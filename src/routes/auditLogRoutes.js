import express from 'express';
import { getAuditLogs } from '../controllers/auditLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.get('/', protect, requirePermission(PERMISSIONS.ADMIN_AUDIT_VIEW), getAuditLogs);

export default router;
