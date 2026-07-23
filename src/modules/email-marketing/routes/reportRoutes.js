import { Router } from 'express';

import { exportReport } from '../controllers/reportController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import { reportQuerySchema } from '../validators/advancedValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_REPORTS),
);
router.get(
  '/',
  validateEmailMarketingRequest(reportQuerySchema),
  exportReport,
);
router.get(
  '/export',
  validateEmailMarketingRequest(reportQuerySchema),
  exportReport,
);

export default router;
