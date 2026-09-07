import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolveUserDataScope } from '../services/dataScopeService.js';
import {
  attendanceTargetIsVisible,
  statusFromAttendanceTimes,
  withAttendanceMetrics,
  withAttendanceMetricsMany,
} from '../services/attendanceService.js';

const ATTENDANCE_STATUSES = new Set(['Present', 'Absent', 'Half Day', 'On Leave']);

const ensureVisibleAttendanceTarget = async (req, res, userId) => {
  const visibility = await resolveUserDataScope(req.user, 'attendance', req.access);
  if (!attendanceTargetIsVisible(visibility, userId)) {
    errorResponse(res, 403, 'This employee is outside your attendance access');
    return null;
  }
  return visibility;
};

// @desc    Mark attendance for a user (Admin only)
// @route   POST /api/attendance
// @access  Private/Admin
export const markAttendance = async (req, res, next) => {
  try {
    const { userId, date, status, checkIn, checkOut, notes } = req.body;

    if (!userId || !date || !status) {
      return errorResponse(res, 400, 'User ID, date, and status are required');
    }
    if (!ATTENDANCE_STATUSES.has(status)) {
      return errorResponse(res, 400, 'Invalid attendance status');
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    if (!await ensureVisibleAttendanceTarget(req, res, userId)) return;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    const filter = { user: userId, date: attendanceDate };
    const update = { status, markedBy: req.user._id };
    if (Object.hasOwn(req.body, 'checkIn')) update.checkIn = checkIn ? new Date(checkIn) : null;
    if (Object.hasOwn(req.body, 'checkOut')) update.checkOut = checkOut ? new Date(checkOut) : null;
    if (Object.hasOwn(req.body, 'notes')) update.notes = notes;

    const effectiveCheckIn = Object.hasOwn(update, 'checkIn') ? update.checkIn : undefined;
    const effectiveCheckOut = Object.hasOwn(update, 'checkOut') ? update.checkOut : undefined;
    if ((effectiveCheckIn && Number.isNaN(effectiveCheckIn.getTime()))
      || (effectiveCheckOut && Number.isNaN(effectiveCheckOut.getTime()))) {
      return errorResponse(res, 400, 'Check-in and check-out must be valid dates');
    }

    if (effectiveCheckIn !== undefined || effectiveCheckOut !== undefined) {
      const existing = await Attendance.findOne(filter).select('checkIn checkOut').lean();
      const finalCheckIn = effectiveCheckIn !== undefined ? effectiveCheckIn : existing?.checkIn;
      const finalCheckOut = effectiveCheckOut !== undefined ? effectiveCheckOut : existing?.checkOut;
      if (finalCheckOut && !finalCheckIn) {
        return errorResponse(res, 400, 'Check-in is required before check-out');
      }
      if (finalCheckIn && finalCheckOut && finalCheckOut < finalCheckIn) {
        return errorResponse(res, 400, 'Check-out cannot be earlier than check-in');
      }
      if (finalCheckIn && finalCheckOut) {
        update.status = statusFromAttendanceTimes(finalCheckIn, finalCheckOut);
      }
    }

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Attendance marked successfully', withAttendanceMetrics(attendance));
  } catch (error) {
    next(error);
  }
};

// @desc    Mark attendance for self (Employee)
// @route   POST /api/attendance/mark-self
// @access  Private
export const markSelfAttendance = async (req, res, next) => {
  try {
    const { status, lat, lng } = req.body;
    
    if (!status) {
      return errorResponse(res, 400, 'Status is required');
    }
    if (!ATTENDANCE_STATUSES.has(status)) {
      return errorResponse(res, 400, 'Invalid attendance status');
    }

    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const filter = { user: req.user._id, date: attendanceDate };
    
    // Check if attendance already marked today
    const existing = await Attendance.findOne(filter);
    if (existing) {
      return errorResponse(res, 400, 'Attendance has already been marked for today. Request a change if it needs correction.');
    }
    
    const update = {
      status,
      markedBy: req.user._id,
      notes: `Self checked in as ${status}`
    };

    if (status === 'Present' || status === 'Half Day') {
      update.checkIn = new Date();
    }

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Attendance marked successfully', withAttendanceMetrics(attendance));
  } catch (error) {
    next(error);
  }
};

// @desc    Mark checkout for self (Employee)
// @route   POST /api/attendance/checkout
// @access  Private
export const selfCheckOut = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    
    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const filter = { user: req.user._id, date: attendanceDate };
    
    const existing = await Attendance.findOne(filter);
    if (!existing) {
      return errorResponse(res, 400, 'You must mark your attendance before checking out.');
    }
    if (existing.checkOut) {
      return errorResponse(res, 400, 'You have already checked out today.');
    }
    if (!existing.checkIn) {
      return errorResponse(res, 400, 'A check-in time is required before checking out.');
    }

    const checkedOutAt = new Date();
    const calculatedStatus = statusFromAttendanceTimes(existing.checkIn, checkedOutAt);

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      { checkOut: checkedOutAt, status: calculatedStatus },
      { new: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Checked out successfully', withAttendanceMetrics(attendance));
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance for a specific date (Admin only)
// @route   GET /api/attendance/daily
// @access  Private/Admin
export const getDailyAttendance = async (req, res, next) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return errorResponse(res, 400, 'Date is required');
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const visibility = await resolveUserDataScope(req.user, 'attendance', req.access);
    const visibilityFilter = visibility.scope === 'all'
      ? {}
      : visibility.scope === 'none'
        ? { _id: { $exists: false } }
        : { _id: { $in: visibility.userIds } };
    const users = await User.find({
      ...visibilityFilter,
      isActive: true,
      role: { $not: /^admin$/i },
    })
      .select('name email role')
      .lean();
    
    // Get attendance records for this date
    const attendanceRecords = await Attendance.find({ date: targetDate }).lean();
    const attendanceByUser = new Map(
      attendanceRecords.map((record) => [String(record.user), record]),
    );

    // Combine them
    const combinedData = users.map(user => {
      const record = withAttendanceMetrics(attendanceByUser.get(String(user._id)));
      return {
        user,
        attendance: record || null
      };
    });

    return successResponse(res, 200, 'Daily attendance fetched', combinedData);
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged in user's attendance history
// @route   GET /api/attendance/my
// @access  Private
export const getMyAttendance = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    
    let query = { user: req.user._id };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 }).lean();

    return successResponse(res, 200, 'My attendance fetched', withAttendanceMetricsMany(attendance));
  } catch (error) {
    next(error);
  }
};

// @desc    Request attendance change (Employee)
// @route   POST /api/attendance/request-change
// @access  Private
export const requestAttendanceChange = async (req, res, next) => {
  try {
    const { comment } = req.body;
    
    if (!comment) {
      return errorResponse(res, 400, 'Comment is required');
    }

    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({ user: req.user._id, date: attendanceDate });
    if (!attendance) {
      return errorResponse(res, 404, 'No attendance record found for today');
    }

    // Append to notes
    attendance.notes = (attendance.notes ? attendance.notes + ' | ' : '') + `Change Requested: ${comment}`;
    await attendance.save();

    // Create notifications for all admins
    const adminIds = await User.find({ role: 'admin' }).distinct('_id');
    if (adminIds.length) {
      await Notification.bulkWrite(adminIds.map((userId) => ({
        insertOne: {
          document: {
            user: userId,
            title: 'Attendance Change Request',
            message: `${req.user.name} has requested an attendance change: ${comment}`,
            type: 'warning',
          },
        },
      })), { ordered: false });
    }

    return successResponse(res, 200, 'Change request submitted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get a specific user's attendance history (Admin only)
// @route   GET /api/attendance/history/:userId
// @access  Private/Admin
export const getUserAttendanceHistory = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const { userId } = req.params;
    if (!await ensureVisibleAttendanceTarget(req, res, userId)) return;
    
    let query = { user: userId };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 }).lean();

    return successResponse(res, 200, 'User attendance fetched', withAttendanceMetricsMany(attendance));
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance report by date range and optional user
// @route   GET /api/attendance/report
// @access  Private/Admin
export const getAttendanceReport = async (req, res, next) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const visibility = await resolveUserDataScope(req.user, 'attendance', req.access);
    let query = visibility.scope === 'all'
      ? {}
      : visibility.scope === 'none'
        ? { _id: { $exists: false } }
        : { user: { $in: visibility.userIds } };

    if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) 
      };
    }

    if (userId && visibility.scope !== 'none') {
      if (
        visibility.scope !== 'all'
        && !visibility.userIds.map(String).includes(String(userId))
      ) {
        return errorResponse(res, 403, 'This employee is outside your attendance access');
      }
      query.user = userId;
    }

    const attendance = await Attendance.find(query)
      .populate('user', 'name email role')
      .sort({ date: -1 })
      .lean();

    return successResponse(res, 200, 'Attendance report fetched successfully', withAttendanceMetricsMany(attendance));
  } catch (error) {
    next(error);
  }
};
