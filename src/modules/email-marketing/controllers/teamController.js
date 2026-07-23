import { errorResponse, successResponse } from '../../../utils/response.js';
import User from '../../../models/User.js';
import {
  EMAIL_MARKETING_PERMISSIONS,
  EMAIL_MARKETING_PERMISSION_VALUES,
  sanitizeEmailMarketingPermissions,
} from '../constants/permissions.js';
import EmailMarketingMembership from '../models/EmailMarketingMembership.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { resolveWorkspaceOwner } from '../services/workspaceService.js';

const inferRole = (permissions) => {
  if (permissions.length === EMAIL_MARKETING_PERMISSION_VALUES.length) {
    return 'admin';
  }
  if (
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUTOMATIONS) ||
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.MANAGE_SENDING_DOMAINS)
  ) {
    return 'manager';
  }
  if (
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS) ||
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT) ||
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE)
  ) {
    return 'editor';
  }
  if (
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS) ||
    permissions.includes(EMAIL_MARKETING_PERMISSIONS.VIEW_REPORTS)
  ) {
    return 'analyst';
  }
  return 'viewer';
};

const serializeMembership = (membership) => ({
  id: String(membership._id),
  userId: String(membership.userId?._id || membership.userId),
  name: membership.userId?.name || '',
  email: membership.userId?.email || '',
  status: membership.status,
  role: membership.role,
  permissions: membership.permissions,
  invitedAt: membership.createdAt,
  lastLoginAt: membership.lastAccessedAt,
});

export const listTeamUsers = async (req, res, next) => {
  try {
    const memberships = await EmailMarketingMembership.find({
      workspaceId: req.emailMarketing.workspaceId,
      role: { $ne: 'owner' },
    })
      .populate('userId', 'name email role status isActive')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Team access fetched successfully', {
      items: memberships
        .filter((membership) => membership.userId)
        .map(serializeMembership),
      permissionCatalog: EMAIL_MARKETING_PERMISSION_VALUES,
    });
  } catch (error) {
    return next(error);
  }
};

export const createTeamUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.validated.body.email });
    if (!user) {
      return errorResponse(
        res,
        404,
        'This email must belong to an existing CRM user before access can be granted',
      );
    }
    if (String(user._id) === String(req.emailMarketing.owner._id)) {
      return errorResponse(res, 409, 'Workspace owner access cannot be changed');
    }
    const owner = await resolveWorkspaceOwner(user);
    if (String(owner._id) !== String(req.emailMarketing.owner._id)) {
      return errorResponse(
        res,
        400,
        'This CRM user belongs to a different workspace',
      );
    }
    const permissions = Array.from(
      new Set([
        EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
        ...sanitizeEmailMarketingPermissions(req.validated.body.permissions),
      ]),
    );
    const membership = await EmailMarketingMembership.findOneAndUpdate(
      {
        workspaceId: req.emailMarketing.workspaceId,
        userId: user._id,
      },
      {
        $set: {
          role: inferRole(permissions),
          permissions,
          status: req.validated.body.status,
          invitedBy: req.user._id,
        },
        $setOnInsert: {
          workspaceId: req.emailMarketing.workspaceId,
          userId: user._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).populate('userId', 'name email role status isActive');
    await recordEmailMarketingAudit({
      req,
      action: 'team.access_granted',
      resourceType: 'membership',
      resourceId: membership._id,
      metadata: { userId: user._id, permissions },
    });
    return successResponse(
      res,
      201,
      'Team access saved successfully',
      serializeMembership(membership),
    );
  } catch (error) {
    return next(error);
  }
};

const findEditableMembership = async (req) => {
  const membership = await EmailMarketingMembership.findOne({
    _id: req.validated.params.id,
    workspaceId: req.emailMarketing.workspaceId,
  });
  if (!membership) return null;
  if (membership.role === 'owner') {
    const error = new Error('Workspace owner access cannot be changed');
    error.statusCode = 409;
    throw error;
  }
  if (String(membership.userId) === String(req.user._id)) {
    const error = new Error('You cannot change your own Email Marketing access');
    error.statusCode = 409;
    throw error;
  }
  return membership;
};

export const updateTeamUser = async (req, res, next) => {
  try {
    const membership = await findEditableMembership(req);
    if (!membership) return errorResponse(res, 404, 'Team membership not found');
    if (req.validated.body.permissions) {
      membership.permissions = Array.from(
        new Set([
          EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
          ...sanitizeEmailMarketingPermissions(
            req.validated.body.permissions,
          ),
        ]),
      );
      membership.role = inferRole(membership.permissions);
    }
    if (req.validated.body.status) {
      membership.status = req.validated.body.status;
    }
    await membership.save();
    await membership.populate('userId', 'name email role status isActive');
    return successResponse(
      res,
      200,
      'Team access updated successfully',
      serializeMembership(membership),
    );
  } catch (error) {
    return next(error);
  }
};

export const deactivateTeamUser = async (req, res, next) => {
  try {
    const membership = await findEditableMembership(req);
    if (!membership) return errorResponse(res, 404, 'Team membership not found');
    membership.status = 'inactive';
    await membership.save();
    return successResponse(res, 200, 'Team access removed successfully', null);
  } catch (error) {
    return next(error);
  }
};
