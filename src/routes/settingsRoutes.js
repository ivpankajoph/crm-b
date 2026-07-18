import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getSettings);
router.put('/', adminOnly, updateSettings); // Only admins can update settings

export default router;
