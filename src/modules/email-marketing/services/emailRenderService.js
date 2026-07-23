import { createTrackingToken } from '../utils/trackingTokens.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const replacements = (subscriber) => ({
  firstName: subscriber.firstName || '',
  first_name: subscriber.firstName || '',
  lastName: subscriber.lastName || '',
  last_name: subscriber.lastName || '',
  email: subscriber.email || '',
  phone: subscriber.phone || '',
});

const personalize = (content, subscriber, html = false) => {
  const values = replacements(subscriber);
  return String(content || '').replace(
    /\{\{\s*(firstName|first_name|lastName|last_name|email|phone)\s*\}\}/g,
    (_match, key) => (html ? escapeHtml(values[key]) : values[key]),
  );
};

const safeUrl = (value = '', { image = false } = {}) => {
  const candidate = String(value).trim();
  if (!candidate) return '';
  if (!image && candidate === '#') return '#';
  try {
    const parsed = new URL(candidate);
    const allowed = image
      ? ['http:', 'https:']
      : ['http:', 'https:', 'mailto:'];
    return allowed.includes(parsed.protocol) ? candidate : '';
  } catch {
    return '';
  }
};

const renderBlock = (block = {}) => {
  const align = ['left', 'center', 'right'].includes(block.align)
    ? block.align
    : 'left';
  const content = escapeHtml(block.content || '');
  if (block.type === 'heading') {
    return `<h1 style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:30px;line-height:1.25;color:#1f2937;text-align:${align}">${content}</h1>`;
  }
  if (block.type === 'text') {
    return `<p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#4b5563;text-align:${align}">${content.replaceAll('\n', '<br>')}</p>`;
  }
  if (block.type === 'button') {
    const href = safeUrl(block.href || '#') || '#';
    return `<div style="margin:24px 0;text-align:${align}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;border-radius:10px;background:#b86917;color:#ffffff;font-family:Arial,sans-serif;font-weight:700;text-decoration:none">${content || 'Learn more'}</a></div>`;
  }
  if (block.type === 'image') {
    const source = safeUrl(block.content, { image: true });
    return source
      ? `<div style="margin:20px 0;text-align:${align}"><img src="${escapeHtml(source)}" alt="" style="display:inline-block;max-width:100%;height:auto;border-radius:12px"></div>`
      : '';
  }
  if (block.type === 'divider') {
    return '<hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb">';
  }
  if (block.type === 'spacer') {
    const height = Math.min(
      500,
      Math.max(8, Number.parseInt(block.content, 10) || 32),
    );
    return `<div style="height:${height}px;line-height:1px">&nbsp;</div>`;
  }
  return '';
};

export const renderTemplateHtml = (template = {}) => {
  if (String(template.htmlContent || '').trim()) {
    return String(template.htmlContent);
  }
  const content = (template.blocks || []).map(renderBlock).join('');
  if (!content) return '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1ec;padding:30px 12px"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(template.preheader || '')}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:16px"><tr><td style="padding:42px">${content}</td></tr></table></td></tr></table></body></html>`;
};

export const renderTestCampaignEmail = ({
  template,
  recipientEmail,
  subject,
  previewText = '',
}) => {
  const subscriber = {
    firstName: 'Test',
    lastName: 'Recipient',
    email: recipientEmail,
    phone: '',
  };
  const personalizedSubject = personalize(subject, subscriber);
  const baseHtml = personalize(renderTemplateHtml(template), subscriber, true);
  const notice = '<div style="padding:10px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;font-family:Arial,sans-serif;font-size:12px;text-align:center">Campaign test email &mdash; no audience delivery or tracking was recorded.</div>';
  const preheader = previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(personalize(previewText, subscriber))}</div>`
    : '';
  const html = baseHtml.match(/<body(?:\s[^>]*)?>/i)
    ? baseHtml.replace(
        /(<body(?:\s[^>]*)?>)/i,
        (bodyTag) => `${bodyTag}${preheader}${notice}`,
      )
    : `${preheader}${notice}${baseHtml}`;
  const textContent = personalize(
    baseHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    subscriber,
  );
  return {
    subject: personalizedSubject,
    html,
    text: `CAMPAIGN TEST EMAIL\n\n${textContent}`.trim(),
  };
};

const appendTracking = (html, recipientId) => {
  const { publicUrl } = getEmailMarketingConfig();
  const token = createTrackingToken('recipient', recipientId);
  const clickBase = `${publicUrl}/api/email-marketing/events/click/${recipientId}`;
  const rewritten = String(html).replace(
    /href=(["'])(https?:\/\/[^"']+)\1/gi,
    (_match, quote, url) =>
      `href=${quote}${clickBase}?token=${token}&url=${encodeURIComponent(url)}${quote}`,
  );
  const pixel = `<img src="${publicUrl}/api/email-marketing/events/open/${recipientId}.gif?token=${token}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0" />`;
  return rewritten.includes('</body>')
    ? rewritten.replace('</body>', `${pixel}</body>`)
    : `${rewritten}${pixel}`;
};

export const renderCampaignEmail = ({
  campaign,
  template,
  subscriber,
  recipientId,
  subject,
}) => {
  const { publicUrl } = getEmailMarketingConfig();
  const unsubscribeToken = createTrackingToken('unsubscribe', recipientId);
  const unsubscribeUrl = `${publicUrl}/api/email-marketing/events/unsubscribe/${recipientId}?token=${unsubscribeToken}`;
  const personalizedSubject = personalize(subject, subscriber);
  const baseHtml = personalize(renderTemplateHtml(template), subscriber, true);
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-family:Arial,sans-serif;font-size:12px">You are receiving this marketing email because you subscribed. <a href="${unsubscribeUrl}">Unsubscribe</a></div>`;
  const withFooter = baseHtml.includes('</body>')
    ? baseHtml.replace('</body>', `${footer}</body>`)
    : `${baseHtml}${footer}`;
  const html = appendTracking(withFooter, recipientId);
  const text = `${personalize(
    baseHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    subscriber,
  )}\n\nUnsubscribe: ${unsubscribeUrl}`.trim();
  return {
    subject: personalizedSubject,
    html,
    text,
    unsubscribeUrl,
    previewText: personalize(campaign.previewText, subscriber),
  };
};
