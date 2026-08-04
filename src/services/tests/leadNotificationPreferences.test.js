import test from 'node:test';
import assert from 'node:assert/strict';
import Company from '../../models/Company.js';
import Customer from '../../models/Customer.js';
import Lead from '../../models/Lead.js';
import leadRoutes from '../../routes/leadRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { resolveLeadNotificationChannels } from '../leadStatusNotificationService.js';

const routePaths = (router) => router.stack
  .map((layer) => layer.route?.path)
  .filter(Boolean);

test('all unified lead models default automatic notifications to off', () => {
  const records = [
    new Company({ companyName: 'Example', mobileNo: '+919999999999', address1: 'Delhi', website1: 'example.com' }),
    new Customer({ name: 'Example', createdBy: '507f1f77bcf86cd799439011' }),
    new Lead({ name: 'Example', createdBy: '507f1f77bcf86cd799439011' }),
  ];

  records.forEach((record) => {
    assert.equal(record.notificationPreferences.emailEnabled, false);
    assert.equal(record.notificationPreferences.whatsappEnabled, false);
  });
});

test('notification channels remain independent and missing preferences are disabled', () => {
  assert.deepEqual(resolveLeadNotificationChannels({}), {
    emailEnabled: false,
    whatsappEnabled: false,
  });
  assert.deepEqual(resolveLeadNotificationChannels({
    notificationPreferences: { emailEnabled: true, whatsappEnabled: false },
  }), {
    emailEnabled: true,
    whatsappEnabled: false,
  });
  assert.deepEqual(resolveLeadNotificationChannels({
    notificationPreferences: { emailEnabled: false, whatsappEnabled: true },
  }), {
    emailEnabled: false,
    whatsappEnabled: true,
  });
});

test('notification preference and scoped delegation routes remain registered', () => {
  assert.ok(routePaths(leadRoutes).includes('/unified/:type/:id/notification-preferences'));
  assert.ok(routePaths(userRoutes).includes('/lead-notification-delegates'));
  assert.ok(routePaths(userRoutes).includes('/:id/lead-notification-access'));
  assert.equal(PERMISSIONS.LEADS_MANAGE_NOTIFICATIONS, 'leads.manage_notifications');
});
