import express from 'express';

import {
  getTeams,
  createTeam,
  updateTeam,
  deactivateTeam,
} from '../controllers/teamController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.route('/')
  .get(
    protect,
    requirePermission(
      PERMISSIONS.ADMIN_TEAMS_VIEW,
      PERMISSIONS.ADMIN_TEAMS_MANAGE,
      PERMISSIONS.ADMIN_USERS_MANAGE,
      PERMISSIONS.ADMIN_TEMPLATE_ACCESS_VIEW,
      PERMISSIONS.ADMIN_TEMPLATE_ACCESS_MANAGE,
      PERMISSIONS.EMAIL_TEMPLATES_SHARE,
      PERMISSIONS.WHATSAPP_TEMPLATES_SHARE,
    ),
    getTeams,
  )
  .post(
    protect,
    requirePermission(PERMISSIONS.ADMIN_TEAMS_MANAGE),
    createTeam,
  );

router.route('/:id')
  .put(
    protect,
    requirePermission(PERMISSIONS.ADMIN_TEAMS_MANAGE),
    updateTeam,
  )
  .delete(
    protect,
    requirePermission(PERMISSIONS.ADMIN_TEAMS_MANAGE),
    deactivateTeam,
  );

export default router;
