import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import { dispatchCampaignJob } from './campaignDispatchService.js';

const MAX_TIMER_DELAY = 2_147_000_000;
const MAX_ATTEMPTS = 3;
const scheduledJobs = new Map();

const jobId = ({ campaignId, runNumber, stepIndex }) =>
  `email-${campaignId}-run-${runNumber}-step-${stepIndex}`;

const clearScheduledJob = (id) => {
  const job = scheduledJobs.get(id);
  if (job?.timer) clearTimeout(job.timer);
  scheduledJobs.delete(id);
};

const markCampaignFailed = async (data, error) => {
  await EmailMarketingCampaign.updateOne(
    {
      _id: data.campaignId,
      workspaceId: data.workspaceId,
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
};

const runCampaignJob = async (id, data, attempt = 1) => {
  scheduledJobs.delete(id);
  try {
    const next = await dispatchCampaignJob(data);
    if (next) {
      await scheduleCampaignDelivery({
        campaignId: data.campaignId,
        workspaceId: data.workspaceId,
        runAt: next.nextRunAt,
        runNumber: next.runNumber,
        stepIndex: next.nextStepIndex,
      });
    }
  } catch (error) {
    console.error(
      `[EmailMarketingScheduler] Job ${id} attempt ${attempt} failed:`,
      error.message,
    );
    if (attempt < MAX_ATTEMPTS) {
      scheduleTimer(
        id,
        data,
        new Date(Date.now() + 10_000 * 2 ** (attempt - 1)),
        attempt + 1,
      );
      return;
    }
    await markCampaignFailed(data, error);
  }
};

const scheduleTimer = (id, data, runAt, attempt = 1) => {
  clearScheduledJob(id);
  const targetTime = new Date(runAt).getTime();
  const arm = () => {
    const remaining = targetTime - Date.now();
    if (remaining > MAX_TIMER_DELAY) {
      const timer = setTimeout(arm, MAX_TIMER_DELAY);
      scheduledJobs.set(id, { timer, data, runAt: new Date(targetTime) });
      return;
    }
    const timer = setTimeout(
      () => void runCampaignJob(id, data, attempt),
      Math.max(0, remaining),
    );
    scheduledJobs.set(id, { timer, data, runAt: new Date(targetTime) });
  };
  arm();
};

// Campaign scheduling is always available through the backend-managed scheduler.
// MongoDB stores the durable schedule and startEmailMarketingRuntime restores it.
export const isEmailQueueConfigured = () => true;

export const scheduleCampaignDelivery = async ({
  campaignId,
  workspaceId,
  runAt,
  runNumber = 1,
  stepIndex = -1,
}) => {
  const data = { campaignId, workspaceId, runNumber, stepIndex };
  const id = jobId(data);
  scheduleTimer(id, data, runAt);
  return id;
};

export const cancelCampaignDelivery = async (campaign) => {
  for (const [id, job] of scheduledJobs.entries()) {
    if (String(job.data.campaignId) === String(campaign._id)) {
      clearScheduledJob(id);
    }
  }
};

export const startEmailMarketingRuntime = async () => {
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
    `[EmailMarketingScheduler] Runtime started; restored ${scheduled.length} job(s)`,
  );
  return true;
};

export const stopEmailMarketingRuntime = async () => {
  for (const id of [...scheduledJobs.keys()]) clearScheduledJob(id);
};
