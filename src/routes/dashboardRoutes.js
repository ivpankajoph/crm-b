import express from 'express';
import { getDashboardMetricsOnly, getDashboardStats } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/metrics', protect, getDashboardMetricsOnly);

router.route('/')
  .get(protect, getDashboardStats);

export default router;
