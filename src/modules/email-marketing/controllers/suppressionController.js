import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { escapeRegex } from '../utils/segmentFilter.js';

export const listSuppressions = async (req, res, next) => {
  try {
    const { page, limit, search, type, status } = req.validated.query;
    const filter = buildWorkspaceFilter(req.emailMarketing, {
      status,
      ...(type !== 'all' ? { type } : {}),
      ...(search ? { email: new RegExp(escapeRegex(search), 'i') } : {}),
    });
    const [items, total, counts] = await Promise.all([
      EmailMarketingSuppression.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailMarketingSuppression.countDocuments(filter),
      EmailMarketingSuppression.aggregate([
        {
          $match: {
            workspaceId: req.emailMarketing.workspaceId,
            status: 'active',
          },
        },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);
    return successResponse(res, 200, 'Suppressions fetched successfully', {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: Object.fromEntries(counts.map((entry) => [entry._id, entry.count])),
    });
  } catch (error) {
    return next(error);
  }
};

export const createSuppression = async (req, res, next) => {
  try {
    const { email, type, reason } = req.validated.body;
    const protectedComplaint = await EmailMarketingSuppression.exists(
      buildWorkspaceFilter(req.emailMarketing, {
        email,
        type: 'complaint',
        status: 'active',
      }),
    );
    if (protectedComplaint && type !== 'complaint') {
      return errorResponse(
        res,
        403,
        'Complaint suppressions cannot be changed manually',
      );
    }
    const subscriber = await EmailMarketingSubscriber.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { email }),
      {
        $set: {
          status: type === 'unsubscribe' ? 'unsubscribed' : 'suppressed',
          blocked: type !== 'unsubscribe',
          updatedBy: req.user._id,
        },
      },
      { new: true },
    );
    const suppression = await EmailMarketingSuppression.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { email }),
      {
        $set: {
          type,
          reason,
          status: 'active',
          subscriberId: subscriber?._id || null,
          updatedBy: req.user._id,
        },
        $setOnInsert: {
          workspaceId: req.emailMarketing.workspaceId,
          email,
          source: 'crm',
          createdBy: req.user._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    await recordEmailMarketingAudit({
      req,
      action: 'suppression.created',
      resourceType: 'suppression',
      resourceId: suppression._id,
      metadata: { email, type },
    });
    return successResponse(res, 201, 'Suppression saved successfully', suppression);
  } catch (error) {
    return next(error);
  }
};

export const releaseSuppression = async (req, res, next) => {
  try {
    const suppression = await EmailMarketingSuppression.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!suppression) return errorResponse(res, 404, 'Suppression not found');
    if (suppression.type === 'complaint') {
      return errorResponse(
        res,
        403,
        'Complaint suppressions cannot be released manually',
      );
    }
    suppression.status = 'released';
    suppression.updatedBy = req.user._id;
    await suppression.save();
    const activeSuppression = await EmailMarketingSuppression.exists(
      buildWorkspaceFilter(req.emailMarketing, {
        email: suppression.email,
        status: 'active',
      }),
    );
    if (!activeSuppression) {
      await EmailMarketingSubscriber.findOneAndUpdate(
        buildWorkspaceFilter(req.emailMarketing, { email: suppression.email }),
        {
          $set: {
            status: 'subscribed',
            blocked: false,
            updatedBy: req.user._id,
          },
        },
      );
    }
    await recordEmailMarketingAudit({
      req,
      action: 'suppression.released',
      resourceType: 'suppression',
      resourceId: suppression._id,
      metadata: { email: suppression.email },
    });
    return successResponse(
      res,
      200,
      'Suppression released successfully',
      suppression,
    );
  } catch (error) {
    return next(error);
  }
};
