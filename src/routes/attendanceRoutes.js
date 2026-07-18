import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { markAttendance, getDailyAttendance, getMyAttendance, markSelfAttendance, requestAttendanceChange, getUserAttendanceHistory, selfCheckOut, getAttendanceReport } from '../controllers/attendanceController.js';

const router = express.Router();

router.post('/', protect, adminOnly, markAttendance);
router.post('/mark-self', protect, markSelfAttendance);
router.post('/checkout', protect, selfCheckOut);
router.post('/request-change', protect, requestAttendanceChange);
router.get('/report', protect, adminOnly, getAttendanceReport);
router.get('/daily', protect, adminOnly, getDailyAttendance);
router.get('/history/:userId', protect, adminOnly, getUserAttendanceHistory);
router.get('/my', protect, getMyAttendance);

export default router;
