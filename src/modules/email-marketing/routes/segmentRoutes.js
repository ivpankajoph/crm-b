import { Router } from 'express';

import {
  createSegment,
  deleteSegment,
  getSegment,
  getSegmentMeta,
  listSegments,
  previewSegment,
  updateSegment,
} from '../controllers/segmentController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createSegmentSchema,
  previewSegmentSchema,
  subscriberIdSchema,
  updateSegmentSchema,
} from '../validators/audienceValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(
    EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
  ),
);

router.get('/meta', getSegmentMeta);
router.post('/preview', validateEmailMarketingRequest(previewSegmentSchema), previewSegment);
router.get('/', listSegments);
router.post('/', validateEmailMarketingRequest(createSegmentSchema), createSegment);
router.get('/:id', validateEmailMarketingRequest(subscriberIdSchema), getSegment);
router.patch('/:id', validateEmailMarketingRequest(updateSegmentSchema), updateSegment);
router.put('/:id', validateEmailMarketingRequest(updateSegmentSchema), updateSegment);
router.delete('/:id', validateEmailMarketingRequest(subscriberIdSchema), deleteSegment);

export default router;
