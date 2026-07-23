import { Router } from 'express';

import {
  getBootstrap,
  getModuleConfig,
  getModuleStatus,
  getPermissions,
  getWorkspace,
  updateWorkspace,
} from '../controllers/foundationController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import { updateWorkspaceSchema } from '../validators/foundationValidators.js';

const router = Router();

router.get('/', getModuleStatus);
router.get('/bootstrap', getBootstrap);
router.get('/config', getModuleConfig);
router.get('/permissions', getPermissions);

router
  .route('/workspace')
  .get(
    requireEmailMarketingPermission(
      EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
    ),
    getWorkspace,
  )
  .patch(
    requireEmailMarketingPermission(
      EMAIL_MARKETING_PERMISSIONS.MANAGE_SETTINGS,
    ),
    validateEmailMarketingRequest(updateWorkspaceSchema),
    updateWorkspace,
  );

export default router;
