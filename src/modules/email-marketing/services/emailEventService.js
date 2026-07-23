import crypto from 'node:crypto';

import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingRecipient from '../models/EmailMarketingRecipient.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';

const eventConfig = {
  delivery: {
    status: 'delivered',
    timestampField: 'deliveredAt',
    metric: 'delivered',
  },
  open: { status: 'opened', timestampField: 'openedAt', metric: 'opens' },
  click: { status: 'clicked', timestampField: 'clickedAt', metric: 'clicks' },
  bounce: {
    status: 'bounced',
    timestampField: 'bouncedAt',
    metric: 'bounces',
  },
  complaint: {
    status: 'complained',
    timestampField: 'complainedAt',
    metric: 'complaints',
  },
  unsubscribe: {
    status: 'unsubscribed',
    timestampField: 'unsubscribedAt',
    metric: 'unsubscribes',
  },
  reject: {
    status: 'rejected',
    timestampField: 'failedAt',
    metric: null,
  },
  failed: {
    status: 'failed',
    timestampField: 'failedAt',
    metric: null,
  },
};

const statusPriority = {
  queued: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  unsubscribed: 5,
  bounced: 5,
  complained: 6,
  rejected: 6,
  failed: 6,
};

export const recordRecipientEvent = async ({
  recipient,
  eventType,
  timestamp = new Date(),
  providerEventId,
  clickedLink = '',
  ipAddress = '',
  userAgent = '',
  rawPayload = null,
}) => {
  const config = eventConfig[eventType];
  if (!config) return null;
  try {
    await EmailMarketingEvent.create({
      workspaceId: recipient.workspaceId,
      campaignId: recipient.campaignId,
      recipientId: recipient._id,
      subscriberId: recipient.subscriberId,
      recipientEmail: recipient.email,
      messageId: recipient.messageId || `tracking:${recipient._id}`,
      providerEventId,
      eventType,
      timestamp,
      clickedLink,
      ipAddress,
      userAgent,
      rawPayload,
      createdBy: recipient.createdBy,
      updatedBy: recipient.updatedBy,
    });
  } catch (error) {
    if (error.code === 11000) return { duplicate: true, recipient };
    throw error;
  }

  const wasUnique = !recipient[config.timestampField];
  recipient[config.timestampField] ||= timestamp;
  if (
    (statusPriority[config.status] || 0) >=
    (statusPriority[recipient.status] || 0)
  ) {
    recipient.status = config.status;
  }
  await recipient.save();

  if (config.metric) {
    const increments = { [`metrics.${config.metric}`]: 1 };
    if (eventType === 'open' && wasUnique) increments['metrics.uniqueOpens'] = 1;
    if (eventType === 'click' && wasUnique) increments['metrics.uniqueClicks'] = 1;
    await EmailMarketingCampaign.updateOne(
      { _id: recipient.campaignId, workspaceId: recipient.workspaceId },
      { $inc: increments },
    );
  }

  if (['bounce', 'complaint', 'unsubscribe'].includes(eventType)) {
    const type = eventType;
    await EmailMarketingSuppression.findOneAndUpdate(
      { workspaceId: recipient.workspaceId, email: recipient.email },
      {
        $set: {
          type,
          reason: `SES ${eventType}`,
          status: 'active',
          subscriberId: recipient.subscriberId,
          source: 'ses',
          updatedBy: recipient.updatedBy,
        },
        $setOnInsert: {
          workspaceId: recipient.workspaceId,
          email: recipient.email,
          createdBy: recipient.createdBy,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await EmailMarketingSubscriber.updateOne(
      { _id: recipient.subscriberId, workspaceId: recipient.workspaceId },
      {
        $set: {
          status:
            eventType === 'unsubscribe' ? 'unsubscribed' : 'suppressed',
          blocked: eventType !== 'unsubscribe',
          updatedBy: recipient.updatedBy,
        },
      },
    );
  }
  return { duplicate: false, recipient };
};

const snsFields = {
  Notification: [
    'Message',
    'MessageId',
    'Subject',
    'Timestamp',
    'TopicArn',
    'Type',
  ],
  SubscriptionConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
  UnsubscribeConfirmation: [
    'Message',
    'MessageId',
    'SubscribeURL',
    'Timestamp',
    'Token',
    'TopicArn',
    'Type',
  ],
};

const isTrustedSnsUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
};

export const verifySnsSignature = async (message) => {
  if (
    !message?.Signature ||
    !message?.SigningCertURL ||
    !snsFields[message.Type] ||
    !isTrustedSnsUrl(message.SigningCertURL)
  ) {
    return false;
  }
  const canonical = snsFields[message.Type]
    .filter((field) => message[field] !== undefined)
    .map((field) => `${field}\n${message[field]}\n`)
    .join('');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(message.SigningCertURL, {
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const certificate = await response.text();
    const verifier = crypto.createVerify(
      message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1',
    );
    verifier.update(canonical, 'utf8');
    verifier.end();
    return verifier.verify(certificate, message.Signature, 'base64');
  } finally {
    clearTimeout(timeout);
  }
};

const eventRecipients = (event) => {
  const type = String(event.eventType || '').toLowerCase();
  if (type === 'bounce') {
    return event.bounce?.bouncedRecipients?.map((item) => item.emailAddress) || [];
  }
  if (type === 'complaint') {
    return (
      event.complaint?.complainedRecipients?.map((item) => item.emailAddress) ||
      []
    );
  }
  return event.mail?.destination || [];
};

const eventTimestamp = (event) => {
  const type = String(event.eventType || '').toLowerCase();
  return new Date(
    event[type]?.timestamp || event.mail?.timestamp || Date.now(),
  );
};

export const processSesNotification = async (event) => {
  const messageId = event.mail?.messageId;
  const eventType = String(event.eventType || '').toLowerCase();
  if (!messageId || !eventConfig[eventType]) return { processed: 0 };
  let processed = 0;
  for (const email of eventRecipients(event)) {
    const recipient = await EmailMarketingRecipient.findOne({
      messageId,
      email: String(email).toLowerCase(),
    });
    if (!recipient) continue;
    const result = await recordRecipientEvent({
      recipient,
      eventType,
      timestamp: eventTimestamp(event),
      providerEventId: `ses:${messageId}:${eventType}:${email}:${eventTimestamp(
        event,
      ).toISOString()}`,
      rawPayload: event,
    });
    if (!result?.duplicate) processed += 1;
  }
  return { processed };
};

export const confirmSnsSubscription = async (url) => {
  if (!isTrustedSnsUrl(url)) throw new Error('Untrusted SNS subscription URL');
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error('Unable to confirm SNS subscription');
  return true;
};
