import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SendEmailCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';

let sesClient;

const configurationError = (message) => {
  const error = new Error(message);
  error.statusCode = 503;
  return error;
};

export const getSesClient = () => {
  const config = getEmailMarketingConfig();
  if (!config.sesRegion) throw configurationError('AWS SES region is missing');
  if (!sesClient) sesClient = new SESv2Client({ region: config.sesRegion });
  return sesClient;
};

export const assertSesSendingConfigured = () => {
  const config = getEmailMarketingConfig();
  if (!config.publicUrl || !config.trackingSecret) {
    throw configurationError(
      'Email Marketing public URL and tracking secret are required',
    );
  }
  return config;
};

const assertSesDomainVerificationConfigured = () => {
  const config = getEmailMarketingConfig();
  if (!config.domainVerificationEnabled) {
    throw configurationError('SES domain verification is disabled');
  }
  return config;
};

export const createSesDomainIdentity = async (domain) => {
  assertSesDomainVerificationConfigured();
  const client = getSesClient();
  const created = await client.send(
    new CreateEmailIdentityCommand({ EmailIdentity: domain }),
  );
  const mailFromDomain = `bounce.${domain}`;
  await client.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain,
      BehaviorOnMxFailure: 'REJECT_MESSAGE',
    }),
  );
  return {
    dkimTokens: created.DkimAttributes?.Tokens || [],
    mailFromDomain,
  };
};

export const getSesDomainIdentity = async (domain) => {
  assertSesDomainVerificationConfigured();
  const response = await getSesClient().send(
    new GetEmailIdentityCommand({ EmailIdentity: domain }),
  );
  return {
    providerStatus: response.VerificationStatus || '',
    dkimStatus: response.DkimAttributes?.Status || '',
    dkimTokens: response.DkimAttributes?.Tokens || [],
    mailFromDomain: response.MailFromAttributes?.MailFromDomain || '',
    mailFromStatus: response.MailFromAttributes?.MailFromDomainStatus || '',
    behaviorOnMxFailure:
      response.MailFromAttributes?.BehaviorOnMxFailure || '',
  };
};

export const deleteSesDomainIdentity = async (domain) => {
  if (!getEmailMarketingConfig().domainVerificationEnabled) return;
  await getSesClient().send(
    new DeleteEmailIdentityCommand({ EmailIdentity: domain }),
  );
};

export const sendSesEmail = async ({
  fromName,
  fromEmail,
  replyTo,
  recipient,
  subject,
  html,
  text,
  tags,
  unsubscribeUrl,
}) => {
  const config = assertSesSendingConfigured();
  const safeFromName = String(fromName).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const headers = unsubscribeUrl
    ? [
        { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl}>` },
        {
          Name: 'List-Unsubscribe-Post',
          Value: 'List-Unsubscribe=One-Click',
        },
      ]
    : undefined;
  const payload = {
    FromEmailAddress: `"${safeFromName}" <${fromEmail}>`,
    Destination: { ToAddresses: [recipient] },
    ReplyToAddresses: replyTo ? [replyTo] : undefined,
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
        Headers: headers,
      },
    },
    EmailTags: Object.entries(tags).map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    })),
    ConfigurationSetName: config.sesConfigurationSet || undefined,
  };
  return getSesClient().send(new SendEmailCommand(payload));
};
