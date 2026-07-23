import dns from 'node:dns/promises';
import net from 'node:net';

import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import { buildWorkspaceFilter } from './workspaceService.js';
import {
  createSesDomainIdentity,
  deleteSesDomainIdentity,
  getSesDomainIdentity,
} from './sesService.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { isPlatformSenderDomain } from './senderService.js';

const normalizeDnsValue = (value = '') =>
  String(value).trim().replace(/^"|"$/g, '').replace(/\.$/, '').toLowerCase();

export const normalizeDomain = (input = '') => {
  const candidate = String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (
    !candidate ||
    candidate.length > 253 ||
    net.isIP(candidate) ||
    !candidate.includes('.')
  ) {
    throw Object.assign(new Error('Enter a valid business domain'), {
      statusCode: 400,
    });
  }
  const labels = candidate.split('.');
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw Object.assign(new Error('Enter a valid business domain'), {
      statusCode: 400,
    });
  }
  return candidate;
};

const trackingTarget = () => {
  const config = getEmailMarketingConfig();
  if (!config.publicUrl) return '';
  try {
    return new URL(config.publicUrl).hostname;
  } catch {
    return '';
  }
};

export const buildDomainDnsRecords = (domain, dkimTokens = []) => {
  const config = getEmailMarketingConfig();
  return [
    ...dkimTokens.map((token) => ({
      purpose: 'dkim',
      type: 'CNAME',
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
    })),
    {
      purpose: 'spf',
      type: 'TXT',
      name: domain,
      value: 'v=spf1 include:amazonses.com ~all',
    },
    {
      purpose: 'dmarc',
      type: 'TXT',
      name: `_dmarc.${domain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    },
    {
      purpose: 'tracking',
      type: 'CNAME',
      name: `track.${domain}`,
      value: trackingTarget() || `tracking.${domain}`,
    },
    {
      purpose: 'return_path_mx',
      type: 'MX',
      name: `bounce.${domain}`,
      value: `feedback-smtp.${config.sesRegion}.amazonses.com`,
      priority: 10,
    },
    {
      purpose: 'return_path_spf',
      type: 'TXT',
      name: `bounce.${domain}`,
      value: 'v=spf1 include:amazonses.com ~all',
    },
  ];
};

export const registerDomain = async ({ req, input }) => {
  const domain = normalizeDomain(input);
  let identity;
  try {
    identity = await createSesDomainIdentity(domain);
  } catch (error) {
    if (!['AlreadyExistsException', 'ConflictException'].includes(error.name)) {
      throw error;
    }
    identity = await getSesDomainIdentity(domain);
  }

  const dkimTokens = identity.dkimTokens || [];
  return EmailMarketingDomain.create({
    workspaceId: req.emailMarketing.workspaceId,
    domain,
    providerIdentity: domain,
    dkimTokens,
    trackingSubdomain: `track.${domain}`,
    mailFromDomain: identity.mailFromDomain || `bounce.${domain}`,
    dnsRecords: buildDomainDnsRecords(domain, dkimTokens),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
};

const resolveRecord = async (record) => {
  try {
    if (record.type === 'TXT') {
      const values = (await dns.resolveTxt(record.name)).map((parts) =>
        parts.join(''),
      );
      const expected = normalizeDnsValue(record.value);
      const matched = values.some(
        (value) => normalizeDnsValue(value) === expected,
      );
      return {
        status: matched ? 'verified' : 'incorrect',
        actualValue: values.join(' | '),
      };
    }
    if (record.type === 'CNAME') {
      const values = await dns.resolveCname(record.name);
      const expected = normalizeDnsValue(record.value);
      const matched = values.some(
        (value) => normalizeDnsValue(value) === expected,
      );
      return {
        status: matched ? 'verified' : 'incorrect',
        actualValue: values.join(' | '),
      };
    }
    const values = await dns.resolveMx(record.name);
    const expected = normalizeDnsValue(record.value);
    const matched = values.some(
      (value) =>
        normalizeDnsValue(value.exchange) === expected &&
        Number(value.priority) === Number(record.priority || 10),
    );
    return {
      status: matched ? 'verified' : 'incorrect',
      actualValue: values
        .map((value) => `${value.priority} ${value.exchange}`)
        .join(' | '),
    };
  } catch (error) {
    return {
      status: ['ENODATA', 'ENOTFOUND', 'ENODOMAIN'].includes(error.code)
        ? 'missing'
        : 'failed',
      actualValue: '',
      lastError: error.message,
    };
  }
};

export const verifyDomainIdentity = async ({ req, domainId }) => {
  const domain = await EmailMarketingDomain.findOne(
    buildWorkspaceFilter(req.emailMarketing, { _id: domainId }),
  );
  if (!domain) {
    throw Object.assign(new Error('Sending domain not found'), {
      statusCode: 404,
    });
  }

  const identity = await getSesDomainIdentity(domain.domain);
  const dkimTokens = identity.dkimTokens?.length
    ? identity.dkimTokens
    : domain.dkimTokens;
  const canonical = buildDomainDnsRecords(domain.domain, dkimTokens);
  const existing = new Map(
    domain.dnsRecords.map((record) => [
      `${record.type}:${record.name}:${record.value}`,
      record.toObject(),
    ]),
  );
  const checkedRecords = [];
  for (const record of canonical) {
    const old = existing.get(`${record.type}:${record.name}:${record.value}`);
    const check = await resolveRecord(record);
    checkedRecords.push({ ...record, ...old, ...check, lastCheckedAt: new Date() });
  }

  const success = (value) =>
    ['success', 'verified'].includes(String(value || '').toLowerCase());
  const providerVerified = success(identity.providerStatus);
  const dkimVerified = success(identity.dkimStatus);
  const mailFromVerified = success(identity.mailFromStatus);
  const aligned =
    providerVerified &&
    dkimVerified &&
    mailFromVerified &&
    identity.mailFromDomain === `bounce.${domain.domain}` &&
    identity.behaviorOnMxFailure === 'REJECT_MESSAGE';

  domain.dkimTokens = dkimTokens;
  domain.dnsRecords = checkedRecords;
  domain.providerStatus = identity.providerStatus;
  domain.dkimStatus = identity.dkimStatus;
  domain.mailFromStatus = identity.mailFromStatus;
  domain.mailFromDomain = identity.mailFromDomain || domain.mailFromDomain;
  domain.lastCheckedAt = new Date();
  domain.status = aligned ? 'verified' : 'pending';
  domain.verifiedAt = aligned ? domain.verifiedAt || new Date() : null;
  domain.updatedBy = req.user._id;
  await domain.save();
  return domain;
};

export const removeDomainIdentity = async ({ req, domainId }) => {
  const domain = await EmailMarketingDomain.findOne(
    buildWorkspaceFilter(req.emailMarketing, { _id: domainId }),
  );
  if (!domain) {
    throw Object.assign(new Error('Sending domain not found'), {
      statusCode: 404,
    });
  }
  await deleteSesDomainIdentity(domain.domain);
  await domain.deleteOne();
  return domain;
};

export const assertVerifiedSender = async (emailMarketingContext, email) => {
  const senderDomain = String(email || '').split('@').pop()?.toLowerCase();
  if (senderDomain && isPlatformSenderDomain(senderDomain)) {
    return { domain: senderDomain, status: 'verified', source: 'platform' };
  }
  const domain = await EmailMarketingDomain.findOne(
    buildWorkspaceFilter(emailMarketingContext, {
      domain: senderDomain,
      status: 'verified',
    }),
  ).lean();
  if (!domain) {
    const error = new Error(
      'From email must use a verified workspace sending domain',
    );
    error.statusCode = 400;
    throw error;
  }
  return domain;
};
