import express from 'express';

import {
  getTemplateAccessInventory,
  updateTemplateAccess,
  getAvailableTemplates,
} from '../controllers/templateAccessController.js';
import { protect } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';
import {
  resolveEffectiveAccess,
  userHasPermission,
} from '../services/accessControlService.js';
import { errorResponse } from '../utils/response.js';

const router = express.Router();

const attachTemplateAccessPermissions = async (req, res, next) => {
  try {
    const access = await resolveEffectiveAccess(req.user);
    req.access = access;
    const canViewAll = userHasPermission(access, PERMISSIONS.ADMIN_TEMPLATE_ACCESS_VIEW)
      || userHasPermission(access, PERMISSIONS.ADMIN_TEMPLATE_ACCESS_MANAGE);
    const allowedTypes = [];
    if (canViewAll || userHasPermission(access, PERMISSIONS.EMAIL_TEMPLATES_SHARE)) {
      allowedTypes.push('email_template');
    }
    if (canViewAll || userHasPermission(access, PERMISSIONS.WHATSAPP_TEMPLATES_SHARE)) {
      allowedTypes.push('whatsapp_template');
    }
    if (!allowedTypes.length) {
      return errorResponse(res, 403, 'You do not have permission to view template access');
    }
    req.allowedTemplateTypes = allowedTypes;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireTemplateShare = (req, res, next) => {
  const allowed = userHasPermission(req.access, PERMISSIONS.ADMIN_TEMPLATE_ACCESS_MANAGE)
    || (
      req.params.resourceType === 'email_template'
      && userHasPermission(req.access, PERMISSIONS.EMAIL_TEMPLATES_SHARE)
    )
    || (
      req.params.resourceType === 'whatsapp_template'
      && userHasPermission(req.access, PERMISSIONS.WHATSAPP_TEMPLATES_SHARE)
    );
  return allowed
    ? next()
    : errorResponse(res, 403, 'You do not have permission to share this template');
};

router.get('/available', protect, getAvailableTemplates);
router.get(
  '/',
  protect,
  attachTemplateAccessPermissions,
  getTemplateAccessInventory,
);
router.put(
  '/:resourceType/:resourceId',
  protect,
  attachTemplateAccessPermissions,
  requireTemplateShare,
  updateTemplateAccess,
);

export default router;
