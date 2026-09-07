export const FULL_DAY_THRESHOLD_MS = 5 * 60 * 60 * 1000;

export const statusFromAttendanceTimes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const elapsed = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  return elapsed > FULL_DAY_THRESHOLD_MS ? 'Present' : 'Half Day';
};

export const withAttendanceMetrics = (record) => {
  if (!record) return record;
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const checkIn = value.checkIn ? new Date(value.checkIn) : null;
  const checkOut = value.checkOut ? new Date(value.checkOut) : null;
  const elapsed = checkIn && checkOut ? checkOut.getTime() - checkIn.getTime() : null;
  const calculatedStatus = ['Present', 'Half Day'].includes(value.status)
    ? statusFromAttendanceTimes(checkIn, checkOut)
    : null;

  return {
    ...value,
    status: calculatedStatus || value.status,
    workedSeconds: elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0
      ? Math.floor(elapsed / 1000)
      : null,
    workedMinutes: elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0
      ? Math.floor(elapsed / 60_000)
      : null,
    isOpenSession: Boolean(checkIn && !checkOut),
  };
};

export const withAttendanceMetricsMany = (records = []) => records.map(withAttendanceMetrics);

export const attendanceTargetIsVisible = (visibility, userId) => (
  visibility.scope === 'all'
  || (
    visibility.scope !== 'none'
    && visibility.userIds.map(String).includes(String(userId))
  )
);
