import crypto from 'crypto';

const validationEnabled = () => (
  process.env.PLIVO_VALIDATE_WEBHOOK_SIGNATURES === 'true'
  || (process.env.NODE_ENV === 'production' && process.env.PLIVO_VALIDATE_WEBHOOK_SIGNATURES !== 'false')
);

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const computePlivoV3Signature = ({ url, nonce, authToken, method = 'POST', params = {} }) => {
  let signedPayload = String(url);
  if (String(method).toUpperCase() === 'POST') {
    signedPayload += Object.keys(params || {}).sort().map((key) => {
      const value = Array.isArray(params[key]) ? params[key].join('') : params[key];
      return `${key}${value ?? ''}`;
    }).join('');
  }
  signedPayload += String(nonce);
  return crypto.createHmac('sha256', String(authToken)).update(signedPayload).digest('base64');
};

export const validatePlivoWebhook = (req, res, next) => {
  if (!validationEnabled()) return next();
  const authToken = String(process.env.PLIVO_AUTH_TOKEN || '');
  const nonce = String(req.get('X-Plivo-Signature-V3-Nonce') || '');
  const signatures = String(req.get('X-Plivo-Signature-V3') || req.get('X-Plivo-Signature-Ma-V3') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const publicRoot = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (!authToken || !nonce || !signatures.length || !publicRoot) return res.sendStatus(403);

  const expected = computePlivoV3Signature({
    url: `${publicRoot}${req.originalUrl}`,
    nonce,
    authToken,
    method: req.method,
    params: req.body,
  });
  if (!signatures.some((signature) => safeEqual(expected, signature))) return res.sendStatus(403);
  return next();
};
