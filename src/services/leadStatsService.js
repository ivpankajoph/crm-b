import Customer from '../models/Customer.js';
import Company from '../models/Company.js';
import LeadStatusHistory from '../models/LeadStatusHistory.js';
import { isAdminUser, normalizeRole } from '../utils/hierarchy.js';
import {
  buildLeadStatsCacheKey,
  isFeatureEnabled,
  withSafeCache,
} from './cacheService.js';

const TRACKED_STATUSES = ['Demo Scheduled', 'Follow Up', 'Prospective', 'Committed', 'Converted', 'Not Interested'];

export const emptyLeadStats = () => ({
  totalLeads: 0,
  demoScheduled: 0,
  interested: 0,
  notInterested: 0,
  prospective: 0,
  committed: 0,
  converted: 0,
  followUp: 0,
  today: {
    demoScheduled: 0,
    followUp: 0,
    prospective: 0,
    committed: 0,
    converted: 0,
    notInterested: 0,
  },
});

const visibilityQuery = (user) => (isAdminUser(user) ? {} : { assignedTo: user._id });

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const buildLeadStatsMatch = (user, filters) => {
  const { period = 'today', startDate: startDateParam, endDate: endDateParam, month, year } = filters;
  const matchStage = visibilityQuery(user);
  let startDate = new Date();
  let endDate = new Date();

  const applyRange = (start, end) => {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    matchStage.createdAt = { $gte: start, $lte: end };
  };

  if (period === 'today') {
    applyRange(startDate, endDate);
  } else if (period === 'date') {
    if (!startDateParam || !endDateParam) throw Object.assign(new Error('Start date and end date are required'), { statusCode: 400 });
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw Object.assign(new Error('Start date and end date are invalid'), { statusCode: 400 });
    }
    applyRange(startDate, endDate);
  } else if (period === 'month') {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) throw Object.assign(new Error('Month is required'), { statusCode: 400 });
    const [selectedYear, selectedMonth] = month.split('-').map(Number);
    applyRange(new Date(selectedYear, selectedMonth - 1, 1), new Date(selectedYear, selectedMonth, 0));
  } else if (period === 'year') {
    const selectedYear = Number(year);
    if (!selectedYear || selectedYear < 1900) throw Object.assign(new Error('Year is required'), { statusCode: 400 });
    applyRange(new Date(selectedYear, 0, 1), new Date(selectedYear, 11, 31));
  }

  return matchStage;
};

const applyGroupedCounts = (result, grouped) => {
  const keyByStatus = {
    'Demo Scheduled': 'demoScheduled',
    Interested: 'interested',
    'Not Interested': 'notInterested',
    Prospective: 'prospective',
    Committed: 'committed',
    Converted: 'converted',
    'Follow Up': 'followUp',
  };
  grouped.forEach(({ _id, count }) => {
    result.totalLeads += count;
    const key = keyByStatus[_id];
    if (key) result[key] += count;
  });
};

const groupedStatusPipeline = (matchStage) => [
  { $match: matchStage },
  { $group: { _id: '$leadStatus', count: { $sum: 1 } } },
];

const historyVisibilityLookup = (from, as, matchStage) => ({
  $lookup: {
    from,
    let: { leadId: '$lead' },
    pipeline: [
      { $match: { ...matchStage, $expr: { $eq: ['$_id', '$$leadId'] } } },
      { $limit: 1 },
    ],
    as,
  },
});

export const calculateLeadStatsAggregated = async (user, filters) => {
  const matchStage = buildLeadStatsMatch(user, filters);
  const { start, end } = todayRange();
  const [customerGroups, companyGroups, todayDemo, todayHistory] = await Promise.all([
    Customer.aggregate(groupedStatusPipeline(matchStage)),
    Company.aggregate(groupedStatusPipeline(matchStage)),
    Promise.all([
      Customer.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
      Company.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
    ]),
    LeadStatusHistory.aggregate([
      {
        $match: {
          leadModel: { $in: ['Customer', 'Company'] },
          newStatus: { $in: TRACKED_STATUSES },
          changedAt: { $gte: start, $lte: end },
        },
      },
      historyVisibilityLookup(Customer.collection.name, 'visibleCustomer', matchStage),
      historyVisibilityLookup(Company.collection.name, 'visibleCompany', matchStage),
      {
        $match: {
          $expr: {
            $or: [
              { $and: [{ $eq: ['$leadModel', 'Customer'] }, { $gt: [{ $size: '$visibleCustomer' }, 0] }] },
              { $and: [{ $eq: ['$leadModel', 'Company'] }, { $gt: [{ $size: '$visibleCompany' }, 0] }] },
            ],
          },
        },
      },
      { $group: { _id: '$newStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const result = emptyLeadStats();
  applyGroupedCounts(result, customerGroups);
  applyGroupedCounts(result, companyGroups);
  result.today.demoScheduled = todayDemo[0] + todayDemo[1];
  const todayKey = {
    'Follow Up': 'followUp',
    Prospective: 'prospective',
    Committed: 'committed',
    Converted: 'converted',
    'Not Interested': 'notInterested',
  };
  todayHistory.forEach(({ _id, count }) => {
    if (todayKey[_id]) result.today[todayKey[_id]] = count;
  });
  return result;
};

export const calculateLeadStatsLegacy = async (user, filters) => {
  const matchStage = buildLeadStatsMatch(user, filters);
  const result = emptyLeadStats();
  const countByStatus = async (status) => {
    const [customers, companies] = await Promise.all([
      Customer.countDocuments({ ...matchStage, leadStatus: status }),
      Company.countDocuments({ ...matchStage, leadStatus: status }),
    ]);
    return customers + companies;
  };
  const [customerCount, companyCount, ...statusCounts] = await Promise.all([
    Customer.countDocuments(matchStage),
    Company.countDocuments(matchStage),
    ...['Demo Scheduled', 'Interested', 'Not Interested', 'Prospective', 'Committed', 'Converted', 'Follow Up'].map(countByStatus),
  ]);
  result.totalLeads = customerCount + companyCount;
  [
    'demoScheduled',
    'interested',
    'notInterested',
    'prospective',
    'committed',
    'converted',
    'followUp',
  ].forEach((key, index) => { result[key] = statusCounts[index]; });

  const { start, end } = todayRange();
  const visibleLeadIds = [
    ...(await Customer.find(matchStage).select('_id').lean()).map((lead) => lead._id),
    ...(await Company.find(matchStage).select('_id').lean()).map((lead) => lead._id),
  ];
  const [todayDemo, todayHistory] = await Promise.all([
    Promise.all([
      Customer.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
      Company.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
    ]),
    LeadStatusHistory.aggregate([
      { $match: { lead: { $in: visibleLeadIds }, newStatus: { $in: TRACKED_STATUSES }, changedAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$newStatus', count: { $sum: 1 } } },
    ]),
  ]);
  result.today.demoScheduled = todayDemo[0] + todayDemo[1];
  const todayKey = {
    'Follow Up': 'followUp',
    Prospective: 'prospective',
    Committed: 'committed',
    Converted: 'converted',
    'Not Interested': 'notInterested',
  };
  todayHistory.forEach(({ _id, count }) => {
    if (todayKey[_id]) result.today[todayKey[_id]] = count;
  });
  return result;
};

export const getCachedLeadStats = async (user, filters) => {
  const useAggregation = isFeatureEnabled('LEAD_STATS_AGGREGATION_V2');
  const key = await buildLeadStatsCacheKey({
    userId: user._id.toString(),
    role: normalizeRole(user.role),
    filters: { ...filters, implementation: useAggregation ? 'aggregation' : 'legacy' },
  });
  const result = await withSafeCache({ key }, () => (
    useAggregation
      ? calculateLeadStatsAggregated(user, filters)
      : calculateLeadStatsLegacy(user, filters)
  ));
  return { ...result, queryCount: useAggregation ? 5 : 23 };
};
