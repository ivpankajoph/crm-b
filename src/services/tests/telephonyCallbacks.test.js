import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import CallbackRoute from '../../models/CallbackRoute.js';
import CallLog from '../../models/CallLog.js';
import { computePlivoV3Signature } from '../../middleware/plivoWebhookMiddleware.js';

test('callback route is unique for a customer and virtual-number pair', () => {
  const uniqueIndex = CallbackRoute.schema.indexes().find(([fields]) => (
    fields.customerNumber === 1 && fields.virtualNumber === 1
  ));
  assert.equal(uniqueIndex?.[1]?.unique, true);
});

test('call log records direction, routing result, provider leg, and canonical numbers', async () => {
  assert.deepEqual(CallLog.schema.path('direction').enumValues, ['outbound', 'inbound']);
  assert.ok(CallLog.schema.path('routeStatus').enumValues.includes('busy'));
  assert.ok(CallLog.schema.path('routeStatus').enumValues.includes('offline'));
  assert.ok(CallLog.schema.path('providerLegId'));
  assert.ok(CallLog.schema.path('virtualNumber'));
  assert.ok(CallLog.schema.path('customerNumber'));
  const unmatched = new CallLog({
    direction: 'inbound', routeStatus: 'no-route', status: 'failed',
    providerCallId: 'unmatched-call', fromNumber: '+919876543210', toNumber: '+918000000000',
  });
  await assert.doesNotReject(() => unmatched.validate());
});

test('Plivo V3 signature uses sorted POST parameters', () => {
  const input = { url: 'https://crm.example/api/telephony/webhooks/incoming', nonce: 'abc123', authToken: 'secret' };
  const first = computePlivoV3Signature({ ...input, params: { To: '+9199', From: '+9188', CallUUID: 'uuid' } });
  const second = computePlivoV3Signature({ ...input, params: { CallUUID: 'uuid', From: '+9188', To: '+9199' } });
  assert.equal(first, second);
  assert.notEqual(first, computePlivoV3Signature({ ...input, params: { CallUUID: 'changed', From: '+9188', To: '+9199' } }));
});

test('incoming callback XML has one employee endpoint and no fallback transfer branch', () => {
  const controller = fs.readFileSync(new URL('../../controllers/telephonyController.js', import.meta.url), 'utf8');
  const handler = controller.slice(controller.indexOf('export const answerIncomingCallback'), controller.indexOf('export const incomingCallHangup'));
  assert.match(handler, /findCallbackRoute/);
  assert.match(handler, /callbackDestinationIsBusy\(\{ employeeId: route\.employee, virtualNumber \}\)/);
  assert.match(handler, /getRegisteredEndpoint\(route\.employee\)/);
  assert.doesNotMatch(handler, /manager|fallbackEmployee|roundRobin/i);
});
