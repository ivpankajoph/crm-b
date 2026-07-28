import express from 'express';
import { 
  getNotifications, 
  getNotificationsPaged,
  getNotificationSummary,
  createNotification, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification,
  deleteAllNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/paged', protect, getNotificationsPaged);
router.get('/summary', protect, getNotificationSummary);

router.route('/')
  .get(protect, getNotifications)
  .post(protect, createNotification)
  .delete(protect, deleteAllNotifications);

router.route('/read-all')
  .put(protect, markAllAsRead);

router.route('/:id')
  .delete(protect, deleteNotification);

router.route('/:id/read')
  .put(protect, markAsRead);

export default router;
