import { Router } from 'express';

import {
  deleteMediaAsset,
  listMediaAssets,
  uploadImageDataUrl,
  uploadImageFile,
} from '../controllers/uploadController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { uploadEmailMarketingImage } from '../middleware/emailMarketingUpload.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import { dataUrlUploadSchema } from '../validators/contentValidators.js';
import { templateIdSchema } from '../validators/contentValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT),
);

router.get('/', listMediaAssets);
router.post('/image', validateEmailMarketingRequest(dataUrlUploadSchema), uploadImageDataUrl);
router.post('/image/file', uploadEmailMarketingImage.single('file'), uploadImageFile);
router.delete(
  '/:id',
  validateEmailMarketingRequest(templateIdSchema),
  deleteMediaAsset,
);

export default router;
