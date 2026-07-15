import { successResponse } from '../utils/response.js';

// @desc    Get dashboard stats and activities
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    // In the future, this data will be aggregated from the database 
    // (e.g. Lead, Meeting, Activity models).
    const dashboardData = {
      metrics: {
        todayFollowUp: 0,
        totalFollowUp: 0,
        todayMeeting: 0,
        totalMeeting: 0,
        todayAfterMeeting: 0,
        totalAfterMeeting: 0,
        todayProspective: 0,
        totalProspective: 0,
        todayCommitted: 0,
        totalCommitted: 0,
        todayNI: 0,
        totalNI: 0,
        todayConverted: 0,
        totalConverted: 0,
        notOpenLeads: 0,
      },
      recentActivities: []
    };

    return successResponse(res, 200, 'Dashboard data fetched successfully', dashboardData);
  } catch (error) {
    next(error);
  }
};
