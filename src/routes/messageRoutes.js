import express from 'express';
import { getUsersForMessaging, getMessages, sendMessage } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/users', getUsersForMessaging);
router.get('/:userId', getMessages);
router.post('/', sendMessage);

export default router;
