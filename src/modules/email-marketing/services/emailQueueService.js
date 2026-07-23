import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import { dispatchCampaignJob } from './campaignDispatchService.js';

const QUEUE_NAME = 'crm-email-marketing-campaigns';
const JOB_NAME = 'dispatch-campaign';
let connection;
let queue;
let worker;

const configError = (message) =>
  Object.assign(new Error(message), { statusCode: 503 });

export const isEmailQueueConfigured = () => {
  const config = getEmailMarketingConfig();
  return Boolean(
    config.sendingEnabled && config.queueEnabled && config.redisUrl,
  );
};

const getConnection = () => {
  const config = getEmailMarketingConfig();
  if (!isEmailQueueConfigured()) {
    throw configError(
      'Campaign queue requires sending, queue, and Redis configuration',
    );
  }
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (error) => {
      console.error('[EmailMarketingQueue] Redis error:', error.message);
    });
  }
  return connection;
};

const getQueue = () => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
};

const jobId = ({ campaignId, runNumber, stepIndex }) =>
  `email-${campaignId}-run-${runNumber}-step-${stepIndex}`;

export const scheduleCampaignDelivery = async ({
  campaignId,
  workspaceId,
  runAt,
  runNumber = 1,
  stepIndex = -1,
}) => {
  const campaignQueue = getQueue();
  const id = jobId({ campaignId, runNumber, stepIndex });
  const existing = await campaignQueue.getJob(id);
  if (existing) await existing.remove().catch(() => undefined);
  await campaignQueue.add(
    JOB_NAME,
    { campaignId, workspaceId, runNumber, stepIndex },
    {
      jobId: id,
      delay: Math.max(0, new Date(runAt).getTime() - Date.now()),
    },
  );
  return id;
};

export const cancelCampaignDelivery = async (campaign) => {
  if (!isEmailQueueConfigured()) return;
  const campaignQueue = getQueue();
  const jobs = await campaignQueue.getJobs([
    'delayed',
    'waiting',
    'prioritized',
    'paused',
  ]);
  await Promise.all(
    jobs
      .filter((job) => String(job.data.campaignId) === String(campaign._id))
      .map((job) => job.remove().catch(() => undefined)),
  );
};

export const startEmailMarketingRuntime = async () => {
  if (!isEmailQueueConfigured()) return false;
  if (!worker) {
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        if (job.name !== JOB_NAME) return null;
        const next = await dispatchCampaignJob(job.data);
        if (next) {
          await scheduleCampaignDelivery({
            campaignId: job.data.campaignId,
            workspaceId: job.data.workspaceId,
            runAt: next.nextRunAt,
            runNumber: next.runNumber,
            stepIndex: next.nextStepIndex,
          });
        }
        return next;
      },
      {
        connection: getConnection(),
        concurrency: Math.max(1, getEmailMarketingConfig().sendConcurrency),
      },
    );
    worker.on('failed', async (job, error) => {
      console.error(
        `[EmailMarketingQueue] Job ${job?.id || 'unknown'} failed:`,
        error.message,
      );
      if (job && job.attemptsMade >= Number(job.opts.attempts || 1)) {
        await EmailMarketingCampaign.updateOne(
          {
            _id: job.data.campaignId,
            workspaceId: job.data.workspaceId,
          },
          {
            $set: {
              status: 'failed',
              processing: false,
              processingStartedAt: null,
              lastError: error.message,
            },
          },
        );
      }
    });
  }

  const scheduled = await EmailMarketingCampaign.find({
    status: { $in: ['scheduled', 'active'] },
    scheduledAt: { $ne: null },
  })
    .select('_id workspaceId scheduledAt type currentDripStep recurrenceRunCount')
    .lean();
  for (const campaign of scheduled) {
    await scheduleCampaignDelivery({
      campaignId: campaign._id,
      workspaceId: campaign.workspaceId,
      runAt: campaign.scheduledAt,
      runNumber: Math.max(1, Number(campaign.recurrenceRunCount || 0) + 1),
      stepIndex:
        campaign.type === 'drip_campaign' ? campaign.currentDripStep : -1,
    });
  }
  console.log(
    `[EmailMarketingQueue] Runtime started; restored ${scheduled.length} job(s)`,
  );
  return true;
};

export const stopEmailMarketingRuntime = async () => {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
};
