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
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get('/pending', protect, requirePermission(PERMISSIONS.LEADS_VIEW), getPendingFollowUps);
router.get('/lead/:leadId', protect, requirePermission(PERMISSIONS.LEADS_VIEW), getLeadFollowUps);
router.post('/lead/:leadId', protect, requirePermission(PERMISSIONS.LEADS_CHANGE_STATUS), upload.single('attachment'), saveLeadFollowUp);
router.put('/:id/complete', protect, requirePermission(PERMISSIONS.LEADS_CHANGE_STATUS), completeFollowUp);
router.put('/:id/snooze', protect, requirePermission(PERMISSIONS.LEADS_CHANGE_STATUS), snoozeFollowUp);

export default router;
