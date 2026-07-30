import Event from '../models/Event.js';
import Company from '../models/Company.js';
import Customer from '../models/Customer.js';
import {
  buildMarketingReportPipeline,
  buildSalesReportPipeline,
  getMarketingReportData,
  getMeetingReportData,
  getSalesReportData,
  getUserReportData,
} from '../services/reportQueryService.js';
import { streamCsv } from '../utils/csvStream.js';
import mongoose from 'mongoose';
import { resolveUserDataScope } from '../services/dataScopeService.js';

const scopedReportQuery = async (req) => {
  const visibility = await resolveUserDataScope(req.user, 'reports', req.access);
  if (visibility.scope === 'all') return { ...req.query, _visibleUserIds: undefined };
  return {
    ...req.query,
    _visibleUserIds: visibility.userIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id)),
  };
};

const leadOwnershipFilter = (visibleUserIds) => (
  Array.isArray(visibleUserIds)
    ? {
        $or: [
          { createdBy: { $in: visibleUserIds } },
          { assignedTo: { $in: visibleUserIds } },
        ],
      }
    : {}
);

const creatorFilter = (visibleUserIds) => (
  Array.isArray(visibleUserIds) ? { createdBy: { $in: visibleUserIds } } : {}
);

export const getDashboardReport = async (req, res) => {
  try {
    const scopedQuery = await scopedReportQuery(req);
    const visibleUserIds = scopedQuery._visibleUserIds;
    const leadFilter = leadOwnershipFilter(visibleUserIds);
    const activityFilter = creatorFilter(visibleUserIds);
    const [
      totalCustomers,
      totalCompanies,
      totalMeetings,
      recentCustomers,
      recentCompanies,
      recentMeetings,
    ] = await Promise.all([
      Customer.countDocuments(leadFilter),
      Company.countDocuments(leadFilter),
      Event.countDocuments({ type: 'Meeting', ...activityFilter }),
      Customer.find(leadFilter)
        .select('name createdAt createdBy')
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name')
        .lean(),
      Company.find(leadFilter)
        .select('companyName createdAt createdBy')
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name')
        .lean(),
      Event.find({ type: 'Meeting', ...activityFilter })
        .select('title createdAt createdBy')
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name')
        .lean(),
    ]);

    const recentActivities = [
      ...recentCustomers.map((item) => ({
        id: item._id,
        action: `New customer lead created: ${item.name}`,
        date: item.createdAt,
        user: item.createdBy?.name || 'System',
      })),
      ...recentCompanies.map((item) => ({
        id: item._id,
        action: `New company lead created: ${item.companyName}`,
        date: item.createdAt,
        user: item.createdBy?.name || 'System',
      })),
      ...recentMeetings.map((item) => ({
        id: item._id,
        action: `Meeting scheduled: ${item.title}`,
        date: item.createdAt,
        user: item.createdBy?.name || 'System',
      })),
    ].sort((a, b) => b.date - a.date).slice(0, 10);

    res.json({
      success: true,
      data: {
        metrics: {
          totalLeads: totalCustomers + totalCompanies,
          totalCustomers,
          totalCompanies,
          totalMeetings,
        },
        recentActivities,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    res.json({ success: true, data: await getSalesReportData(await scopedReportQuery(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMarketingReport = async (req, res) => {
  try {
    res.json({ success: true, data: await getMarketingReportData(await scopedReportQuery(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserReport = async (req, res) => {
  try {
    res.json({ success: true, data: await getUserReportData(await scopedReportQuery(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMeetingReport = async (req, res) => {
  try {
    res.json({ success: true, data: await getMeetingReportData(await scopedReportQuery(req)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleExportError = (res, error) => {
  if (res.headersSent) return res.end();
  return res.status(500).json({ success: false, message: error.message });
};

export const exportSalesReport = async (req, res) => {
  try {
    const query = await scopedReportQuery(req);
    const rows = Customer.aggregate([
      ...buildSalesReportPipeline({
        period: query.period,
        status: query.status,
        visibleUserIds: query._visibleUserIds,
      }),
      { $sort: { createdAt: -1, id: -1 } },
    ]).cursor({ batchSize: 250 });
    await streamCsv({
      res,
      filename: 'sales-report.csv',
      columns: [
        { label: 'Lead Name', value: 'name' },
        { label: 'Company', value: 'company' },
        { label: 'Status', value: 'status' },
        { label: 'Owner', value: 'owner' },
        { label: 'Created At', value: 'createdAt' },
        { label: 'Updated At', value: 'updatedAt' },
      ],
      rows,
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

export const exportMarketingReport = async (req, res) => {
  try {
    const query = await scopedReportQuery(req);
    const rows = Customer.aggregate([
      ...buildMarketingReportPipeline({
        period: query.period,
        visibleUserIds: query._visibleUserIds,
      }),
      { $sort: { dateAcquired: -1, id: -1 } },
    ]).cursor({ batchSize: 250 });
    await streamCsv({
      res,
      filename: 'marketing-report.csv',
      columns: [
        { label: 'Lead Name', value: 'leadName' },
        { label: 'Source', value: 'source' },
        { label: 'Status', value: 'status' },
        { label: 'Converted', value: (row) => row.isConverted ? 'Yes' : 'No' },
        { label: 'Acquisition Date', value: 'dateAcquired' },
      ],
      rows,
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

export const exportUserReport = async (req, res) => {
  try {
    const rows = await getUserReportData(await scopedReportQuery(req));
    await streamCsv({
      res,
      filename: 'user-report.csv',
      columns: [
        { label: 'User Name', value: 'name' },
        { label: 'Email', value: 'email' },
        { label: 'Role', value: 'role' },
        { label: 'Leads Created', value: 'leadsCreated' },
        { label: 'Meetings Completed', value: 'meetingsCompleted' },
        { label: 'Joined At', value: 'joinedAt' },
      ],
      rows,
    });
  } catch (error) {
    handleExportError(res, error);
  }
};

export const exportMeetingReport = async (req, res) => {
  try {
    const rows = await getMeetingReportData(await scopedReportQuery(req));
    await streamCsv({
      res,
      filename: 'meeting-report.csv',
      columns: [
        { label: 'Meeting Title', value: 'title' },
        { label: 'Organizer', value: 'organizer' },
        { label: 'Status', value: 'status' },
        { label: 'Duration Minutes', value: 'durationMinutes' },
        { label: 'Has Summary', value: (row) => row.hasSummary ? 'Yes' : 'No' },
        { label: 'Scheduled Date', value: 'date' },
      ],
      rows,
    });
  } catch (error) {
    handleExportError(res, error);
  }
};
