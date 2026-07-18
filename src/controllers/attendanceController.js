import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Mark attendance for a user (Admin only)
// @route   POST /api/attendance
// @access  Private/Admin
export const markAttendance = async (req, res, next) => {
  try {
    const { userId, date, status, checkIn, checkOut, notes } = req.body;

    if (!userId || !date || !status) {
      return errorResponse(res, 400, 'User ID, date, and status are required');
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    const filter = { user: userId, date: attendanceDate };
    const update = {
      status,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      notes,
      markedBy: req.user._id
    };

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Attendance marked successfully', attendance);
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

    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const filter = { user: req.user._id, date: attendanceDate };
    
    // Check if attendance already marked today
    const existing = await Attendance.findOne(filter);
    
    const update = {
      status,
      markedBy: req.user._id,
      notes: (existing && existing.notes) ? existing.notes + ` | Self checked in as ${status}` : `Self checked in as ${status}`
    };

    if (status === 'Present' || status === 'Half Day') {
      if (!existing || !existing.checkIn) {
        update.checkIn = new Date();
      }
    }

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Attendance marked successfully', attendance);
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

    const attendance = await Attendance.findOneAndUpdate(
      filter,
      { checkOut: new Date() },
      { new: true }
    ).populate('user', 'name email');

    return successResponse(res, 200, 'Checked out successfully', attendance);
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

    // Get all users (except admins maybe? Let's get all active users)
    const users = await User.find({ isActive: true, role: { $ne: 'admin' } }).select('name email role');
    
    // Get attendance records for this date
    const attendanceRecords = await Attendance.find({ date: targetDate });

    // Combine them
    const combinedData = users.map(user => {
      const record = attendanceRecords.find(a => a.user.toString() === user._id.toString());
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

    const attendance = await Attendance.find(query).sort({ date: -1 });

    return successResponse(res, 200, 'My attendance fetched', attendance);
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
    const admins = await User.find({ role: 'admin' });
    const notificationPromises = admins.map(admin => 
      Notification.create({
        user: admin._id,
        title: 'Attendance Change Request',
        message: `${req.user.name} has requested an attendance change: ${comment}`,
        type: 'warning'
      })
    );
    await Promise.all(notificationPromises);

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
    
    let query = { user: userId };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 });

    return successResponse(res, 200, 'User attendance fetched', attendance);
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
    
    let query = {};

    if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) 
      };
    }

    if (userId) {
      query.user = userId;
    }

    const attendance = await Attendance.find(query)
      .populate('user', 'name email role')
      .sort({ date: -1 });

    return successResponse(res, 200, 'Attendance report fetched successfully', attendance);
  } catch (error) {
    next(error);
  }
};
