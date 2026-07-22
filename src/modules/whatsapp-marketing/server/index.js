import express from "express";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import {
  Campaign,
  CampaignLog,
  connectToMongoDB,
  FormAutomation,
  Template
} from "./modules/storage/mongodb.adapter.js";
import { ensureDefaultAdmin } from "./modules/auth/auth.service.js";
import { parallelLimit, retry, syncLeadsForFormMain } from "./worker.js";
import {
  sendTemplateMessage,
  startScheduler as startBroadcastScheduler
} from "./modules/broadcast/broadcast.service.js";
const APP_TIMEZONE = "Asia/Kolkata";
process.env.TZ = APP_TIMEZONE;
const DRIP_STEP_RETRY_INTERVAL_MS = Number(
  process.env.DRIP_STEP_RETRY_INTERVAL_MS || 6e4
);
const DRIP_STEP_MAX_ATTEMPTS = Number(
  process.env.DRIP_STEP_MAX_ATTEMPTS || 3
);
const DRIP_REQUIRE_PREVIOUS_STEP_SUCCESS = String(process.env.DRIP_REQUIRE_PREVIOUS_STEP_SUCCESS || "false").trim().toLowerCase() === "true";
const DRIP_CAMPAIGN_EXPIRY_GRACE_MS = Math.max(
  0,
  Number(process.env.DRIP_CAMPAIGN_EXPIRY_GRACE_MS || 2 * 6e4)
);
const app = express();
const httpServer = createServer(app);
app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
let cronJobsStarted = false;
const legacyCronScheduleDisabled = (..._args) => {
  console.warn("[Cron] Legacy embedded cron scheduler is disabled; use BullMQ-backed schedulers instead.");
  return null;
};
function getStepDelayMs(step) {
  const delayDays = Number(step?.delayDays ?? 0);
  const delayHours = Number(step?.delayHours ?? 0);
  const delayValue = Number(step?.delay_value ?? 0);
  const delayUnit = step?.delay_unit;
  let totalHours = (Number.isFinite(delayDays) ? delayDays : 0) * 24 + (Number.isFinite(delayHours) ? delayHours : 0);
  if (Number.isFinite(delayValue) && delayValue > 0) {
    if (delayUnit === "minutes") {
      totalHours += delayValue / 60;
    } else if (delayUnit === "hours") {
      totalHours += delayValue;
    } else if (delayUnit === "days") {
      totalHours += delayValue * 24;
    }
  }
  return Math.max(0, totalHours * 60 * 60 * 1e3);
}
function parseSpecificStepDateTime(step) {
  if (!step?.specificDate || !step?.specificTime) return null;
  const specific = /* @__PURE__ */ new Date(`${step.specificDate}T${step.specificTime}:00`);
  if (Number.isNaN(specific.getTime())) return null;
  return specific;
}
function isStepSuccessStatus(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "accepted" || normalized === "sent" || normalized === "delivered" || normalized === "read";
}
function calculateCampaignNextRunAt(step, baseDate = /* @__PURE__ */ new Date()) {
  const specific = parseSpecificStepDateTime(step);
  if (step?.scheduleType === "specific" && specific) {
    return specific;
  }
  const nextRunAt = new Date(baseDate.getTime() + getStepDelayMs(step));
  const preferredTime = step?.specificTime || step?.send_at_time;
  if (preferredTime) {
    const [hours, minutes] = String(preferredTime).split(":").map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      nextRunAt.setHours(hours, minutes, 0, 0);
      if (nextRunAt < baseDate) {
        nextRunAt.setDate(nextRunAt.getDate() + 1);
      }
    }
  }
  return nextRunAt;
}
function getCampaignSpecificEndAt(campaign) {
  const specificTimes = (campaign?.steps || []).map(
    (step) => step?.scheduleType === "specific" ? parseSpecificStepDateTime(step) : null
  ).filter(
    (value) => value instanceof Date && !Number.isNaN(value.getTime())
  );
  if (!specificTimes.length) return null;
  return new Date(Math.max(...specificTimes.map((value) => value.getTime())));
}
async function expireFinishedSpecificCampaigns(now) {
  const runningCampaigns = await Campaign.find({
    status: "running",
    is_active: { $ne: false },
    "steps.scheduleType": "specific"
  });
  for (const campaign of runningCampaigns) {
    const endAt = getCampaignSpecificEndAt(campaign);
    if (!endAt || now.getTime() < endAt.getTime() + DRIP_CAMPAIGN_EXPIRY_GRACE_MS) {
      continue;
    }
    campaign.status = "completed";
    campaign.is_active = false;
    campaign.isProcessing = false;
    campaign.nextRunAt = null;
    await campaign.save();
    console.log(
      `[CAMPAIGN] Auto-completed ${campaign._id}: schedule ended at ${endAt.toISOString()}`
    );
  }
}
function startMongoCronJobs() {
  if (cronJobsStarted) {
    return;
  }
  cronJobsStarted = true;
  let formSyncRunning = false;
  legacyCronScheduleDisabled(
    "*/40 * * * * *",
    async () => {
      if (formSyncRunning) {
        console.log("[FormSync] Skipping run: previous sync is still in progress");
        return;
      }
      formSyncRunning = true;
      try {
        console.log("[FormSync] Running form automation sync");
        const automations = await FormAutomation.find({
          automation_active: true
        });
        for (const automation of automations) {
          await syncLeadsForFormMain(automation);
        }
        console.log(`[FormSync] Synced ${automations.length} forms`);
      } catch (err) {
        console.error("[FormSync] Error:", err);
      } finally {
        formSyncRunning = false;
      }
    },
    { timezone: APP_TIMEZONE }
  );
  const STUCK_TIMEOUT_MIN = 10;
  legacyCronScheduleDisabled(
    "*/12 * * * * *",
    async () => {
      const now = /* @__PURE__ */ new Date();
      try {
        console.log(
          "\n[CRON] Drip job @",
          now.toLocaleString("en-IN", { timeZone: APP_TIMEZONE })
        );
        await expireFinishedSpecificCampaigns(now);
        await Campaign.updateMany(
          {
            isProcessing: true,
            processingStartedAt: {
              $lte: new Date(Date.now() - STUCK_TIMEOUT_MIN * 60 * 1e3)
            }
          },
          { $set: { isProcessing: false } }
        );
        const campaignIds = await Campaign.find(
          {
            status: "running",
            is_active: { $ne: false },
            isProcessing: false,
            $or: [
              { nextRunAt: { $lte: now } },
              { nextRunAt: { $exists: false } },
              { nextRunAt: null }
            ]
          },
          { _id: 1 }
        );
        if (!campaignIds.length) {
          console.log("[CRON] No campaigns to process");
          return;
        }
        console.log(`[CRON] Found ${campaignIds.length} campaigns`);
        for (const { _id } of campaignIds) {
          const campaign = await Campaign.findOneAndUpdate(
            {
              _id,
              isProcessing: false,
              status: "running",
              is_active: { $ne: false },
              $or: [
                { nextRunAt: { $lte: now } },
                { nextRunAt: { $exists: false } },
                { nextRunAt: null }
              ]
            },
            {
              $set: {
                isProcessing: true,
                processingStartedAt: /* @__PURE__ */ new Date()
              }
            },
            { new: true }
          );
          if (!campaign) continue;
          const campaignStart = Date.now();
          try {
            console.log(`[CAMPAIGN] Processing ${campaign._id}`);
            const step = campaign.steps[campaign.currentStep];
            if (!step) {
              campaign.status = "completed";
              await campaign.save();
              continue;
            }
            const stepSpecificRunAt = parseSpecificStepDateTime(step);
            if (step.scheduleType === "specific" && stepSpecificRunAt && now < stepSpecificRunAt) {
              campaign.nextRunAt = stepSpecificRunAt;
              console.log(
                `[CAMPAIGN] Step ${campaign.currentStep + 1} not due yet. Scheduled for ${stepSpecificRunAt.toISOString()}`
              );
              continue;
            }
            let stepAcceptedCount = 0;
            let stepFailedCount = 0;
            await parallelLimit(campaign.contacts, 5, async (contact) => {
              const normalizedContact = String(contact || "").trim();
              const templateCandidates = Array.from(
                new Set(
                  [step.templateId, step.template_id, step.template_name].map((value) => String(value || "").trim()).filter(Boolean)
                )
              );
              let previousAttemptCount = 0;
              try {
                if (DRIP_REQUIRE_PREVIOUS_STEP_SUCCESS) {
                  const previousStepIndex = campaign.currentStep - 1;
                  if (previousStepIndex >= 0) {
                    const previousSuccess = await CampaignLog.findOne({
                      campaignId: campaign._id,
                      stepIndex: previousStepIndex,
                      contact: normalizedContact,
                      status: { $in: ["accepted", "sent", "delivered", "read"] }
                    }).lean();
                    if (!previousSuccess) {
                      await CampaignLog.updateOne(
                        {
                          campaignId: campaign._id,
                          stepIndex: campaign.currentStep,
                          contact: normalizedContact
                        },
                        {
                          $set: {
                            userId: campaign.userId,
                            templateName: String(step.template_name || "").trim() || templateCandidates[0] || "",
                            status: "failed",
                            providerStatus: "skipped_previous_step_failed",
                            failedAt: /* @__PURE__ */ new Date(),
                            error: "Skipped because previous step did not complete successfully",
                            attemptCount: DRIP_STEP_MAX_ATTEMPTS
                          }
                        },
                        { upsert: true }
                      );
                      stepFailedCount++;
                      console.warn(
                        `[SEND] Skipped ${normalizedContact} on step ${campaign.currentStep + 1}: previous step not successful`
                      );
                      return;
                    }
                  }
                }
                const exists = await CampaignLog.findOne({
                  campaignId: campaign._id,
                  stepIndex: campaign.currentStep,
                  contact: normalizedContact
                }).lean();
                previousAttemptCount = Number(exists?.attemptCount || 0);
                if (exists && exists.status !== "failed") return;
                if (exists?.status === "failed" && previousAttemptCount >= DRIP_STEP_MAX_ATTEMPTS) {
                  stepFailedCount++;
                  console.warn(
                    `[SEND] Max retries reached for ${normalizedContact} on step ${campaign.currentStep + 1}`
                  );
                  return;
                }
                console.log("contact is", normalizedContact, step.template_name);
                if (templateCandidates.length === 0) {
                  throw new Error("Template reference missing on campaign step");
                }
                const templatedetail = await Template.findOne({
                  $or: templateCandidates.flatMap((candidate) => [
                    { id: candidate },
                    { name: candidate }
                  ])
                });
                if (!templatedetail) {
                  throw new Error(
                    `Template not found for step reference: ${templateCandidates.join(
                      ", "
                    )}`
                  );
                }
                const template_name = templatedetail.name;
                const sendResult = await retry(
                  () => sendTemplateMessage(normalizedContact, template_name, void 0, {
                    allowLanguageFallback: false
                  }, campaign.userId || void 0)
                );
                if (!sendResult?.success) {
                  const sendError = sendResult?.error || "Template send failed";
                  await CampaignLog.updateOne(
                    {
                      campaignId: campaign._id,
                      stepIndex: campaign.currentStep,
                      contact: normalizedContact
                    },
                    {
                      $set: {
                        userId: campaign.userId,
                        templateName: template_name,
                        messageId: sendResult?.messageId || void 0,
                        status: "failed",
                        providerStatus: sendResult?.provider_status || "failed",
                        failedAt: /* @__PURE__ */ new Date(),
                        error: sendError,
                        sendAttemptedAt: /* @__PURE__ */ new Date(),
                        attemptedLanguage: sendResult?.attempted_language || void 0,
                        providerHttpStatus: typeof sendResult?.provider_http_status === "number" ? sendResult.provider_http_status : void 0,
                        providerErrorCode: sendResult?.provider_error_code ? String(sendResult.provider_error_code) : void 0,
                        requestPayload: sendResult?.request_payload || null,
                        providerResponse: sendResult?.provider_response || null,
                        metaAccepted: false,
                        metaAcceptedAt: null,
                        attemptCount: previousAttemptCount + 1
                      }
                    },
                    { upsert: true }
                  );
                  stepFailedCount++;
                  console.error(`[SEND ERROR]`, normalizedContact, sendError);
                  return;
                }
                const providerStatus = String(
                  sendResult.provider_status || "accepted"
                );
                const normalizedStatus = providerStatus === "read" ? "read" : providerStatus === "delivered" ? "delivered" : "accepted";
                await CampaignLog.updateOne(
                  {
                    campaignId: campaign._id,
                    stepIndex: campaign.currentStep,
                    contact: normalizedContact
                  },
                  {
                    $set: {
                      userId: campaign.userId,
                      templateName: template_name,
                      messageId: sendResult.messageId || void 0,
                      status: normalizedStatus,
                      providerStatus,
                      sentAt: /* @__PURE__ */ new Date(),
                      sendAttemptedAt: /* @__PURE__ */ new Date(),
                      attemptedLanguage: sendResult.attempted_language || void 0,
                      providerHttpStatus: typeof sendResult.provider_http_status === "number" ? sendResult.provider_http_status : void 0,
                      providerErrorCode: sendResult.provider_error_code ? String(sendResult.provider_error_code) : void 0,
                      requestPayload: sendResult.request_payload || null,
                      providerResponse: sendResult.provider_response || null,
                      metaAccepted: Boolean(sendResult.messageId),
                      metaAcceptedAt: sendResult.messageId ? /* @__PURE__ */ new Date() : null,
                      failedAt: null,
                      error: null,
                      attemptCount: previousAttemptCount + 1
                    }
                  },
                  { upsert: true }
                );
                stepAcceptedCount++;
                console.log(
                  `[SEND] ${providerStatus} to ${normalizedContact} | messageId=${sendResult.messageId || "n/a"}`
                );
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown send error";
                await CampaignLog.updateOne(
                  {
                    campaignId: campaign._id,
                    stepIndex: campaign.currentStep,
                    contact: normalizedContact
                  },
                  {
                    $set: {
                      userId: campaign.userId,
                      templateName: String(step.template_name || "").trim() || templateCandidates[0] || "",
                      status: "failed",
                      providerStatus: "failed",
                      failedAt: /* @__PURE__ */ new Date(),
                      error: errorMessage,
                      sendAttemptedAt: /* @__PURE__ */ new Date(),
                      metaAccepted: false,
                      metaAcceptedAt: null,
                      attemptCount: previousAttemptCount + 1
                    }
                  },
                  { upsert: true }
                );
                stepFailedCount++;
                console.error(`[SEND ERROR]`, normalizedContact, errorMessage);
              }
            });
            const stepLogs = await CampaignLog.find({
              campaignId: campaign._id,
              stepIndex: campaign.currentStep
            }).lean();
            const contactStates = (campaign.contacts || []).map((rawContact) => {
              const normalizedContact = String(rawContact || "").trim();
              const log = stepLogs.find(
                (row) => String(row.contact || "") === normalizedContact
              );
              const success = Boolean(log && isStepSuccessStatus(log.status));
              const terminalFail = Boolean(
                log && String(log.status) === "failed" && Number(log.attemptCount || 0) >= DRIP_STEP_MAX_ATTEMPTS
              );
              return { normalizedContact, success, terminalFail };
            });
            const successfulContacts = contactStates.filter(
              (state) => state.success
            );
            const terminalFailedContacts = contactStates.filter(
              (state) => state.terminalFail
            );
            const pendingContacts = contactStates.filter(
              (state) => !state.success && !state.terminalFail
            );
            if (pendingContacts.length === 0) {
              campaign.currentStep++;
              const nextStep = campaign.steps[campaign.currentStep];
              if (!nextStep) {
                campaign.status = "completed";
                campaign.is_active = false;
                campaign.nextRunAt = null;
              } else {
                campaign.nextRunAt = calculateCampaignNextRunAt(nextStep, now);
              }
              continue;
            }
            if (successfulContacts.length === 0 && terminalFailedContacts.length === contactStates.length) {
              campaign.status = "failed";
              campaign.is_active = false;
              campaign.nextRunAt = null;
              console.error(
                `[CAMPAIGN] Marked failed: step ${campaign.currentStep + 1} has terminal contact failures`
              );
              continue;
            }
            campaign.nextRunAt = new Date(now.getTime() + DRIP_STEP_RETRY_INTERVAL_MS);
            console.log(
              `[CAMPAIGN] Step ${campaign.currentStep + 1} partially sent (${successfulContacts.length}/${campaign.contacts.length}). Retrying failed contacts at ${campaign.nextRunAt.toISOString()}`
            );
          } catch (err) {
            console.error(`[CAMPAIGN ERROR] ${campaign._id}`, err);
          } finally {
            campaign.isProcessing = false;
            await campaign.save();
            console.log(
              `[CAMPAIGN] Done ${campaign._id} in ${Date.now() - campaignStart}ms`
            );
          }
        }
      } catch (err) {
        console.error("[CRON] Fatal drip error:", err);
      }
    },
    { timezone: APP_TIMEZONE }
  );
  console.log("[Cron] Background cron jobs started");
}
let postListenStartupStarted = false;
async function runPostListenStartupTasks() {
  if (postListenStartupStarted) {
    return;
  }
  postListenStartupStarted = true;
  const mongoConfigured = Boolean(process.env.MONGODB_URL);
  if (!mongoConfigured) {
    console.warn("[Startup] Skipping DB init: MONGODB_URL is not configured");
    return;
  }
  try {
    console.log("[Startup] Initializing database and background jobs...");
    await connectToMongoDB();
    await ensureDefaultAdmin();
    await startBroadcastScheduler();
    console.warn("[Startup] Legacy Mongo cron jobs are disabled; use BullMQ-backed schedulers instead.");
    console.log("[Startup] Database and background jobs ready");
  } catch (err) {
    console.error("[Startup] Post-listen initialization failed:", err);
  }
}
(async () => {
  await registerRoutes(httpServer, app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status === 413) {
      return res.status(413).json({
        message: "Request payload too large. Please reduce contacts or split into smaller campaign batches."
      });
    }
    res.status(status).json({ message: err.message || "Server Error" });
  });
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }
  const defaultPort = 8080;
  const requestedPort = parseInt(process.env.PORT || `${defaultPort}`, 10);
  const hasExplicitPort = Boolean(process.env.PORT);
  const bindHost = "0.0.0.0";
  const startServer = (port, retries = 0) => {
    const onListening = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
      console.log(`[Startup] Server running on ${bindHost}:${port}`);
      console.log(`[Startup] Bound host ${bindHost}:${port}`);
      console.log(`[Startup] Timezone: ${process.env.TZ}`);
      void runPostListenStartupTasks();
    };
    const onError = (err) => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
      if (!hasExplicitPort && err.code === "EADDRINUSE" && retries < 10) {
        const nextPort = 8082;
        console.warn(`[Server] Port ${port} is in use, trying ${nextPort}`);
        startServer(nextPort, retries + 1);
        return;
      }
      console.error(`[Server] Failed to start on port ${port}:`, err);
      process.exit(1);
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen({ port, host: bindHost });
  };
  startServer(requestedPort);
})();
