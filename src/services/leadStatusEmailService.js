import LeadMessage from '../models/LeadMessage.js';
import { getPlatformMarketingSender } from '../modules/email-marketing/services/senderService.js';
import { sendSesEmail } from '../modules/email-marketing/services/sesService.js';
import { logActivity } from '../utils/activity.js';
import {
  LEAD_STATUS_EMAIL_THEMES,
  renderLeadStatusEmail,
  resolveLeadEmailIdentity,
} from './leadStatusEmailTemplate.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const logDelivery = ({ actorUserId, leadType, lead, status, trigger, deliveryStatus, recipient, providerMessageId = '', error = '' }) => logActivity({
  user: actorUserId,
  actionType: `automated_lead_status_email_${deliveryStatus}`,
  description: `Automated ${status} email ${deliveryStatus} for ${lead.companyName || lead.company || lead.name || 'lead'}`,
  entityType: leadType,
  entityId: lead._id,
  metadata: { status, trigger, recipient, providerMessageId, error },
});

export const sendAutomatedLeadStatusEmail = async ({
  leadType,
  lead,
  status,
  actorUserId,
  trigger,
}) => {
  if (!LEAD_STATUS_EMAIL_THEMES[status]) return { status: 'skipped', reason: 'unsupported_status' };

  const { email } = resolveLeadEmailIdentity(leadType, lead);
  if (!emailPattern.test(email)) {
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'skipped',
      recipient: email,
      error: 'Lead does not have a valid email address',
    });
    return { status: 'skipped', reason: 'invalid_recipient' };
  }

  let rendered;
  try {
    rendered = renderLeadStatusEmail({ leadType, lead, status });
    const sender = getPlatformMarketingSender();
    const response = await sendSesEmail({
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyTo: sender.replyTo,
      recipient: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: {
        purpose: 'crm-lead-status',
        leadType: slug(leadType),
        leadStatus: slug(status),
        trigger: slug(trigger),
      },
    });
    const providerMessageId = response.MessageId || '';
    await LeadMessage.create({
      lead: lead._id,
      leadModel: leadType,
      channel: 'email',
      templateId: `automated-lead-status-${slug(status)}`,
      templateName: `Automated ${status} status email`,
      recipient: email,
      subject: rendered.subject,
      status: 'sent',
      providerMessageId,
      createdBy: actorUserId,
    });
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'sent',
      recipient: email,
      providerMessageId,
    });
    return { status: 'sent', providerMessageId };
  } catch (error) {
    const message = String(error?.message || 'Automated email could not be sent').slice(0, 2000);
    try {
      await LeadMessage.create({
        lead: lead._id,
        leadModel: leadType,
        channel: 'email',
        templateId: `automated-lead-status-${slug(status)}`,
        templateName: `Automated ${status} status email`,
        recipient: email,
        subject: rendered?.subject || `${status} update`,
        status: 'failed',
        error: message,
        createdBy: actorUserId,
      });
    } catch (loggingError) {
      console.error('Automated lead email message log failed:', loggingError.message);
    }
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'failed',
      recipient: email,
      error: message,
    });
    console.error(`Automated ${status} email failed for ${leadType} ${lead._id}:`, message);
    return { status: 'failed', error: message };
  }
};
