import mongoose from 'mongoose';

import User from '../../../models/User.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import {
  EMAIL_MARKETING_PERMISSIONS,
  EMAIL_MARKETING_PERMISSION_VALUES,
  getDefaultEmailMarketingPermissions,
  normalizeEmailMarketingRole,
  sanitizeEmailMarketingPermissions,
} from '../constants/permissions.js';
import EmailMarketingMembership from '../models/EmailMarketingMembership.js';
import EmailMarketingWorkspace from '../models/EmailMarketingWorkspace.js';
import {
  resolveEffectiveAccess,
  userHasPermission,
} from '../../../services/accessControlService.js';
import { PERMISSIONS } from '../../../constants/permissions.js';

const MAX_OWNER_DEPTH = 50;

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getUserSnapshot = async (userOrId) => {
  if (userOrId?._id && userOrId.name !== undefined) {
    return {
      _id: userOrId._id,
      name: userOrId.name,
      email: userOrId.email,
      role: userOrId.role,
      parent: userOrId.parent,
      createdBy: userOrId.createdBy,
      status: userOrId.status,
      isActive: userOrId.isActive,
    };
  }

  return User.findById(userOrId)
    .select('_id name email role parent createdBy status isActive')
    .lean();
};

export const resolveWorkspaceOwner = async (authenticatedUser) => {
  let current = await getUserSnapshot(authenticatedUser);
  if (!current) throw createHttpError(401, 'Authenticated CRM user not found');

  const visited = new Set();

  for (let depth = 0; depth < MAX_OWNER_DEPTH; depth += 1) {
    const currentId = String(current._id);
    if (visited.has(currentId)) {
      throw createHttpError(500, 'Invalid CRM ownership hierarchy');
    }
    visited.add(currentId);

    const parentId = current.parent || current.createdBy;
    if (!parentId || String(parentId) === currentId) return current;

    const parent = await getUserSnapshot(parentId);
    if (!parent) return current;
    current = parent;
  }

  throw createHttpError(500, 'CRM ownership hierarchy is too deep');
};

const mapCrmRoleToMembershipRole = (role, isOwner) => {
  if (isOwner) return 'owner';
  const normalized = normalizeEmailMarketingRole(role);
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('manager')) return 'manager';
  if (normalized.includes('editor')) return 'editor';
  if (normalized.includes('analyst')) return 'analyst';
  return 'viewer';
};

const resolveInitialPermissions = async (user, isOwner) => {
  if (isOwner) return [...EMAIL_MARKETING_PERMISSION_VALUES];

  const access = await resolveEffectiveAccess(user);
  const usesCentralAccess = Number(access.accessVersion || 1) >= 2;
  const configured = usesCentralAccess
    ? []
    : sanitizeEmailMarketingPermissions(access.permissions || []);
  const mapped = [];
  const has = (permission) => userHasPermission(access, permission);

  if (has(PERMISSIONS.EMAIL_MODULE_VIEW)) {
    mapped.push(EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD);
  }
  if (has(PERMISSIONS.EMAIL_TEMPLATES_USE)) {
    mapped.push(EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES);
  }
  if (has(PERMISSIONS.EMAIL_TEMPLATES_CREATE)) {
    mapped.push(
      EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES,
      EMAIL_MARKETING_PERMISSIONS.CREATE_CONTENT,
    );
  }
  if (has(PERMISSIONS.EMAIL_TEMPLATES_EDIT)) {
    mapped.push(
      EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES,
      EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT,
    );
  }
  if (has(PERMISSIONS.EMAIL_TEMPLATES_SHARE)) {
    mapped.push(
      EMAIL_MARKETING_PERMISSIONS.VIEW_SHARED_TEMPLATES,
      EMAIL_MARKETING_PERMISSIONS.SHARE_CONTENT,
    );
  }
  if (has(PERMISSIONS.EMAIL_CAMPAIGNS_MANAGE)) {
    mapped.push(
      EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS,
      EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
    );
  }

  const permissions = configured.length || mapped.length || usesCentralAccess
    ? [...configured, ...mapped]
    : getDefaultEmailMarketingPermissions(user.role);

  return Array.from(new Set(permissions));
};

export const ensureEmailMarketingContext = async (authenticatedUser) => {
  if (!mongoose.isValidObjectId(authenticatedUser?._id)) {
    throw createHttpError(401, 'Valid CRM authentication is required');
  }

  const owner = await resolveWorkspaceOwner(authenticatedUser);
  const config = getEmailMarketingConfig();

  const workspace = await EmailMarketingWorkspace.findOneAndUpdate(
    { ownerUserId: owner._id },
    {
      $setOnInsert: {
        ownerUserId: owner._id,
        name: `${owner.name || owner.email || 'CRM'} Email Marketing`,
        settings: { timezone: config.defaultTimezone },
        createdBy: authenticatedUser._id,
        updatedBy: authenticatedUser._id,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  if (workspace.status !== 'active') {
    throw createHttpError(403, 'Email Marketing workspace is suspended');
  }

  const isOwner = String(owner._id) === String(authenticatedUser._id);
  const initialPermissions = await resolveInitialPermissions(
    authenticatedUser,
    isOwner,
  );
  const membershipRole = mapCrmRoleToMembershipRole(
    authenticatedUser.role,
    isOwner,
  );

  const membership = await EmailMarketingMembership.findOneAndUpdate(
    { workspaceId: workspace._id, userId: authenticatedUser._id },
    isOwner
      ? {
          $set: {
            role: 'owner',
            permissions: EMAIL_MARKETING_PERMISSION_VALUES,
            status: 'active',
            lastAccessedAt: new Date(),
          },
          $setOnInsert: {
            workspaceId: workspace._id,
            userId: authenticatedUser._id,
            invitedBy: null,
          },
        }
      : {
          $set: {
            lastAccessedAt: new Date(),
            role: membershipRole,
            permissions: initialPermissions,
          },
          $setOnInsert: {
            workspaceId: workspace._id,
            userId: authenticatedUser._id,
            status: 'active',
            invitedBy: owner._id,
          },
        },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  if (membership.status !== 'active') {
    throw createHttpError(403, 'Email Marketing access is inactive');
  }

  const permissions = sanitizeEmailMarketingPermissions(
    membership.permissions,
  );

  return {
    workspace,
    workspaceId: workspace._id,
    owner,
    membership,
    permissions,
    isOwner,
  };
};

export const buildWorkspaceFilter = (emailMarketingContext, extra = {}) => {
  if (!emailMarketingContext?.workspaceId) {
    throw createHttpError(500, 'Email Marketing workspace context is missing');
  }
  return { ...extra, workspaceId: emailMarketingContext.workspaceId };
};
