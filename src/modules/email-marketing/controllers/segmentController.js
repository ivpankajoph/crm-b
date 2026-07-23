import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingSegment from '../models/EmailMarketingSegment.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { buildSegmentFilter, escapeRegex } from '../utils/segmentFilter.js';

const withPreview = async (req, segment) => {
  const definition = {
    logic: segment.logic,
    conditions: segment.conditions,
  };
  const count = await EmailMarketingSubscriber.countDocuments(
    buildSegmentFilter(req.emailMarketing, definition),
  );
  return { ...segment, subscriberCount: count };
};

export const listSegments = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = buildWorkspaceFilter(req.emailMarketing, {
      ...(search ? { name: new RegExp(escapeRegex(search), 'i') } : {}),
    });
    const segments = await EmailMarketingSegment.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    const items = await Promise.all(
      segments.map((segment) => withPreview(req, segment)),
    );
    return successResponse(res, 200, 'Segments fetched successfully', { items });
  } catch (error) {
    return next(error);
  }
};

export const getSegment = async (req, res, next) => {
  try {
    const segment = await EmailMarketingSegment.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!segment) return errorResponse(res, 404, 'Segment not found');
    return successResponse(
      res,
      200,
      'Segment fetched successfully',
      await withPreview(req, segment),
    );
  } catch (error) {
    return next(error);
  }
};

export const createSegment = async (req, res, next) => {
  try {
    const segment = await EmailMarketingSegment.create({
      ...req.validated.body,
      workspaceId: req.emailMarketing.workspaceId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'segment.created',
      resourceType: 'segment',
      resourceId: segment._id,
    });
    return successResponse(
      res,
      201,
      'Segment created successfully',
      await withPreview(req, segment.toObject()),
    );
  } catch (error) {
    return next(error);
  }
};

export const updateSegment = async (req, res, next) => {
  try {
    const segment = await EmailMarketingSegment.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
      { $set: { ...req.validated.body, updatedBy: req.user._id } },
      { new: true, runValidators: true },
    ).lean();
    if (!segment) return errorResponse(res, 404, 'Segment not found');
    await recordEmailMarketingAudit({
      req,
      action: 'segment.updated',
      resourceType: 'segment',
      resourceId: segment._id,
      metadata: { fields: Object.keys(req.validated.body) },
    });
    return successResponse(
      res,
      200,
      'Segment updated successfully',
      await withPreview(req, segment),
    );
  } catch (error) {
    return next(error);
  }
};

export const deleteSegment = async (req, res, next) => {
  try {
    const segment = await EmailMarketingSegment.findOneAndDelete(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!segment) return errorResponse(res, 404, 'Segment not found');
    await recordEmailMarketingAudit({
      req,
      action: 'segment.deleted',
      resourceType: 'segment',
      resourceId: segment._id,
      metadata: { name: segment.name },
    });
    return successResponse(res, 200, 'Segment deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};

export const previewSegment = async (req, res, next) => {
  try {
    const filter = buildSegmentFilter(
      req.emailMarketing,
      req.validated.body,
    );
    const [subscriberCount, sampleSubscribers] = await Promise.all([
      EmailMarketingSubscriber.countDocuments(filter),
      EmailMarketingSubscriber.find(filter)
        .select('email firstName lastName status source tags')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);
    return successResponse(res, 200, 'Segment preview generated', {
      subscriberCount,
      sampleSubscribers,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSegmentMeta = async (_req, res) =>
  successResponse(res, 200, 'Segment metadata fetched successfully', {
    fields: ['status', 'tag', 'source', 'email', 'createdAt'],
    operators: [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'within_days',
    ],
    logic: ['and', 'or'],
  });
