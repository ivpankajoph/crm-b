import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Customer from '../../models/Customer.js';
import Company from '../../models/Company.js';
import LeadStatusHistory from '../../models/LeadStatusHistory.js';
import { calculateDashboardMetricsAggregated } from '../dashboardMetricsService.js';
import { buildLeadStatsMatch, calculateLeadStatsAggregated } from '../leadStatsService.js';
import {
  getCacheMetrics,
  getCachedJsonMany,
  setCachedJsonMany,
  withSafeCache,
} from '../cacheService.js';

const admin = {
  _id: new mongoose.Types.ObjectId(),
  role: 'admin',
};

test('dashboard aggregation preserves status mapping and null-as-New', { concurrency: false }, async () => {
  const originalCustomerAggregate = Customer.aggregate;
  const originalCompanyAggregate = Company.aggregate;
  try {
    Customer.aggregate = async () => [
      { _id: null, count: 2 },
      { _id: 'Interested', count: 3 },
    ];
    Company.aggregate = async () => [
      { _id: 'New', count: 4 },
      { _id: 'Converted', count: 1 },
    ];

    const metrics = await calculateDashboardMetricsAggregated(admin, { period: 'all' });
    assert.deepEqual(metrics, {
      new: 6,
      demoScheduled: 0,
      interested: 3,
      notInterested: 0,
      prospective: 0,
      committed: 0,
      converted: 1,
      followUp: 0,
    });
  } finally {
    Customer.aggregate = originalCustomerAggregate;
    Company.aggregate = originalCompanyAggregate;
  }
});

test('lead aggregation uses grouped counts and lookup visibility without loading ID arrays', { concurrency: false }, async () => {
  const originals = {
    customerAggregate: Customer.aggregate,
    companyAggregate: Company.aggregate,
    customerCount: Customer.countDocuments,
    companyCount: Company.countDocuments,
    historyAggregate: LeadStatusHistory.aggregate,
    customerFind: Customer.find,
    companyFind: Company.find,
  };
  let customerPipeline;
  let companyPipeline;
  let historyPipeline;
  try {
    Customer.aggregate = async (pipeline) => {
      customerPipeline = pipeline;
      return [{ _id: 'Interested', count: 2 }, { _id: null, count: 1 }];
    };
    Company.aggregate = async (pipeline) => {
      companyPipeline = pipeline;
      return [{ _id: 'Converted', count: 3 }];
    };
    Customer.countDocuments = async () => 1;
    Company.countDocuments = async () => 2;
    LeadStatusHistory.aggregate = async (pipeline) => {
      historyPipeline = pipeline;
      return [{ _id: 'Follow Up', count: 4 }];
    };
    Customer.find = () => { throw new Error('Customer.find must not be used by V2 stats'); };
    Company.find = () => { throw new Error('Company.find must not be used by V2 stats'); };

    const stats = await calculateLeadStatsAggregated(admin, { period: 'all' });
    assert.equal(stats.totalLeads, 6);
    assert.equal(stats.interested, 2);
    assert.equal(stats.converted, 3);
    assert.equal(stats.today.demoScheduled, 3);
    assert.equal(stats.today.followUp, 4);
    assert.ok(customerPipeline.some((stage) => stage.$group));
    assert.ok(companyPipeline.some((stage) => stage.$group));
    assert.equal(historyPipeline.filter((stage) => stage.$lookup).length, 2);
  } finally {
    Customer.aggregate = originals.customerAggregate;
    Company.aggregate = originals.companyAggregate;
    Customer.countDocuments = originals.customerCount;
    Company.countDocuments = originals.companyCount;
    LeadStatusHistory.aggregate = originals.historyAggregate;
    Customer.find = originals.customerFind;
    Company.find = originals.companyFind;
  }
});

test('company-only lead stats do not query customer records', { concurrency: false }, async () => {
  const originals = {
    customerAggregate: Customer.aggregate,
    companyAggregate: Company.aggregate,
    companyCount: Company.countDocuments,
    historyAggregate: LeadStatusHistory.aggregate,
  };
  try {
    Customer.aggregate = () => { throw new Error('Customer.aggregate must not run for company-only stats'); };
    Company.aggregate = async () => [
      { _id: 'Interested', count: 4 },
      { _id: 'Follow Up', count: 2 },
    ];
    Company.countDocuments = async () => 1;
    LeadStatusHistory.aggregate = async () => [{ _id: 'Follow Up', count: 1 }];

    const stats = await calculateLeadStatsAggregated(admin, { period: 'all', type: 'Company' });
    assert.equal(stats.totalLeads, 6);
    assert.equal(stats.interested, 4);
    assert.equal(stats.followUp, 2);
    assert.equal(stats.today.demoScheduled, 1);
    assert.equal(stats.today.followUp, 1);
  } finally {
    Customer.aggregate = originals.customerAggregate;
    Company.aggregate = originals.companyAggregate;
    Company.countDocuments = originals.companyCount;
    LeadStatusHistory.aggregate = originals.historyAggregate;
  }
});

test('lead filter validation rejects incomplete committed values', () => {
  assert.throws(
    () => buildLeadStatsMatch(admin, { period: 'month', month: '2026-' }),
    /Month is required/,
  );
  assert.throws(
    () => buildLeadStatsMatch(admin, { period: 'year', year: '20' }),
    /Year is required/,
  );
  assert.throws(
    () => buildLeadStatsMatch(admin, { period: 'date', startDate: '', endDate: '' }),
    /required/,
  );
});

test('concurrent identical uncached requests share one producer', async () => {
  let calls = 0;
  const producer = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { totalLeads: 7 };
  };
  const [first, second] = await Promise.all([
    withSafeCache({ key: 'test:part2:dedupe' }, producer),
    withSafeCache({ key: 'test:part2:dedupe' }, producer),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first.value, second.value);
});

test('local cache serves repeated metric reads and batched reference reads', async () => {
  const suffix = `${Date.now()}:${Math.random()}`;
  const metricKey = `test:part4:metric:${suffix}`;
  let calls = 0;
  await withSafeCache({ key: metricKey }, async () => {
    calls += 1;
    return { totalLeads: 9 };
  });
  const before = getCacheMetrics();
  const cached = await withSafeCache({ key: metricKey }, async () => {
    calls += 1;
    return { totalLeads: 0 };
  });
  const after = getCacheMetrics();
  assert.equal(calls, 1);
  assert.equal(cached.cacheStatus, 'hit');
  assert.ok(after.localHits > before.localHits);

  const keys = [`test:part4:a:${suffix}`, `test:part4:b:${suffix}`];
  await setCachedJsonMany([
    { key: keys[0], value: { id: 'a' } },
    { key: keys[1], value: { id: 'b' } },
  ]);
  assert.deepEqual(await getCachedJsonMany(keys), [{ id: 'a' }, { id: 'b' }]);
});
