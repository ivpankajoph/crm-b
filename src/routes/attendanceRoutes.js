import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { markAttendance, getDailyAttendance, getMyAttendance, markSelfAttendance, requestAttendanceChange, getUserAttendanceHistory, selfCheckOut, getAttendanceReport } from '../controllers/attendanceController.js';

const router = express.Router();

router.post('/', protect, requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), markAttendance);
router.post('/mark-self', protect, requirePermission(PERMISSIONS.ATTENDANCE_VIEW), markSelfAttendance);
router.post('/checkout', protect, requirePermission(PERMISSIONS.ATTENDANCE_VIEW), selfCheckOut);
router.post('/request-change', protect, requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requestAttendanceChange);
router.get('/report', protect, requirePermission(PERMISSIONS.REPORTS_VIEW), getAttendanceReport);
router.get('/daily', protect, requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), getDailyAttendance);
router.get('/history/:userId', protect, requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), getUserAttendanceHistory);
router.get('/my', protect, requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getMyAttendance);

export default router;
