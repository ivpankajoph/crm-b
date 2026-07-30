import Company from '../models/Company.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import LeadMessage from '../models/LeadMessage.js';
import EmailMarketingTemplate from '../modules/email-marketing/models/EmailMarketingTemplate.js';
import WhatsAppTemplate from '../models/WhatsAppTemplate.js';
import { ensureEmailMarketingContext } from '../modules/email-marketing/services/workspaceService.js';
import { resolveEmailMarketingSender } from '../modules/email-marketing/services/senderService.js';
import { renderTemplateHtml } from '../modules/email-marketing/services/emailRenderService.js';
import { sendSesEmail } from '../modules/email-marketing/services/sesService.js';
import { resolveLeadVisibility } from '../services/leadAccessService.js';
import { resolveResourceAccess } from '../services/resourceAccessService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logActivity } from '../utils/activity.js';

const MODELS = { Company, Customer, Lead };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const leadRecipient = (type, lead) => ({
  name: type === 'Company' ? lead.customerName || lead.companyName : lead.name,
  firstName: String(type === 'Company' ? lead.customerName || '' : lead.name || '')
    .trim()
    .split(/\s+/)[0] || '',
  lastName: String(type === 'Company' ? lead.customerName || '' : lead.name || '')
    .trim()
    .split(/\s+/)
    .slice(1)
    .join(' '),
  email: type === 'Company' ? lead.email1 : lead.email,
  phone: type === 'Company' ? lead.mobileNo || lead.phoneNo : lead.phone,
});

const personalize = (content, recipient, html = false) => {
  const values = {
    firstName: recipient.firstName,
    first_name: recipient.firstName,
    lastName: recipient.lastName,
    last_name: recipient.lastName,
    email: recipient.email || '',
    phone: recipient.phone || '',
  };
  return String(content || '').replace(
    /\{\{\s*(firstName|first_name|lastName|last_name|email|phone)\s*\}\}/g,
    (_match, key) => html ? escapeHtml(values[key]) : values[key],
  );
};

const findLead = async (type, id, user) => {
  const Model = MODELS[type];
  if (!Model) return null;
  const visibility = await resolveLeadVisibility(user);
  return Model.findOne({ _id: id, ...visibility.query }).lean();
};

const saveMessage = async ({
  req,
  channel,
  template,
  recipient,
  subject = '',
  result,
}) => {
  const message = await LeadMessage.create({
    lead: req.params.id,
    leadModel: req.params.type,
    channel,
    templateId: String(template._id || template.id),
    templateName: template.name,
    recipient,
    subject,
    status: result.success ? 'sent' : 'failed',
    providerMessageId: result.messageId || '',
    error: result.error || '',
    createdBy: req.user._id,
  });

  await logActivity({
    user: req.user._id,
    actionType: `${channel}_template_sent`,
    description: `${channel === 'email' ? 'Email' : 'WhatsApp'} template ${template.name} ${result.success ? 'sent' : 'failed'}`,
    entityType: req.params.type,
    entityId: req.params.id,
    metadata: {
      templateId: String(template._id || template.id),
      recipient,
      providerMessageId: result.messageId || '',
      status: message.status,
    },
  });

  return message.populate('createdBy', 'name email');
};

export const sendLeadEmail = async (req, res, next) => {
  try {
    const lead = await findLead(req.params.type, req.params.id, req.user);
    if (!lead) return errorResponse(res, 404, 'Lead not found');

    const templateId = String(req.body.templateId || '');
    const resource = await resolveResourceAccess({
      user: req.user,
      resourceType: 'email_template',
      resourceId: templateId,
    });
    if (!resource.allowed) return errorResponse(res, 403, 'This email template is not shared with you');

    const context = await ensureEmailMarketingContext(req.user);
    const template = await EmailMarketingTemplate.findOne({
      _id: templateId,
      workspaceId: context.workspaceId,
      status: 'active',
    }).lean();
    if (!template) return errorResponse(res, 400, 'Email template is unavailable or inactive');

    const recipient = leadRecipient(req.params.type, lead);
    if (!emailPattern.test(String(recipient.email || '').trim())) {
      return errorResponse(res, 400, 'Lead does not have a valid email address');
    }
    const baseHtml = renderTemplateHtml(template);
    if (!baseHtml) return errorResponse(res, 400, 'Email template has no content');

    const sender = await resolveEmailMarketingSender(context);
    const subject = personalize(template.subject || template.name, recipient);
    const html = personalize(baseHtml, recipient, true);
    const text = personalize(
      baseHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      recipient,
    );

    try {
      const response = await sendSesEmail({
        fromName: sender.fromName,
        fromEmail: sender.fromEmail,
        replyTo: sender.replyTo,
        recipient: recipient.email,
        subject,
        html,
        text,
        tags: {
          purpose: 'crm-lead-message',
          leadType: req.params.type,
          templateId,
        },
      });
      const message = await saveMessage({
        req,
        channel: 'email',
        template,
        recipient: recipient.email,
        subject,
        result: { success: true, messageId: response.MessageId || '' },
      });
      return successResponse(res, 200, 'Email sent successfully', message);
    } catch (sendError) {
      await saveMessage({
        req,
        channel: 'email',
        template,
        recipient: recipient.email,
        subject,
        result: { success: false, error: sendError.message },
      });
      throw sendError;
    }
  } catch (error) {
    next(error);
  }
};

export const sendLeadWhatsApp = async (req, res, next) => {
  try {
    const lead = await findLead(req.params.type, req.params.id, req.user);
    if (!lead) return errorResponse(res, 404, 'Lead not found');

    const templateId = String(req.body.templateId || '');
    const resource = await resolveResourceAccess({
      user: req.user,
      resourceType: 'whatsapp_template',
      resourceId: templateId,
    });
    if (!resource.allowed) return errorResponse(res, 403, 'This WhatsApp template is not shared with you');

    const whatsappUserId = `crm:${resource.ownerUserId}`;
    const template = await WhatsAppTemplate.findOne({
      userId: whatsappUserId,
      id: templateId,
    }).lean();
    if (!template) return errorResponse(res, 404, 'WhatsApp template not found');
    const approvalStatus = String(template.metaStatus || template.status || '').toLowerCase();
    if (approvalStatus !== 'approved') {
      return errorResponse(res, 400, 'Only approved WhatsApp templates can be sent');
    }

    const recipient = leadRecipient(req.params.type, lead);
    if (!String(recipient.phone || '').replace(/\D/g, '')) {
      return errorResponse(res, 400, 'Lead does not have a valid phone number');
    }

    const { sendTemplateMessage } = await import(
      '../modules/whatsapp-marketing/server/modules/broadcast/broadcast.service.js'
    );
    const result = await sendTemplateMessage(
      recipient.phone,
      template.name,
      recipient.name,
      { allowLanguageFallback: true },
      whatsappUserId,
    );
    const message = await saveMessage({
      req,
      channel: 'whatsapp',
      template,
      recipient: recipient.phone,
      result,
    });
    if (!result.success) {
      return errorResponse(res, 502, result.error || 'WhatsApp message could not be sent');
    }
    return successResponse(res, 200, 'WhatsApp message sent successfully', message);
  } catch (error) {
    next(error);
  }
};
