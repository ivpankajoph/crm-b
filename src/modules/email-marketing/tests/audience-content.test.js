import assert from 'node:assert/strict';
import test from 'node:test';

import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import {
  createSubscriberSchema,
  createSegmentSchema,
  updateSubscriberSchema,
} from '../validators/audienceValidators.js';
import {
  createTemplateSchema,
  dataUrlUploadSchema,
  updateTemplateSchema,
} from '../validators/contentValidators.js';
import { normalizeImportedSubscriber, parseCsvText } from '../utils/csv.js';
import { buildSegmentFilter } from '../utils/segmentFilter.js';

test('CSV parser supports quoted commas and escaped quotes', () => {
  const rows = parseCsvText(
    'email,first_name,last_name,notes,tags\r\n' +
      'asha@example.com,Asha,Sharma,"VIP, repeat buyer","vip|repeat"\r\n' +
      'dev@example.com,Dev,Patel,"Said ""hello""",lead',
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].notes, 'VIP, repeat buyer');
  assert.equal(rows[1].notes, 'Said "hello"');
});

test('CSV subscriber normalization maps common headers and tags', () => {
  assert.deepEqual(
    normalizeImportedSubscriber({
      emailaddress: ' User@Example.com ',
      firstname: ' Asha ',
      lastname: ' Sharma ',
      mobile: '9999999999',
      tags: 'vip|repeat',
    }),
    {
      email: 'user@example.com',
      firstName: 'Asha',
      lastName: 'Sharma',
      phone: '9999999999',
      status: 'subscribed',
      source: 'csv_import',
      tags: ['vip', 'repeat'],
      notes: '',
    },
  );
});

test('subscriber validation rejects ownership fields from clients', () => {
  const result = createSubscriberSchema.safeParse({
    body: {
      email: 'user@example.com',
      workspaceId: '507f1f77bcf86cd799439011',
    },
    params: {},
    query: {},
  });
  assert.equal(result.success, false);
});

test('partial subscriber updates do not inject creation defaults', () => {
  const result = updateSubscriberSchema.safeParse({
    body: { notes: 'Updated note' },
    params: { id: '507f1f77bcf86cd799439011' },
    query: {},
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.body, { notes: 'Updated note' });
});

test('segment validation enforces createdAt within-days semantics', () => {
  const invalid = createSegmentSchema.safeParse({
    body: {
      name: 'Recent subscribers',
      logic: 'and',
      conditions: [
        {
          field: 'email',
          operator: 'within_days',
          value: '30',
        },
      ],
    },
    params: {},
    query: {},
  });
  assert.equal(invalid.success, false);
});

test('segment filter is workspace scoped and preserves OR logic', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const filter = buildSegmentFilter(
    { workspaceId },
    {
      logic: 'or',
      conditions: [
        { field: 'status', operator: 'equals', value: 'subscribed' },
        { field: 'tag', operator: 'contains', value: 'vip' },
      ],
    },
    new Date('2026-07-23T00:00:00.000Z'),
  );
  assert.equal(filter.workspaceId, workspaceId);
  assert.equal(filter.$or.length, 2);
});

test('template validation supports all three editor types', () => {
  for (const type of ['visual', 'simple', 'html']) {
    const result = createTemplateSchema.safeParse({
      body: {
        name: `${type} template`,
        subject: 'Welcome',
        type,
        htmlContent: '<p>Hello</p>',
        blocks: [],
      },
      params: {},
      query: {},
    });
    assert.equal(result.success, true);
  }
});

test('partial template updates do not reset editor content or status', () => {
  const result = updateTemplateSchema.safeParse({
    body: { subject: 'Updated subject' },
    params: { id: '507f1f77bcf86cd799439011' },
    query: {},
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.body, { subject: 'Updated subject' });
});

test('data URL validation rejects unsupported client fields', () => {
  const result = dataUrlUploadSchema.safeParse({
    body: {
      dataUrl: 'data:image/png;base64,AAAA',
      filename: 'logo',
      workspaceId: 'attempted-override',
    },
    params: {},
    query: {},
  });
  assert.equal(result.success, false);
});

test('Part 2 models require workspace ownership and unique workspace keys', () => {
  assert.equal(EmailMarketingSubscriber.schema.path('workspaceId').isRequired, true);
  assert.equal(EmailMarketingTemplate.schema.path('workspaceId').isRequired, true);

  const subscriberIndexes = EmailMarketingSubscriber.schema.indexes();
  const templateIndexes = EmailMarketingTemplate.schema.indexes();
  assert.equal(
    subscriberIndexes.some(
      ([keys, options]) =>
        keys.workspaceId === 1 && keys.email === 1 && options.unique === true,
    ),
    true,
  );
  assert.equal(
    templateIndexes.some(
      ([keys, options]) =>
        keys.workspaceId === 1 && keys.name === 1 && options.unique === true,
    ),
    true,
  );
});
