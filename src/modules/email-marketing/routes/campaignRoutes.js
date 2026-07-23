import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import {
  archiveCampaign,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaign,
  getCampaignMeta,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  scheduleCampaign,
  sendCampaignTestEmail,
  sendCampaignNow,
  updateCampaign,
} from '../controllers/campaignController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  campaignIdSchema,
  createCampaignSchema,
  listCampaignsSchema,
  scheduleCampaignSchema,
  testCampaignEmailSchema,
  updateCampaignSchema,
} from '../validators/campaignValidators.js';

const router = Router();
const campaignTestSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many campaign test emails. Please try again later.',
    errors: [],
  },
});

router.use(
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS),
);

router.get('/meta', getCampaignMeta);
router.get('/', validateEmailMarketingRequest(listCampaignsSchema), listCampaigns);
router.post('/', validateEmailMarketingRequest(createCampaignSchema), createCampaign);
router.post(
  '/test-send',
  campaignTestSendLimiter,
  validateEmailMarketingRequest(testCampaignEmailSchema),
  sendCampaignTestEmail,
);
router.post(
  '/:id/duplicate',
  validateEmailMarketingRequest(campaignIdSchema),
  duplicateCampaign,
);
router.post(
  '/:id/schedule',
  validateEmailMarketingRequest(scheduleCampaignSchema),
  scheduleCampaign,
);
router.post('/:id/send', validateEmailMarketingRequest(campaignIdSchema), sendCampaignNow);
router.post('/:id/pause', validateEmailMarketingRequest(campaignIdSchema), pauseCampaign);
router.post('/:id/resume', validateEmailMarketingRequest(campaignIdSchema), resumeCampaign);
router.post('/:id/archive', validateEmailMarketingRequest(campaignIdSchema), archiveCampaign);
router.get('/:id', validateEmailMarketingRequest(campaignIdSchema), getCampaign);
router.patch('/:id', validateEmailMarketingRequest(updateCampaignSchema), updateCampaign);
router.put('/:id', validateEmailMarketingRequest(updateCampaignSchema), updateCampaign);
router.delete('/:id', validateEmailMarketingRequest(campaignIdSchema), deleteCampaign);

export default router;
