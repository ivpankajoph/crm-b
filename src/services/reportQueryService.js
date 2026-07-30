import Company from '../models/Company.js';
import Customer from '../models/Customer.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { isFeatureEnabled } from './cacheService.js';
import { pagedData, paginationMeta, parsePagination } from './listQueryService.js';

export const reportDateRange = (period, now = new Date()) => {
  if (!period || period === 'All') return null;
  let start;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === 'Today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'This Week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'This Month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    return null;
  }
  return { $gte: start, $lte: end };
};

const leadMatch = ({ period, status, visibleUserIds }) => {
  const match = {};
  const dateRange = reportDateRange(period);
  if (dateRange) match.createdAt = dateRange;
  if (status && status !== 'All') match.leadStatus = status;
  if (Array.isArray(visibleUserIds)) {
    match.$or = [
      { createdBy: { $in: visibleUserIds } },
      { assignedTo: { $in: visibleUserIds } },
    ];
  }
  return match;
};

export const buildSalesReportPipeline = ({ period, status, visibleUserIds } = {}) => {
  const match = leadMatch({ period, status, visibleUserIds });
  return [
    { $match: match },
    {
      $project: {
        _id: 0,
        id: '$_id',
        name: '$name',
        company: { $literal: 'N/A' },
        status: { $ifNull: ['$leadStatus', 'New'] },
        createdAt: 1,
        updatedAt: 1,
        createdById: '$createdBy',
      },
    },
    {
      $unionWith: {
        coll: Company.collection.name,
        pipeline: [
          { $match: match },
          {
            $project: {
              _id: 0,
              id: '$_id',
              name: { $ifNull: ['$customerName', '$companyName'] },
              company: '$companyName',
              status: { $ifNull: ['$leadStatus', 'New'] },
              createdAt: 1,
              updatedAt: 1,
              createdById: '$createdBy',
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'createdById',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 0, name: 1 } }],
        as: 'ownerUser',
      },
    },
    {
      $project: {
        id: 1,
        name: 1,
        company: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        owner: { $ifNull: [{ $arrayElemAt: ['$ownerUser.name', 0] }, 'System'] },
      },
    },
  ];
};

export const buildMarketingReportPipeline = ({ period, visibleUserIds } = {}) => {
  const match = leadMatch({ period, visibleUserIds });
  return [
    { $match: match },
    {
      $project: {
        _id: 0,
        id: '$_id',
        leadName: '$name',
        source: { $literal: 'Organic/Unknown' },
        status: { $ifNull: ['$leadStatus', 'New'] },
        isConverted: { $eq: ['$leadStatus', 'Converted'] },
        dateAcquired: '$createdAt',
      },
    },
    {
      $unionWith: {
        coll: Company.collection.name,
        pipeline: [
          { $match: match },
          {
            $project: {
              _id: 0,
              id: '$_id',
              leadName: '$companyName',
              source: { $literal: 'Organic/Unknown' },
              status: { $ifNull: ['$leadStatus', 'New'] },
              isConverted: { $eq: ['$leadStatus', 'Converted'] },
              dateAcquired: '$createdAt',
            },
          },
        ],
      },
    },
  ];
};

const runOptionalPage = async ({ Model, pipeline, sort, query }) => {
  const paginationRequested = query.page !== undefined || query.limit !== undefined;
  if (!paginationRequested) return Model.aggregate([...pipeline, { $sort: sort }]);

  const { page, limit, skip } = parsePagination(query);
  const [result] = await Model.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const total = result?.total?.[0]?.count || 0;
  return pagedData(result?.items || [], paginationMeta({ page, limit, total }));
};

const getSalesReportFallback = async ({ period, status, visibleUserIds, query }) => {
  const match = leadMatch({ period, status, visibleUserIds });
  const [customers, companies] = await Promise.all([
    Customer.find(match)
      .select('name leadStatus createdAt updatedAt createdBy')
      .populate('createdBy', 'name')
      .lean(),
    Company.find(match)
      .select('customerName companyName leadStatus createdAt updatedAt createdBy')
      .populate('createdBy', 'name')
      .lean(),
  ]);
  const rows = [
    ...customers.map((item) => ({
      id: item._id,
      name: item.name,
      company: 'N/A',
      status: item.leadStatus || 'New',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      owner: item.createdBy?.name || 'System',
    })),
    ...companies.map((item) => ({
      id: item._id,
      name: item.customerName || item.companyName,
      company: item.companyName,
      status: item.leadStatus || 'New',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      owner: item.createdBy?.name || 'System',
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);
  if (query.page === undefined && query.limit === undefined) return rows;
  const { page, limit, skip } = parsePagination(query);
  return pagedData(rows.slice(skip, skip + limit), paginationMeta({ page, limit, total: rows.length }));
};

export const getSalesReportData = async (query = {}) => {
  const options = {
    period: query.period,
    status: query.status,
    visibleUserIds: query._visibleUserIds,
  };
  if (!isFeatureEnabled('REPORT_AGGREGATIONS_V2', true)) {
    return getSalesReportFallback({ ...options, query });
  }
  return runOptionalPage({
    Model: Customer,
    pipeline: buildSalesReportPipeline(options),
    sort: { createdAt: -1, id: -1 },
    query,
  });
};

const getMarketingReportFallback = async (query) => {
  const match = leadMatch({
    period: query.period,
    visibleUserIds: query._visibleUserIds,
  });
  const [customers, companies] = await Promise.all([
    Customer.find(match).select('name leadStatus createdAt').lean(),
    Company.find(match).select('companyName leadStatus createdAt').lean(),
  ]);
  const rows = [
    ...customers.map((item) => ({
      id: item._id,
      leadName: item.name,
      source: 'Organic/Unknown',
      status: item.leadStatus || 'New',
      isConverted: item.leadStatus === 'Converted',
      dateAcquired: item.createdAt,
    })),
    ...companies.map((item) => ({
      id: item._id,
      leadName: item.companyName,
      source: 'Organic/Unknown',
      status: item.leadStatus || 'New',
      isConverted: item.leadStatus === 'Converted',
      dateAcquired: item.createdAt,
    })),
  ].sort((a, b) => b.dateAcquired - a.dateAcquired);
  if (query.page === undefined && query.limit === undefined) return rows;
  const { page, limit, skip } = parsePagination(query);
  return pagedData(rows.slice(skip, skip + limit), paginationMeta({ page, limit, total: rows.length }));
};

export const getMarketingReportData = async (query = {}) => {
  if (!isFeatureEnabled('REPORT_AGGREGATIONS_V2', true)) {
    return getMarketingReportFallback(query);
  }
  return runOptionalPage({
    Model: Customer,
    pipeline: buildMarketingReportPipeline({
      period: query.period,
      visibleUserIds: query._visibleUserIds,
    }),
    sort: { dateAcquired: -1, id: -1 },
    query,
  });
};

const countsByUser = (rows) => new Map(rows.map((row) => [String(row._id), row.count]));

export const mergeUserReportRows = ({ users, customerCounts, companyCounts, meetingCounts }) => {
  const customerMap = countsByUser(customerCounts);
  const companyMap = countsByUser(companyCounts);
  const meetingMap = countsByUser(meetingCounts);
  return users.map((user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    leadsCreated: (customerMap.get(String(user._id)) || 0) + (companyMap.get(String(user._id)) || 0),
    meetingsCompleted: meetingMap.get(String(user._id)) || 0,
    joinedAt: user.createdAt,
  }));
};

export const getUserReportData = async (query = {}) => {
  const filter = {};
  if (Array.isArray(query._visibleUserIds)) filter._id = { $in: query._visibleUserIds };
  const dateRange = reportDateRange(query.period);
  if (dateRange) filter.createdAt = dateRange;
  const paginationRequested = query.page !== undefined || query.limit !== undefined;
  const { page, limit, skip } = parsePagination(query);
  const userQuery = User.find(filter)
    .select('name email role createdAt')
    .lean();
  if (paginationRequested) userQuery.sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit);
  const [users, total] = await Promise.all([
    userQuery,
    paginationRequested ? User.countDocuments(filter) : Promise.resolve(0),
  ]);
  const userIds = users.map((user) => user._id);
  const groupPipeline = (extraMatch = {}) => [
    { $match: { createdBy: { $in: userIds }, ...extraMatch } },
    { $group: { _id: '$createdBy', count: { $sum: 1 } } },
  ];
  const [customerCounts, companyCounts, meetingCounts] = userIds.length
    ? await Promise.all([
      Customer.aggregate(groupPipeline()),
      Company.aggregate(groupPipeline()),
      Event.aggregate(groupPipeline({ type: 'Meeting', status: 'Completed' })),
    ])
    : [[], [], []];
  const rows = mergeUserReportRows({ users, customerCounts, companyCounts, meetingCounts });
  return paginationRequested ? pagedData(rows, paginationMeta({ page, limit, total })) : rows;
};

export const getMeetingReportData = async (query = {}) => {
  const filter = { type: 'Meeting' };
  if (Array.isArray(query._visibleUserIds)) filter.createdBy = { $in: query._visibleUserIds };
  if (query.status && query.status !== 'All') filter.status = query.status;
  const dateRange = reportDateRange(query.period);
  if (dateRange) filter.date = dateRange;
  const paginationRequested = query.page !== undefined || query.limit !== undefined;
  const { page, limit, skip } = parsePagination(query);
  const meetingQuery = Event.find(filter)
    .select('title date status report.durationMinutes report.summary createdBy createdAt')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  if (paginationRequested) meetingQuery.skip(skip).limit(limit);
  const [meetings, total] = await Promise.all([
    meetingQuery,
    paginationRequested ? Event.countDocuments(filter) : Promise.resolve(0),
  ]);
  const rows = meetings.map((meeting) => ({
    id: meeting._id,
    title: meeting.title,
    date: meeting.date,
    status: meeting.status,
    durationMinutes: meeting.report?.durationMinutes || 0,
    hasSummary: Boolean(meeting.report?.summary),
    organizer: meeting.createdBy?.name || 'System',
  }));
  return paginationRequested ? pagedData(rows, paginationMeta({ page, limit, total })) : rows;
};
