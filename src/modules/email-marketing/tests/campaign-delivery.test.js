import assert from 'node:assert/strict';
import test from 'node:test';

import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import EmailMarketingEvent from '../models/EmailMarketingEvent.js';
import EmailMarketingRecipient from '../models/EmailMarketingRecipient.js';
import {
  isCampaignEditableStatus,
  normalizeCampaignPayload,
} from '../services/campaignService.js';
import {
  buildDomainDnsRecords,
  normalizeDomain,
  assertVerifiedSender,
} from '../services/domainService.js';
import {
  getPlatformMarketingSender,
  isPlatformSenderDomain,
  resolveEmailMarketingSender,
} from '../services/senderService.js';
import {
  createCampaignSchema,
  testCampaignEmailSchema,
  updateCampaignSchema,
} from '../validators/campaignValidators.js';
import {
  renderTemplateHtml,
  renderTestCampaignEmail,
} from '../services/emailRenderService.js';
import {
  calculateDelayMs,
  calculateNextCampaignRunNumber,
  nextRecurrenceDate,
} from '../utils/campaign.js';
import {
  createTrackingToken,
  verifyTrackingToken,
} from '../utils/trackingTokens.js';

const objectId = '507f1f77bcf86cd799439011';

test('campaign validation rejects client supplied workspace ownership', () => {
  const result = createCampaignSchema.safeParse({
    body: {
      name: 'Weekly newsletter',
      type: 'newsletter',
      fromName: 'SellersLogin',
      fromEmail: 'news@example.com',
      workspaceId: objectId,
    },
    params: {},
    query: {},
  });

  assert.equal(result.success, false);
});

test('campaign validation blocks newline injection in sender headers', () => {
  const result = createCampaignSchema.safeParse({
    body: {
      name: 'Unsafe sender',
      type: 'newsletter',
      fromName: 'Marketing\r\nBcc: victim@example.com',
      fromEmail: 'news@example.com',
    },
    params: {},
    query: {},
  });

  assert.equal(result.success, false);
});

test('campaign test-send validation accepts only a safe scoped payload', () => {
  const valid = testCampaignEmailSchema.safeParse({
    body: {
      recipientEmail: 'TEST@EXAMPLE.COM',
      fromName: 'SellersLogin',
      fromEmail: 'news@example.com',
      replyTo: '',
      subject: 'Hello {{firstName}}',
      previewText: 'A safe preview',
      templateId: objectId,
    },
    params: {},
    query: {},
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.body.recipientEmail, 'test@example.com');

  const unsafe = testCampaignEmailSchema.safeParse({
    body: {
      recipientEmail: 'test@example.com',
      fromName: 'SellersLogin\r\nBcc: victim@example.com',
      fromEmail: 'news@example.com',
      subject: 'Test',
      templateId: objectId,
      workspaceId: objectId,
    },
    params: {},
    query: {},
  });
  assert.equal(unsafe.success, false);
});

test('campaign test renderer personalizes without tracking or unsubscribe links', () => {
  const rendered = renderTestCampaignEmail({
    template: {
      htmlContent:
        '<html><body><h1>Hello {{firstName}}</h1><p>{{email}}</p></body></html>',
    },
    recipientEmail: 'test@example.com',
    subject: 'Welcome {{firstName}}',
    previewText: 'Preview for {{email}}',
  });
  assert.equal(rendered.subject, 'Welcome Test');
  assert.match(rendered.html, /Hello Test/);
  assert.match(rendered.html, /test@example\.com/);
  assert.match(rendered.html, /Campaign test email/);
  assert.doesNotMatch(rendered.html, /unsubscribe|events\/open|events\/click/i);
});

test('visual template blocks render safely for backend delivery', () => {
  const html = renderTemplateHtml({
    htmlContent: '',
    preheader: 'A safe preview',
    blocks: [
      {
        type: 'heading',
        content: 'Hello {{first_name}} <script>alert(1)</script>',
        align: 'center',
      },
      {
        type: 'text',
        content: 'Line one\nLine two',
        align: 'left',
      },
      {
        type: 'button',
        content: 'Shop now',
        href: 'javascript:alert(1)',
        align: 'center',
      },
      {
        type: 'image',
        content: 'data:text/html,unsafe',
        align: 'center',
      },
    ],
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /\{\{first_name\}\}/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Line one<br>Line two/);
  assert.match(html, /href="#"/);
  assert.doesNotMatch(html, /javascript:|data:text\/html/i);
});

test('expanded visual blocks render into delivery-safe email HTML', () => {
  const html = renderTemplateHtml({
    htmlContent: '',
    blocks: [
      { type: 'dynamic', content: 'Hello {{first_name}}' },
      {
        type: 'video',
        content: 'https://example.com/thumbnail.jpg',
        href: 'https://example.com/watch',
      },
      {
        type: 'logo',
        content: 'https://example.com/logo.png',
        href: 'https://example.com',
      },
      {
        type: 'social',
        items: [
          { label: 'Safe', url: 'https://example.com/social' },
          { label: 'Unsafe', url: 'javascript:alert(1)' },
        ],
      },
      {
        type: 'product',
        content: 'Starter plan',
        subtitle: 'A useful product',
        price: '₹999',
        imageUrl: 'https://example.com/product.jpg',
        href: 'https://example.com/product',
        buttonText: 'View product',
      },
      {
        type: 'navigation',
        items: [{ label: 'Shop', url: 'https://example.com/shop' }],
      },
      { type: 'html', content: '<strong>Custom block</strong>' },
    ],
  });

  assert.match(html, /Hello \{\{first_name\}\}/);
  assert.match(html, /Watch video/);
  assert.match(html, /logo\.png/);
  assert.match(html, /Starter plan/);
  assert.match(html, /View product/);
  assert.match(html, />Shop</);
  assert.match(html, /<strong>Custom block<\/strong>/);
  assert.doesNotMatch(html, /javascript:/i);
});

test('visual template test-send personalizes snake-case placeholders', () => {
  const rendered = renderTestCampaignEmail({
    template: {
      htmlContent: '',
      preheader: 'Hello {{first_name}}',
      blocks: [
        {
          type: 'heading',
          content: 'Welcome {{first_name}} {{last_name}}',
          align: 'center',
        },
      ],
    },
    recipientEmail: 'test@example.com',
    subject: 'Hello {{first_name}}',
  });

  assert.equal(rendered.subject, 'Hello Test');
  assert.match(rendered.html, /Welcome Test Recipient/);
  assert.doesNotMatch(rendered.html, /\{\{first_name\}\}/);
});

test('custom HTML templates remain unchanged by block rendering', () => {
  const source = '<html><body><strong>Custom HTML</strong></body></html>';
  assert.equal(
    renderTemplateHtml({ htmlContent: source, blocks: [] }),
    source,
  );
});

test('platform sender defaults to the trusted SellersLogin identity', async () => {
  const previousEmail = process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL;
  const previousName = process.env.EMAIL_MARKETING_PLATFORM_FROM_NAME;
  const previousReply = process.env.EMAIL_MARKETING_PLATFORM_REPLY_TO;
  process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL = 'noreply@sellerslogin.com';
  process.env.EMAIL_MARKETING_PLATFORM_FROM_NAME = 'SellersLogin';
  process.env.EMAIL_MARKETING_PLATFORM_REPLY_TO = 'support@sellerslogin.com';

  try {
    const sender = getPlatformMarketingSender();
    assert.deepEqual(sender, {
      fromName: 'SellersLogin',
      fromEmail: 'noreply@sellerslogin.com',
      replyTo: 'support@sellerslogin.com',
      source: 'platform',
      domain: 'sellerslogin.com',
    });
    assert.equal(isPlatformSenderDomain('SELLERSLOGIN.COM'), true);
    assert.equal(
      (
        await resolveEmailMarketingSender(
          { workspaceId: objectId },
          { requestedFromEmail: '' },
        )
      ).fromEmail,
      'noreply@sellerslogin.com',
    );
    assert.equal(
      (await assertVerifiedSender(
        { workspaceId: objectId },
        'noreply@sellerslogin.com',
      )).source,
      'platform',
    );
  } finally {
    if (previousEmail === undefined) {
      delete process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL;
    } else {
      process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL = previousEmail;
    }
    if (previousName === undefined) {
      delete process.env.EMAIL_MARKETING_PLATFORM_FROM_NAME;
    } else {
      process.env.EMAIL_MARKETING_PLATFORM_FROM_NAME = previousName;
    }
    if (previousReply === undefined) {
      delete process.env.EMAIL_MARKETING_PLATFORM_REPLY_TO;
    } else {
      process.env.EMAIL_MARKETING_PLATFORM_REPLY_TO = previousReply;
    }
  }
});

test('sender resolution falls back for unverified domains and preserves verified domains', async () => {
  const previousEmail = process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL;
  const originalFindOne = EmailMarketingDomain.findOne;
  process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL = 'noreply@sellerslogin.com';

  try {
    EmailMarketingDomain.findOne = () => ({
      select: () => ({
        lean: async () => null,
      }),
    });
    const fallback = await resolveEmailMarketingSender(
      { workspaceId: objectId },
      {
        requestedFromName: 'My Shop',
        requestedFromEmail: 'offers@pending-shop.com',
      },
    );
    assert.equal(fallback.source, 'platform');
    assert.equal(fallback.fromEmail, 'noreply@sellerslogin.com');

    EmailMarketingDomain.findOne = () => ({
      select: () => ({
        lean: async () => ({
          _id: objectId,
          domain: 'verified-shop.com',
        }),
      }),
    });
    const custom = await resolveEmailMarketingSender(
      { workspaceId: objectId },
      {
        requestedFromName: 'My Shop',
        requestedFromEmail: 'offers@verified-shop.com',
        requestedReplyTo: 'help@verified-shop.com',
      },
    );
    assert.equal(custom.source, 'workspace_domain');
    assert.equal(custom.fromEmail, 'offers@verified-shop.com');
    assert.equal(custom.replyTo, 'help@verified-shop.com');
  } finally {
    EmailMarketingDomain.findOne = originalFindOne;
    if (previousEmail === undefined) {
      delete process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL;
    } else {
      process.env.EMAIL_MARKETING_PLATFORM_FROM_EMAIL = previousEmail;
    }
  }
});

test('partial campaign updates preserve omitted relationships and dates', () => {
  const parsed = updateCampaignSchema.safeParse({
    body: { previewText: 'Fresh preview' },
    params: { id: objectId },
    query: {},
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.body, { previewText: 'Fresh preview' });
  assert.deepEqual(normalizeCampaignPayload(parsed.data.body), {
    previewText: 'Fresh preview',
  });
});

test('sent campaigns remain editable for same-id resend', () => {
  assert.equal(isCampaignEditableStatus('sent'), true);
  assert.equal(isCampaignEditableStatus('sending'), false);
  assert.equal(isCampaignEditableStatus('archived'), false);
});

test('campaign resend advances beyond every preserved recipient run', () => {
  assert.equal(calculateNextCampaignRunNumber(0, 0), 1);
  assert.equal(calculateNextCampaignRunNumber(1, 1), 2);
  assert.equal(calculateNextCampaignRunNumber(1, 3), 4);
});

test('campaign payload converts explicitly cleared references to null', () => {
  assert.deepEqual(
    normalizeCampaignPayload({
      templateId: '',
      segmentId: '',
      recurrenceEndAt: '',
    }),
    {
      templateId: null,
      segmentId: null,
      recurrenceEndAt: null,
    },
  );
});

test('domain normalization accepts host URLs and rejects unsafe hostnames', () => {
  assert.equal(normalizeDomain('https://Mail.Example.com/path'), 'mail.example.com');
  assert.throws(() => normalizeDomain('localhost'), /valid business domain/i);
  assert.throws(() => normalizeDomain('127.0.0.1'), /valid business domain/i);
  assert.throws(() => normalizeDomain('-mail.example.com'), /valid business domain/i);
});

test('DNS instructions contain SES DKIM, authentication and return-path records', () => {
  const previousRegion = process.env.EMAIL_MARKETING_SES_REGION;
  const previousPublicUrl = process.env.EMAIL_MARKETING_PUBLIC_URL;
  process.env.EMAIL_MARKETING_SES_REGION = 'ap-south-1';
  process.env.EMAIL_MARKETING_PUBLIC_URL = 'https://api.example.com';

  try {
    const records = buildDomainDnsRecords('example.com', ['dkim-token']);
    const purposes = new Set(records.map((record) => record.purpose));

    assert.equal(records.find((record) => record.purpose === 'dkim').value,
      'dkim-token.dkim.amazonses.com');
    assert.equal(records.find((record) => record.purpose === 'tracking').value,
      'api.example.com');
    assert.equal(
      records.find((record) => record.purpose === 'return_path_mx').value,
      'feedback-smtp.ap-south-1.amazonses.com',
    );
    assert.deepEqual(
      purposes,
      new Set([
        'dkim',
        'spf',
        'dmarc',
        'tracking',
        'return_path_mx',
        'return_path_spf',
      ]),
    );
  } finally {
    if (previousRegion === undefined) delete process.env.EMAIL_MARKETING_SES_REGION;
    else process.env.EMAIL_MARKETING_SES_REGION = previousRegion;
    if (previousPublicUrl === undefined) delete process.env.EMAIL_MARKETING_PUBLIC_URL;
    else process.env.EMAIL_MARKETING_PUBLIC_URL = previousPublicUrl;
  }
});

test('tracking signatures are purpose-bound and reject tampering', () => {
  const previousSecret = process.env.EMAIL_MARKETING_TRACKING_SECRET;
  process.env.EMAIL_MARKETING_TRACKING_SECRET = 'test-only-tracking-secret';

  try {
    const token = createTrackingToken('open', objectId);
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;
    assert.equal(verifyTrackingToken('open', objectId, token), true);
    assert.equal(verifyTrackingToken('click', objectId, token), false);
    assert.equal(verifyTrackingToken('open', objectId, tamperedToken), false);
  } finally {
    if (previousSecret === undefined) delete process.env.EMAIL_MARKETING_TRACKING_SECRET;
    else process.env.EMAIL_MARKETING_TRACKING_SECRET = previousSecret;
  }
});

test('delay and recurrence helpers produce deterministic UTC schedules', () => {
  assert.equal(calculateDelayMs(2, 'hours'), 7_200_000);
  assert.equal(calculateDelayMs(-10, 'days'), 0);
  assert.equal(
    nextRecurrenceDate(
      {
        isRecurring: true,
        recurrenceInterval: 2,
        recurrenceUnit: 'week',
      },
      new Date('2026-07-01T10:00:00.000Z'),
    ).toISOString(),
    '2026-07-15T10:00:00.000Z',
  );
  assert.equal(
    nextRecurrenceDate(
      {
        isRecurring: true,
        recurrenceInterval: 1,
        recurrenceUnit: 'month',
        recurrenceEndAt: new Date('2026-07-31T00:00:00.000Z'),
      },
      new Date('2026-07-01T10:00:00.000Z'),
    ),
    null,
  );
});

test('delivery models enforce workspace ownership', () => {
  for (const Model of [
    EmailMarketingCampaign,
    EmailMarketingDomain,
    EmailMarketingRecipient,
    EmailMarketingEvent,
  ]) {
    const error = new Model({}).validateSync();
    assert.ok(error.errors.workspaceId, `${Model.modelName} must require workspaceId`);
  }
});
