import { Router } from 'express';

import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  getTemplateMeta,
  listTemplates,
  updateTemplate,
} from '../controllers/templateController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createTemplateSchema,
  listTemplatesSchema,
  templateIdSchema,
  updateTemplateSchema,
} from '../validators/contentValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT),
);

router.get('/meta', getTemplateMeta);
router.get('/', validateEmailMarketingRequest(listTemplatesSchema), listTemplates);
router.post('/', validateEmailMarketingRequest(createTemplateSchema), createTemplate);
router.post('/:id/duplicate', validateEmailMarketingRequest(templateIdSchema), duplicateTemplate);
router.get('/:id', validateEmailMarketingRequest(templateIdSchema), getTemplate);
router.patch('/:id', validateEmailMarketingRequest(updateTemplateSchema), updateTemplate);
router.put('/:id', validateEmailMarketingRequest(updateTemplateSchema), updateTemplate);
router.delete('/:id', validateEmailMarketingRequest(templateIdSchema), deleteTemplate);

export default router;
