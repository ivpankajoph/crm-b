import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingTemplate, {
  emailBlockTypes,
  templateStatuses,
  templateTypes,
} from '../models/EmailMarketingTemplate.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { escapeRegex } from '../utils/segmentFilter.js';

export const listTemplates = async (req, res, next) => {
  try {
    const { page, limit, search, type, status, category } = req.validated.query;
    const filter = buildWorkspaceFilter(req.emailMarketing, {
      ...(search
        ? {
            $or: [
              { name: new RegExp(escapeRegex(search), 'i') },
              { subject: new RegExp(escapeRegex(search), 'i') },
            ],
          }
        : {}),
      ...(type !== 'all' ? { type } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(category ? { category } : {}),
    });
    const [items, total] = await Promise.all([
      EmailMarketingTemplate.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailMarketingTemplate.countDocuments(filter),
    ]);
    return successResponse(res, 200, 'Templates fetched successfully', {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getTemplate = async (req, res, next) => {
  try {
    const template = await EmailMarketingTemplate.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!template) return errorResponse(res, 404, 'Template not found');
    return successResponse(res, 200, 'Template fetched successfully', template);
  } catch (error) {
    return next(error);
  }
};

export const createTemplate = async (req, res, next) => {
  try {
    const template = await EmailMarketingTemplate.create({
      ...req.validated.body,
      workspaceId: req.emailMarketing.workspaceId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'template.created',
      resourceType: 'template',
      resourceId: template._id,
      metadata: { type: template.type },
    });
    return successResponse(res, 201, 'Template created successfully', template);
  } catch (error) {
    return next(error);
  }
};

export const updateTemplate = async (req, res, next) => {
  try {
    const template = await EmailMarketingTemplate.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
      { $set: { ...req.validated.body, updatedBy: req.user._id } },
      { new: true, runValidators: true },
    );
    if (!template) return errorResponse(res, 404, 'Template not found');
    await recordEmailMarketingAudit({
      req,
      action: 'template.updated',
      resourceType: 'template',
      resourceId: template._id,
      metadata: { fields: Object.keys(req.validated.body) },
    });
    return successResponse(res, 200, 'Template updated successfully', template);
  } catch (error) {
    return next(error);
  }
};

export const duplicateTemplate = async (req, res, next) => {
  try {
    const source = await EmailMarketingTemplate.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!source) return errorResponse(res, 404, 'Template not found');
    const template = await EmailMarketingTemplate.create({
      name: `${source.name} Copy ${Date.now().toString().slice(-6)}`,
      subject: source.subject,
      preheader: source.preheader,
      type: source.type,
      status: 'draft',
      category: source.category,
      htmlContent: source.htmlContent,
      blocks: source.blocks,
      workspaceId: req.emailMarketing.workspaceId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'template.duplicated',
      resourceType: 'template',
      resourceId: template._id,
      metadata: { sourceId: source._id },
    });
    return successResponse(res, 201, 'Template duplicated successfully', template);
  } catch (error) {
    return next(error);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    const template = await EmailMarketingTemplate.findOneAndDelete(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!template) return errorResponse(res, 404, 'Template not found');
    await recordEmailMarketingAudit({
      req,
      action: 'template.deleted',
      resourceType: 'template',
      resourceId: template._id,
      metadata: { name: template.name },
    });
    return successResponse(res, 200, 'Template deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};

export const getTemplateMeta = async (_req, res) =>
  successResponse(res, 200, 'Template metadata fetched successfully', {
    types: templateTypes,
    statuses: templateStatuses,
    blockTypes: emailBlockTypes,
    editors: {
      visual: 'blocks',
      simple: 'htmlContent',
      html: 'htmlContent',
    },
  });
