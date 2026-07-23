import { Router } from 'express';

import { getIntegrationSnapshot } from '../controllers/integrationController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';

const router = Router();
router.get(
  '/snapshot',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD),
  getIntegrationSnapshot,
);

export default router;
