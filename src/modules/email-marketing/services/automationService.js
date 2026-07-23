import dns from 'node:dns/promises';
import net from 'node:net';

import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingSegment from '../models/EmailMarketingSegment.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import EmailMarketingWorkspace from '../models/EmailMarketingWorkspace.js';
import { calculateDelayMs } from '../utils/campaign.js';
import { createTrackingToken } from '../utils/trackingTokens.js';
import { buildSegmentFilter } from '../utils/segmentFilter.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { sendSesEmail } from './sesService.js';
import { debitEmailCredits, refundEmailCredits } from './billingService.js';
import { resolveEmailMarketingSender } from './senderService.js';
import { renderTemplateHtml } from './emailRenderService.js';

const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

export const normalizeAutomationPayload = (payload) => {
  const normalized = { ...payload };
  if (Object.hasOwn(payload, 'segmentId')) {
    normalized.segmentId = payload.segmentId || null;
  }
  if (payload.steps) {
    normalized.steps = payload.steps.map((step) => ({
      ...step,
      templateId: step.templateId || null,
    }));
  }
  return normalized;
};

export const validateAutomationDefinition = async (context, payload) => {
  const emailSteps = (payload.steps || []).filter(
    (step) => step.type === 'send_email',
  );
  const templateIds = emailSteps.map((step) => step.templateId);
  if (templateIds.length) {
    const count = await EmailMarketingTemplate.countDocuments({
      workspaceId: context.workspaceId,
      _id: { $in: templateIds },
      status: { $ne: 'archived' },
    });
    if (count !== new Set(templateIds.map(String)).size) {
      throw httpError(400, 'One or more automation templates are unavailable');
    }
  }
  if (payload.segmentId) {
    const segment = await EmailMarketingSegment.exists({
      workspaceId: context.workspaceId,
      _id: payload.segmentId,
    });
    if (!segment) throw httpError(400, 'Automation segment was not found');
  }
  return true;
};

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const personalize = (content, subscriber, html = false) =>
  String(content || '').replace(
    /\{\{\s*(firstName|first_name|lastName|last_name|email|phone)\s*\}\}/g,
    (_match, key) => {
      const field =
        key === 'first_name'
          ? 'firstName'
          : key === 'last_name'
            ? 'lastName'
            : key;
      return html
        ? escapeHtml(subscriber?.[field] || '')
        : String(subscriber?.[field] || '');
    },
  );

const isPrivateAddress = (address) => {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
};

const assertSafeWebhookUrl = async (value) => {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    ['localhost', 'localhost.localdomain'].includes(url.hostname.toLowerCase())
  ) {
    throw httpError(400, 'Automation webhook URL is not allowed');
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw httpError(400, 'Automation webhook must resolve to a public address');
  }
  return url;
};

const conditionMatches = (step, subscriber, execution) => {
  const actual =
    execution.context?.[step.field] ??
    subscriber?.customFields?.[step.field] ??
    subscriber?.[step.field];
  const current = Array.isArray(actual)
    ? actual.map(String).join(',').toLowerCase()
    : String(actual ?? '').toLowerCase();
  const expected = String(step.value || '').toLowerCase();
  if (step.operator === 'exists') return actual !== undefined && actual !== null;
  if (step.operator === 'equals') return current === expected;
  if (step.operator === 'not_equals') return current !== expected;
  if (step.operator === 'contains') return current.includes(expected);
  if (step.operator === 'not_contains') return !current.includes(expected);
  return false;
};

const appendStepResult = (execution, step, stepIndex, status, message, messageId = '') => {
  execution.stepResults.push({
    stepIndex,
    stepType: step.type,
    status,
    message,
    messageId,
    completedAt: new Date(),
  });
};

const completeExecution = async (execution, automation, status = 'completed') => {
  execution.status = status;
  execution.completedAt = new Date();
  execution.scheduledFor = null;
  await execution.save();
  await EmailMarketingAutomation.updateOne(
    { _id: automation._id, workspaceId: automation.workspaceId },
    {
      $inc: {
        ...(status === 'completed' || status === 'exited'
          ? { completedCount: 1 }
          : { failedCount: 1 }),
      },
      $set: { lastRunAt: new Date() },
    },
  );
  return null;
};

export const executeAutomation = async ({ executionId, workspaceId }) => {
  const execution = await EmailMarketingAutomationExecution.findOne({
    _id: executionId,
    workspaceId,
    status: { $in: ['pending', 'running'] },
  });
  if (!execution) return null;
  const automation = await EmailMarketingAutomation.findOne({
    _id: execution.automationId,
    workspaceId,
  });
  if (!automation) throw httpError(404, 'Automation was not found');
  if (automation.status !== 'active' && !execution.context?.testRun) {
    execution.status = 'cancelled';
    execution.completedAt = new Date();
    await execution.save();
    return null;
  }

  const subscriber = execution.subscriberId
    ? await EmailMarketingSubscriber.findOne({
        _id: execution.subscriberId,
        workspaceId,
      })
    : await EmailMarketingSubscriber.findOne({
        email: execution.subscriberEmail,
        workspaceId,
      });
  const contact = subscriber || {
    email: execution.subscriberEmail,
    firstName: '',
    lastName: '',
    phone: '',
    customFields: {},
    tags: [],
  };
  execution.status = 'running';
  execution.startedAt ||= new Date();

  for (
    let stepIndex = execution.currentStep;
    stepIndex < automation.steps.length;
    stepIndex += 1
  ) {
    const step = automation.steps[stepIndex];
    execution.currentStep = stepIndex;

    if (step.type === 'delay') {
      const nextRunAt = new Date(
        Date.now() + calculateDelayMs(step.delayValue, step.delayUnit),
      );
      execution.currentStep = stepIndex + 1;
      execution.scheduledFor = nextRunAt;
      appendStepResult(execution, step, stepIndex, 'completed', `Delayed until ${nextRunAt.toISOString()}`);
      await execution.save();
      return { nextRunAt };
    }

    if (step.type === 'condition' && !conditionMatches(step, contact, execution)) {
      appendStepResult(execution, step, stepIndex, 'skipped', 'Condition did not match');
      execution.currentStep = stepIndex + 1;
      return completeExecution(execution, automation, 'exited');
    }

    if (step.type === 'send_email') {
      const workspace = await EmailMarketingWorkspace.findById(workspaceId).lean();
      const sender = await resolveEmailMarketingSender(
        { workspaceId },
        {
          requestedFromName: workspace?.settings?.defaultFromName,
          requestedFromEmail: workspace?.settings?.defaultFromEmail,
          requestedReplyTo:
            automation.replyTo || workspace?.settings?.defaultReplyTo,
        },
      );
      const template = await EmailMarketingTemplate.findOne({
        _id: step.templateId,
        workspaceId,
        status: { $ne: 'archived' },
      }).lean();
      if (!template) throw httpError(400, 'Automation email template is unavailable');
      const templateHtml = renderTemplateHtml(template);
      if (!templateHtml) {
        throw httpError(400, 'Automation email template has no content');
      }
      const config = getEmailMarketingConfig();
      const token = createTrackingToken('automation-unsubscribe', execution._id);
      const unsubscribeUrl = `${config.publicUrl}/api/email-marketing/events/automation-unsubscribe/${execution._id}?token=${token}`;
      const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-family:Arial,sans-serif;font-size:12px"><a href="${unsubscribeUrl}">Unsubscribe</a></div>`;
      const html = `${personalize(templateHtml, contact, true)}${footer}`;
      const text = `${personalize(templateHtml, contact)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()}\n\nUnsubscribe: ${unsubscribeUrl}`;
      const debit = await debitEmailCredits({
        workspaceId,
        actorUserId: automation.updatedBy,
        credits: 1,
        type: 'automation_send',
        sourceType: 'automation',
        sourceId: automation._id,
        idempotencyKey: `automation:${execution._id}:${stepIndex}`,
        description: `Automation email: ${automation.name}`,
      });
      let sesAccepted = false;
      try {
        const response = await sendSesEmail({
          fromName: sender.fromName,
          fromEmail: sender.fromEmail,
          replyTo: sender.replyTo,
          recipient: contact.email,
          subject: personalize(step.subject, contact),
          html,
          text,
          unsubscribeUrl,
          tags: {
            workspaceId,
            automationId: automation._id,
            executionId: execution._id,
          },
        });
        sesAccepted = true;
        execution.emailsSent += 1;
        appendStepResult(execution, step, stepIndex, 'completed', 'Email sent', response.MessageId);
        await EmailMarketingAutomation.updateOne(
          { _id: automation._id, workspaceId },
          { $inc: { emailsSent: 1 } },
        );
      } catch (error) {
        if (!sesAccepted) {
          await refundEmailCredits({
            debit,
            actorUserId: automation.updatedBy,
            description: `Refund for failed automation email: ${automation.name}`,
          });
        }
        throw error;
      }
    } else if (step.type === 'add_tag' || step.type === 'remove_tag') {
      if (!subscriber) {
        appendStepResult(execution, step, stepIndex, 'skipped', 'Subscriber record is unavailable');
      } else {
        const tags = String(step.value)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        await EmailMarketingSubscriber.updateOne(
          { _id: subscriber._id, workspaceId },
          step.type === 'add_tag'
            ? { $addToSet: { tags: { $each: tags } } }
            : { $pull: { tags: { $in: tags } } },
        );
        appendStepResult(execution, step, stepIndex, 'completed', `${step.type === 'add_tag' ? 'Added' : 'Removed'} tags`);
      }
    } else if (step.type === 'webhook') {
      const url = await assertSafeWebhookUrl(step.value);
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          automationId: String(automation._id),
          executionId: String(execution._id),
          subscriber: { id: subscriber?._id || null, email: contact.email },
          context: execution.context,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Automation webhook returned ${response.status}`);
      appendStepResult(execution, step, stepIndex, 'completed', `Webhook returned ${response.status}`);
    } else if (step.type === 'exit') {
      appendStepResult(execution, step, stepIndex, 'completed', 'Workflow exited');
      execution.currentStep = stepIndex + 1;
      return completeExecution(execution, automation, 'exited');
    } else if (step.type === 'condition') {
      appendStepResult(execution, step, stepIndex, 'completed', 'Condition matched');
    }

    execution.currentStep = stepIndex + 1;
    await execution.save();
  }
  return completeExecution(execution, automation);
};

export const createAutomationExecutions = async ({
  context,
  actorUserId,
  trigger,
  subscriber,
  email,
  triggerContext = {},
  idempotencyKey = '',
  automationId = null,
  testRun = false,
}) => {
  const filter = {
    workspaceId: context.workspaceId,
    ...(automationId
      ? { _id: automationId }
      : { trigger, status: 'active' }),
  };
  const automations = await EmailMarketingAutomation.find(filter);
  const executions = [];
  for (const automation of automations) {
    if (!testRun && subscriber && (subscriber.status !== 'subscribed' || subscriber.blocked)) {
      continue;
    }
    if (automation.segmentId && !subscriber) continue;
    if (automation.segmentId && subscriber) {
      const segment = await EmailMarketingSegment.findOne({
        _id: automation.segmentId,
        workspaceId: context.workspaceId,
      }).lean();
      if (!segment) continue;
      const matches = await EmailMarketingSubscriber.exists({
        ...buildSegmentFilter(context, segment),
        _id: subscriber._id,
      });
      if (!matches) continue;
    }
    try {
      const execution = await EmailMarketingAutomationExecution.create({
        workspaceId: context.workspaceId,
        automationId: automation._id,
        subscriberId: subscriber?._id || null,
        subscriberEmail: subscriber?.email || email,
        trigger: automation.trigger,
        triggerKey: idempotencyKey
          ? `${idempotencyKey}:${automation._id}`
          : '',
        context: { ...triggerContext, ...(testRun ? { testRun: true } : {}) },
        status: 'pending',
        scheduledFor: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      });
      await EmailMarketingAutomation.updateOne(
        { _id: automation._id, workspaceId: context.workspaceId },
        { $inc: { executionCount: 1 }, $set: { lastRunAt: new Date() } },
      );
      executions.push(execution);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await EmailMarketingAutomationExecution.findOne({
        workspaceId: context.workspaceId,
        automationId: automation._id,
        triggerKey: `${idempotencyKey}:${automation._id}`,
      });
      if (existing) executions.push(existing);
    }
  }
  return executions;
};
