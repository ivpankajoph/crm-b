import express from 'express';
import { getRoles, createRole, deleteRole, updateRolePermissions } from '../controllers/roleController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getRoles)
  .post(protect, createRole);

router.route('/:id')
  .delete(protect, deleteRole);

router.route('/:id/permissions')
  .put(protect, updateRolePermissions);

export default router;
