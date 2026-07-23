import { randomUUID, timingSafeEqual } from 'node:crypto';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingRecipient from '../models/EmailMarketingRecipient.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import {
  confirmSnsSubscription,
  processSesNotification,
  recordRecipientEvent,
  verifySnsSignature,
} from '../services/emailEventService.js';
import { verifyTrackingToken } from '../utils/trackingTokens.js';

const transparentGif = Buffer.from(
  'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  'base64',
);

const parsePayload = (body) => {
  if (typeof body === 'string') return JSON.parse(body);
  return body;
};

const secretMatches = (supplied = '') => {
  const expected = getEmailMarketingConfig().webhookSecret;
  if (!expected || String(supplied).length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(String(supplied)), Buffer.from(expected));
};

export const ingestSesWebhook = async (req, res, next) => {
  try {
    const envelope = parsePayload(req.body);
    const sharedSecretValid = secretMatches(
      req.get('x-email-webhook-secret') || '',
    );
    const snsValid = sharedSecretValid
      ? false
      : await verifySnsSignature(envelope);
    if (!sharedSecretValid && !snsValid) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    if (envelope.Type === 'SubscriptionConfirmation') {
      await confirmSnsSubscription(envelope.SubscribeURL);
      return res.json({ success: true, message: 'SNS subscription confirmed' });
    }
    const event =
      envelope.Type === 'Notification'
        ? parsePayload(envelope.Message)
        : envelope;
    const result = await processSesNotification(event);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const trackingContext = (req) => ({
  ipAddress: req.ip || req.socket?.remoteAddress || '',
  userAgent: req.get('user-agent') || '',
});

export const trackOpen = async (req, res) => {
  try {
    if (
      verifyTrackingToken('recipient', req.params.recipientId, req.query.token)
    ) {
      const recipient = await EmailMarketingRecipient.findById(
        req.params.recipientId,
      );
      if (recipient) {
        await recordRecipientEvent({
          recipient,
          eventType: 'open',
          providerEventId: `track:open:${recipient._id}:${randomUUID()}`,
          ...trackingContext(req),
        });
      }
    }
  } catch {
    // Tracking pixels always return a transparent image.
  }
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': transparentGif.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  return res.end(transparentGif);
};

export const trackClick = async (req, res, next) => {
  try {
    if (
      !verifyTrackingToken('recipient', req.params.recipientId, req.query.token)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid tracking link' });
    }
    let target;
    try {
      target = new URL(String(req.query.url || ''));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid target URL' });
    }
    if (!['http:', 'https:'].includes(target.protocol)) {
      return res.status(400).json({ success: false, message: 'Invalid target URL' });
    }
    const recipient = await EmailMarketingRecipient.findById(
      req.params.recipientId,
    );
    if (recipient) {
      await recordRecipientEvent({
        recipient,
        eventType: 'click',
        providerEventId: `track:click:${recipient._id}:${randomUUID()}`,
        clickedLink: target.toString(),
        ...trackingContext(req),
      });
    }
    return res.redirect(target.toString());
  } catch (error) {
    return next(error);
  }
};

const unsubscribePage = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:48px">
<main style="max-width:560px;margin:auto;background:white;padding:32px;border-radius:16px;border:1px solid #e2e8f0">
<h1 style="font-size:24px">${title}</h1><p style="color:#475569;line-height:1.6">${message}</p></main></body></html>`;

export const unsubscribeRecipient = async (req, res, next) => {
  try {
    if (
      !verifyTrackingToken(
        'unsubscribe',
        req.params.recipientId,
        req.query.token || req.body?.token,
      )
    ) {
      return res
        .status(400)
        .type('html')
        .send(
          unsubscribePage(
            'Invalid unsubscribe link',
            'This unsubscribe link could not be verified.',
          ),
        );
    }
    const recipient = await EmailMarketingRecipient.findById(
      req.params.recipientId,
    );
    if (!recipient) {
      return res
        .status(404)
        .type('html')
        .send(
          unsubscribePage(
            'Link expired',
            'This recipient record is no longer available.',
          ),
        );
    }
    await recordRecipientEvent({
      recipient,
      eventType: 'unsubscribe',
      providerEventId: `unsubscribe:${recipient._id}`,
      ...trackingContext(req),
    });
    return res
      .type('html')
      .send(
        unsubscribePage(
          'You are unsubscribed',
          'This email address has been removed from future marketing emails.',
        ),
      );
  } catch (error) {
    return next(error);
  }
};

export const unsubscribeAutomationExecution = async (req, res, next) => {
  try {
    if (
      !verifyTrackingToken(
        'automation-unsubscribe',
        req.params.executionId,
        req.query.token || req.body?.token,
      )
    ) {
      return res
        .status(400)
        .type('html')
        .send(
          unsubscribePage(
            'Invalid unsubscribe link',
            'This unsubscribe link could not be verified.',
          ),
        );
    }
    const execution = await EmailMarketingAutomationExecution.findById(
      req.params.executionId,
    );
    if (!execution) {
      return res
        .status(404)
        .type('html')
        .send(unsubscribePage('Link expired', 'This unsubscribe link is no longer available.'));
    }
    await EmailMarketingSuppression.findOneAndUpdate(
      {
        workspaceId: execution.workspaceId,
        email: execution.subscriberEmail,
      },
      {
        $set: {
          type: 'unsubscribe',
          reason: 'Automation email unsubscribe',
          status: 'active',
          subscriberId: execution.subscriberId,
          source: 'automation',
          updatedBy: execution.updatedBy,
        },
        $setOnInsert: {
          workspaceId: execution.workspaceId,
          email: execution.subscriberEmail,
          createdBy: execution.createdBy,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    if (execution.subscriberId) {
      await EmailMarketingSubscriber.updateOne(
        {
          _id: execution.subscriberId,
          workspaceId: execution.workspaceId,
        },
        {
          $set: {
            status: 'unsubscribed',
            blocked: false,
            updatedBy: execution.updatedBy,
          },
        },
      );
    }
    return res
      .type('html')
      .send(
        unsubscribePage(
          'You are unsubscribed',
          'This email address has been removed from future marketing emails.',
        ),
      );
  } catch (error) {
    return next(error);
  }
};
