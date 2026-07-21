import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { connectWhatsApp, disconnectWhatsApp, getWhatsAppConnection, syncWhatsApp } from '../controllers/whatsappController.js';

const router = express.Router();
router.use(protect);
router.get('/connection', getWhatsAppConnection);
router.post('/connection', connectWhatsApp);
router.post('/sync', syncWhatsApp);
router.delete('/connection', disconnectWhatsApp);
export default router;
