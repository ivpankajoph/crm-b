import { Router } from 'express';

import {
  activateAutomation,
  createAutomation,
  deactivateAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  getAutomationMeta,
  listAutomations,
  testAutomation,
  triggerAutomations,
  updateAutomation,
} from '../controllers/automationController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  automationIdSchema,
  createAutomationSchema,
  listAutomationsSchema,
  testAutomationSchema,
  triggerAutomationSchema,
  updateAutomationSchema,
} from '../validators/advancedValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(
    EMAIL_MARKETING_PERMISSIONS.MANAGE_AUTOMATIONS,
  ),
);

router.get('/meta', getAutomationMeta);
router.post(
  '/trigger',
  validateEmailMarketingRequest(triggerAutomationSchema),
  triggerAutomations,
);
router.get(
  '/',
  validateEmailMarketingRequest(listAutomationsSchema),
  listAutomations,
);
router.post(
  '/',
  validateEmailMarketingRequest(createAutomationSchema),
  createAutomation,
);
router.post(
  '/:id/duplicate',
  validateEmailMarketingRequest(automationIdSchema),
  duplicateAutomation,
);
router.post(
  '/:id/activate',
  validateEmailMarketingRequest(automationIdSchema),
  activateAutomation,
);
router.post(
  '/:id/deactivate',
  validateEmailMarketingRequest(automationIdSchema),
  deactivateAutomation,
);
router.post(
  '/:id/test',
  validateEmailMarketingRequest(testAutomationSchema),
  testAutomation,
);
router.get(
  '/:id',
  validateEmailMarketingRequest(automationIdSchema),
  getAutomation,
);
router.patch(
  '/:id',
  validateEmailMarketingRequest(updateAutomationSchema),
  updateAutomation,
);
router.put(
  '/:id',
  validateEmailMarketingRequest(updateAutomationSchema),
  updateAutomation,
);
router.delete(
  '/:id',
  validateEmailMarketingRequest(automationIdSchema),
  deleteAutomation,
);

export default router;
