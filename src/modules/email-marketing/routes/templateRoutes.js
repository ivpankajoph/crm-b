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
import {
  requireAnyEmailMarketingPermission,
  requireEmailMarketingPermission,
} from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createTemplateSchema,
  listTemplatesSchema,
  templateIdSchema,
  updateTemplateSchema,
} from '../validators/contentValidators.js';

const router = Router();

const canReadTemplates = requireAnyEmailMarketingPermission(
  EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES,
  EMAIL_MARKETING_PERMISSIONS.CREATE_CONTENT,
  EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT,
);
const canCreateTemplates = requireAnyEmailMarketingPermission(
  EMAIL_MARKETING_PERMISSIONS.CREATE_CONTENT,
  EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT,
);

router.get('/meta', canReadTemplates, getTemplateMeta);
router.get('/', canReadTemplates, validateEmailMarketingRequest(listTemplatesSchema), listTemplates);
router.post('/', canCreateTemplates, validateEmailMarketingRequest(createTemplateSchema), createTemplate);
router.post('/:id/duplicate', canCreateTemplates, validateEmailMarketingRequest(templateIdSchema), duplicateTemplate);
router.get('/:id', canReadTemplates, validateEmailMarketingRequest(templateIdSchema), getTemplate);
router.patch('/:id', requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT), validateEmailMarketingRequest(updateTemplateSchema), updateTemplate);
router.put('/:id', requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT), validateEmailMarketingRequest(updateTemplateSchema), updateTemplate);
router.delete('/:id', requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT), validateEmailMarketingRequest(templateIdSchema), deleteTemplate);

export default router;
