import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  completeFollowUp,
  getLeadFollowUps,
  getPendingFollowUps,
  saveLeadFollowUp,
  snoozeFollowUp,
} from '../controllers/followUpController.js';

const router = express.Router();

router.get('/pending', protect, getPendingFollowUps);
router.get('/lead/:leadId', protect, getLeadFollowUps);
router.post('/lead/:leadId', protect, upload.single('attachment'), saveLeadFollowUp);
router.put('/:id/complete', protect, completeFollowUp);
router.put('/:id/snooze', protect, snoozeFollowUp);

export default router;
