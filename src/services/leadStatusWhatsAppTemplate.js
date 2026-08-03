import { getEmailMarketingConfig } from '../modules/email-marketing/config/emailMarketingConfig.js';

export const LEAD_STATUS_WHATSAPP_TEMPLATES = Object.freeze({
  New: 'lead_conversation_acknowledgement_v1',
  Interested: 'enquiry_requirement_recorded_v1',
  'Not Interested': 'enquiry_closure_confirmation_v1',
  Prospective: 'enquiry_review_confirmation_v1',
  'Follow Up': 'followup_appointment_confirmation_v1',
  Committed: 'service_request_confirmation_v1',
  Converted: 'onboarding_process_confirmation_v1',
});

const cleanParameter = (value, fallback = '') => String(value ?? fallback)
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, 1000);

const statusDetails = (lead, status) => (
  lead?.statusDetails?.status === status ? lead.statusDetails : {}
);

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: getEmailMarketingConfig().defaultTimezone,
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeZone: getEmailMarketingConfig().defaultTimezone,
  }).format(date);
};

export const leadEnquiryReference = (lead) => {
  const id = cleanParameter(lead?._id || lead?.id).replace(/[^a-z0-9]/gi, '');
  return `ENQ-${(id.slice(-7) || 'PENDING').toUpperCase()}`;
};

export const resolveLeadWhatsAppIdentity = (leadType, lead) => ({
  companyName: cleanParameter(
    leadType === 'Company' ? lead.companyName : lead.company || lead.name,
    'Customer',
  ),
  phone: cleanParameter(
    leadType === 'Company' ? lead.mobileNo || lead.phoneNo : lead.phone,
  ),
});

export const normalizeWhatsAppNumber = (phone = '') => {
  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.length === 10) digits = `91${digits}`;
  else if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
};

export const buildLeadStatusWhatsAppMessage = ({ leadType, lead, status }) => {
  const { companyName, phone } = resolveLeadWhatsAppIdentity(leadType, lead);
  const reference = leadEnquiryReference(lead);
  const details = statusDetails(lead, status);
  let templateName = LEAD_STATUS_WHATSAPP_TEMPLATES[status];
  let parameters;

  switch (status) {
    case 'New':
      parameters = [companyName];
      break;
    case 'Demo Scheduled': {
      const demoMode = cleanParameter(details.demoMode);
      const demoDateTime = formatDateTime(details.demoDateTime || lead.scheduledDateTime || lead.followTypeDate);
      if (demoMode === 'Online') {
        templateName = 'demo_appointment_online_update_v1';
        parameters = [companyName, reference, demoDateTime, cleanParameter(details.meetingLink)];
      } else if (demoMode === 'On-site') {
        templateName = 'demo_appointment_onsite_update_v1';
        parameters = [companyName, reference, demoDateTime, cleanParameter(details.location)];
      } else {
        return { status: 'skipped', reason: 'demo_mode_missing', phone, reference };
      }
      break;
    }
    case 'Interested':
      parameters = [
        companyName,
        reference,
        cleanParameter(details.productService || lead.products, 'Requirements discussed'),
      ];
      break;
    case 'Not Interested':
      parameters = [companyName, reference];
      break;
    case 'Prospective':
      parameters = [
        companyName,
        reference,
        formatDate(details.expectedClosingDate) || 'To be confirmed',
      ];
      break;
    case 'Follow Up':
      parameters = [
        companyName,
        reference,
        formatDateTime(lead.followUpDateTime || lead.followTypeDate),
      ];
      break;
    case 'Committed':
      parameters = [
        companyName,
        cleanParameter(details.committedProductService || lead.products, 'Requested service'),
        reference,
        formatDate(details.expectedCompletionDate) || 'To be confirmed',
      ];
      break;
    case 'Converted':
      parameters = [
        companyName,
        cleanParameter(details.productService || lead.products, 'Requested service'),
        reference,
        formatDate(details.convertedAt || lead.leadStatusChangedAt || new Date()),
      ];
      break;
    default:
      return { status: 'skipped', reason: 'unsupported_status', phone, reference };
  }

  if (!templateName) return { status: 'skipped', reason: 'template_not_mapped', phone, reference };
  if (parameters.some((value) => !cleanParameter(value))) {
    return { status: 'skipped', reason: 'required_template_value_missing', phone, reference, templateName };
  }
  return {
    status: 'ready',
    templateName,
    language: 'en_US',
    phone,
    normalizedPhone: normalizeWhatsAppNumber(phone),
    reference,
    parameters: parameters.map((value) => cleanParameter(value)),
  };
};
