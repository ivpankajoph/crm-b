import crypto from 'crypto';
import CallLog from '../models/CallLog.js';
import Setting from '../models/Setting.js';
import { errorResponse, successResponse } from '../utils/response.js';
import { normalizePhone, plivoRequest } from '../services/plivoService.js';

const publicBaseUrl = () => (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
const xmlEscape = (value) => String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const exchangeRateCache = new Map();
const providerStatusCheckCache = new Map();

const getUsdExchangeRate = async (currency) => {
  if (currency === 'USD') return 1;
  const cached = exchangeRateCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Currency conversion service is unavailable');
  const data = await response.json();
  const rate = Number(data.rates?.[currency]);
  if (!Number.isFinite(rate)) throw new Error(`Currency conversion is unavailable for ${currency}`);
  exchangeRateCache.set(currency, { rate, expiresAt: Date.now() + (6 * 60 * 60 * 1000) });
  return rate;
};

export const getTelephonyConfig = async (_req, res, next) => {
  try {
    const settings = await Setting.findOne();
    const response = await plivoRequest('/Number/?limit=20');
    return successResponse(res, 200, 'Plivo numbers fetched', {
      configured: true,
      selectedNumber: settings?.plivoNumber || '',
      numbers: response.objects || [],
    });
  } catch (error) { next(error); }
};

export const searchNumbers = async (req, res, next) => {
  try {
    const country = String(req.query.country || 'US').toUpperCase();
    const type = String(req.query.type || 'local');
    // Plivo's pattern is the national number prefix without the country code
    // or domestic trunk zero (e.g. Indian Bengaluru 080 becomes 80).
    const rawPrefix = String(req.query.prefix || '').replace(/\D/g, '');
    const prefix = rawPrefix.replace(/^0+/, '');
    const currency = /^[A-Z]{3}$/.test(String(req.query.currency || '').toUpperCase())
      ? String(req.query.currency).toUpperCase()
      : 'USD';
    const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
    const query = new URLSearchParams({ country_iso: country, type, services: 'voice', limit: '20', offset: String(offset) });
    if (prefix) query.set('pattern', prefix);
    const response = await plivoRequest(`/PhoneNumber/?${query}`);
    let exchangeRate = 1;
    let conversionAvailable = true;
    try {
      exchangeRate = await getUsdExchangeRate(currency);
    } catch {
      conversionAvailable = false;
    }
    return successResponse(res, 200, 'Available numbers fetched', {
      numbers: response.objects || [],
      meta: response.meta || { limit: 20, offset, total_count: (response.objects || []).length, next: null },
      appliedPrefix: prefix,
      pricing: { sourceCurrency: 'USD', displayCurrency: currency, exchangeRate, conversionAvailable },
    });
  } catch (error) { next(error); }
};

export const buyNumber = async (req, res, next) => {
  try {
    const number = String(req.body.number || '').replace(/\D/g, '');
    if (!number) return errorResponse(res, 400, 'Number is required');
    const response = await plivoRequest(`/PhoneNumber/${number}/`, { method: 'POST', body: '{}' });
    const settings = (await Setting.findOne()) || new Setting();
    if (!settings.plivoNumber) settings.plivoNumber = `+${number}`;
    await settings.save();
    return successResponse(res, 201, 'Virtual number purchased', response);
  } catch (error) { next(error); }
};

export const selectNumber = async (req, res, next) => {
  try {
    const number = normalizePhone(req.body.number);
    if (!number) return errorResponse(res, 400, 'Enter a valid E.164 phone number');
    const owned = await plivoRequest('/Number/?limit=20');
    if (!(owned.objects || []).some((item) => normalizePhone(item.number) === number)) {
      return errorResponse(res, 400, 'That number is not present in your Plivo account');
    }
    const settings = (await Setting.findOne()) || new Setting();
    settings.plivoNumber = number;
    await settings.save();
    return successResponse(res, 200, 'Default calling number updated', { selectedNumber: number });
  } catch (error) { next(error); }
};

export const answerClickToCall = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.status(404).type('application/xml').send('<Response><Speak>Call request is invalid.</Speak></Response>');
  callLog.status = 'ringing';
  callLog.providerCallId = req.body.CallUUID || req.query.CallUUID || callLog.providerCallId;
  await callLog.save();
  const callback = `${publicBaseUrl()}/api/telephony/webhooks/hangup/${callLog._id}/${callLog.webhookToken}`;
  return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Please wait while we connect your call.</Speak><Dial callerId="${xmlEscape(callLog.fromNumber)}" callbackUrl="${xmlEscape(callback)}" callbackMethod="POST"><Number>${xmlEscape(callLog.toNumber)}</Number></Dial></Response>`);
};

export const hangupClickToCall = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.sendStatus(404);
  if (['completed', 'failed', 'cancelled'].includes(callLog.status)) {
    return res.type('application/xml').send('<Response/>');
  }
  const dialAction = String(req.body.DialAction || '').toLowerCase();
  const legStatus = String(req.body.DialBLegStatus || '').toLowerCase();
  const finalStatus = String(req.body.DialStatus || req.body.CallStatus || '').toLowerCase();
  const hangupCause = req.body.DialBLegHangupCauseName || req.body.HangupCauseName || req.body.DialHangupCause || req.body.DialStatus || req.body.CallStatus;
  const normalizedCause = String(hangupCause || '').toLowerCase();
  const failedCause = ['busy', 'reject', 'no answer', 'timeout', 'failed', 'cancel'].some((value) => normalizedCause.includes(value));
  const duration = Number(req.body.DialBLegDuration || req.body.Duration || 0);
  callLog.durationSeconds = Math.max(callLog.durationSeconds || 0, duration);
  if (dialAction === 'answer' || dialAction === 'connected' || ['answered', 'in-progress'].includes(legStatus)) {
    callLog.status = 'in-progress';
    callLog.answeredAt = callLog.answeredAt || new Date();
  } else if (legStatus === 'ringing') {
    callLog.status = 'ringing';
  } else if (dialAction === 'hangup') {
    callLog.status = !failedCause && (callLog.answeredAt || ['answered', 'in-progress'].includes(legStatus)) ? 'completed' : 'failed';
    callLog.endedAt = new Date();
  } else if (finalStatus) {
    callLog.status = finalStatus === 'completed' ? 'completed' : 'failed';
    callLog.endedAt = new Date();
  }
  callLog.hangupCause = hangupCause;
  callLog.hangupCauseCode = String(req.body.DialBLegHangupCauseCode || req.body.HangupCauseCode || req.body.DialHangupCauseCode || '');
  if (['completed', 'failed'].includes(callLog.status)) callLog.endedAt = callLog.endedAt || new Date();
  await callLog.save();
  return res.type('application/xml').send('<Response/>');
};

const encryptEndpointPassword = (password) => {
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || '').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;
};

const decryptEndpointPassword = (payload) => {
  const [ivHex, tagHex, encryptedHex] = payload.split('.');
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || '').digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

const ensureBrowserApplication = async () => {
  const baseUrl = publicBaseUrl();
  if (!baseUrl?.startsWith('https://')) throw new Error('PUBLIC_API_URL must be a public HTTPS URL');
  const settings = (await Setting.findOne()) || new Setting();
  if (settings.plivoApplicationId) return settings.plivoApplicationId;
  const response = await plivoRequest('/Application/', {
    method: 'POST',
    body: JSON.stringify({
      app_name: `CRM_Browser_Calling_${Date.now()}`,
      answer_url: `${baseUrl}/api/telephony/webhooks/browser-answer`,
      answer_method: 'POST',
    }),
  });
  settings.plivoApplicationId = response.app_id || response.appId;
  await settings.save();
  return settings.plivoApplicationId;
};

const ensureBrowserEndpoint = async (user) => {
  const endpointUser = await user.constructor.findById(user._id).select('+plivoEndpointId +plivoEndpointUsername +plivoEndpointPassword');
  if (endpointUser.plivoEndpointUsername && endpointUser.plivoEndpointPassword) {
    return { username: endpointUser.plivoEndpointUsername, password: decryptEndpointPassword(endpointUser.plivoEndpointPassword) };
  }
  const appId = await ensureBrowserApplication();
  const password = crypto.randomBytes(24).toString('base64url');
  const username = `crm${String(user._id).slice(-10)}`;
  const response = await plivoRequest('/Endpoint/', {
    method: 'POST',
    body: JSON.stringify({ username, password, alias: `crm_${String(user._id).slice(-12)}`, app_id: appId }),
  });
  endpointUser.plivoEndpointId = response.endpoint_id || response.endpointId;
  endpointUser.plivoEndpointUsername = response.username;
  endpointUser.plivoEndpointPassword = encryptEndpointPassword(password);
  await endpointUser.save();
  return { username: response.username, password };
};

export const prepareBrowserCall = async ({ callLog, user }) => {
  const endpoint = await ensureBrowserEndpoint(user);
  const dialCode = Array.from(crypto.randomBytes(15), (byte) => byte % 10).join('');
  callLog.browserDialCode = dialCode;
  callLog.browserDialExpiresAt = new Date(Date.now() + (5 * 60 * 1000));
  callLog.webhookToken = crypto.randomBytes(24).toString('hex');
  await callLog.save();
  return { ...endpoint, dialCode };
};

export const answerBrowserCall = async (req, res) => {
  const dialCode = String(req.body.To || req.query.To || '').match(/\d{15}/)?.[0];
  if (!dialCode) return res.status(400).type('application/xml').send('<Response><Speak>Invalid call destination.</Speak></Response>');
  const callLog = await CallLog.findOne({ browserDialCode: dialCode }).select('+browserDialCode +browserDialExpiresAt +webhookToken');
  if (!callLog || callLog.browserDialExpiresAt < new Date()) {
    return res.status(404).type('application/xml').send('<Response><Speak>This call request has expired.</Speak></Response>');
  }
  // Plivo may retry the answer webhook after the B-leg has already ended.
  // Never restart or regress a terminal call back to queued.
  if (['completed', 'failed', 'cancelled'].includes(callLog.status) || callLog.endedAt) {
    return res.type('application/xml').send('<Response/>');
  }
  callLog.status = 'queued';
  callLog.providerCallId = req.body.CallUUID || req.query.CallUUID || callLog.providerCallId;
  await callLog.save();
  const callback = `${publicBaseUrl()}/api/telephony/webhooks/hangup/${callLog._id}/${callLog.webhookToken}`;
  const recordingCallbackUrl = `${publicBaseUrl()}/api/telephony/webhooks/recording/${callLog._id}/${callLog.webhookToken}`;
  const transcriptionUrl = `${publicBaseUrl()}/api/telephony/webhooks/transcription/${callLog._id}/${callLog.webhookToken}`;
  return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Record startOnDialAnswer="true" redirect="false" fileFormat="mp3" recordChannelType="stereo" callbackUrl="${xmlEscape(recordingCallbackUrl)}" callbackMethod="POST" transcriptionType="auto" transcriptionUrl="${xmlEscape(transcriptionUrl)}" transcriptionMethod="POST" transcriptionReportType="full"/><Dial callerId="${xmlEscape(callLog.fromNumber)}" action="${xmlEscape(callback)}" method="POST" redirect="false" callbackUrl="${xmlEscape(callback)}" callbackMethod="POST"><Number>${xmlEscape(callLog.toNumber)}</Number></Dial></Response>`);
};

export const recordingCallback = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.sendStatus(404);
  callLog.recordingUrl = req.body.RecordUrl || req.body.record_url || callLog.recordingUrl;
  callLog.recordingId = req.body.RecordingID || req.body.recording_id || callLog.recordingId;
  callLog.recordingDurationMs = Number(req.body.RecordingDurationMs || req.body.recording_duration_ms || 0);
  callLog.durationSeconds = Number(req.body.RecordingDuration || req.body.recording_duration || callLog.durationSeconds || 0);
  callLog.recordingStatus = callLog.recordingUrl ? 'ready' : 'failed';
  if (callLog.recordingUrl) {
    callLog.status = 'completed';
    callLog.endedAt = callLog.endedAt || new Date();
    callLog.hangupCause = callLog.hangupCause || 'Completed';
  }
  await callLog.save();
  return res.sendStatus(204);
};

export const transcriptionCallback = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.sendStatus(404);
  const providerError = req.body.error || req.body.Error;
  callLog.transcriptText = req.body.transcription || req.body.Transcription || callLog.transcriptText;
  callLog.transcriptionError = providerError || '';
  callLog.transcriptionStatus = providerError ? 'failed' : callLog.transcriptText ? 'completed' : 'pending';
  await callLog.save();
  return res.sendStatus(204);
};

const callAccessFilter = (user) => user.role === 'admin' ? {} : { calledBy: user._id };

const syncActiveCallFromPlivo = async (call) => {
  if (!call?.providerCallId || !['queued', 'ringing'].includes(call.status)) return call;
  const lastCheck = providerStatusCheckCache.get(String(call._id)) || 0;
  if (Date.now() - lastCheck < 1000) return call;
  providerStatusCheckCache.set(String(call._id), Date.now());
  try {
    const providerCall = await plivoRequest(`/Call/${encodeURIComponent(call.providerCallId)}/`);
    if (!providerCall.end_time) return call;
    const childResponse = await plivoRequest(`/Call/?parent_call_uuid=${encodeURIComponent(call.providerCallId)}&limit=1`);
    const child = childResponse.objects?.[0] || providerCall;
    const answered = Boolean(child.answer_time) || Number(child.bill_duration || child.billed_duration || 0) > 0;
    call.status = answered ? 'completed' : 'failed';
    call.answeredAt = call.answeredAt || (child.answer_time ? new Date(child.answer_time) : undefined);
    call.endedAt = call.endedAt || new Date(child.end_time || providerCall.end_time);
    call.durationSeconds = Math.max(call.durationSeconds || 0, Number(child.call_duration || 0));
    call.hangupCause = child.hangup_cause_name || providerCall.hangup_cause_name || call.hangupCause;
    call.hangupCauseCode = String(child.hangup_cause_code || providerCall.hangup_cause_code || call.hangupCauseCode || '');
    await call.save();
  } catch {
    // Active calls may not be available in Plivo's completed-call API yet.
  }
  return call;
};

const reconcileStaleCallStatuses = async () => {
  const active = { status: { $in: ['queued', 'ringing'] } };
  await CallLog.updateMany(
    { ...active, endedAt: { $ne: null }, recordingStatus: { $ne: 'ready' }, answeredAt: null },
    { $set: { status: 'failed' } },
  );
  await CallLog.updateMany(
    { ...active, $or: [{ recordingStatus: 'ready' }, { answeredAt: { $ne: null } }, { transcriptionStatus: 'completed' }] },
    { $set: { status: 'completed', hangupCause: 'Completed' } },
  );
  await CallLog.updateMany(
    { ...active, callDatetime: { $lt: new Date(Date.now() - (10 * 60 * 1000)) }, recordingStatus: { $ne: 'ready' } },
    { $set: { status: 'failed', hangupCause: 'Call did not complete', endedAt: new Date() } },
  );
};

export const listCallLogs = async (req, res, next) => {
  try {
    await reconcileStaleCallStatuses();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = 20;
    const filter = callAccessFilter(req.user);
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    const [calls, total] = await Promise.all([
      CallLog.find(filter).populate('lead').populate('calledBy', 'name email role').sort({ callDatetime: -1 }).skip((page - 1) * limit).limit(limit),
      CallLog.countDocuments(filter),
    ]);
    return successResponse(res, 200, 'Call history fetched', { calls, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

export const getCallLogDetails = async (req, res, next) => {
  try {
    await reconcileStaleCallStatuses();
    const call = await CallLog.findOne({ _id: req.params.callLogId, ...callAccessFilter(req.user) })
      .populate('lead').populate('calledBy', 'name email role').populate('manualCommentBy', 'name');
    if (!call) return errorResponse(res, 404, 'Call not found');
    await syncActiveCallFromPlivo(call);
    return successResponse(res, 200, 'Call details fetched', call);
  } catch (error) { next(error); }
};

export const finalizeBrowserCall = async (req, res, next) => {
  try {
    const call = await CallLog.findOne({ _id: req.params.callLogId, ...callAccessFilter(req.user) });
    if (!call) return errorResponse(res, 404, 'Call not found');
    const connected = req.body.connected === true;
    call.status = connected ? 'completed' : 'failed';
    call.hangupCause = req.body.reason || (connected ? 'Normal Hangup' : 'Call not connected');
    call.endedAt = new Date();
    if (Number.isFinite(Number(req.body.durationSeconds))) {
      call.durationSeconds = Math.max(call.durationSeconds || 0, Number(req.body.durationSeconds));
    }
    await call.save();
    return successResponse(res, 200, 'Call status finalized', call);
  } catch (error) { next(error); }
};

export const createPlivoBridge = async ({ callLog, agentNumber }) => {
  const baseUrl = publicBaseUrl();
  if (!baseUrl?.startsWith('https://')) throw new Error('PUBLIC_API_URL must be a public HTTPS URL');
  const token = crypto.randomBytes(24).toString('hex');
  callLog.webhookToken = token;
  await callLog.save();
  const answerUrl = `${baseUrl}/api/telephony/webhooks/answer/${callLog._id}/${token}`;
  const hangupUrl = `${baseUrl}/api/telephony/webhooks/hangup/${callLog._id}/${token}`;
  return plivoRequest('/Call/', {
    method: 'POST',
    body: JSON.stringify({ from: callLog.fromNumber, to: agentNumber, answer_url: answerUrl, answer_method: 'POST', hangup_url: hangupUrl, hangup_method: 'POST' }),
  });
};
