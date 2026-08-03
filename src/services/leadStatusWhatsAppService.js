import LeadMessage from '../models/LeadMessage.js';
import User from '../models/User.js';
import WhatsAppTemplate from '../models/WhatsAppTemplate.js';
import { resolveAccountOwnerId } from './accessControlService.js';
import { logActivity } from '../utils/activity.js';
import { buildLeadStatusWhatsAppMessage } from './leadStatusWhatsAppTemplate.js';

const logDelivery = ({ actorUserId, leadType, lead, status, trigger, deliveryStatus, recipient, templateName = '', providerMessageId = '', error = '' }) => logActivity({
  user: actorUserId,
  actionType: `automated_lead_status_whatsapp_${deliveryStatus}`,
  description: `Automated ${status} WhatsApp ${deliveryStatus} for ${lead.companyName || lead.company || lead.name || 'lead'}`,
  entityType: leadType,
  entityId: lead._id,
  metadata: { status, trigger, recipient, templateName, providerMessageId, error },
});

const saveMessage = ({ actorUserId, leadType, lead, template, recipient, deliveryStatus, result = {}, error = '' }) => LeadMessage.create({
  lead: lead._id,
  leadModel: leadType,
  channel: 'whatsapp',
  templateId: String(template?.id || template?._id || template?.name || 'automated-lead-status'),
  templateName: template?.name || 'Automated lead status WhatsApp',
  recipient,
  status: deliveryStatus,
  providerMessageId: result.messageId || '',
  error,
  createdBy: actorUserId,
});

const placeholderCount = (content = '') => Math.max(
  0,
  ...[...String(content).matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1])),
);

export const sendAutomatedLeadStatusWhatsApp = async ({
  leadType,
  lead,
  status,
  actorUserId,
  trigger,
}) => {
  const message = buildLeadStatusWhatsAppMessage({ leadType, lead, status });
  if (message.status !== 'ready' || !message.normalizedPhone) {
    const reason = !message.normalizedPhone ? 'Lead does not have a valid WhatsApp number' : message.reason;
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'skipped',
      recipient: message.phone || '',
      templateName: message.templateName || '',
      error: reason,
    });
    return { status: 'skipped', reason };
  }

  let template;
  try {
    const actor = await User.findById(actorUserId).select('_id parent createdBy').lean();
    if (!actor) throw new Error('Status-changing user could not be resolved');
    const ownerId = await resolveAccountOwnerId(actor);
    const whatsappUserId = `crm:${ownerId}`;
    template = await WhatsAppTemplate.findOne({
      userId: whatsappUserId,
      language: message.language,
      $or: [{ name: message.templateName }, { id: message.templateName }],
    }).lean();
    if (!template) throw new Error(`Approved WhatsApp template ${message.templateName} was not found for the account owner`);
    const approvalStatus = String(template.metaStatus || template.status || '').toLowerCase();
    if (approvalStatus !== 'approved') throw new Error(`WhatsApp template ${message.templateName} is not approved`);
    const expectedParameters = placeholderCount(template.content);
    if (expectedParameters !== message.parameters.length) {
      throw new Error(`WhatsApp template ${message.templateName} expects ${expectedParameters} body parameters but ${message.parameters.length} were provided`);
    }

    const components = [{
      type: 'body',
      parameters: message.parameters.map((value) => ({ type: 'text', text: value })),
    }];
    const whatsappService = await import(
      '../modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.service.js'
    );
    const result = await whatsappService.sendTemplateMessage(
      message.normalizedPhone,
      template.name,
      message.language,
      components,
      whatsappUserId,
    );
    if (!result.success) throw new Error(result.error || 'WhatsApp template could not be sent');

    await saveMessage({
      actorUserId,
      leadType,
      lead,
      template,
      recipient: result.acceptedRecipient || message.normalizedPhone,
      deliveryStatus: 'sent',
      result,
    });
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'sent',
      recipient: result.acceptedRecipient || message.normalizedPhone,
      templateName: template.name,
      providerMessageId: result.messageId || '',
    });
    return { status: 'sent', providerMessageId: result.messageId || '' };
  } catch (error) {
    const errorMessage = String(error?.message || 'Automated WhatsApp could not be sent').slice(0, 2000);
    if (template) {
      try {
        await saveMessage({
          actorUserId,
          leadType,
          lead,
          template,
          recipient: message.normalizedPhone,
          deliveryStatus: 'failed',
          error: errorMessage,
        });
      } catch (loggingError) {
        console.error('Automated WhatsApp message log failed:', loggingError.message);
      }
    }
    await logDelivery({
      actorUserId,
      leadType,
      lead,
      status,
      trigger,
      deliveryStatus: 'failed',
      recipient: message.normalizedPhone,
      templateName: message.templateName,
      error: errorMessage,
    });
    console.error(`Automated ${status} WhatsApp failed for ${leadType} ${lead._id}:`, errorMessage);
    return { status: 'failed', error: errorMessage };
  }
};
