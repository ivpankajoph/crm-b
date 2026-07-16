import { successResponse } from '../utils/response.js';
import Customer from '../models/Customer.js';
import Company from '../models/Company.js';

// @desc    Get dashboard stats and activities
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let matchStage = {};
    if (req.user.role !== 'admin') {
      matchStage.createdBy = req.user._id;
    }

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    matchStage.updatedAt = { $gte: start, $lte: end };

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
