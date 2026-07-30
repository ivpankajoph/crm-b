import express from 'express';
import {
  getEmployees,
  getEmployeesPaged,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getTeamLeaders,
  getMyEmployeeProfile
} from '../controllers/employeeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get(
  '/team-leaders',
  protect,
  requirePermission(PERMISSIONS.EMPLOYEES_MANAGE),
  getTeamLeaders,
);
router.get('/me', protect, getMyEmployeeProfile);
router.get(
  '/paged',
  protect,
  requirePermission(PERMISSIONS.EMPLOYEES_VIEW),
  getEmployeesPaged,
);

router.route('/')
  .get(protect, requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployees)
  .post(protect, requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), createEmployee);

router.route('/:id')
  .get(protect, requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployeeById)
  .put(protect, requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), updateEmployee)
  .delete(protect, requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), deleteEmployee);

export default router;
