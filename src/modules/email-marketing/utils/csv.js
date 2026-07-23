const normalizeHeader = (header = '') =>
  String(header)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

export const parseCsvText = (input = '') => {
  const text = String(input).replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/, ''));
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted field');
  record.push(field.replace(/\r$/, ''));
  if (record.some((value) => value.trim())) records.push(record);
  if (records.length < 2) return [];

  const headers = records[0].map(normalizeHeader);
  return records.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])),
  );
};

const splitTags = (value) => {
  if (Array.isArray(value)) return value;
  return String(value || '')
    .split(/[;|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

export const normalizeImportedSubscriber = (row = {}) => ({
  email: String(row.email || row.emailaddress || '').trim().toLowerCase(),
  firstName: String(row.firstName || row.firstname || row.first || '').trim(),
  lastName: String(row.lastName || row.lastname || row.last || '').trim(),
  phone: String(row.phone || row.phonenumber || row.mobile || '').trim(),
  status: String(row.status || 'subscribed').trim().toLowerCase(),
  source: String(row.source || 'csv_import').trim(),
  tags: splitTags(row.tags || row.tag),
  notes: String(row.notes || row.note || '').trim(),
});
