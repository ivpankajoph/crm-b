import { successResponse } from '../utils/response.js';
import Customer from '../models/Customer.js';
import Company from '../models/Company.js';

// @desc    Get dashboard stats and activities
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { period = 'today', month, year } = req.query;
    let matchStage = {};
    if (req.user.role !== 'admin') {
      matchStage.createdBy = req.user._id;
    }

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
      Interested: 0,
      'Not Interested': 0,
      Prospective: 0,
      Committed: 0,
      Converted: 0
    };

    [...customerStats, ...companyStats].forEach(stat => {
      if (statusCounts[stat._id] !== undefined) {
        statusCounts[stat._id] += stat.count;
      }
    });

    const dashboardData = {
      metrics: {
        new: statusCounts['New'],
        interested: statusCounts['Interested'],
        notInterested: statusCounts['Not Interested'],
        prospective: statusCounts['Prospective'],
        committed: statusCounts['Committed'],
        converted: statusCounts['Converted'],
      },
      recentActivities: []
    };

    return successResponse(res, 200, 'Dashboard data fetched successfully', dashboardData);
  } catch (error) {
    next(error);
  }
};
