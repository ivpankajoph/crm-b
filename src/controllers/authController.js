import Role from '../models/Role.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../utils/response.js';

// Generate JWT
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * @desc    Auth user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      let permissions = [];
      if (user.role === 'admin') {
        // Admin has all permissions conceptually, but frontend will handle 'admin' check.
        // We can just pass the role.
      } else {
        const roleDoc = await Role.findOne({ name: user.role });
        if (roleDoc) {
          permissions = roleDoc.permissions || [];
        }
      }

      generateToken(res, user._id);
      return successResponse(res, 200, 'Login successful', {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      });
    } else {
      return errorResponse(res, 401, 'Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  return successResponse(res, 200, 'Logged out successfully');
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      let permissions = [];
      if (user.role !== 'admin') {
        const roleDoc = await Role.findOne({ name: user.role });
        if (roleDoc) {
          permissions = roleDoc.permissions || [];
        }
      }

      return successResponse(res, 200, 'User profile fetched', {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      });
    } else {
      return errorResponse(res, 404, 'User not found');
    }
  } catch (error) {
    next(error);
  }
};
