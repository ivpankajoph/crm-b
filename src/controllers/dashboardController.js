import { successResponse } from '../utils/response.js';
import Customer from '../models/Customer.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import CallLog from '../models/CallLog.js';
import LeadStatusHistory from '../models/LeadStatusHistory.js';
import { getVisibleUserIds, isAdminUser } from '../utils/hierarchy.js';

// @desc    Get dashboard stats and activities
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { period = 'today', month, year } = req.query;
    const userIds = await getVisibleUserIds(req.user);
    let matchStage = isAdminUser(req.user) ? {} : { assignedTo: req.user._id };

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    const applyDateRange = (startDate, endDate) => {
      if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return false;
      }
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: startDate, $lte: endDate };
      return true;
    };

    if (period === 'today') {
      applyDateRange(start, end);
    } else if (period === 'month') {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
      } else {
        const [selectedYear, selectedMonth] = month.split('-').map(Number);
        start = new Date(selectedYear, selectedMonth - 1, 1);
        end = new Date(selectedYear, selectedMonth, 0);
      }
      applyDateRange(start, end);
    } else if (period === 'year') {
      const selectedYear = Number(year) || now.getFullYear();
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31);
      applyDateRange(start, end);
    }

    const [customerStats, companyStats] = await Promise.all([
      Customer.aggregate([
        { $match: matchStage },
        { $group: { _id: { $ifNull: ["$leadStatus", "New"] }, count: { $sum: 1 } } }
      ]),
      Company.aggregate([
        { $match: matchStage },
        { $group: { _id: { $ifNull: ["$leadStatus", "New"] }, count: { $sum: 1 } } }
      ])
    ]);

    const statusCounts = {
      New: 0,
      'Demo Scheduled': 0,
      Interested: 0,
      'Not Interested': 0,
      Prospective: 0,
      Committed: 0,
      Converted: 0,
      'Follow Up': 0,
    };

    [...customerStats, ...companyStats].forEach(stat => {
      if (statusCounts[stat._id] !== undefined) {
        statusCounts[stat._id] += stat.count;
      }
    });

    const dashboardData = {
      metrics: {
        new: statusCounts['New'],
        demoScheduled: statusCounts['Demo Scheduled'],
        interested: statusCounts['Interested'],
        notInterested: statusCounts['Not Interested'],
        prospective: statusCounts['Prospective'],
        committed: statusCounts['Committed'],
        converted: statusCounts['Converted'],
        followUp: statusCounts['Follow Up'],
      },
      recentActivities: []
    };

    const [callAgg, teamUsers, statusTrend] = await Promise.all([
      CallLog.aggregate([
        { $match: { calledBy: { $in: userIds } } },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            averageQualityScore: { $avg: '$aiQualityScore' },
          },
        },
      ]),
      User.find({ _id: { $in: userIds } }).select('name role parent').lean(),
      LeadStatusHistory.aggregate([
        {
          $match: {
            changedBy: { $in: userIds },
            newStatus: { $in: ['Demo Scheduled', 'Follow Up', 'Prospective', 'Committed', 'Converted', 'Not Interested'] },
          },
        },
        {
          $group: {
            _id: {
              status: '$newStatus',
              day: { $dateToString: { format: '%Y-%m-%d', date: '$changedAt' } },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.day': 1 } },
      ]),
    ]);

    const teamBreakdown = await Promise.all(teamUsers.map(async (user) => {
      const ownership = { $or: [{ createdBy: user._id }, { assignedTo: user._id }] };
      const [customers, companies, calls] = await Promise.all([
        Customer.countDocuments(ownership),
        Company.countDocuments(ownership),
        CallLog.aggregate([
          { $match: { calledBy: user._id } },
          {
            $group: {
              _id: null,
              totalCalls: { $sum: 1 },
              averageQualityScore: { $avg: '$aiQualityScore' },
            },
          },
        ]),
      ]);

      return {
        userId: user._id,
        name: user.name,
        role: user.role,
        totalLeads: customers + companies,
        totalCalls: calls[0]?.totalCalls || 0,
        averageQualityScore: Math.round((calls[0]?.averageQualityScore || 0) * 10) / 10,
      };
    }));

    dashboardData.callActivity = {
      totalCalls: callAgg[0]?.totalCalls || 0,
      averageQualityScore: Math.round((callAgg[0]?.averageQualityScore || 0) * 10) / 10,
    };
    dashboardData.teamBreakdown = teamBreakdown.sort((a, b) => b.totalLeads - a.totalLeads);
    dashboardData.statusTrend = statusTrend.map((item) => ({
      date: item._id.day,
      status: item._id.status,
      count: item.count,
    }));

    return successResponse(res, 200, 'Dashboard data fetched successfully', dashboardData);
  } catch (error) {
    next(error);
  }
};
