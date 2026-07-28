import { once } from 'node:events';

export const encodeCsvValue = (value) => {
  if (value == null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const streamCsv = async ({ res, filename, columns, rows }) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.write(`${columns.map((column) => encodeCsvValue(column.label)).join(',')}\r\n`);
  for await (const row of rows) {
    const line = `${columns.map((column) => encodeCsvValue(
      typeof column.value === 'function' ? column.value(row) : row[column.value],
    )).join(',')}\r\n`;
    if (!res.write(line)) await once(res, 'drain');
  }
  res.end();
};
