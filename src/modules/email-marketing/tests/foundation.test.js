import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMAIL_MARKETING_PERMISSIONS,
  EMAIL_MARKETING_PERMISSION_VALUES,
  getDefaultEmailMarketingPermissions,
  sanitizeEmailMarketingPermissions,
} from '../constants/permissions.js';
import { updateWorkspaceSchema } from '../validators/foundationValidators.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';

test('admin role receives the complete Email Marketing permission catalog', () => {
  assert.deepEqual(
    new Set(getDefaultEmailMarketingPermissions('admin')),
    new Set(EMAIL_MARKETING_PERMISSION_VALUES),
  );
});

test('unknown CRM roles receive dashboard-only access', () => {
  assert.deepEqual(getDefaultEmailMarketingPermissions('sales_agent'), [
    EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
  ]);
});

test('permission sanitizer removes unsupported values and duplicates', () => {
  assert.deepEqual(
    sanitizeEmailMarketingPermissions([
      EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
      'delete_everything',
      EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
    ]),
    [EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD],
  );
});

test('workspace update validation accepts safe partial settings', () => {
  const result = updateWorkspaceSchema.safeParse({
    body: {
      name: 'Primary CRM Email Workspace',
      settings: {
        timezone: 'Asia/Kolkata',
        defaultFromEmail: 'marketing@example.com',
        trackingEnabled: true,
      },
    },
    query: {},
    params: {},
  });

  assert.equal(result.success, true);
});

test('workspace update validation rejects unknown and malformed fields', () => {
  const result = updateWorkspaceSchema.safeParse({
    body: {
      ownerUserId: 'another-owner',
      settings: { defaultFromEmail: 'not-an-email' },
    },
    query: {},
    params: {},
  });

  assert.equal(result.success, false);
});

test('workspace filter cannot be built without authenticated context', () => {
  assert.throws(
    () => buildWorkspaceFilter(null, { status: 'active' }),
    /workspace context is missing/i,
  );
});

test('workspace filter always owns the workspace key', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  assert.deepEqual(
    buildWorkspaceFilter(
      { workspaceId },
      { workspaceId: 'attempted-override', status: 'active' },
    ),
    { workspaceId, status: 'active' },
  );
});
