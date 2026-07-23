import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import { executeAutomation } from './automationService.js';

const QUEUE_NAME = 'crm-email-marketing-automations';
const JOB_NAME = 'execute-automation';
let connection;
let queue;
let worker;

const configError = (message) =>
  Object.assign(new Error(message), { statusCode: 503 });

export const isAutomationQueueConfigured = () => {
  const config = getEmailMarketingConfig();
  return Boolean(
    config.sendingEnabled && config.queueEnabled && config.redisUrl,
  );
};

const getConnection = () => {
  const config = getEmailMarketingConfig();
  if (!isAutomationQueueConfigured()) {
    throw configError(
      'Automation execution requires sending, queue, and Redis configuration',
    );
  }
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (error) => {
      console.error('[EmailMarketingAutomationQueue] Redis error:', error.message);
    });
  }
  return connection;
};

const getQueue = () => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
};

export const scheduleAutomationExecution = async ({
  executionId,
  workspaceId,
  runAt = new Date(),
}) => {
  const automationQueue = getQueue();
  const id = `automation-execution-${executionId}`;
  const existing = await automationQueue.getJob(id);
  if (existing) await existing.remove().catch(() => undefined);
  await automationQueue.add(
    JOB_NAME,
    { executionId, workspaceId },
    {
      jobId: id,
      delay: Math.max(0, new Date(runAt).getTime() - Date.now()),
    },
  );
  return id;
};

export const cancelAutomationExecutions = async (automationId, workspaceId) => {
  await EmailMarketingAutomationExecution.updateMany(
    {
      workspaceId,
      automationId,
      status: { $in: ['pending', 'running'] },
    },
    {
      $set: {
        status: 'cancelled',
        completedAt: new Date(),
        scheduledFor: null,
      },
    },
  );
  if (!isAutomationQueueConfigured()) return;
  const jobs = await getQueue().getJobs(['delayed', 'waiting', 'prioritized']);
  await Promise.all(
    jobs
      .filter((job) => String(job.data.workspaceId) === String(workspaceId))
      .map(async (job) => {
        const execution = await EmailMarketingAutomationExecution.findOne({
          _id: job.data.executionId,
          workspaceId,
          automationId,
        })
          .select('_id')
          .lean();
        if (execution) await job.remove().catch(() => undefined);
      }),
  );
};

export const startEmailMarketingAutomationRuntime = async () => {
  if (!isAutomationQueueConfigured()) return false;
  if (!worker) {
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        if (job.name !== JOB_NAME) return null;
        const next = await executeAutomation(job.data);
        if (next?.nextRunAt) {
          await scheduleAutomationExecution({
            ...job.data,
            runAt: next.nextRunAt,
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
        `[EmailMarketingAutomationQueue] Job ${job?.id || 'unknown'} failed:`,
        error.message,
      );
      if (job) {
        const execution = await EmailMarketingAutomationExecution.findOneAndUpdate(
          {
            _id: job.data.executionId,
            workspaceId: job.data.workspaceId,
            status: { $in: ['pending', 'running'] },
          },
          {
            $set: {
              status: 'failed',
              completedAt: new Date(),
              scheduledFor: null,
              lastError: error.message,
            },
          },
          { new: true },
        );
        if (execution) {
          await EmailMarketingAutomation.updateOne(
            {
              _id: execution.automationId,
              workspaceId: execution.workspaceId,
            },
            { $inc: { failedCount: 1 }, $set: { lastRunAt: new Date() } },
          );
        }
      }
    });
  }

  const pending = await EmailMarketingAutomationExecution.find({
    status: { $in: ['pending', 'running'] },
  })
    .select('_id workspaceId scheduledFor')
    .lean();
  for (const execution of pending) {
    await scheduleAutomationExecution({
      executionId: execution._id,
      workspaceId: execution.workspaceId,
      runAt: execution.scheduledFor || new Date(),
    });
  }
  console.log(
    `[EmailMarketingAutomationQueue] Runtime started; restored ${pending.length} execution(s)`,
  );
  return true;
};

export const stopEmailMarketingAutomationRuntime = async () => {
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
