import express from 'express';
import { getLeads, createLead, getLeadStats } from '../controllers/leadController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, getLeadStats);

router.route('/')
  .get(protect, getLeads)
  .post(protect, createLead);

export default router;
