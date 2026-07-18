import express from 'express';
import {
  getEmployees,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getTeamLeaders,
  getMyEmployeeProfile
} from '../controllers/employeeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/team-leaders', protect, getTeamLeaders);
router.get('/me', protect, getMyEmployeeProfile);

router.route('/')
  .get(protect, getEmployees)
  .post(protect, createEmployee);

router.route('/:id')
  .get(protect, getEmployeeById)
  .put(protect, updateEmployee)
  .delete(protect, deleteEmployee);

export default router;
