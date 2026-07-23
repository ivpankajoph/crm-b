import { Router } from 'express';

import {
  createDomain,
  deleteDomain,
  getDomain,
  getDomainHealth,
  listDomains,
  listVerifiedSenders,
  requestDedicatedIp,
  updateSenderDefaults,
  verifyDomain,
} from '../controllers/domainController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createDomainSchema,
  dedicatedIpSchema,
  domainIdSchema,
  senderDefaultsSchema,
} from '../validators/campaignValidators.js';

const router = Router();
const requireDomainPermission = requireEmailMarketingPermission(
  EMAIL_MARKETING_PERMISSIONS.MANAGE_SENDING_DOMAINS,
);

router.get(
  '/verified-senders',
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS),
  listVerifiedSenders,
);
router.patch(
  '/sender-defaults',
  requireDomainPermission,
  validateEmailMarketingRequest(senderDefaultsSchema),
  updateSenderDefaults,
);
router.get('/', requireDomainPermission, listDomains);
router.post(
  '/',
  requireDomainPermission,
  validateEmailMarketingRequest(createDomainSchema),
  createDomain,
);
router.post(
  '/:id/verify',
  requireDomainPermission,
  validateEmailMarketingRequest(domainIdSchema),
  verifyDomain,
);
router.get(
  '/:id/health',
  requireDomainPermission,
  validateEmailMarketingRequest(domainIdSchema),
  getDomainHealth,
);
router.post(
  '/:id/dedicated-ip',
  requireDomainPermission,
  validateEmailMarketingRequest(dedicatedIpSchema),
  requestDedicatedIp,
);
router.get(
  '/:id',
  requireDomainPermission,
  validateEmailMarketingRequest(domainIdSchema),
  getDomain,
);
router.delete(
  '/:id',
  requireDomainPermission,
  validateEmailMarketingRequest(domainIdSchema),
  deleteDomain,
);

export default router;
