import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolveEffectiveAccess } from '../services/accessControlService.js';

// Generate JWT
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development';
  const sameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
  const secure = process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === 'true' : isProduction;

  res.cookie('jwt', token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
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
      const access = await resolveEffectiveAccess(user);

      const token = generateToken(res, user._id);
      return successResponse(res, 200, 'Login successful', {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: access.permissions,
        grants: access.grants,
        scopes: access.scopes,
        teamIds: access.teamIds,
        roleId: access.roleId,
        accessVersion: access.accessVersion,
        token,
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
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development';
  const sameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
  const secure = process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === 'true' : isProduction;

  res.cookie('jwt', '', {
    httpOnly: true,
    secure,
    sameSite,
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
    const user = req.user;
    if (user) {
      const access = await resolveEffectiveAccess(user);

      return successResponse(res, 200, 'User profile fetched', {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: access.permissions,
        grants: access.grants,
        scopes: access.scopes,
        teamIds: access.teamIds,
        roleId: access.roleId,
        accessVersion: access.accessVersion,
      });
    } else {
      return errorResponse(res, 404, 'User not found');
    }
  } catch (error) {
    next(error);
  }
};
