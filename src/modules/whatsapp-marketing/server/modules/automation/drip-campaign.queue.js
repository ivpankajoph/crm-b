import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import {
  Campaign,
  CampaignLog,
  connectToMongoDB,
  Template
} from "../storage/mongodb.adapter.js";
import { sendTemplateMessage } from "../broadcast/broadcast.service.js";
const QUEUE_NAME = "whatsapp-drip-campaigns";
const JOB_NAME = "run-campaign-step";
const DEFAULT_TIMEZONE = "Asia/Kolkata";
process.env.TZ = DEFAULT_TIMEZONE;
const CONTACT_CONCURRENCY = Math.max(
  1,
  Number(process.env.DRIP_CONTACT_CONCURRENCY || 5)
);
const WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.DRIP_WORKER_CONCURRENCY || 2)
);
const RETRY_DELAY_MS = Math.max(
  1e4,
  Number(process.env.DRIP_STEP_RETRY_INTERVAL_MS || 6e4)
);
const MAX_CONTACT_ATTEMPTS = Math.max(
  1,
  Number(process.env.DRIP_STEP_MAX_ATTEMPTS || 3)
);
let connection = null;
let queue = null;
let worker = null;
function getRedisUrl() {
  const explicitUrl = String(process.env.REDIS_URL || "").trim();
  if (explicitUrl) return explicitUrl;
  const host = String(process.env.REDIS_HOST || "").trim();
  if (!host) return "";
  const port = String(process.env.REDIS_PORT || "6379").trim() || "6379";
  const password = String(process.env.REDIS_PASSWORD || "").trim();
  const auth = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${auth}${host}:${port}`;
}
function getRedisConnection() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    connection.on("error", (error) => {
      console.error("[DripQueue] Redis error:", error?.message || error);
    });
  }
  return connection;
}
function getQueue() {
  const redis = getRedisConnection();
  if (!redis) return null;
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5e3 },
        removeOnComplete: 500,
        removeOnFail: 1e3
      }
    });
  }
  return queue;
}
function jobId(campaignId, stepIndex, runAt) {
  return `drip-${campaignId}-step-${stepIndex}-${runAt.getTime()}`;
}
function contactPhone(contact) {
  const raw = typeof contact === "object" && contact ? contact.phone || contact.whatsappNumber || contact.whatsapp || "" : contact;
  return String(raw || "").replace(/\D/g, "");
}
function contactName(contact) {
  if (typeof contact !== "object" || !contact) return void 0;
  const name = String(contact.name || "").trim();
  return name || void 0;
}
function parseSpecificDateTime(step) {
  if (!step?.specificDate || !step?.specificTime) return null;
  const value = /* @__PURE__ */ new Date(`${step.specificDate}T${step.specificTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}
function stepDelayMs(step) {
  const days = Math.max(0, Number(step?.delayDays || 0));
  const hours = Math.max(0, Number(step?.delayHours || 0));
  const minutes = Math.max(0, Number(step?.delayMinutes || 0));
  return (days * 24 * 60 + hours * 60 + minutes) * 6e4;
}
function getStepRunAt(step, baseDate = /* @__PURE__ */ new Date()) {
  const specific = parseSpecificDateTime(step);
  if (step?.scheduleType === "specific" && specific) return specific;
  return new Date(baseDate.getTime() + stepDelayMs(step));
}
async function parallelLimit(items, limit, handler) {
  const executing = /* @__PURE__ */ new Set();
  for (const item of items) {
    const promise = handler(item).finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
}
async function processCampaignStep(job) {
  const { campaignId, stepIndex } = job.data;
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== "running" || campaign.is_active === false) {
    return;
  }
  if (Number(campaign.currentStep || 0) !== stepIndex) return;
  const step = campaign.steps?.[stepIndex];
  if (!step) {
    campaign.status = "completed";
    campaign.is_active = false;
    campaign.nextRunAt = null;
    await campaign.save();
    return;
  }
  const specificAt = parseSpecificDateTime(step);
  if (specificAt && Date.now() < specificAt.getTime()) {
    await scheduleDripCampaignStep(campaignId, stepIndex, specificAt);
    return;
  }
  const claimed = await Campaign.findOneAndUpdate(
    {
      _id: campaignId,
      currentStep: stepIndex,
      status: "running",
      is_active: { $ne: false },
      isProcessing: { $ne: true }
    },
    {
      $set: {
        isProcessing: true,
        processingStartedAt: /* @__PURE__ */ new Date()
      }
    },
    { new: true }
  );
  if (!claimed) return;
  try {
    const templateCandidates = Array.from(
      new Set(
        [step.templateId, step.template_id, step.template_name].map((value) => String(value || "").trim()).filter(Boolean)
      )
    );
    const template = await Template.findOne({
      $or: templateCandidates.flatMap((candidate) => [
        { id: candidate },
        { name: candidate }
      ])
    }).lean();
    if (!template) {
      throw new Error(`Template not found: ${templateCandidates.join(", ")}`);
    }
    await parallelLimit(
      Array.isArray(claimed.contacts) ? claimed.contacts : [],
      CONTACT_CONCURRENCY,
      async (contact) => {
        const phone = contactPhone(contact);
        if (!phone) return;
        const existing = await CampaignLog.findOne({
          campaignId: claimed._id,
          stepIndex,
          contact: phone
        }).lean();
        if (existing && ["accepted", "sent", "delivered", "read"].includes(existing.status)) {
          return;
        }
        const attemptCount = Number(existing?.attemptCount || 0);
        if (attemptCount >= MAX_CONTACT_ATTEMPTS) return;
        const result = await sendTemplateMessage(
          phone,
          template.name,
          contactName(contact),
          { allowLanguageFallback: false },
          claimed.userId || void 0
        );
        const providerStatus = String(
          result?.provider_status || (result?.success ? "accepted" : "failed")
        ).toLowerCase();
        const status = result?.success ? providerStatus === "read" ? "read" : providerStatus === "delivered" ? "delivered" : "accepted" : "failed";
        await CampaignLog.updateOne(
          {
            campaignId: claimed._id,
            stepIndex,
            contact: phone
          },
          {
            $set: {
              userId: claimed.userId,
              templateName: template.name,
              messageId: result?.messageId || void 0,
              status,
              providerStatus,
              sentAt: result?.success ? /* @__PURE__ */ new Date() : null,
              failedAt: result?.success ? null : /* @__PURE__ */ new Date(),
              sendAttemptedAt: /* @__PURE__ */ new Date(),
              error: result?.success ? null : result?.error || "Template send failed",
              attemptCount: attemptCount + 1,
              providerHttpStatus: result?.provider_http_status || void 0,
              providerErrorCode: result?.provider_error_code ? String(result.provider_error_code) : void 0,
              requestPayload: result?.request_payload || null,
              providerResponse: result?.provider_response || null,
              metaAccepted: Boolean(result?.success && result?.messageId),
              metaAcceptedAt: result?.success && result?.messageId ? /* @__PURE__ */ new Date() : null
            }
          },
          { upsert: true }
        );
      }
    );
    const logs = await CampaignLog.find({
      campaignId: claimed._id,
      stepIndex
    }).lean();
    const stateByPhone = new Map(logs.map((log) => [String(log.contact), log]));
    const pending = (claimed.contacts || []).some((contact) => {
      const log = stateByPhone.get(contactPhone(contact));
      if (!log) return true;
      if (["accepted", "sent", "delivered", "read"].includes(log.status)) return false;
      return Number(log.attemptCount || 0) < MAX_CONTACT_ATTEMPTS;
    });
    if (pending) {
      const retryAt = new Date(Date.now() + RETRY_DELAY_MS);
      claimed.nextRunAt = retryAt;
      await scheduleDripCampaignStep(campaignId, stepIndex, retryAt);
      return;
    }
    claimed.currentStep = stepIndex + 1;
    const nextStep = claimed.steps?.[claimed.currentStep];
    if (!nextStep) {
      claimed.status = "completed";
      claimed.is_active = false;
      claimed.nextRunAt = null;
    } else {
      const nextRunAt = getStepRunAt(nextStep, /* @__PURE__ */ new Date());
      claimed.nextRunAt = nextRunAt;
      await scheduleDripCampaignStep(campaignId, claimed.currentStep, nextRunAt);
    }
  } finally {
    claimed.isProcessing = false;
    await claimed.save();
  }
}
function startWorker() {
  const redis = getRedisConnection();
  if (!redis || worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) return;
      await processCampaignStep(job);
    },
    { connection: redis, concurrency: WORKER_CONCURRENCY }
  );
  worker.on("failed", (job, error) => {
    console.error(
      `[DripQueue] Job ${job?.id || "unknown"} failed:`,
      error?.message || error
    );
  });
  console.log(
    `[DripQueue] Worker started (timezone=${DEFAULT_TIMEZONE}, concurrency=${WORKER_CONCURRENCY})`
  );
}
function isDripQueueConfigured() {
  return Boolean(getRedisUrl());
}
async function scheduleDripCampaignStep(campaignId, stepIndex, runAt) {
  const dripQueue = getQueue();
  if (!dripQueue) {
    throw new Error("REDIS_URL is required to run drip campaigns");
  }
  startWorker();
  const pendingJobs = await dripQueue.getJobs([
    "delayed",
    "waiting",
    "prioritized",
    "paused"
  ]);
  await Promise.all(
    pendingJobs.filter(
      (job) => job.data.campaignId === campaignId && Number(job.data.stepIndex) === Number(stepIndex)
    ).map((job) => job.remove().catch(() => void 0))
  );
  const id = jobId(campaignId, stepIndex, runAt);
  const existing = await dripQueue.getJob(id);
  if (existing) await existing.remove().catch(() => void 0);
  await dripQueue.add(
    JOB_NAME,
    { campaignId, stepIndex },
    {
      jobId: id,
      delay: Math.max(0, runAt.getTime() - Date.now())
    }
  );
}
async function cancelDripCampaignJobs(campaignId) {
  const dripQueue = getQueue();
  if (!dripQueue) return;
  const pendingJobs = await dripQueue.getJobs([
    "delayed",
    "waiting",
    "prioritized",
    "paused"
  ]);
  await Promise.all(
    pendingJobs.filter((job) => job.data.campaignId === campaignId).map((job) => job.remove().catch(() => void 0))
  );
}
async function scheduleRunningDripCampaigns() {
  if (!isDripQueueConfigured()) return;
  await connectToMongoDB();
  if (mongoose.connection.readyState !== 1) {
    console.warn("[DripQueue] Skipping bootstrap: MongoDB is not connected");
    return;
  }
  const campaigns = await Campaign.find({
    status: "running",
    is_active: { $ne: false },
    nextRunAt: { $ne: null }
  }).lean();
  let scheduled = 0;
  for (const campaign of campaigns) {
    const stepIndex = Number(campaign?.currentStep || 0);
    const step = campaign?.steps?.[stepIndex];
    const nextRunAt = campaign?.nextRunAt ? new Date(campaign.nextRunAt) : null;
    if (!step || !nextRunAt || Number.isNaN(nextRunAt.getTime())) continue;
    await scheduleDripCampaignStep(String(campaign._id), stepIndex, nextRunAt);
    scheduled++;
  }
  console.log(`[DripQueue] Bootstrapped ${scheduled} running drip campaign job(s)`);
}
startWorker();
export {
  cancelDripCampaignJobs,
  getStepRunAt,
  isDripQueueConfigured,
  scheduleDripCampaignStep,
  scheduleRunningDripCampaigns
};
