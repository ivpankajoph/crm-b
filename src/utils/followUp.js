export const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Demo', 'Other'];
export const FOLLOW_UP_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
export const FOLLOW_UP_REMINDERS = ['15_minutes', '30_minutes', '1_hour', '1_day'];
export const FOLLOW_UP_REMINDER_MS = {
  '15_minutes': 15 * 60 * 1000,
  '30_minutes': 30 * 60 * 1000,
  '1_hour': 60 * 60 * 1000,
  '1_day': 24 * 60 * 60 * 1000,
};

export const getFirstReminderAt = (followUpDateTime, reminderBefore, now = new Date()) => {
  const scheduledAt = new Date(followUpDateTime);
  const offset = FOLLOW_UP_REMINDER_MS[reminderBefore];
  if (Number.isNaN(scheduledAt.getTime()) || !offset) {
    throw new RangeError('Reminder schedule is invalid');
  }
  const reminderAt = new Date(scheduledAt.getTime() - offset);
  return reminderAt.getTime() <= new Date(now).getTime() ? new Date(now) : reminderAt;
};

const requireAllowedValue = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw new RangeError(`${label} is invalid`);
  }
  return value;
};

export const parseFollowUpPayload = (payload = {}, now = () => new Date()) => {
  if (typeof payload.followUpRequired !== 'boolean') {
    throw new RangeError('Follow-up Required must be Yes or No');
  }

  if (!payload.followUpRequired) {
    return {
      followUpRequired: false,
      followUpDateTime: null,
      followUpType: null,
      followUpPriority: null,
      followUpReminder: null,
    };
  }

  if (!payload.followUpDateTime) {
    throw new RangeError('Follow-up Date & Time is required');
  }
  const followUpDateTime = new Date(payload.followUpDateTime);
  if (Number.isNaN(followUpDateTime.getTime())) {
    throw new RangeError('Follow-up Date & Time is invalid');
  }
  if (followUpDateTime.getTime() <= new Date(now()).getTime()) {
    throw new RangeError('Follow-up Date & Time must be in the future');
  }

  return {
    followUpRequired: true,
    followUpDateTime,
    followUpType: requireAllowedValue(payload.followUpType, FOLLOW_UP_TYPES, 'Follow-up Type'),
    followUpPriority: requireAllowedValue(payload.followUpPriority, FOLLOW_UP_PRIORITIES, 'Priority'),
    followUpReminder: requireAllowedValue(payload.followUpReminder, FOLLOW_UP_REMINDERS, 'Reminder'),
  };
};
