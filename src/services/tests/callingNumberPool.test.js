import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Setting from '../../models/Setting.js';
import CallLog from '../../models/CallLog.js';
import telephonyRoutes from '../../routes/telephonyRoutes.js';
import {
  callingNumberForCursor,
  effectiveCallingPool,
  normalizeCallingPool,
} from '../callingNumberPoolService.js';

const route = (path, method) => telephonyRoutes.stack.find((layer) => (
  layer.route?.path === path && layer.route?.methods?.[method]
))?.route;

test('legacy default number becomes a one-number pool until pool is explicitly configured', () => {
  assert.deepEqual(effectiveCallingPool({
    plivoNumber: '+918035341163',
    callingPoolConfigured: false,
    activePlivoNumbers: [],
  }), ['+918035341163']);
  assert.deepEqual(effectiveCallingPool({
    plivoNumber: '+918035341163',
    callingPoolConfigured: true,
    activePlivoNumbers: [],
  }), []);
});

test('calling pool is normalized, deduplicated, and selected dynamically by cursor', () => {
  const pool = normalizeCallingPool(['+918035341163', '918035313191', '+918035341163']);
  assert.deepEqual(pool, ['+918035341163', '+918035313191']);
  assert.equal(callingNumberForCursor(pool, 0), '+918035341163');
  assert.equal(callingNumberForCursor(pool, 1), '+918035313191');
  assert.equal(callingNumberForCursor(pool, 2), '+918035341163');
  assert.equal(callingNumberForCursor([], 10), null);
});

test('settings and call logs retain pool configuration and number-wise history support', () => {
  assert.ok(Setting.schema.path('activePlivoNumbers'));
  assert.ok(Setting.schema.path('callingPoolConfigured'));
  assert.ok(Setting.schema.path('plivoNumberPoolCursor'));
  assert.ok(CallLog.schema.indexes().some(([fields]) => fields.fromNumber === 1 && fields.callDatetime === -1));
});

test('active calling pool mutation is admin protected and call history supports number filtering', () => {
  const poolRoute = route('/numbers/active-pool', 'put');
  assert.ok(poolRoute);
  assert.equal(poolRoute.stack.length, 3);
  assert.equal(poolRoute.stack[1].handle.name, 'adminOnly');

  const controller = fs.readFileSync(new URL('../../controllers/telephonyController.js', import.meta.url), 'utf8');
  const leadController = fs.readFileSync(new URL('../../controllers/leadController.js', import.meta.url), 'utf8');
  assert.match(controller, /virtualNumber: fromNumber/);
  assert.match(controller, /CallLog\.distinct\('fromNumber'/);
  assert.match(leadController, /selectNextCallingNumber\(\)/);
});
