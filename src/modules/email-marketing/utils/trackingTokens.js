import crypto from 'node:crypto';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';

const getSecret = () => {
  const secret = getEmailMarketingConfig().trackingSecret;
  if (!secret) {
    const error = new Error('Email tracking secret is not configured');
    error.statusCode = 503;
    throw error;
  }
  return secret;
};

export const createTrackingToken = (purpose, id) =>
  crypto
    .createHmac('sha256', getSecret())
    .update(`${purpose}:${id}`)
    .digest('hex');

export const verifyTrackingToken = (purpose, id, token = '') => {
  const expected = createTrackingToken(purpose, id);
  const supplied = String(token);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
};
