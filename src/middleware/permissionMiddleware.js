import { errorResponse } from '../utils/response.js';
import {
  resolveEffectiveAccess,
  userHasPermission,
} from '../services/accessControlService.js';

export const attachAccessContext = async (req, res, next) => {
  try {
    req.access = await resolveEffectiveAccess(req.user);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requirePermission = (...requiredPermissions) => async (req, res, next) => {
  try {
    const access = req.access || await resolveEffectiveAccess(req.user);
    req.access = access;

    const allowed = requiredPermissions.some((permission) => (
      userHasPermission(access, permission)
    ));

    if (!allowed) {
      return errorResponse(res, 403, 'You do not have permission to perform this action');
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
