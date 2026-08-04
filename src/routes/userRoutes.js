import express from 'express';
import {
  getUsers,
  getUsersPaged,
  getUserOptions,
  getLeadNotificationDelegates,
  updateLeadNotificationAccess,
  createUser,
  deleteUser,
  updateUser,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get(
  '/paged',
  protect,
  requirePermission(PERMISSIONS.ADMIN_USERS_VIEW, PERMISSIONS.ADMIN_USERS_MANAGE),
  getUsersPaged,
);
router.get('/options', protect, getUserOptions);
router.get(
  '/lead-notification-delegates',
  protect,
  requirePermission(PERMISSIONS.LEADS_MANAGE_NOTIFICATIONS),
  getLeadNotificationDelegates,
);
router.put(
  '/:id/lead-notification-access',
  protect,
  requirePermission(PERMISSIONS.LEADS_MANAGE_NOTIFICATIONS),
  updateLeadNotificationAccess,
);

router.route('/')
  .get(protect, requirePermission(PERMISSIONS.ADMIN_USERS_VIEW, PERMISSIONS.ADMIN_USERS_MANAGE), getUsers)
  .post(protect, requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE), createUser);

router.route('/:id')
  .put(protect, requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE), updateUser)
  .delete(protect, requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE), deleteUser);

export default router;
