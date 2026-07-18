import express from 'express';
import {
  getDashboardReport,
  getSalesReport,
  getMarketingReport,
  getUserReport,
  getMeetingReport
} from '../controllers/reportsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Secure all reports routes

router.get('/dashboard', getDashboardReport);
router.get('/sales', getSalesReport);
router.get('/marketing', getMarketingReport);
router.get('/users', getUserReport);
router.get('/meetings', getMeetingReport);

export default router;
