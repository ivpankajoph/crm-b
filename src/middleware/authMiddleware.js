import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { errorResponse } from '../utils/response.js';
import { isAdminUser } from '../utils/hierarchy.js';
import { cacheKeys, getCachedJson, setCachedJson } from '../services/cacheService.js';

export const protect = async (req, res, next) => {
  let token;

  token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const key = cacheKeys.authUser(decoded.userId);
      req.user = await getCachedJson(key);
      if (!req.user) {
        req.user = await User.findById(decoded.userId).select('-password').lean();
        if (req.user) await setCachedJson(key, req.user, 60);
      }
      if (!req.user || req.user.isActive === false || req.user.status === 'inactive') {
        return errorResponse(res, 401, 'User account is inactive');
      }
      next();
    } catch (error) {
      console.error(error);
      return errorResponse(res, 401, 'Not authorized, token failed');
    }
  } else {
    return errorResponse(res, 401, 'Not authorized, no token');
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && isAdminUser(req.user)) {
    next();
  } else {
    return errorResponse(res, 403, 'Not authorized as admin');
  }
};
