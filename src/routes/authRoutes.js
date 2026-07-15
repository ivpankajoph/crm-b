import express from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate, loginSchema } from '../validators/authValidator.js';

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
