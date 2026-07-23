export const resolveDateRange = ({ from, to, days = 30 }) => {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - Math.max(1, Number(days)) * 86400000);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    const error = new Error('Invalid analytics date range');
    error.statusCode = 400;
    throw error;
  }
  return { start, end };
};
