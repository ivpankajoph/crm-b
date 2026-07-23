import assert from 'node:assert/strict';
import test from 'node:test';

import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import {
  EMAIL_MARKETING_PERMISSIONS,
  EMAIL_MARKETING_PERMISSION_VALUES,
} from '../constants/permissions.js';
import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingBillingAccount from '../models/EmailMarketingBillingAccount.js';
import EmailMarketingCreditTransaction from '../models/EmailMarketingCreditTransaction.js';
import { normalizeAutomationPayload } from '../services/automationService.js';
import { rowsToCsv } from '../utils/csvExport.js';
import { resolveDateRange } from '../utils/dateRange.js';
import {
  createAutomationSchema,
  reportQuerySchema,
  triggerAutomationSchema,
  updateAutomationSchema,
} from '../validators/advancedValidators.js';

const objectId = '507f1f77bcf86cd799439011';

const emailStep = {
  id: 'client-step-id',
  type: 'send_email',
  title: 'Welcome email',
  delayValue: 1,
  delayUnit: 'days',
  templateId: objectId,
  subject: 'Welcome {{firstName}}',
  field: '',
  operator: '',
  value: '',
};

test('automation creation rejects client-supplied workspace ownership', () => {
  const result = createAutomationSchema.safeParse({
    body: {
      name: 'Welcome journey',
      trigger: 'welcome_signup',
      steps: [emailStep],
      workspaceId: objectId,
    },
    params: {},
    query: {},
  });
  assert.equal(result.success, false);
});

test('automation validation requires complete email and HTTPS webhook steps', () => {
  const missingTemplate = createAutomationSchema.safeParse({
    body: {
      name: 'Welcome journey',
      trigger: 'welcome_signup',
      steps: [{ ...emailStep, templateId: '' }],
    },
    params: {},
    query: {},
  });
  const unsafeWebhook = createAutomationSchema.safeParse({
    body: {
      name: 'Webhook journey',
      trigger: 'payment_success',
      steps: [
        {
          ...emailStep,
          type: 'webhook',
          templateId: '',
          subject: '',
          value: 'http://localhost/internal',
        },
      ],
    },
    params: {},
    query: {},
  });
  assert.equal(missingTemplate.success, false);
  assert.equal(unsafeWebhook.success, false);
});

test('partial automation updates do not clear omitted relationships', () => {
  const parsed = updateAutomationSchema.safeParse({
    body: { notes: 'Reviewed by lifecycle team' },
    params: { id: objectId },
    query: {},
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(
    normalizeAutomationPayload(parsed.data.body),
    { notes: 'Reviewed by lifecycle team' },
  );
  assert.deepEqual(
    normalizeAutomationPayload({ segmentId: '', steps: [emailStep] }),
    {
      segmentId: null,
      steps: [{ ...emailStep, templateId: objectId }],
    },
  );
});

test('trigger validation requires a subscriber id or email', () => {
  const invalid = triggerAutomationSchema.safeParse({
    body: { trigger: 'welcome_signup', context: {} },
    params: {},
    query: {},
  });
  const valid = triggerAutomationSchema.safeParse({
    body: {
      trigger: 'welcome_signup',
      email: 'person@example.com',
      idempotencyKey: 'event-12345678',
      context: {},
    },
    params: {},
    query: {},
  });
  assert.equal(invalid.success, false);
  assert.equal(valid.success, true);
});

test('report validation only permits supported bounded exports', () => {
  const parsed = reportQuerySchema.safeParse({
    body: undefined,
    params: {},
    query: { target: 'automations', format: 'csv', days: '90' },
  });
  const invalid = reportQuerySchema.safeParse({
    body: undefined,
    params: {},
    query: { target: 'users', format: 'xlsx', days: '5000' },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.query.days, 90);
  assert.equal(invalid.success, false);
});

test('date ranges are bounded and reject reversed windows', () => {
  const range = resolveDateRange({
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-31T23:59:59.000Z',
  });
  assert.equal(range.start.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.throws(
    () =>
      resolveDateRange({
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-07-01T00:00:00.000Z',
      }),
    /invalid analytics date range/i,
  );
});

test('CSV report export escapes formulas, quotes, and commas', () => {
  const csv = rowsToCsv([
    { email: '=cmd|calc', note: 'VIP, "repeat"' },
  ]);
  assert.match(csv, /"'=cmd\|calc"/);
  assert.match(csv, /"VIP, ""repeat"""/);
});

test('advanced module models enforce workspace ownership', () => {
  for (const Model of [
    EmailMarketingAutomation,
    EmailMarketingAutomationExecution,
    EmailMarketingBillingAccount,
    EmailMarketingCreditTransaction,
  ]) {
    const error = new Model({}).validateSync();
    assert.ok(error.errors.workspaceId, `${Model.modelName} must require workspaceId`);
  }
});

test('permission catalog includes billing and team administration', () => {
  assert.ok(
    EMAIL_MARKETING_PERMISSION_VALUES.includes(
      EMAIL_MARKETING_PERMISSIONS.VIEW_BILLING,
    ),
  );
  assert.ok(
    EMAIL_MARKETING_PERMISSION_VALUES.includes(
      EMAIL_MARKETING_PERMISSIONS.MANAGE_TEAM_ACCESS,
    ),
  );
});

test('credit enforcement and purchases remain safe-by-default', () => {
  const previousEnforced = process.env.EMAIL_MARKETING_CREDITS_ENFORCED;
  const previousPurchases =
    process.env.EMAIL_MARKETING_CREDIT_PURCHASES_ENABLED;
  delete process.env.EMAIL_MARKETING_CREDITS_ENFORCED;
  delete process.env.EMAIL_MARKETING_CREDIT_PURCHASES_ENABLED;
  try {
    const config = getEmailMarketingConfig();
    assert.equal(config.creditsEnforced, false);
    assert.equal(config.creditPurchasesEnabled, false);
  } finally {
    if (previousEnforced === undefined) {
      delete process.env.EMAIL_MARKETING_CREDITS_ENFORCED;
    } else {
      process.env.EMAIL_MARKETING_CREDITS_ENFORCED = previousEnforced;
    }
    if (previousPurchases === undefined) {
      delete process.env.EMAIL_MARKETING_CREDIT_PURCHASES_ENABLED;
    } else {
      process.env.EMAIL_MARKETING_CREDIT_PURCHASES_ENABLED =
        previousPurchases;
    }
  }
});
