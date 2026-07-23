import { Router } from 'express';

import {
  getBilling,
  getCreditBalance,
  purchaseCredits,
  updateBillingProfile,
} from '../controllers/billingController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  billingProfileSchema,
  purchaseCreditsSchema,
} from '../validators/advancedValidators.js';

const router = Router();

router.get(
  '/',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_BILLING),
  getBilling,
);
router.get(
  '/credits',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.VIEW_BILLING),
  getCreditBalance,
);
router.patch(
  '/profile',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.MANAGE_SETTINGS),
  validateEmailMarketingRequest(billingProfileSchema),
  updateBillingProfile,
);
router.post(
  '/credits/purchase',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.MANAGE_SETTINGS),
  validateEmailMarketingRequest(purchaseCreditsSchema),
  purchaseCredits,
);

export default router;
