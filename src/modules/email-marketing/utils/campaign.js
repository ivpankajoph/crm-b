export const calculateDelayMs = (value, unit) => {
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };
  return Math.max(0, Number(value) || 0) * (multipliers[unit] || 0);
};

export const nextRecurrenceDate = (campaign, from = new Date()) => {
  if (!campaign.isRecurring) return null;
  const next = new Date(from);
  const interval = Math.max(1, Number(campaign.recurrenceInterval) || 1);
  if (campaign.recurrenceUnit === 'day') next.setUTCDate(next.getUTCDate() + interval);
  else if (campaign.recurrenceUnit === 'month') next.setUTCMonth(next.getUTCMonth() + interval);
  else next.setUTCDate(next.getUTCDate() + interval * 7);
  if (campaign.recurrenceEndAt && next > new Date(campaign.recurrenceEndAt)) return null;
  return next;
};
