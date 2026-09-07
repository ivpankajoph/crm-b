import { getEmailMarketingConfig } from '../modules/email-marketing/config/emailMarketingConfig.js';

export const SELLERSLOGIN_WEBSITE = 'https://www.sellerslogin.com/';
export const SELLERSLOGIN_SUPPORT_EMAIL = 'info@sellerslogin.com';

export const LEAD_STATUS_EMAIL_THEMES = Object.freeze({
  New: { primary: '#2563eb', soft: '#eff6ff', heading: 'Thank You for Connecting!', subtitle: 'We appreciate the conversation with you.' },
  'Demo Scheduled': { primary: '#0891b2', soft: '#ecfeff', heading: 'Your Demo Is Scheduled', subtitle: 'Here are the details agreed during our conversation.' },
  Interested: { primary: '#059669', soft: '#ecfdf5', heading: 'Thank You for Your Interest!', subtitle: 'We are pleased to continue the conversation.' },
  'Not Interested': { primary: '#dc2626', soft: '#fef2f2', heading: 'Thank You for Your Time', subtitle: 'We appreciate the opportunity to speak with you.' },
  'Follow Up': { primary: '#d97706', soft: '#fffbeb', heading: 'Follow-Up Scheduled', subtitle: 'This confirms our next conversation.' },
  Committed: { primary: '#1d4ed8', soft: '#eef2ff', heading: 'Thank You for Choosing Us!', subtitle: 'We are ready to move forward together.' },
  Converted: { primary: '#047857', soft: '#ecfdf5', heading: 'Welcome to Sellerslogin!', subtitle: 'We are delighted to have you with us.' },
});

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const cleanText = (value = '') => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

const safeUrl = (value = '') => {
  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const formatDateTime = (value, timezone) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
};

const formatDate = (value, timezone) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeZone: timezone,
  }).format(date);
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(number);
};

const leadValue = (lead, field) => {
  const details = lead?.statusDetails?.status === (lead.leadStatus || lead.status)
    ? lead.statusDetails
    : {};
  return details?.[field];
};

const copyForStatus = (status) => {
  const copies = {
    New: [
      'Thank you for taking the time to speak with us. We appreciate the opportunity to understand your business and requirements.',
      'As discussed, we have recorded the details shared during our conversation and will proceed according to the agreed next steps.',
      'Please contact our support team if you would like to share any additional information.',
    ],
    'Demo Scheduled': [
      'Thank you for speaking with us. As discussed, your product demonstration has been scheduled with the details below.',
      'During the session, we will demonstrate the solution based on the requirements discussed with you.',
      'If you need to reschedule the demonstration, please contact our support team.',
    ],
    Interested: [
      'Thank you for the productive discussion and for expressing your interest in our solution.',
      'Based on our conversation, we have noted your requirements and the areas in which our solution can support your business. We appreciate your positive response and will proceed with the agreed next steps.',
      'Please contact our support team if you have any additional questions or requirements.',
    ],
    'Not Interested': [
      'Thank you for taking the time to discuss your requirements with us.',
      'As discussed, we understand that you do not wish to proceed with our solution at this time. We respect your decision and appreciate the opportunity to present our services to you.',
      'If your requirements change in the future, we would be pleased to assist you.',
    ],
    'Follow Up': [
      'Thank you for speaking with us. As discussed, we have scheduled a follow-up conversation to continue our discussion regarding your requirements.',
      'During the follow-up, we will continue from the points discussed and address any further questions or requirements.',
      'If you need to change the scheduled date or time, please contact our support team.',
    ],
    Committed: [
      'Thank you for the discussion and for confirming your decision to proceed with our solution.',
      'As agreed, we will now move forward with the required formalities and the next stage of our engagement. We appreciate the trust you have placed in us and look forward to working with you.',
      'Please contact our support team if you require any additional information or assistance.',
    ],
    Converted: [
      'Thank you for completing the discussions and formalities with us. We are delighted to officially welcome you as our valued customer.',
      'As agreed, we will now proceed with the onboarding and implementation activities. We appreciate your trust and look forward to building a successful long-term partnership.',
      'Our support team is available if you need any assistance.',
    ],
  };
  return copies[status];
};

const subjectForStatus = (status, companyName, demoMode) => {
  const subjects = {
    New: `Thank You for Speaking with Us – ${companyName}`,
    'Demo Scheduled': `${demoMode === 'On-site' ? 'On-Site Demo' : demoMode === 'Online' ? 'Online Demo' : 'Demo'} Confirmation – ${companyName}`,
    Interested: `Thank You for Confirming Your Interest – ${companyName}`,
    'Not Interested': `Thank You for Your Time – ${companyName}`,
    'Follow Up': `Follow-Up Confirmation – ${companyName}`,
    Committed: `Confirmation of Your Decision to Proceed – ${companyName}`,
    Converted: `Welcome to Sellerslogin – ${companyName}`,
  };
  return subjects[status];
};

const detailRowsForStatus = (status, lead, timezone) => {
  if (status === 'Demo Scheduled') {
    const demoMode = leadValue(lead, 'demoMode');
    const rows = [
      ['Demo Date & Time', formatDateTime(leadValue(lead, 'demoDateTime') || lead.scheduledDateTime || lead.followTypeDate, timezone)],
      ['Demo Mode', demoMode],
    ];
    if (demoMode === 'Online') rows.push(['Meeting Link', safeUrl(leadValue(lead, 'meetingLink'))]);
    if (demoMode === 'On-site') rows.push(['Location', leadValue(lead, 'location')]);
    return rows;
  }
  if (status === 'Follow Up') {
    return [['Follow-Up Date & Time', formatDateTime(lead.followUpDateTime || lead.followTypeDate, timezone)]];
  }
  if (status === 'Interested') {
    return [
      ['Product / Service', leadValue(lead, 'productService')],
      ['Expected Decision Date', formatDate(leadValue(lead, 'expectedDecisionDate'), timezone)],
    ];
  }
  if (status === 'Committed') {
    return [
      ['Product / Service', leadValue(lead, 'committedProductService')],
      ['Deal Value', formatMoney(leadValue(lead, 'dealValue'))],
      ['Expected Completion Date', formatDate(leadValue(lead, 'expectedCompletionDate'), timezone)],
    ];
  }
  if (status === 'Converted') {
    return [
      ['Product / Service', leadValue(lead, 'productService')],
      ['Final Deal Value', formatMoney(leadValue(lead, 'finalDealValue'))],
      ['Conversion Date', formatDate(leadValue(lead, 'convertedAt'), timezone)],
    ];
  }
  return [];
};

const renderDetails = (rows, theme) => {
  const populatedRows = rows.filter(([, value]) => cleanText(value));
  if (!populatedRows.length) return '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:separate;border-spacing:0;background:${theme.soft};border:1px solid ${theme.primary}33;border-radius:12px;overflow:hidden;">${populatedRows.map(([label, value]) => {
    const url = safeUrl(value);
    const renderedValue = url
      ? `<a href="${escapeHtml(url)}" style="color:${theme.primary};font-weight:700;text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>`
      : escapeHtml(value);
    return `<tr><td style="padding:12px 16px;border-bottom:1px solid ${theme.primary}1f;color:#475569;font-size:13px;font-weight:700;width:42%;">${escapeHtml(label)}</td><td style="padding:12px 16px;border-bottom:1px solid ${theme.primary}1f;color:#0f172a;font-size:14px;">${renderedValue}</td></tr>`;
  }).join('')}</table>`;
};

export const resolveLeadEmailIdentity = (leadType, lead) => {
  const companyName = cleanText(
    leadType === 'Company'
      ? lead.companyName
      : lead.company || lead.name,
  ) || 'Customer';
  const email = cleanText(leadType === 'Company' ? lead.email1 : lead.email).toLowerCase();
  return { companyName, email };
};

export const renderLeadStatusEmail = ({ leadType, lead, status }) => {
  const theme = LEAD_STATUS_EMAIL_THEMES[status];
  const paragraphs = copyForStatus(status);
  if (!theme || !paragraphs) throw new RangeError(`Unsupported lead status: ${status}`);

  const { companyName } = resolveLeadEmailIdentity(leadType, lead);
  const timezone = getEmailMarketingConfig().defaultTimezone;
  const demoMode = leadValue(lead, 'demoMode');
  const subject = subjectForStatus(status, companyName, demoMode);
  const details = detailRowsForStatus(status, lead, timezone);
  const detailsHtml = renderDetails(details, theme);
  const year = new Date().getFullYear();
  const paragraphHtml = paragraphs
    .map((paragraph) => `<p style="margin:0 0 18px;color:#334155;font-size:16px;line-height:1.75;">${escapeHtml(paragraph)}</p>`)
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08);"><tr><td align="center" style="padding:38px 28px;background:${theme.primary};"><div style="color:#ffffff;font-size:30px;line-height:1.2;font-weight:800;">${escapeHtml(theme.heading)}</div><div style="margin-top:12px;color:#ffffff;font-size:16px;line-height:1.5;opacity:.95;">${escapeHtml(theme.subtitle)}</div></td></tr><tr><td style="padding:38px 40px 28px;"><p style="margin:0 0 22px;color:#0f172a;font-size:17px;line-height:1.6;">Dear <strong>${escapeHtml(companyName)}</strong>,</p>${paragraphHtml}${detailsHtml}<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:8px 0 10px;"><a href="${SELLERSLOGIN_WEBSITE}" style="display:inline-block;padding:14px 24px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Open Sellerslogin</a></td></tr></table></td></tr><tr><td align="center" style="padding:30px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><div style="font-size:16px;font-weight:800;color:#0f172a;">Best regards,</div><div style="margin-top:7px;font-size:15px;color:#334155;">Sellerslogin</div><div style="margin-top:14px;font-size:14px;line-height:1.8;"><a href="mailto:${SELLERSLOGIN_SUPPORT_EMAIL}" style="color:${theme.primary};text-decoration:none;">Support: ${SELLERSLOGIN_SUPPORT_EMAIL}</a><br><a href="${SELLERSLOGIN_WEBSITE}" style="color:${theme.primary};text-decoration:none;">${SELLERSLOGIN_WEBSITE}</a></div><div style="margin-top:20px;color:#94a3b8;font-size:12px;">© ${year} Sellerslogin. All rights reserved.</div></td></tr></table></td></tr></table></body></html>`;

  const detailText = details
    .filter(([, value]) => cleanText(value))
    .map(([label, value]) => `${label}: ${cleanText(value)}`)
    .join('\n');
  const text = [
    `Dear ${companyName},`,
    '',
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    detailText,
    '',
    'Best regards,',
    'Sellerslogin',
    `Support: ${SELLERSLOGIN_SUPPORT_EMAIL}`,
    `Website: ${SELLERSLOGIN_WEBSITE}`,
  ].filter((line, index, lines) => line || lines[index - 1]).join('\n').trim();

  return { subject, html, text, theme };
};
