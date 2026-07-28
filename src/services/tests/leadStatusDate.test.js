import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLeadStatusDate } from '../../utils/leadStatusDate.js';
import Lead from '../../models/Lead.js';
import Customer from '../../models/Customer.js';
import Company from '../../models/Company.js';

test('status date accepts an exact calendar date without timezone ambiguity', () => {
  assert.equal(
    parseLeadStatusDate('2026-07-27').toISOString(),
    '2026-07-27T00:00:00.000Z',
  );
});

test('status date preserves the exact selected time and timezone', () => {
  assert.equal(
    parseLeadStatusDate('2026-07-27T18:42:00.000+05:30').toISOString(),
    '2026-07-27T13:12:00.000Z',
  );
  assert.equal(
    parseLeadStatusDate('2026-07-27T13:12:00.000Z').toISOString(),
    '2026-07-27T13:12:00.000Z',
  );
});

test('missing status date preserves existing clients by using the current timestamp', () => {
  const now = new Date('2026-07-27T12:34:56.000Z');
  assert.equal(parseLeadStatusDate(undefined, () => now).toISOString(), now.toISOString());
});

test('invalid or impossible status dates are rejected', () => {
  assert.throws(() => parseLeadStatusDate('27-07-2026'), /ISO 8601/);
  assert.throws(() => parseLeadStatusDate('2026-02-30'), /invalid/);
  assert.throws(() => parseLeadStatusDate('2026-02-30T10:00:00.000Z'), /invalid/);
  assert.throws(() => parseLeadStatusDate(''), /ISO 8601/);
  assert.throws(() => parseLeadStatusDate('2026-07-27T18:42'), /ISO 8601/);
});

test('all unified lead models retain the latest effective status date without an extra read', () => {
  assert.ok(Lead.schema.path('leadStatusChangedAt'));
  assert.ok(Customer.schema.path('leadStatusChangedAt'));
  assert.ok(Company.schema.path('leadStatusChangedAt'));
});
