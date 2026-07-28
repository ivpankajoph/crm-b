const parseBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getEmailMarketingConfig = () => ({
  enabled: parseBoolean(process.env.EMAIL_MARKETING_ENABLED, true),
  defaultTimezone:
    process.env.EMAIL_MARKETING_DEFAULT_TIMEZONE?.trim() || 'Asia/Kolkata',
  maxImportRows: parsePositiveInteger(
    process.env.EMAIL_MARKETING_MAX_IMPORT_ROWS,
    10000,
  ),
  maxPageSize: parsePositiveInteger(
    process.env.EMAIL_MARKETING_MAX_PAGE_SIZE,
    100,
  ),
  domainVerificationEnabled: parseBoolean(
    process.env.EMAIL_MARKETING_DOMAIN_VERIFICATION_ENABLED,
    false,
  ),
  sesRegion:
    process.env.EMAIL_MARKETING_SES_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'ap-south-1',
  sesConfigurationSet:
    process.env.EMAIL_MARKETING_SES_CONFIGURATION_SET?.trim() || '',
  platformFromName:
    process.env.EMAIL_MARKETING_PLATFORM_FROM_NAME?.trim() || 'SellersLogin',
  platformFromEmail:
    process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL?.trim().toLowerCase() ||
    'noreply@sellerslogin.com',
  platformReplyTo:
    process.env.EMAIL_MARKETING_PLATFORM_REPLY_TO?.trim().toLowerCase() || '',
  publicUrl:
    process.env.EMAIL_MARKETING_PUBLIC_URL?.trim().replace(/\/+$/, '') ||
    process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, '') ||
    '',
  trackingSecret:
    process.env.EMAIL_MARKETING_TRACKING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '',
  webhookSecret:
    process.env.EMAIL_MARKETING_WEBHOOK_SECRET?.trim() || '',
  sendConcurrency: parsePositiveInteger(
    process.env.EMAIL_MARKETING_SEND_CONCURRENCY,
    5,
  ),
  creditsEnforced: parseBoolean(
    process.env.EMAIL_MARKETING_CREDITS_ENFORCED,
    false,
  ),
  creditPurchasesEnabled: parseBoolean(
    process.env.EMAIL_MARKETING_CREDIT_PURCHASES_ENABLED,
    false,
  ),
  initialCredits: parseNonNegativeInteger(
    process.env.EMAIL_MARKETING_INITIAL_CREDITS,
    0,
  ),
});

export const getPublicEmailMarketingConfig = () => {
  const config = getEmailMarketingConfig();
  return {
    enabled: config.enabled,
    defaultTimezone: config.defaultTimezone,
    limits: {
      maxImportRows: config.maxImportRows,
      maxPageSize: config.maxPageSize,
    },
    capabilities: {
      subscribers: true,
      csvImport: true,
      segments: true,
      suppressions: true,
      templates: true,
      editorUploads: true,
      sending: true,
      domainVerification: config.domainVerificationEnabled,
      scheduling: true,
      tracking: Boolean(config.publicUrl && config.trackingSecret),
      automations: true,
      analytics: true,
      reports: true,
      billing: true,
      teamAccess: true,
      creditsEnforced: config.creditsEnforced,
      creditPurchases: config.creditPurchasesEnabled,
    },
    platformSender: {
      fromName: config.platformFromName,
      fromEmail: config.platformFromEmail,
      replyTo: config.platformReplyTo || config.platformFromEmail,
    },
  };
};
