const apiRoot = 'https://api.plivo.com/v1/Account';

const credentials = () => {
  const authId = process.env.PLIVO_AUTH_ID?.trim();
  const authToken = process.env.PLIVO_AUTH_TOKEN?.trim();
  if (!authId || !authToken) throw new Error('Plivo credentials are not configured');
  return { authId, authToken };
};

export const plivoRequest = async (path, options = {}) => {
  const { authId, authToken } = credentials();
  const response = await fetch(`${apiRoot}/${encodeURIComponent(authId)}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = typeof data.error === 'string'
      ? data.error
      : data.error && typeof data.error === 'object'
        ? Object.entries(data.error).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`).join('; ')
        : data.message;
    const error = new Error(providerMessage || `Plivo request failed (${response.status})`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
};

export const normalizePhone = (value) => {
  let phone = String(value || '').trim().replace(/[\s().-]/g, '');
  if (phone.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
  phone = phone.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(phone)) {
    const countryCode = String(process.env.DEFAULT_PHONE_COUNTRY_CODE || '91').replace(/\D/g, '');
    phone = `${countryCode}${phone}`;
  }
  return /^[1-9]\d{7,14}$/.test(phone) ? `+${phone}` : null;
};
