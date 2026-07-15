import express from 'express';
import { getUsers, createUser, deleteUser, updateUser } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getUsers)
  .post(protect, createUser);

router.route('/:id')
  .put(protect, updateUser)
  .delete(protect, deleteUser);

export default router;
