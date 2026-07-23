import { errorResponse } from '../../../utils/response.js';

export const requireEmailMarketingPermission =
  (...requiredPermissions) =>
  (req, res, next) => {
    if (!req.user || !req.emailMarketing) {
      return errorResponse(res, 401, 'Email Marketing authentication required');
    }

    const granted = new Set(req.emailMarketing.permissions || []);
    const allowed = requiredPermissions.every((permission) =>
      granted.has(permission),
    );

    if (!allowed) {
      return errorResponse(
        res,
        403,
        'Insufficient Email Marketing permission',
        requiredPermissions.map((permission) => ({
          field: 'permission',
          message: `Missing permission: ${permission}`,
        })),
      );
    }

    return next();
  };
