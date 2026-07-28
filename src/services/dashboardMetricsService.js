import Customer from '../models/Customer.js';
import Company from '../models/Company.js';
import { isAdminUser, normalizeRole } from '../utils/hierarchy.js';
import {
  buildDashboardMetricsCacheKey,
  isFeatureEnabled,
  withSafeCache,
} from './cacheService.js';

export const PIPELINE_STATUSES = [
  'New',
  'Demo Scheduled',
  'Interested',
  'Not Interested',
  'Prospective',
  'Committed',
  'Converted',
  'Follow Up',
];

export const emptyDashboardMetrics = () => ({
  new: 0,
  demoScheduled: 0,
  interested: 0,
  notInterested: 0,
  prospective: 0,
  committed: 0,
  converted: 0,
  followUp: 0,
});

const applyDashboardDateRange = (matchStage, { period = 'today', month, year }) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (period === 'all') return matchStage;
  if (period === 'month') {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
    } else {
      const [selectedYear, selectedMonth] = month.split('-').map(Number);
      start = new Date(selectedYear, selectedMonth - 1, 1);
      end = new Date(selectedYear, selectedMonth, 0);
    }
  } else if (period === 'year') {
    const selectedYear = Number(year) || now.getFullYear();
    start = new Date(selectedYear, 0, 1);
    end = new Date(selectedYear, 11, 31);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { ...matchStage, createdAt: { $gte: start, $lte: end } };
};

export const buildDashboardMetricMatch = (user, filters) => {
  const visibility = isAdminUser(user) ? {} : { assignedTo: user._id };
  return applyDashboardDateRange(visibility, filters);
};

const mapGroupedMetrics = (customerStats, companyStats) => {
  const counts = Object.fromEntries(PIPELINE_STATUSES.map((status) => [status, 0]));
  [...customerStats, ...companyStats].forEach(({ _id, count }) => {
    const status = _id || 'New';
    if (counts[status] !== undefined) counts[status] += count;
  });

  return {
    new: counts.New,
    demoScheduled: counts['Demo Scheduled'],
    interested: counts.Interested,
    notInterested: counts['Not Interested'],
    prospective: counts.Prospective,
    committed: counts.Committed,
    converted: counts.Converted,
    followUp: counts['Follow Up'],
  };
};

export const calculateDashboardMetricsAggregated = async (user, filters) => {
  const matchStage = buildDashboardMetricMatch(user, filters);
  const groupPipeline = [
    { $match: matchStage },
    { $group: { _id: { $ifNull: ['$leadStatus', 'New'] }, count: { $sum: 1 } } },
  ];
  const [customerStats, companyStats] = await Promise.all([
    Customer.aggregate(groupPipeline),
    Company.aggregate(groupPipeline),
  ]);
  return mapGroupedMetrics(customerStats, companyStats);
};

export const calculateDashboardMetricsLegacy = async (user, filters) => {
  const matchStage = buildDashboardMetricMatch(user, filters);
  const metrics = emptyDashboardMetrics();
  const statusToKey = {
    New: 'new',
    'Demo Scheduled': 'demoScheduled',
    Interested: 'interested',
    'Not Interested': 'notInterested',
    Prospective: 'prospective',
    Committed: 'committed',
    Converted: 'converted',
    'Follow Up': 'followUp',
  };
  const values = await Promise.all(PIPELINE_STATUSES.map(async (status) => {
    const statusMatch = status === 'New'
      ? { $or: [{ leadStatus: 'New' }, { leadStatus: null }] }
      : { leadStatus: status };
    const [customers, companies] = await Promise.all([
      Customer.countDocuments({ ...matchStage, ...statusMatch }),
      Company.countDocuments({ ...matchStage, ...statusMatch }),
    ]);
    return [statusToKey[status], customers + companies];
  }));
  values.forEach(([key, count]) => { metrics[key] = count; });
  return metrics;
};

export const getDashboardMetrics = async (user, filters) => {
  const useAggregation = isFeatureEnabled('DASHBOARD_METRICS_V2');
  const cacheKey = await buildDashboardMetricsCacheKey({
    userId: user._id.toString(),
    role: normalizeRole(user.role),
    period: filters.period || 'today',
    month: filters.month,
    year: filters.year,
    implementation: useAggregation ? 'aggregation' : 'legacy',
  });
  const result = await withSafeCache({ key: cacheKey }, () => (
    useAggregation
      ? calculateDashboardMetricsAggregated(user, filters)
      : calculateDashboardMetricsLegacy(user, filters)
  ));
  return { ...result, queryCount: useAggregation ? 2 : 16 };
};
