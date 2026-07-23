import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import { buildWorkspaceFilter } from './workspaceService.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const domainOf = (email = '') => normalizeEmail(email).split('@').pop() || '';

const configurationError = (message) =>
  Object.assign(new Error(message), { statusCode: 503 });

export const getPlatformMarketingSender = ({
  requestedFromName = '',
  requestedReplyTo = '',
} = {}) => {
  const config = getEmailMarketingConfig();
  const fromEmail = normalizeEmail(config.platformFromEmail);
  if (!emailPattern.test(fromEmail)) {
    throw configurationError(
      'Email Marketing platform sender email is invalid',
    );
  }
  const requestedReply = normalizeEmail(requestedReplyTo);
  const configuredReply = normalizeEmail(config.platformReplyTo);
  const replyTo = [requestedReply, configuredReply, fromEmail].find((email) =>
    emailPattern.test(email),
  );
  return {
    fromName:
      String(requestedFromName || config.platformFromName || 'SellersLogin').trim(),
    fromEmail,
    replyTo,
    source: 'platform',
    domain: domainOf(fromEmail),
  };
};

export const isPlatformSenderDomain = (domain = '') =>
  domainOf(getEmailMarketingConfig().platformFromEmail) ===
  String(domain).trim().toLowerCase();

export const resolveEmailMarketingSender = async (
  emailMarketingContext,
  {
    requestedFromName = '',
    requestedFromEmail = '',
    requestedReplyTo = '',
  } = {},
) => {
  const platform = getPlatformMarketingSender({
    requestedFromName,
    requestedReplyTo,
  });
  const requestedEmail = normalizeEmail(requestedFromEmail);
  const requestedDomain = domainOf(requestedEmail);
  if (
    !emailPattern.test(requestedEmail) ||
    !requestedDomain ||
    requestedDomain === platform.domain
  ) {
    return platform;
  }

  const verifiedDomain = await EmailMarketingDomain.findOne(
    buildWorkspaceFilter(emailMarketingContext, {
      domain: requestedDomain,
      status: 'verified',
    }),
  )
    .select('_id domain')
    .lean();
  if (!verifiedDomain) return platform;

  const requestedReply = normalizeEmail(requestedReplyTo);
  return {
    fromName:
      String(requestedFromName || verifiedDomain.domain).trim(),
    fromEmail: requestedEmail,
    replyTo: emailPattern.test(requestedReply)
      ? requestedReply
      : requestedEmail,
    source: 'workspace_domain',
    domain: verifiedDomain.domain,
    domainId: String(verifiedDomain._id),
  };
};
