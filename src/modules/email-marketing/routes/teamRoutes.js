import { Router } from 'express';

import {
  createTeamUser,
  deactivateTeamUser,
  listTeamUsers,
  updateTeamUser,
} from '../controllers/teamController.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import { requireEmailMarketingPermission } from '../middleware/requirePermission.js';
import { validateEmailMarketingRequest } from '../middleware/validateRequest.js';
import {
  createTeamUserSchema,
  teamUserIdSchema,
  updateTeamUserSchema,
} from '../validators/advancedValidators.js';

const router = Router();
router.use(
  requireEmailMarketingPermission(
    EMAIL_MARKETING_PERMISSIONS.MANAGE_TEAM_ACCESS,
  ),
);

router.get('/', listTeamUsers);
router.post(
  '/',
  validateEmailMarketingRequest(createTeamUserSchema),
  createTeamUser,
);
router.patch(
  '/:id',
  validateEmailMarketingRequest(updateTeamUserSchema),
  updateTeamUser,
);
router.delete(
  '/:id',
  validateEmailMarketingRequest(teamUserIdSchema),
  deactivateTeamUser,
);

export default router;
