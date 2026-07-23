import { Router } from 'express';

import {
  getAnalyticsOverview,
  getAnalyticsTimeseries,
  getAutomationAnalytics,
  getDeliverability,
} from '../controllers/analyticsController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import { analyticsQuerySchema } from '../validators/advancedValidators.js';

const router = Router();
const validateQuery = validateEmailMarketingRequest(analyticsQuerySchema);

router.get(
  '/overview',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS),
  validateQuery,
  getAnalyticsOverview,
);
router.get(
  '/timeseries',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS),
  validateQuery,
  getAnalyticsTimeseries,
);
router.get(
  '/automations',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS),
  validateQuery,
  getAutomationAnalytics,
);
router.get(
  '/deliverability',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS),
  validateQuery,
  getDeliverability,
);

export default router;
