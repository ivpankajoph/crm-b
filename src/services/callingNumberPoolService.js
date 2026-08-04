import Setting from '../models/Setting.js';
import { normalizePhone } from './plivoService.js';

export const normalizeCallingPool = (numbers = []) => Array.from(new Set(
  (Array.isArray(numbers) ? numbers : [])
    .map(normalizePhone)
    .filter(Boolean),
));

export const effectiveCallingPool = (settings) => {
  if (settings?.callingPoolConfigured === true) {
    return normalizeCallingPool(settings.activePlivoNumbers);
  }
  return normalizeCallingPool([settings?.plivoNumber]);
};

export const callingNumberForCursor = (pool, cursor = 0) => {
  const normalizedPool = normalizeCallingPool(pool);
  if (!normalizedPool.length) return null;
  const safeCursor = Math.max(0, Number.isFinite(Number(cursor)) ? Math.floor(Number(cursor)) : 0);
  return normalizedPool[safeCursor % normalizedPool.length];
};

export const selectNextCallingNumber = async () => {
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create({});

  const pool = effectiveCallingPool(settings);
  if (!pool.length) {
    const error = new Error('No active calling number is available. Please contact your administrator.');
    error.statusCode = 409;
    throw error;
  }

  const claimedSettings = await Setting.findByIdAndUpdate(
    settings._id,
    { $inc: { plivoNumberPoolCursor: 1 } },
    { new: false },
  );
  const cursor = Math.max(0, Number(claimedSettings?.plivoNumberPoolCursor || 0));
  return callingNumberForCursor(pool, cursor);
};
