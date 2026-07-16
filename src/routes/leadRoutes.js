import express from 'express';
import { getLeads, createLead, getLeadStats, getAllCombinedLeads, getUnifiedLead, updateLeadStatus, addLeadComment, assignLead } from '../controllers/leadController.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/stats')
  .get(protect, getLeadStats);

router.route('/all')
  .get(protect, getAllCombinedLeads);

router.route('/unified/:type/:id')
  .get(protect, getUnifiedLead);

router.route('/unified/:type/:id/status')
  .put(protect, updateLeadStatus);

router.route('/unified/:type/:id/comment')
  .post(protect, upload.single('attachment'), addLeadComment);

router.route('/unified/:type/:id/assign')
  .put(protect, assignLead);

router.route('/')
  .get(protect, getLeads)
  .post(protect, createLead);

export default router;
