import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import compression from 'compression';
import {
  buildMarketingReportPipeline,
  buildSalesReportPipeline,
  mergeUserReportRows,
  reportDateRange,
} from '../reportQueryService.js';
import { createPerformanceTiming, normalizeRoute } from '../../middleware/performanceTiming.js';
import { summarizeExplain } from '../../utils/queryDiagnostics.js';
import Company from '../../models/Company.js';
import Customer from '../../models/Customer.js';
import Event from '../../models/Event.js';
import Task from '../../models/Task.js';
import Message from '../../models/Message.js';
import LeadStatusHistory from '../../models/LeadStatusHistory.js';
import { encodeCsvValue } from '../../utils/csvStream.js';
import reportRoutes from '../../routes/reportsRoutes.js';

test('report periods produce inclusive deterministic date ranges', () => {
  const now = new Date(2026, 6, 27, 12);
  const today = reportDateRange('Today', now);
  assert.equal(today.$gte.getHours(), 0);
  assert.equal(today.$lte.getHours(), 23);
  const month = reportDateRange('This Month', now);
  assert.equal(month.$gte.getDate(), 1);
  assert.equal(month.$lte.getMonth(), 6);
  assert.equal(reportDateRange('All', now), null);
});

test('sales and marketing pipelines preserve report fields and database-side union/filtering', () => {
  const sales = buildSalesReportPipeline({ period: 'This Month', status: 'Converted' });
  assert.equal(sales[0].$match.leadStatus, 'Converted');
  assert.ok(sales.some((stage) => stage.$unionWith));
  const finalSalesProjection = sales.at(-1).$project;
  assert.deepEqual(Object.keys(finalSalesProjection).sort(), [
    'company', 'createdAt', 'id', 'name', 'owner', 'status', 'updatedAt',
  ]);

  const marketing = buildMarketingReportPipeline({ period: 'Today' });
  assert.ok(marketing.some((stage) => stage.$unionWith));
  assert.equal(JSON.stringify(marketing).includes('comments'), false);
  assert.equal(JSON.stringify(marketing).includes('messageNotes'), false);
});

test('grouped user counts preserve per-user report output without N+1 reads', () => {
  const users = [
    { _id: 'u1', name: 'A', email: 'a@example.com', role: 'admin', createdAt: new Date(1) },
    { _id: 'u2', name: 'B', email: 'b@example.com', role: 'manager', createdAt: new Date(2) },
  ];
  const rows = mergeUserReportRows({
    users,
    customerCounts: [{ _id: 'u1', count: 2 }],
    companyCounts: [{ _id: 'u1', count: 3 }, { _id: 'u2', count: 1 }],
    meetingCounts: [{ _id: 'u2', count: 4 }],
  });
  assert.equal(rows[0].leadsCreated, 5);
  assert.equal(rows[0].meetingsCompleted, 0);
  assert.equal(rows[1].leadsCreated, 1);
  assert.equal(rows[1].meetingsCompleted, 4);
});

test('performance telemetry normalizes dynamic paths and explain output', () => {
  assert.equal(
    normalizeRoute('/api/users/507f1f77bcf86cd799439011?password=secret'),
    '/api/users/:id',
  );
  assert.deepEqual(summarizeExplain({
    executionStats: {
      executionTimeMillis: 4,
      totalDocsExamined: 10,
      totalKeysExamined: 10,
      nReturned: 5,
    },
    queryPlanner: { winningPlan: { stage: 'FETCH' } },
  }), {
    executionTimeMillis: 4,
    totalDocsExamined: 10,
    totalKeysExamined: 10,
    returned: 5,
    winningPlan: 'FETCH',
  });
});

test('large JSON is compressed while small JSON stays below threshold', async () => {
  const logs = [];
  const app = express();
  app.use(createPerformanceTiming({ thresholdMs: 0, logger: (entry) => logs.push(entry) }));
  app.use(compression({ threshold: 1024 }));
  app.get('/api/small', (_req, res) => res.json({ ok: true }));
  app.get('/api/large/:id', (_req, res) => res.json({ payload: 'x'.repeat(5000) }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const headers = { 'accept-encoding': 'gzip' };
    const small = await fetch(`http://127.0.0.1:${port}/api/small`, { headers });
    await small.arrayBuffer();
    const large = await fetch(`http://127.0.0.1:${port}/api/large/507f1f77bcf86cd799439011`, { headers });
    await large.arrayBuffer();
    assert.equal(small.headers.get('content-encoding'), null);
    assert.equal(large.headers.get('content-encoding'), 'gzip');
    assert.ok(logs.some((entry) => entry.route === '/api/large/:id' && entry.responseBytes > 0));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Part 4 model indexes are declared without removing prior indexes', () => {
  const hasIndex = (Model, expected) => Model.schema.indexes()
    .some(([key]) => JSON.stringify(key) === JSON.stringify(expected));
  assert.ok(hasIndex(Company, { createdBy: 1, createdAt: -1 }));
  assert.ok(hasIndex(Customer, { leadStatus: 1, createdAt: 1 }));
  assert.ok(hasIndex(Event, { type: 1, status: 1, createdAt: -1 }));
  assert.ok(hasIndex(Task, { createdBy: 1, status: 1, dueDate: 1 }));
  assert.ok(hasIndex(Message, { sender: 1, recipient: 1, createdAt: -1 }));
  assert.ok(hasIndex(LeadStatusHistory, { changedBy: 1, newStatus: 1, changedAt: 1 }));
});

test('full CSV exports remain registered and spreadsheet formulas are neutralized', () => {
  const paths = reportRoutes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.ok(paths.includes('/sales/export'));
  assert.ok(paths.includes('/marketing/export'));
  assert.ok(paths.includes('/users/export'));
  assert.ok(paths.includes('/meetings/export'));
  assert.equal(encodeCsvValue('=HYPERLINK("bad")'), `"'=HYPERLINK(""bad"")"`);
});
