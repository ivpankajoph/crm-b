import express from 'express';
import {
  getDashboardReport,
  getSalesPerformance,
  getSalesReport,
  getUserReport,
  getMeetingReport,
  exportSalesReport,
  exportUserReport,
  exportMeetingReport,
} from '../controllers/reportsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.use(protect); // Secure all reports routes

router.get('/dashboard', requirePermission(PERMISSIONS.REPORTS_VIEW), getDashboardReport);
router.get('/sales/export', requirePermission(PERMISSIONS.REPORTS_EXPORT), exportSalesReport);
router.get('/users/export', requirePermission(PERMISSIONS.REPORTS_EXPORT), exportUserReport);
router.get('/meetings/export', requirePermission(PERMISSIONS.REPORTS_EXPORT), exportMeetingReport);
router.get('/sales/performance', requirePermission(PERMISSIONS.REPORTS_VIEW), getSalesPerformance);
router.get('/sales', requirePermission(PERMISSIONS.REPORTS_VIEW), getSalesReport);
router.get('/users', requirePermission(PERMISSIONS.REPORTS_VIEW), getUserReport);
router.get('/meetings', requirePermission(PERMISSIONS.REPORTS_VIEW), getMeetingReport);

export default router;
