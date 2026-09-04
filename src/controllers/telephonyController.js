import crypto from 'crypto';
import CallLog from '../models/CallLog.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { errorResponse, successResponse } from '../utils/response.js';
import { normalizePhone, plivoRequest } from '../services/plivoService.js';
import { resolveUserDataScope, ownershipFilter } from '../services/dataScopeService.js';
import {
  isGeminiTranscriptionConfigured,
  isUsableTranscript,
  MAX_TRANSCRIPTION_ATTEMPTS,
  scheduleCallTranscription,
} from '../services/geminiCallTranscriptionService.js';
import { effectiveCallingPool, normalizeCallingPool } from '../services/callingNumberPoolService.js';
import { logActivity } from '../utils/activity.js';
import { findCallbackRoute } from '../services/callbackRoutingService.js';
import { emitToUsers } from '../services/realtimeService.js';

const publicBaseUrl = () => (process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
const xmlEscape = (value) => String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const exchangeRateCache = new Map();
const providerStatusCheckCache = new Map();
const missedCallbackMessage = (callLog) => {
  if (callLog.routeStatus === 'busy') return `A customer called back on ${callLog.virtualNumber}, but you were already on another call.`;
  if (callLog.routeStatus === 'offline') return `A customer called back on ${callLog.virtualNumber} while your CRM phone was unavailable.`;
  return `You missed an incoming customer callback from ${callLog.customerNumber || callLog.fromNumber}.`;
};

const notifyMissedCallback = async (callLog) => {
  if (callLog.direction !== 'inbound' || !callLog.calledBy || callLog.missedNotificationSentAt) return;
  const claimed = await CallLog.findOneAndUpdate(
    { _id: callLog._id, missedNotificationSentAt: null },
    { $set: { missedNotificationSentAt: new Date() } },
    { new: true },
  );
  if (!claimed) return;
  try {
    const notification = await Notification.create({
      user: claimed.calledBy,
      title: 'Missed customer callback',
      message: missedCallbackMessage(claimed),
      type: 'warning',
    });
    emitToUsers([claimed.calledBy], 'notification:new', notification.toObject());
  } catch (error) {
    await CallLog.updateOne({ _id: claimed._id }, { $unset: { missedNotificationSentAt: 1 } });
    throw error;
  }
};

const getOwnedPlivoNumbers = async () => {
  const numbers = [];
  const limit = 20;
  for (let offset = 0; offset < 1000; offset += limit) {
    const response = await plivoRequest(`/Number/?limit=${limit}&offset=${offset}`);
    const page = response.objects || [];
    numbers.push(...page);
    const total = Number(response.meta?.total_count || 0);
    if (page.length < limit || (total && numbers.length >= total)) break;
  }
  return numbers;
};

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
    const numbers = await getOwnedPlivoNumbers();
    const activeNumbers = effectiveCallingPool(settings);
    const inboundApplicationId = settings?.plivoInboundApplicationId || '';
    const inboundReadyNumbers = numbers
      .filter((item) => inboundApplicationId && String(item.application || '').includes(inboundApplicationId))
      .map((item) => normalizePhone(item.number))
      .filter(Boolean);
    return successResponse(res, 200, 'Plivo numbers fetched', {
      configured: true,
      selectedNumber: settings?.plivoNumber || '',
      activeNumbers,
      poolConfigured: settings?.callingPoolConfigured === true,
      inboundReadyNumbers,
      numbers,
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
    const owned = await getOwnedPlivoNumbers();
    if (!owned.some((item) => normalizePhone(item.number) === number)) {
      return errorResponse(res, 400, 'That number is not present in your Plivo account');
    }
    const settings = (await Setting.findOne()) || new Setting();
    settings.plivoNumber = number;
    settings.activePlivoNumbers = [number];
    settings.callingPoolConfigured = true;
    settings.plivoNumberPoolCursor = 0;
    await settings.save();
    return successResponse(res, 200, 'Default calling number updated', { selectedNumber: number });
  } catch (error) { next(error); }
};

export const updateActiveCallingPool = async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.numbers)) {
      return errorResponse(res, 400, 'Calling pool numbers must be an array');
    }
    const rawNumbers = req.body.numbers.filter((value) => String(value || '').trim());
    const numbers = normalizeCallingPool(rawNumbers);
    if (numbers.length !== new Set(rawNumbers.map((value) => String(value).trim())).size) {
      return errorResponse(res, 400, 'Calling pool contains an invalid phone number');
    }

    const owned = await getOwnedPlivoNumbers();
    const ownedNumbers = new Set(owned.map((item) => normalizePhone(item.number)).filter(Boolean));
    const unavailable = numbers.filter((number) => !ownedNumbers.has(number));
    if (unavailable.length) {
      return errorResponse(res, 400, `These numbers are not available in your Plivo account: ${unavailable.join(', ')}`);
    }

    const settings = (await Setting.findOne()) || new Setting();
    const previousNumbers = effectiveCallingPool(settings);
    settings.activePlivoNumbers = numbers;
    settings.callingPoolConfigured = true;
    settings.plivoNumber = numbers[0] || '';
    settings.plivoNumberPoolCursor = 0;
    await settings.save();

    await logActivity({
      user: req.user._id,
      actionType: 'calling_number_pool_updated',
      description: `Updated active calling pool to ${numbers.length} number${numbers.length === 1 ? '' : 's'}`,
      entityType: 'Setting',
      entityId: settings._id,
      metadata: {
        previousNumbers,
        activeNumbers: numbers,
        addedNumbers: numbers.filter((number) => !previousNumbers.includes(number)),
        removedNumbers: previousNumbers.filter((number) => !numbers.includes(number)),
      },
    });

    return successResponse(res, 200, 'Active calling pool updated', {
      activeNumbers: numbers,
      poolConfigured: true,
      inboundReadyNumbers: owned
        .filter((item) => settings.plivoInboundApplicationId && String(item.application || '').includes(settings.plivoInboundApplicationId))
        .map((item) => normalizePhone(item.number))
        .filter((number) => number && numbers.includes(number)),
    });
  } catch (error) { next(error); }
};

export const answerClickToCall = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.status(404).type('application/xml').send('<Response><Speak>Call request is invalid.</Speak></Response>');
  callLog.status = 'ringing';
  callLog.providerCallId = req.body.CallUUID || req.query.CallUUID || callLog.providerCallId;
  await callLog.save();
  const callback = `${publicBaseUrl()}/api/telephony/webhooks/hangup/${callLog._id}/${callLog.webhookToken}`;
  const recordingCallbackUrl = `${publicBaseUrl()}/api/telephony/webhooks/recording/${callLog._id}/${callLog.webhookToken}`;
  return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Please wait while we connect your call. This call may be recorded.</Speak><Record startOnDialAnswer="true" redirect="false" fileFormat="mp3" recordChannelType="stereo" maxLength="14400" callbackUrl="${xmlEscape(recordingCallbackUrl)}" callbackMethod="POST"/><Dial callerId="${xmlEscape(callLog.fromNumber)}" action="${xmlEscape(callback)}" method="POST" redirect="false" callbackUrl="${xmlEscape(callback)}" callbackMethod="POST"><Number>${xmlEscape(callLog.toNumber)}</Number></Dial></Response>`);
};

export const hangupClickToCall = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.sendStatus(404);
  if (['completed', 'failed', 'cancelled'].includes(callLog.status)) {
    if (callLog.status === 'failed') await notifyMissedCallback(callLog).catch(() => undefined);
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
  callLog.providerLegId = req.body.DialBLegUUID || callLog.providerLegId;
  callLog.hangupCauseCode = String(req.body.DialBLegHangupCauseCode || req.body.HangupCauseCode || req.body.DialHangupCauseCode || '');
  if (callLog.direction === 'inbound' && callLog.status === 'failed' && normalizedCause.includes('busy')) {
    callLog.routeStatus = 'busy';
  }
  if (['completed', 'failed'].includes(callLog.status)) callLog.endedAt = callLog.endedAt || new Date();
  await callLog.save();
  if (callLog.status === 'failed') await notifyMissedCallback(callLog).catch(() => undefined);
  return res.type('application/xml').send('<Response/>');
};

export const configureInboundCallbacks = async (req, res, next) => {
  try {
    const settings = (await Setting.findOne()) || new Setting();
    const numbers = effectiveCallingPool(settings);
    if (!numbers.length) return errorResponse(res, 409, 'Activate at least one calling number first');
    settings.plivoInboundApplicationId = await attachInboundApplicationToNumbers(numbers);
    await settings.save();
    await logActivity({
      user: req.user._id,
      actionType: 'inbound_callbacks_configured',
      description: `Enabled strict customer callbacks on ${numbers.length} calling number${numbers.length === 1 ? '' : 's'}`,
      entityType: 'Setting',
      entityId: settings._id,
      metadata: { activeNumbers: numbers, applicationId: settings.plivoInboundApplicationId },
    });
    return successResponse(res, 200, 'Incoming callbacks enabled', { inboundReadyNumbers: numbers });
  } catch (error) { next(error); }
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

const ensureInboundApplication = async () => {
  const baseUrl = publicBaseUrl();
  if (!baseUrl?.startsWith('https://')) throw new Error('PUBLIC_API_URL must be a public HTTPS URL');
  const settings = (await Setting.findOne()) || new Setting();
  const applicationPayload = {
    answer_url: `${baseUrl}/api/telephony/webhooks/incoming`,
    answer_method: 'POST',
    hangup_url: `${baseUrl}/api/telephony/webhooks/incoming-hangup`,
    hangup_method: 'POST',
  };
  if (settings.plivoInboundApplicationId) {
    await plivoRequest(`/Application/${settings.plivoInboundApplicationId}/`, {
      method: 'POST',
      body: JSON.stringify(applicationPayload),
    });
    return settings.plivoInboundApplicationId;
  }
  const response = await plivoRequest('/Application/', {
    method: 'POST',
    body: JSON.stringify({
      app_name: `CRM_Strict_Callbacks_${Date.now()}`,
      ...applicationPayload,
    }),
  });
  settings.plivoInboundApplicationId = response.app_id || response.appId;
  await settings.save();
  return settings.plivoInboundApplicationId;
};

const attachInboundApplicationToNumbers = async (numbers) => {
  if (!numbers.length) return '';
  const appId = await ensureInboundApplication();
  await Promise.all(numbers.map((number) => plivoRequest(`/Number/${encodeURIComponent(number.replace(/^\+/, ''))}/`, {
    method: 'POST',
    body: JSON.stringify({ app_id: appId }),
  })));
  return appId;
};

const ensureBrowserEndpoint = async (user) => {
  const endpointUser = await User.findById(user._id).select('+plivoEndpointId +plivoEndpointUsername +plivoEndpointPassword');
  if (!endpointUser) throw new Error('Authenticated user was not found');
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

const getRegisteredEndpoint = async (employeeId) => {
  const user = await User.findOne({ _id: employeeId, isActive: true, status: { $ne: 'inactive' } })
    .select('+plivoEndpointId +plivoEndpointUsername');
  if (!user?.plivoEndpointId || !user.plivoEndpointUsername) return null;
  try {
    const endpoint = await plivoRequest(`/Endpoint/${user.plivoEndpointId}/`);
    const registered = endpoint.sip_registered === true || String(endpoint.sip_registered).toLowerCase() === 'true';
    return registered ? { username: user.plivoEndpointUsername } : null;
  } catch {
    return null;
  }
};

const callbackDestinationIsBusy = async ({ employeeId, virtualNumber }) => {
  const recent = new Date(Date.now() - (6 * 60 * 60 * 1000));
  const recentlyQueued = new Date(Date.now() - (10 * 60 * 1000));
  return Boolean(await CallLog.exists({
    endedAt: null,
    $and: [
      { $or: [
        { calledBy: employeeId },
        { virtualNumber },
        { direction: { $ne: 'inbound' }, virtualNumber: { $exists: false }, fromNumber: virtualNumber },
      ] },
      { $or: [
        { status: { $in: ['ringing', 'in-progress'] }, callDatetime: { $gte: recent } },
        { status: 'queued', callDatetime: { $gte: recentlyQueued } },
      ] },
    ],
  }));
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

export const getBrowserSession = async (req, res, next) => {
  try {
    const endpoint = await ensureBrowserEndpoint(req.user);
    return successResponse(res, 200, 'Browser phone session prepared', endpoint);
  } catch (error) { next(error); }
};

const inboundCallXml = ({ callLog, endpointUsername }) => {
  const callback = `${publicBaseUrl()}/api/telephony/webhooks/hangup/${callLog._id}/${callLog.webhookToken}`;
  const recordingCallbackUrl = `${publicBaseUrl()}/api/telephony/webhooks/recording/${callLog._id}/${callLog.webhookToken}`;
  const sipTarget = endpointUsername.includes('@') ? endpointUsername : `${endpointUsername}@phone.plivo.com`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>This call may be recorded. Please wait while we connect you.</Speak><Record startOnDialAnswer="true" redirect="false" fileFormat="mp3" recordChannelType="stereo" maxLength="14400" callbackUrl="${xmlEscape(recordingCallbackUrl)}" callbackMethod="POST"/><Dial callerId="${xmlEscape(callLog.customerNumber)}" callerName="CRM customer callback" timeout="30" action="${xmlEscape(callback)}" method="POST" redirect="false" callbackUrl="${xmlEscape(callback)}" callbackMethod="POST"><User sipHeaders="X-PH-CRMCallLogId=${callLog._id}">sip:${xmlEscape(sipTarget)}</User></Dial><Speak>The employee is busy or unavailable. Please try again later.</Speak></Response>`;
};

const unavailableInboundXml = (message = 'The employee is busy or unavailable. Please try again later.') => (
  `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${xmlEscape(message)}</Speak><Hangup/></Response>`
);

export const answerIncomingCallback = async (req, res) => {
  const customerNumber = normalizePhone(req.body.From || req.query.From);
  const virtualNumber = normalizePhone(req.body.To || req.query.To);
  const providerCallId = String(req.body.CallUUID || req.query.CallUUID || '').trim();
  if (!customerNumber || !virtualNumber || !providerCallId) {
    return res.status(400).type('application/xml').send(unavailableInboundXml('This call could not be identified.'));
  }

  const route = await findCallbackRoute({ customerNumber, virtualNumber });
  if (!route) {
    await CallLog.findOneAndUpdate(
      { direction: 'inbound', providerCallId },
      {
        $setOnInsert: {
          direction: 'inbound', routeStatus: 'no-route', status: 'failed', providerCallId,
          fromNumber: customerNumber, toNumber: virtualNumber, customerNumber, virtualNumber,
          callDatetime: new Date(), endedAt: new Date(), hangupCause: 'No callback route',
          recordingStatus: 'failed', transcriptionStatus: 'failed',
          transcriptionError: 'Call was not routed, so no recording was created',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return res.type('application/xml').send(unavailableInboundXml('No callback route was found for this number.'));
  }

  let callLog = await CallLog.findOne({ direction: 'inbound', providerCallId }).select('+webhookToken');
  if (callLog?.routeStatus === 'routed') {
    const endpoint = await getRegisteredEndpoint(callLog.calledBy);
    if (endpoint) return res.type('application/xml').send(inboundCallXml({ callLog, endpointUsername: endpoint.username }));
  }
  if (callLog) return res.type('application/xml').send(unavailableInboundXml());

  let routeStatus = 'routed';
  let endpoint = null;
  if (await callbackDestinationIsBusy({ employeeId: route.employee, virtualNumber })) {
    routeStatus = 'busy';
  } else {
    endpoint = await getRegisteredEndpoint(route.employee);
    if (!endpoint) routeStatus = 'offline';
  }

  callLog = await CallLog.findOneAndUpdate(
    { direction: 'inbound', providerCallId },
    { $setOnInsert: {
      lead: route.lead,
      leadModel: route.leadModel,
      calledBy: route.employee,
      direction: 'inbound',
      routeStatus,
      status: routeStatus === 'routed' ? 'ringing' : 'failed',
      providerCallId,
      fromNumber: customerNumber,
      toNumber: virtualNumber,
      customerNumber,
      virtualNumber,
      webhookToken: crypto.randomBytes(24).toString('hex'),
      callDatetime: new Date(),
      endedAt: routeStatus === 'routed' ? undefined : new Date(),
      hangupCause: routeStatus === 'busy' ? 'Employee busy' : routeStatus === 'offline' ? 'Employee offline' : undefined,
      recordingStatus: routeStatus === 'routed' ? 'pending' : 'failed',
      transcriptionStatus: routeStatus === 'routed' ? 'pending' : 'failed',
      transcriptionError: routeStatus === 'routed' ? '' : 'Call was not answered, so no recording was created',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select('+webhookToken');

  if (routeStatus !== 'routed') {
    await notifyMissedCallback(callLog).catch(() => undefined);
    return res.type('application/xml').send(unavailableInboundXml());
  }

  emitToUsers([route.employee], 'telephony:incoming', {
    callLogId: String(callLog._id),
    customerNumber,
    lead: String(route.lead),
    leadModel: route.leadModel,
  });
  return res.type('application/xml').send(inboundCallXml({ callLog, endpointUsername: endpoint.username }));
};

export const incomingCallHangup = async (req, res) => {
  const providerCallId = String(req.body.CallUUID || req.query.CallUUID || '').trim();
  if (!providerCallId) return res.sendStatus(204);
  const callLog = await CallLog.findOne({ direction: 'inbound', providerCallId });
  if (!callLog) return res.sendStatus(204);
  const duration = Number(req.body.BillDuration || req.body.Duration || 0);
  callLog.durationSeconds = Math.max(callLog.durationSeconds || 0, duration);
  callLog.hangupCause = req.body.HangupCauseName || callLog.hangupCause;
  callLog.hangupCauseCode = String(req.body.HangupCauseCode || callLog.hangupCauseCode || '');
  callLog.endedAt = callLog.endedAt || new Date();
  if (!['completed', 'failed'].includes(callLog.status)) {
    callLog.status = callLog.answeredAt || duration > 0 ? 'completed' : 'failed';
  }
  await callLog.save();
  if (callLog.status === 'failed') await notifyMissedCallback(callLog).catch(() => undefined);
  return res.sendStatus(204);
};

export const getCurrentIncomingCall = async (req, res, next) => {
  try {
    const call = await CallLog.findOne({
      direction: 'inbound',
      calledBy: req.user._id,
      status: 'ringing',
      endedAt: null,
      callDatetime: { $gte: new Date(Date.now() - (2 * 60 * 1000)) },
    }).populate('lead', 'name companyName customerName').sort({ callDatetime: -1 }).lean();
    return successResponse(res, 200, 'Current incoming call fetched', call);
  } catch (error) { next(error); }
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
  return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Record startOnDialAnswer="true" redirect="false" fileFormat="mp3" recordChannelType="stereo" maxLength="14400" callbackUrl="${xmlEscape(recordingCallbackUrl)}" callbackMethod="POST"/><Dial callerId="${xmlEscape(callLog.fromNumber)}" action="${xmlEscape(callback)}" method="POST" redirect="false" callbackUrl="${xmlEscape(callback)}" callbackMethod="POST"><Number>${xmlEscape(callLog.toNumber)}</Number></Dial></Response>`);
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
    if (!isUsableTranscript(callLog.transcriptText)) {
      callLog.transcriptText = '';
      callLog.transcriptionStatus = isGeminiTranscriptionConfigured() ? 'pending' : 'failed';
      callLog.transcriptionError = isGeminiTranscriptionConfigured()
        ? ''
        : 'Gemini API key is not configured on the backend';
    }
  }
  await callLog.save();
  if (callLog.recordingUrl) scheduleCallTranscription(callLog._id);
  return res.sendStatus(204);
};

export const transcriptionCallback = async (req, res) => {
  const callLog = await CallLog.findOne({ _id: req.params.callLogId, webhookToken: req.params.token }).select('+webhookToken');
  if (!callLog) return res.sendStatus(404);
  const providerError = String(req.body.error || req.body.Error || '').trim();
  const providerTranscript = req.body.transcription || req.body.Transcription || '';
  if (isUsableTranscript(providerTranscript) && callLog.transcriptionStatus !== 'processing') {
    callLog.transcriptText = String(providerTranscript).trim();
    callLog.transcriptionError = '';
    callLog.transcriptionStatus = 'completed';
    callLog.transcriptionSource = 'plivo';
    callLog.transcriptionCompletedAt = new Date();
  } else if (!isUsableTranscript(callLog.transcriptText) && callLog.transcriptionStatus !== 'processing') {
    callLog.transcriptText = '';
    callLog.transcriptionError = providerError || 'Plivo did not return a usable transcript';
    callLog.transcriptionStatus = 'failed';
  }
  await callLog.save();
  if (!isUsableTranscript(callLog.transcriptText) && callLog.recordingStatus === 'ready') {
    scheduleCallTranscription(callLog._id);
  }
  return res.sendStatus(204);
};

const callAccessFilter = async (user, access) => ownershipFilter(
  await resolveUserDataScope(user, 'calls', access),
  'calledBy',
);

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
  await CallLog.bulkWrite([
    {
      updateMany: {
        filter: { ...active, endedAt: { $ne: null }, recordingStatus: { $ne: 'ready' }, answeredAt: null },
        update: { $set: { status: 'failed' } },
      },
    },
    {
      updateMany: {
        filter: { ...active, $or: [{ recordingStatus: 'ready' }, { answeredAt: { $ne: null } }, { transcriptionStatus: 'completed' }] },
        update: { $set: { status: 'completed', hangupCause: 'Completed' } },
      },
    },
    {
      updateMany: {
        filter: { ...active, callDatetime: { $lt: new Date(Date.now() - (10 * 60 * 1000)) }, recordingStatus: { $ne: 'ready' } },
        update: { $set: { status: 'failed', hangupCause: 'Call did not complete', endedAt: new Date() } },
      },
    },
  ], { ordered: true });
};

export const listCallLogs = async (req, res, next) => {
  try {
    await reconcileStaleCallStatuses();
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = 20;
    const accessFilter = await callAccessFilter(req.user, req.access);
    const filter = { ...accessFilter };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.direction === 'inbound') filter.direction = 'inbound';
    if (req.query.direction === 'outbound') {
      filter.$and = [...(filter.$and || []), { $or: [{ direction: 'outbound' }, { direction: { $exists: false } }] }];
    }
    if (req.query.fromNumber && req.query.fromNumber !== 'all') {
      const fromNumber = normalizePhone(req.query.fromNumber);
      if (!fromNumber) return errorResponse(res, 400, 'Invalid calling number filter');
      filter.$and = [...(filter.$and || []), { $or: [{ virtualNumber: fromNumber }, { virtualNumber: { $exists: false }, fromNumber }] }];
    }
    const [calls, total, virtualNumbers, legacyCallingNumbers] = await Promise.all([
      CallLog.find(filter)
        .select('lead leadModel calledBy callDatetime durationSeconds direction routeStatus fromNumber toNumber virtualNumber customerNumber status recordingStatus transcriptionStatus hangupCause')
        .populate('lead', 'name companyName customerName')
        .populate('calledBy', 'name email role')
        .sort({ callDatetime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CallLog.countDocuments(filter),
      CallLog.distinct('virtualNumber', accessFilter),
      CallLog.distinct('fromNumber', { ...accessFilter, direction: { $ne: 'inbound' } }),
    ]);
    return successResponse(res, 200, 'Call history fetched', {
      calls,
      callingNumbers: Array.from(new Set([...virtualNumbers, ...legacyCallingNumbers])).filter(Boolean).sort(),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) { next(error); }
};

export const getCallLogDetails = async (req, res, next) => {
  try {
    await reconcileStaleCallStatuses();
    const accessFilter = await callAccessFilter(req.user, req.access);
    const call = await CallLog.findOne({ _id: req.params.callLogId, ...accessFilter })
      .populate('lead').populate('calledBy', 'name email role').populate('manualCommentBy', 'name');
    if (!call) return errorResponse(res, 404, 'Call not found');
    await syncActiveCallFromPlivo(call);
    if (call.recordingStatus === 'ready' && !isUsableTranscript(call.transcriptText)) {
      call.transcriptText = '';
      const attempts = Number(call.transcriptionAttempts || 0);
      const geminiConfigured = isGeminiTranscriptionConfigured();
      if (call.transcriptionStatus === 'completed') {
        call.transcriptionStatus = geminiConfigured ? 'pending' : 'failed';
        call.transcriptionError = geminiConfigured ? '' : 'Gemini API key is not configured on the backend';
        await call.save();
      } else if (!geminiConfigured && call.transcriptionStatus !== 'processing') {
        call.transcriptionStatus = 'failed';
        call.transcriptionError = 'Gemini API key is not configured on the backend';
        await call.save();
      }
      if (geminiConfigured && call.transcriptionStatus !== 'processing' && attempts < MAX_TRANSCRIPTION_ATTEMPTS) {
        if (scheduleCallTranscription(call._id)) call.transcriptionStatus = 'processing';
      }
    }
    return successResponse(res, 200, 'Call details fetched', call);
  } catch (error) { next(error); }
};

export const retryCallTranscription = async (req, res, next) => {
  try {
    if (!isGeminiTranscriptionConfigured()) {
      return errorResponse(res, 503, 'Gemini API key is not configured on the backend');
    }
    const accessFilter = await callAccessFilter(req.user, req.access);
    const call = await CallLog.findOne({ _id: req.params.callLogId, ...accessFilter });
    if (!call) return errorResponse(res, 404, 'Call not found');
    if (call.recordingStatus !== 'ready' || !call.recordingUrl) {
      return errorResponse(res, 409, 'The call recording is not ready for transcription');
    }
    if (call.transcriptionStatus === 'processing') {
      return successResponse(res, 202, 'Transcript generation is already in progress', {
        callLogId: call._id,
        transcriptionStatus: 'processing',
      });
    }

    call.transcriptText = '';
    call.transcriptSegments = [];
    call.transcriptLanguage = '';
    call.transcriptionStatus = 'pending';
    call.transcriptionError = '';
    call.transcriptionSource = 'gemini';
    call.transcriptionAttempts = 0;
    call.transcriptionStartedAt = undefined;
    call.transcriptionCompletedAt = undefined;
    await call.save();
    scheduleCallTranscription(call._id);

    return successResponse(res, 202, 'Transcript generation restarted', {
      callLogId: call._id,
      transcriptionStatus: 'processing',
    });
  } catch (error) { next(error); }
};

export const finalizeBrowserCall = async (req, res, next) => {
  try {
    const accessFilter = await callAccessFilter(req.user, req.access);
    const call = await CallLog.findOne({ _id: req.params.callLogId, ...accessFilter });
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
