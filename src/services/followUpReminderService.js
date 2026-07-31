import FollowUp from '../models/FollowUp.js';
import { emitToUsers } from './realtimeService.js';

const MAX_TIMER_DELAY = 2_147_000_000;
const REPEAT_INTERVAL_MS = Math.max(60_000, Number(process.env.FOLLOW_UP_REPEAT_INTERVAL_MS || 300_000));
const RECOVERY_INTERVAL_MS = Math.max(30_000, Number(process.env.FOLLOW_UP_RECOVERY_INTERVAL_MS || 60_000));
const scheduledJobs = new Map();
let recoveryTimer;

const jobId = (followUpId) => `follow-up-${followUpId}`;

const clearScheduledJob = (id) => {
  const job = scheduledJobs.get(id);
  if (job?.timer) clearTimeout(job.timer);
  scheduledJobs.delete(id);
};

export const followUpReminderPayload = (followUp) => ({
  _id: followUp._id.toString(),
  leadId: followUp.lead.toString(),
  companyName: followUp.companyName,
  message: followUp.message,
  type: followUp.type,
  priority: followUp.priority,
  followUpDateTime: followUp.followUpDateTime,
  nextReminderAt: followUp.nextReminderAt,
  reminderCount: followUp.reminderCount,
});

const runReminder = async (id, followUpId) => {
  scheduledJobs.delete(id);
  const now = new Date();
  const nextReminderAt = new Date(now.getTime() + REPEAT_INTERVAL_MS);
  try {
    const followUp = await FollowUp.findOneAndUpdate(
      {
        _id: followUpId,
        status: { $in: ['Pending', 'Snoozed'] },
        nextReminderAt: { $lte: now },
      },
      {
        $set: {
          status: 'Pending',
          lastRemindedAt: now,
          nextReminderAt,
          snoozedUntil: null,
        },
        $inc: { reminderCount: 1 },
      },
      { new: true },
    ).lean();

    if (!followUp) return;
    emitToUsers(followUp.assignedTo, 'follow_up_reminder', followUpReminderPayload(followUp));
    await scheduleFollowUpReminder(followUp._id, followUp.nextReminderAt);
  } catch (error) {
    console.error(`[FollowUpScheduler] Reminder ${followUpId} failed:`, error.message);
    await scheduleFollowUpReminder(followUpId, new Date(Date.now() + 60_000));
  }
};

const scheduleTimer = (id, followUpId, runAt) => {
  clearScheduledJob(id);
  const targetTime = new Date(runAt).getTime();
  const arm = () => {
    const remaining = targetTime - Date.now();
    if (remaining > MAX_TIMER_DELAY) {
      const timer = setTimeout(arm, MAX_TIMER_DELAY);
      timer.unref?.();
      scheduledJobs.set(id, { timer, followUpId, runAt: new Date(targetTime) });
      return;
    }
    const timer = setTimeout(
      () => void runReminder(id, followUpId),
      Math.max(0, remaining),
    );
    timer.unref?.();
    scheduledJobs.set(id, { timer, followUpId, runAt: new Date(targetTime) });
  };
  arm();
};

export const scheduleFollowUpReminder = async (followUpId, runAt) => {
  const id = jobId(followUpId);
  scheduleTimer(id, followUpId, runAt);
  return id;
};

export const cancelFollowUpReminder = async (followUpId) => {
  clearScheduledJob(jobId(followUpId));
};

const reconcileDueFollowUps = async () => {
  const now = new Date();
  const pending = await FollowUp.find({
    status: { $in: ['Pending', 'Snoozed'] },
    nextReminderAt: { $lte: now },
  })
    .select('_id nextReminderAt')
    .limit(500)
    .lean();
  for (let index = 0; index < pending.length; index += 20) {
    await Promise.all(pending.slice(index, index + 20).map((followUp) => (
      scheduledJobs.has(jobId(followUp._id))
        ? Promise.resolve()
        : scheduleFollowUpReminder(followUp._id, followUp.nextReminderAt)
    )));
  }
};

export const startFollowUpReminderRuntime = async () => {
  const active = await FollowUp.find({
    status: { $in: ['Pending', 'Snoozed'] },
  })
    .select('_id nextReminderAt')
    .lean();
  for (let index = 0; index < active.length; index += 20) {
    await Promise.all(active.slice(index, index + 20).map((followUp) => (
      scheduleFollowUpReminder(followUp._id, followUp.nextReminderAt)
    )));
  }
  recoveryTimer = setInterval(() => {
    void reconcileDueFollowUps().catch((error) => {
      console.error('[FollowUpScheduler] Recovery scan failed:', error.message);
    });
  }, RECOVERY_INTERVAL_MS);
  recoveryTimer.unref?.();
  console.log(`[FollowUpScheduler] Runtime started; restored ${active.length} reminder(s)`);
};

export const stopFollowUpReminderRuntime = async () => {
  if (recoveryTimer) clearInterval(recoveryTimer);
  recoveryTimer = undefined;
  for (const id of [...scheduledJobs.keys()]) clearScheduledJob(id);
};
