import { successResponse } from '../../../utils/response.js';
import { getPublicEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import {
  EMAIL_MARKETING_PERMISSIONS,
  EMAIL_MARKETING_PERMISSION_VALUES,
} from '../constants/permissions.js';
import EmailMarketingAuditLog from '../models/EmailMarketingAuditLog.js';
import EmailMarketingWorkspace from '../models/EmailMarketingWorkspace.js';

const serializeUser = (user) => ({
  id: String(user._id),
  name: user.name || '',
  email: user.email || '',
  role: user.role || 'user',
});

const serializeMembership = (membership) => ({
  id: String(membership._id),
  role: membership.role,
  status: membership.status,
  permissions: membership.permissions,
});

export const getModuleStatus = async (req, res) =>
  successResponse(res, 200, 'Email Marketing module is available', {
    module: 'email-marketing',
    version: 1,
    workspaceId: String(req.emailMarketing.workspaceId),
    authenticated: true,
  });

export const getBootstrap = async (req, res) =>
  successResponse(res, 200, 'Email Marketing workspace loaded', {
    user: serializeUser(req.user),
    workspace: req.emailMarketing.workspace,
    membership: serializeMembership(req.emailMarketing.membership),
    permissions: req.emailMarketing.permissions,
    config: getPublicEmailMarketingConfig(),
  });

export const getWorkspace = async (req, res) =>
  successResponse(
    res,
    200,
    'Email Marketing workspace fetched successfully',
    req.emailMarketing.workspace,
  );

export const updateWorkspace = async (req, res, next) => {
  try {
    const { name, settings } = req.validated.body;
    const updates = { updatedBy: req.user._id };

    if (name !== undefined) updates.name = name;
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        updates[`settings.${key}`] = value;
      }
    }

    const workspace = await EmailMarketingWorkspace.findOneAndUpdate(
      { _id: req.emailMarketing.workspaceId, status: 'active' },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!workspace) {
      const error = new Error('Email Marketing workspace not found');
      error.statusCode = 404;
      throw error;
    }

    await EmailMarketingAuditLog.create({
      workspaceId: req.emailMarketing.workspaceId,
      actorUserId: req.user._id,
      action: 'workspace.updated',
      resourceType: 'workspace',
      resourceId: workspace._id,
      metadata: {
        fields: [
          ...(name !== undefined ? ['name'] : []),
          ...Object.keys(settings || {}).map((key) => `settings.${key}`),
        ],
      },
    });

    return successResponse(
      res,
      200,
      'Email Marketing workspace updated successfully',
      workspace,
    );
  } catch (error) {
    return next(error);
  }
};

export const getPermissions = async (req, res) =>
  successResponse(res, 200, 'Email Marketing permissions fetched successfully', {
    granted: req.emailMarketing.permissions,
    catalog: EMAIL_MARKETING_PERMISSION_VALUES,
    constants: EMAIL_MARKETING_PERMISSIONS,
    role: req.emailMarketing.membership.role,
  });

export const getModuleConfig = async (_req, res) =>
  successResponse(
    res,
    200,
    'Email Marketing configuration fetched successfully',
    getPublicEmailMarketingConfig(),
  );
