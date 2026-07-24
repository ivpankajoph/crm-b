import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import { executeAutomation } from './automationService.js';

const MAX_TIMER_DELAY = 2_147_000_000;
const scheduledExecutions = new Map();

const executionJobId = (executionId) =>
  `automation-execution-${executionId}`;

const clearScheduledExecution = (id) => {
  const job = scheduledExecutions.get(id);
  if (job?.timer) clearTimeout(job.timer);
  scheduledExecutions.delete(id);
};

const markExecutionFailed = async (data, error) => {
  const execution = await EmailMarketingAutomationExecution.findOneAndUpdate(
    {
      _id: data.executionId,
      workspaceId: data.workspaceId,
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
};

const runAutomationJob = async (id, data) => {
  scheduledExecutions.delete(id);
  try {
    const next = await executeAutomation(data);
    if (next?.nextRunAt) {
      await scheduleAutomationExecution({ ...data, runAt: next.nextRunAt });
    }
  } catch (error) {
    console.error(
      `[EmailMarketingAutomationScheduler] Job ${id} failed:`,
      error.message,
    );
    await markExecutionFailed(data, error);
  }
};

const scheduleTimer = (id, data, runAt) => {
  clearScheduledExecution(id);
  const targetTime = new Date(runAt).getTime();
  const arm = () => {
    const remaining = targetTime - Date.now();
    if (remaining > MAX_TIMER_DELAY) {
      const timer = setTimeout(arm, MAX_TIMER_DELAY);
      scheduledExecutions.set(id, { timer, data, runAt: new Date(targetTime) });
      return;
    }
    const timer = setTimeout(
      () => void runAutomationJob(id, data),
      Math.max(0, remaining),
    );
    scheduledExecutions.set(id, { timer, data, runAt: new Date(targetTime) });
  };
  arm();
};

export const isAutomationQueueConfigured = () => true;

export const scheduleAutomationExecution = async ({
  executionId,
  workspaceId,
  runAt = new Date(),
}) => {
  const data = { executionId, workspaceId };
  const id = executionJobId(executionId);
  scheduleTimer(id, data, runAt);
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
  await Promise.all(
    [...scheduledExecutions.entries()].map(async ([id, job]) => {
      if (String(job.data.workspaceId) !== String(workspaceId)) return;
      const execution = await EmailMarketingAutomationExecution.findOne({
        _id: job.data.executionId,
        workspaceId,
        automationId,
      })
        .select('_id')
        .lean();
      if (execution) clearScheduledExecution(id);
    }),
  );
};

export const startEmailMarketingAutomationRuntime = async () => {
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
    `[EmailMarketingAutomationScheduler] Runtime started; restored ${pending.length} execution(s)`,
  );
  return true;
};

export const stopEmailMarketingAutomationRuntime = async () => {
  for (const id of [...scheduledExecutions.keys()]) {
    clearScheduledExecution(id);
  }
};
