import ResourceAccess from '../models/ResourceAccess.js';
import EmailMarketingTemplate from '../modules/email-marketing/models/EmailMarketingTemplate.js';
import WhatsAppTemplate from '../models/WhatsAppTemplate.js';
import { ensureEmailMarketingContext } from '../modules/email-marketing/services/workspaceService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logActivity } from '../utils/activity.js';
import {
  resolveAccountOwnerId,
  resolveEffectiveAccess,
  userHasPermission,
} from '../services/accessControlService.js';
import { PERMISSIONS } from '../constants/permissions.js';

const RESOURCE_TYPES = new Set(['email_template', 'whatsapp_template']);
const ACTIONS = new Set(['use', 'edit', 'share']);

const getInventory = async (user, requestedType, { includePreview = false } = {}) => {
  const ownerId = await resolveAccountOwnerId(user);
  const resources = [];

  if (!requestedType || requestedType === 'email_template') {
    const context = await ensureEmailMarketingContext(user);
    const emailTemplates = await EmailMarketingTemplate.find({
      workspaceId: context.workspaceId,
    })
      .select('name subject status category updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    resources.push(...emailTemplates.map((template) => ({
      resourceType: 'email_template',
      resourceId: String(template._id),
      name: template.name,
      subject: template.subject,
      status: template.status,
      category: template.category,
      updatedAt: template.updatedAt,
    })));
  }

  if (!requestedType || requestedType === 'whatsapp_template') {
    const whatsappTemplates = await WhatsAppTemplate.find({
      userId: `crm:${ownerId}`,
    })
      .select([
        'id name status metaStatus category language updatedAt',
        includePreview
          ? 'templateType headerType headerText headerImageUrl previewUrl content footer buttons'
          : '',
      ].join(' '))
      .sort({ updatedAt: -1 })
      .lean();

    resources.push(...whatsappTemplates.map((template) => ({
      resourceType: 'whatsapp_template',
      resourceId: String(template.id || template._id),
      name: template.name,
      status: template.metaStatus || template.status,
      category: template.category,
      language: template.language,
      updatedAt: template.updatedAt,
      ...(includePreview ? {
        templateType: template.templateType || 'default',
        headerType: template.headerType || null,
        headerText: template.headerText || '',
        headerImageUrl: template.headerImageUrl || '',
        previewUrl: template.previewUrl || '',
        content: template.content || '',
        footer: template.footer || '',
        buttons: template.buttons || [],
      } : {}),
    })));
  }

  return { ownerId, resources };
};

const populateAccess = (query) => query
  .populate('roleIds', 'name level status')
  .populate('teamIds', 'name status')
  .populate('userIds', 'name email role status')
  .populate('updatedBy', 'name email');

const attachEmailPreviewContent = async (resources, requestedType) => {
  if (requestedType !== 'email_template' || !resources.length) return resources;

  const templates = await EmailMarketingTemplate.find({
    _id: { $in: resources.map((resource) => resource.resourceId) },
  })
    .select('preheader htmlContent blocks')
    .lean();
  const byId = new Map(templates.map((template) => [String(template._id), template]));

  return resources.map((resource) => {
    const template = byId.get(resource.resourceId);
    return {
      ...resource,
      preheader: template?.preheader || '',
      htmlContent: template?.htmlContent || '',
      blocks: template?.blocks || [],
    };
  });
};

export const getTemplateAccessInventory = async (req, res, next) => {
  try {
    const requestedType = req.query.type;
    if (requestedType && !RESOURCE_TYPES.has(requestedType)) {
      return errorResponse(res, 400, 'Invalid template type');
    }
    if (requestedType && !req.allowedTemplateTypes?.includes(requestedType)) {
      return errorResponse(res, 403, 'You do not have access to this template type');
    }

    const inventoryType = requestedType
      || (req.allowedTemplateTypes?.length === 1 ? req.allowedTemplateTypes[0] : undefined);
    const { ownerId, resources } = await getInventory(req.user, inventoryType);
    const accessRows = await populateAccess(ResourceAccess.find({
      ownerUserId: ownerId,
      ...(inventoryType ? { resourceType: inventoryType } : {}),
    }).lean());
    const byResource = new Map(
      accessRows.map((row) => [`${row.resourceType}:${row.resourceId}`, row]),
    );

    return successResponse(
      res,
      200,
      'Template access inventory fetched successfully',
      resources.map((resource) => ({
        ...resource,
        access: byResource.get(`${resource.resourceType}:${resource.resourceId}`) || null,
      })),
    );
  } catch (error) {
    next(error);
  }
};

export const updateTemplateAccess = async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    if (!RESOURCE_TYPES.has(resourceType)) {
      return errorResponse(res, 400, 'Invalid template type');
    }
    if (!req.allowedTemplateTypes?.includes(resourceType)) {
      return errorResponse(res, 403, 'You do not have access to this template type');
    }

    const { ownerId, resources } = await getInventory(req.user, resourceType);
    const resource = resources.find((item) => item.resourceId === resourceId);
    if (!resource) return errorResponse(res, 404, 'Template not found');

    const actions = Array.from(new Set(
      (Array.isArray(req.body.actions) ? req.body.actions : ['use'])
        .filter((action) => ACTIONS.has(action)),
    ));
    if (!actions.length) actions.push('use');

    const access = await ResourceAccess.findOneAndUpdate(
      { ownerUserId: ownerId, resourceType, resourceId },
      {
        $set: {
          resourceName: resource.name,
          resourceStatus: resource.status || '',
          visibility: req.body.visibility === 'company' ? 'company' : 'restricted',
          roleIds: Array.isArray(req.body.roleIds) ? req.body.roleIds : [],
          teamIds: Array.isArray(req.body.teamIds) ? req.body.teamIds : [],
          userIds: Array.isArray(req.body.userIds) ? req.body.userIds : [],
          actions,
          updatedBy: req.user._id,
        },
        $setOnInsert: {
          ownerUserId: ownerId,
          resourceType,
          resourceId,
          createdBy: req.user._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await logActivity({
      user: req.user._id,
      actionType: 'template_access_updated',
      description: `Updated access for ${resource.name}`,
      entityType: 'ResourceAccess',
      entityId: access._id,
      metadata: {
        resourceType,
        resourceId,
        visibility: access.visibility,
        roleIds: access.roleIds,
        teamIds: access.teamIds,
        userIds: access.userIds,
        actions,
      },
    });

    const populated = await populateAccess(ResourceAccess.findById(access._id));
    return successResponse(res, 200, 'Template access updated successfully', populated);
  } catch (error) {
    next(error);
  }
};

export const getAvailableTemplates = async (req, res, next) => {
  try {
    const requestedType = req.query.type;
    if (!RESOURCE_TYPES.has(requestedType)) {
      return errorResponse(res, 400, 'Template type is required');
    }

    const requiredPermission = requestedType === 'email_template'
      ? PERMISSIONS.EMAIL_TEMPLATES_USE
      : PERMISSIONS.WHATSAPP_TEMPLATES_USE;
    const accessContext = await resolveEffectiveAccess(req.user);
    if (!userHasPermission(accessContext, requiredPermission)) {
      return errorResponse(res, 403, 'You do not have permission to use templates');
    }

    const { ownerId, resources } = await getInventory(
      req.user,
      requestedType,
      { includePreview: true },
    );
    const eligibleResources = resources.filter((resource) => {
      if (requestedType === 'email_template') return resource.status === 'active';
      return String(resource.status || '').toLowerCase() === 'approved';
    });
    let available = eligibleResources;
    if (!accessContext.isAdmin) {
      const sharingRows = await ResourceAccess.find({
        ownerUserId: ownerId,
        resourceType: requestedType,
        actions: 'use',
        $or: [
          { visibility: 'company' },
          { userIds: req.user._id },
          ...(accessContext.roleId ? [{ roleIds: accessContext.roleId }] : []),
          ...(accessContext.teamIds.length ? [{ teamIds: { $in: accessContext.teamIds } }] : []),
        ],
      }).lean();
      const allowedIds = new Set(sharingRows.map((row) => row.resourceId));
      available = eligibleResources.filter((resource) => allowedIds.has(resource.resourceId));
    }

    const availableWithPreview = await attachEmailPreviewContent(available, requestedType);
    return successResponse(res, 200, 'Available templates fetched successfully', availableWithPreview);
  } catch (error) {
    next(error);
  }
};
