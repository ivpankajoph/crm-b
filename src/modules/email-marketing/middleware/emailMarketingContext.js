import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { ensureEmailMarketingContext } from '../services/workspaceService.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { PERMISSIONS } from '../../../constants/permissions.js';
import {
  resolveEffectiveAccess,
  userHasPermission,
} from '../../../services/accessControlService.js';

export const resolveEmailMarketingContext = async (req, res, next) => {
  try {
    if (!getEmailMarketingConfig().enabled) {
      return res.status(503).json({
        success: false,
        message: 'Email Marketing module is disabled',
        errors: [],
      });
    }

    req.emailMarketing = await ensureEmailMarketingContext(req.user);
    const access = await resolveEffectiveAccess(req.user);
    const mappedPermissions = new Set();
    const allow = (crmPermission, ...modulePermissions) => {
      if (userHasPermission(access, crmPermission)) {
        modulePermissions.forEach((permission) => mappedPermissions.add(permission));
      }
    };

    allow(
      PERMISSIONS.EMAIL_MODULE_VIEW,
      EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
      EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS,
      EMAIL_MARKETING_PERMISSIONS.VIEW_REPORTS,
    );
    allow(PERMISSIONS.EMAIL_TEMPLATES_USE, EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES);
    allow(PERMISSIONS.EMAIL_TEMPLATES_CREATE, EMAIL_MARKETING_PERMISSIONS.CREATE_CONTENT);
    allow(PERMISSIONS.EMAIL_TEMPLATES_EDIT, EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT);
    allow(PERMISSIONS.EMAIL_TEMPLATES_SHARE, EMAIL_MARKETING_PERMISSIONS.SHARE_CONTENT);
    allow(
      PERMISSIONS.EMAIL_CAMPAIGNS_MANAGE,
      EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS,
      EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
    );
    if (access.isAdmin) {
      Object.values(EMAIL_MARKETING_PERMISSIONS)
        .forEach((permission) => mappedPermissions.add(permission));
    }
    req.emailMarketing.permissions = [...mappedPermissions];
    return next();
  } catch (error) {
    return next(error);
  }
};
