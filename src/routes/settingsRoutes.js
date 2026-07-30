import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.use(protect);

// Authenticated users need display settings (for example the CRM name/theme).
// The Settings administration page and every mutation remain permission-gated.
router.get('/', getSettings);
router.put('/', requirePermission(PERMISSIONS.ADMIN_SETTINGS_MANAGE), updateSettings);

export default router;
