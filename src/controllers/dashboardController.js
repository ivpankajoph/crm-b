import { successResponse } from '../utils/response.js';
import { getDashboardMetrics } from '../services/dashboardMetricsService.js';
import { getDashboardAnalytics } from '../services/dashboardAnalyticsService.js';

const setTiming = (res, name, startedAt, cacheStatus = 'none') => {
  const duration = Date.now() - startedAt;
  res.setHeader('Server-Timing', `${name};dur=${duration};desc="cache ${cacheStatus}"`);
  return duration;
};

// @desc    Get lightweight dashboard metrics
// @route   GET /api/dashboard/metrics
// @access  Private
export const getDashboardMetricsOnly = async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const filters = {
      period: req.query.period || 'today',
      month: req.query.month,
      year: req.query.year,
    };
    const { value: metrics, cacheStatus } = await getDashboardMetrics(req.user, filters);
    setTiming(res, 'dashboard-metrics', startedAt, cacheStatus);
    res.setHeader('X-Cache', cacheStatus);
    return successResponse(res, 200, 'Dashboard metrics fetched successfully', { metrics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get full dashboard stats and analytics (backward-compatible contract)
// @route   GET /api/dashboard
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const filters = {
      period: req.query.period || 'today',
      month: req.query.month,
      year: req.query.year,
    };
    const [metricsResult, analytics] = await Promise.all([
      getDashboardMetrics(req.user, filters),
      getDashboardAnalytics(req.user),
    ]);
    const dashboardData = {
      metrics: metricsResult.value,
      recentActivities: [],
      ...analytics,
    };
    setTiming(res, 'dashboard-full', startedAt, metricsResult.cacheStatus);
    res.setHeader('X-Cache', metricsResult.cacheStatus);
    return successResponse(res, 200, 'Dashboard data fetched successfully', dashboardData);
  } catch (error) {
    next(error);
  }
};
