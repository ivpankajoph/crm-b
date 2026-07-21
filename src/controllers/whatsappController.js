import WhatsAppConnection from '../models/WhatsAppConnection.js';
import { syncWhatsAppAssets } from '../services/metaWhatsAppService.js';
import { errorResponse, successResponse } from '../utils/response.js';
import crypto from 'crypto';

const tokenKey = () => crypto.createHash('sha256').update(process.env.WHATSAPP_TOKEN_SECRET || process.env.JWT_SECRET || '').digest();
const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;
};
const decryptToken = (payload) => {
  const [iv, tag, encrypted] = payload.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
};

const publicConnection = (connection) => {
  const value = connection?.toObject ? connection.toObject() : connection;
  if (!value) return { configured: false, accounts: [] };
  delete value.accessToken;
  return { configured: true, ...value };
};

const idList = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(','))
  .map((id) => String(id).trim()).filter((id) => /^\d+$/.test(id)))];

export const getWhatsAppConnection = async (req, res, next) => {
  try {
    const connection = await WhatsAppConnection.findOne({ user: req.user._id });
    return successResponse(res, 200, 'WhatsApp configuration fetched', publicConnection(connection));
  } catch (error) { next(error); }
};

export const connectWhatsApp = async (req, res, next) => {
  try {
    let accessToken = String(req.body.accessToken || '').trim();
    const businessIds = idList(req.body.businessIds);
    const wabaIds = idList(req.body.wabaIds);
    const graphVersion = /^v\d+\.\d+$/.test(req.body.graphVersion) ? req.body.graphVersion : 'v23.0';
    if (!accessToken) {
      const existing = await WhatsAppConnection.findOne({ user: req.user._id }).select('+accessToken');
      if (!existing) return errorResponse(res, 400, 'Meta system-user access token is required');
      accessToken = decryptToken(existing.accessToken);
    }
    const synced = await syncWhatsAppAssets(accessToken, graphVersion, { businessIds, wabaIds });
    if (!synced.accounts.length) return errorResponse(res, 422, 'Token is valid, but Meta returned 0 assigned WhatsApp accounts. Assign the WABAs to this system user in Meta Business Settings, or enter the Business Portfolio ID / WABA IDs.');
    const connection = await WhatsAppConnection.findOneAndUpdate(
      { user: req.user._id },
      { accessToken: encryptToken(accessToken), graphVersion, businessIds, wabaIds, metaUserId: synced.profile.id, metaUserName: synced.profile.name, accounts: synced.accounts, status: 'connected', lastSyncAt: new Date(), lastSyncError: '' },
      { upsert: true, new: true, runValidators: true },
    );
    return successResponse(res, 200, `Connected and synced ${synced.accounts.length} WhatsApp account(s)`, publicConnection(connection));
  } catch (error) {
    return errorResponse(res, error.statusCode || 400, error.message || 'Unable to connect to Meta');
  }
};

export const syncWhatsApp = async (req, res) => {
  const connection = await WhatsAppConnection.findOne({ user: req.user._id }).select('+accessToken');
  if (!connection) return errorResponse(res, 404, 'Connect a Meta system-user token first');
  try {
    const synced = await syncWhatsAppAssets(decryptToken(connection.accessToken), connection.graphVersion, { businessIds: connection.businessIds, wabaIds: connection.wabaIds });
    if (!synced.accounts.length) throw new Error('Meta returned 0 assigned WhatsApp accounts. Assign WABAs to this system user or add the Business Portfolio/WABA IDs.');
    connection.metaUserId = synced.profile.id;
    connection.metaUserName = synced.profile.name;
    connection.accounts = synced.accounts;
    connection.status = 'connected';
    connection.lastSyncAt = new Date();
    connection.lastSyncError = '';
    await connection.save();
    return successResponse(res, 200, 'WhatsApp assets synced', publicConnection(connection));
  } catch (error) {
    connection.status = 'error';
    connection.lastSyncError = error.message;
    await connection.save();
    return errorResponse(res, error.statusCode || 400, error.message || 'WhatsApp sync failed');
  }
};

export const disconnectWhatsApp = async (req, res, next) => {
  try {
    await WhatsAppConnection.deleteOne({ user: req.user._id });
    return successResponse(res, 200, 'WhatsApp connection removed', { configured: false, accounts: [] });
  } catch (error) { next(error); }
};
