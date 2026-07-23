import { Router } from 'express';

import {
  createSuppression,
  listSuppressions,
  releaseSuppression,
} from '../controllers/suppressionController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createSuppressionSchema,
  listSuppressionsSchema,
  suppressionIdSchema,
} from '../validators/audienceValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(
    EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
  ),
);

router.get('/', validateEmailMarketingRequest(listSuppressionsSchema), listSuppressions);
router.post('/', validateEmailMarketingRequest(createSuppressionSchema), createSuppression);
router.delete('/:id', validateEmailMarketingRequest(suppressionIdSchema), releaseSuppression);

export default router;
