import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePagination, paginationMeta, safeSort, escapeRegex, parseDateParam } from '../listQueryService.js';
import companyRoutes from '../../routes/companyRoutes.js';
import customerRoutes from '../../routes/customerRoutes.js';
import employeeRoutes from '../../routes/employeeRoutes.js';
import userRoutes from '../../routes/userRoutes.js';
import eventRoutes from '../../routes/eventRoutes.js';
import taskRoutes from '../../routes/taskRoutes.js';
import noteRoutes from '../../routes/noteRoutes.js';
import notificationRoutes from '../../routes/notificationRoutes.js';
import leadRoutes from '../../routes/leadRoutes.js';
import followUpRoutes from '../../routes/followUpRoutes.js';

const routePaths = (router) => router.stack
  .filter((layer) => layer.route)
  .map((layer) => layer.route.path);

test('pagination input is bounded and deterministic', () => {
  assert.deepEqual(parsePagination({ page: '-5', limit: '1000' }), {
    page: 1,
    limit: 100,
    skip: 0,
    search: '',
    sortOrder: -1,
  });
  assert.deepEqual(parsePagination({ page: '3', limit: '20', search: '  hello  ', sortOrder: 'asc' }), {
    page: 3,
    limit: 20,
    skip: 40,
    search: 'hello',
    sortOrder: 1,
  });
});

test('pagination metadata exposes a safe page and the requested page', () => {
  assert.deepEqual(paginationMeta({ page: 5, limit: 25, total: 30 }), {
    page: 2,
    requestedPage: 5,
    limit: 25,
    total: 30,
    totalPages: 2,
    hasNext: false,
    hasPrevious: true,
  });
});

test('sort fields and regular-expression input are allowlisted/escaped', () => {
  assert.deepEqual(safeSort({ sortBy: 'password', sortOrder: 'asc' }, ['name'], 'name'), {
    name: 1,
    _id: 1,
  });
  assert.equal(escapeRegex('a+b?(c)'), 'a\\+b\\?\\(c\\)');
});

test('date-only upper bounds include the complete final day', () => {
  const date = parseDateParam('2026-07-31', { endOfDay: true });
  assert.equal(date.getHours(), 23);
  assert.equal(date.getMinutes(), 59);
  assert.equal(parseDateParam('not-a-date'), null);
});

test('all additive Part 3 routes remain available beside legacy routes', () => {
  assert.ok(routePaths(companyRoutes).includes('/paged'));
  assert.ok(routePaths(companyRoutes).includes('/options'));
  assert.ok(routePaths(customerRoutes).includes('/options'));
  assert.ok(routePaths(employeeRoutes).includes('/paged'));
  assert.ok(routePaths(userRoutes).includes('/paged'));
  assert.ok(routePaths(userRoutes).includes('/options'));
  assert.ok(routePaths(eventRoutes).includes('/paged'));
  assert.ok(routePaths(taskRoutes).includes('/paged'));
  assert.ok(routePaths(noteRoutes).includes('/paged'));
  assert.ok(routePaths(noteRoutes).includes('/sticky'));
  assert.ok(routePaths(notificationRoutes).includes('/paged'));
  assert.ok(routePaths(notificationRoutes).includes('/summary'));
  assert.ok(routePaths(leadRoutes).includes('/all/paged'));
  assert.ok(routePaths(leadRoutes).includes('/unified/:type/:id/follow-up'));
  assert.ok(routePaths(followUpRoutes).includes('/pending'));
  assert.ok(routePaths(followUpRoutes).includes('/lead/:leadId'));
  assert.ok(routePaths(followUpRoutes).includes('/:id/complete'));
  assert.ok(routePaths(followUpRoutes).includes('/:id/snooze'));

  for (const router of [
    companyRoutes,
    customerRoutes,
    employeeRoutes,
    userRoutes,
    eventRoutes,
    taskRoutes,
    noteRoutes,
    notificationRoutes,
  ]) {
    assert.ok(routePaths(router).includes('/'), 'legacy list route must remain registered');
  }
  assert.ok(routePaths(leadRoutes).includes('/all'), 'legacy unified-leads route must remain registered');
});
