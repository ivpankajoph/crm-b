import { Router } from 'express';

import {
  bulkUpdateSubscribers,
  createSubscriber,
  deleteSubscriber,
  getSubscriberMeta,
  getSubscriberSummary,
  getSubscriber,
  importSubscribersCsv,
  importSubscribersJson,
  listSubscribers,
  listSubscriberImports,
  updateSubscriber,
} from '../controllers/subscriberController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { uploadEmailMarketingCsv } from '../middleware/emailMarketingUpload.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  bulkSubscriberSchema,
  createSubscriberSchema,
  importSubscribersSchema,
  listSubscribersSchema,
  subscriberIdSchema,
  updateSubscriberSchema,
} from '../validators/audienceValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(
    EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
  ),
);

router.get('/meta', getSubscriberMeta);
router.get('/summary', getSubscriberSummary);
router.get('/imports', listSubscriberImports);
router.get('/', validateEmailMarketingRequest(listSubscribersSchema), listSubscribers);
router.post('/import', validateEmailMarketingRequest(importSubscribersSchema), importSubscribersJson);
router.post('/import/csv', uploadEmailMarketingCsv.single('file'), importSubscribersCsv);
router.patch('/bulk', validateEmailMarketingRequest(bulkSubscriberSchema), bulkUpdateSubscribers);
router.post('/', validateEmailMarketingRequest(createSubscriberSchema), createSubscriber);
router.get('/:id', validateEmailMarketingRequest(subscriberIdSchema), getSubscriber);
router.patch('/:id', validateEmailMarketingRequest(updateSubscriberSchema), updateSubscriber);
router.put('/:id', validateEmailMarketingRequest(updateSubscriberSchema), updateSubscriber);
router.delete('/:id', validateEmailMarketingRequest(subscriberIdSchema), deleteSubscriber);

export default router;
