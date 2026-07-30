import express from 'express';
import { getDashboardMetricsOnly, getDashboardStats } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get('/metrics', protect, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardMetricsOnly);

router.route('/')
  .get(protect, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);

export default router;
