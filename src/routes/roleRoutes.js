import express from 'express';
import {
  getRoles,
  createRole,
  deleteRole,
  updateRole,
  updateRoleAccess,
  updateRolePermissions,
  getPermissionCatalog,
} from '../controllers/roleController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get(
  '/catalog',
  protect,
  requirePermission(
    PERMISSIONS.ADMIN_ROLES_VIEW,
    PERMISSIONS.ADMIN_ROLES_MANAGE,
    PERMISSIONS.ADMIN_USERS_MANAGE,
  ),
  getPermissionCatalog,
);

router.route('/')
  .get(
    protect,
    requirePermission(
      PERMISSIONS.ADMIN_ROLES_VIEW,
      PERMISSIONS.ADMIN_ROLES_MANAGE,
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_TEAMS_MANAGE,
      PERMISSIONS.ADMIN_TEAMS_VIEW,
      PERMISSIONS.ADMIN_TEMPLATE_ACCESS_VIEW,
      PERMISSIONS.ADMIN_TEMPLATE_ACCESS_MANAGE,
      PERMISSIONS.EMAIL_TEMPLATES_SHARE,
      PERMISSIONS.WHATSAPP_TEMPLATES_SHARE,
      PERMISSIONS.EMPLOYEES_MANAGE,
    ),
    getRoles,
  )
  .post(protect, requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), createRole);

router.route('/:id')
  .put(protect, requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), updateRole)
  .delete(protect, requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), deleteRole);

router.route('/:id/permissions')
  .put(protect, requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), updateRolePermissions);

router.route('/:id/access')
  .put(protect, requirePermission(PERMISSIONS.ADMIN_ROLES_MANAGE), updateRoleAccess);

export default router;
