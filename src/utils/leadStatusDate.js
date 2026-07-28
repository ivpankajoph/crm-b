const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const parseCalendarDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValidDate = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;

  return isValidDate ? parsed : null;
};

export const parseLeadStatusDate = (value, now = () => new Date()) => {
  if (value === undefined || value === null) {
    return new Date(now());
  }

  if (typeof value !== 'string') {
    throw new RangeError('Status date must use YYYY-MM-DD or ISO 8601 format');
  }

  if (ISO_TIMESTAMP_PATTERN.test(value)) {
    if (!parseCalendarDate(value.slice(0, 10))) {
      throw new RangeError('Status date and time are invalid');
    }
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      throw new RangeError('Status date and time are invalid');
    }
    return timestamp;
  }

  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError('Status date must use YYYY-MM-DD or ISO 8601 format');
  }

  const parsed = parseCalendarDate(value);
  if (!parsed) {
    throw new RangeError('Status date is invalid');
  }

  return parsed;
};
