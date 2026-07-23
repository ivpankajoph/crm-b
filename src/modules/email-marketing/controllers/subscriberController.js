import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import EmailMarketingImport from '../models/EmailMarketingImport.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { importSubscriberRows } from '../services/subscriberImportService.js';
import { parseCsvText } from '../utils/csv.js';
import { escapeRegex } from '../utils/segmentFilter.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { errorResponse, successResponse } from '../../../utils/response.js';
import { createAutomationExecutions } from '../services/automationService.js';
import {
  isAutomationQueueConfigured,
  scheduleAutomationExecution,
} from '../services/automationQueueService.js';

const cleanTags = (tags = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

const queueWelcomeAutomations = async (req, subscriber) => {
  if (
    !isAutomationQueueConfigured() ||
    subscriber.status !== 'subscribed' ||
    subscriber.blocked
  ) {
    return;
  }
  try {
    const executions = await createAutomationExecutions({
      context: req.emailMarketing,
      actorUserId: req.user._id,
      trigger: 'welcome_signup',
      subscriber,
      email: subscriber.email,
      triggerContext: { source: subscriber.source },
      idempotencyKey: `subscriber-created:${subscriber._id}`,
    });
    await Promise.all(
      executions
        .filter((execution) => execution.status === 'pending')
        .map((execution) =>
          scheduleAutomationExecution({
            executionId: execution._id,
            workspaceId: execution.workspaceId,
            runAt: new Date(),
          }),
        ),
    );
  } catch (error) {
    console.error(
      '[Email Marketing] Welcome automation could not be queued:',
      error.message,
    );
  }
};

const buildListFilter = (req) => {
  const { search, status, source, tag, blocked } = req.validated.query;
  const extra = {};
  if (status !== 'all') extra.status = status;
  if (source) extra.source = source;
  if (tag) extra.tags = new RegExp(`^${escapeRegex(tag)}$`, 'i');
  if (blocked !== undefined) extra.blocked = blocked === 'true';
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    extra.$or = [
      { email: regex },
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      { tags: regex },
    ];
  }
  return buildWorkspaceFilter(req.emailMarketing, extra);
};

export const listSubscribers = async (req, res, next) => {
  try {
    const { page, limit, sort } = req.validated.query;
    const filter = buildListFilter(req);
    const sortBy =
      sort === 'oldest'
        ? { createdAt: 1 }
        : sort === 'email'
          ? { email: 1 }
          : { createdAt: -1 };
    const [items, total, counts] = await Promise.all([
      EmailMarketingSubscriber.find(filter)
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailMarketingSubscriber.countDocuments(filter),
      EmailMarketingSubscriber.aggregate([
        { $match: { workspaceId: req.emailMarketing.workspaceId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return successResponse(res, 200, 'Subscribers fetched successfully', {
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

export const getSubscriberSummary = async (req, res, next) => {
  try {
    const [total, subscribed, unsubscribed, suppressed, blocked] =
      await Promise.all([
        EmailMarketingSubscriber.countDocuments(
          buildWorkspaceFilter(req.emailMarketing),
        ),
        EmailMarketingSubscriber.countDocuments(
          buildWorkspaceFilter(req.emailMarketing, { status: 'subscribed' }),
        ),
        EmailMarketingSubscriber.countDocuments(
          buildWorkspaceFilter(req.emailMarketing, { status: 'unsubscribed' }),
        ),
        EmailMarketingSubscriber.countDocuments(
          buildWorkspaceFilter(req.emailMarketing, { status: 'suppressed' }),
        ),
        EmailMarketingSubscriber.countDocuments(
          buildWorkspaceFilter(req.emailMarketing, { blocked: true }),
        ),
      ]);
    return successResponse(res, 200, 'Audience summary fetched successfully', {
      total,
      subscribed,
      unsubscribed,
      suppressed,
      blocked,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSubscriberMeta = async (req, res, next) => {
  try {
    const [sources, tags] = await Promise.all([
      EmailMarketingSubscriber.distinct(
        'source',
        buildWorkspaceFilter(req.emailMarketing),
      ),
      EmailMarketingSubscriber.distinct(
        'tags',
        buildWorkspaceFilter(req.emailMarketing),
      ),
    ]);
    return successResponse(res, 200, 'Audience metadata fetched successfully', {
      statuses: ['subscribed', 'unsubscribed', 'suppressed'],
      sources: sources.sort(),
      tags: tags.sort(),
    });
  } catch (error) {
    return next(error);
  }
};

export const listSubscriberImports = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const items = await EmailMarketingImport.find(
      buildWorkspaceFilter(req.emailMarketing),
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return successResponse(res, 200, 'Subscriber imports fetched successfully', {
      items,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSubscriber = async (req, res, next) => {
  try {
    const subscriber = await EmailMarketingSubscriber.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!subscriber) return errorResponse(res, 404, 'Subscriber not found');
    return successResponse(res, 200, 'Subscriber fetched successfully', subscriber);
  } catch (error) {
    return next(error);
  }
};

export const createSubscriber = async (req, res, next) => {
  try {
    const activeSuppression = await EmailMarketingSuppression.exists(
      buildWorkspaceFilter(req.emailMarketing, {
        email: req.validated.body.email,
        status: 'active',
      }),
    );
    const shouldBlock =
      Boolean(activeSuppression) ||
      req.validated.body.blocked ||
      req.validated.body.status === 'suppressed';
    const subscriber = await EmailMarketingSubscriber.create({
      ...req.validated.body,
      tags: cleanTags(req.validated.body.tags),
      ...(shouldBlock ? { status: 'suppressed', blocked: true } : {}),
      workspaceId: req.emailMarketing.workspaceId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'subscriber.created',
      resourceType: 'subscriber',
      resourceId: subscriber._id,
    });
    await queueWelcomeAutomations(req, subscriber);
    return successResponse(res, 201, 'Subscriber created successfully', subscriber);
  } catch (error) {
    return next(error);
  }
};

export const updateSubscriber = async (req, res, next) => {
  try {
    const updates = { ...req.validated.body, updatedBy: req.user._id };
    if (updates.tags) updates.tags = cleanTags(updates.tags);
    if (updates.blocked === true || updates.status === 'suppressed') {
      updates.status = 'suppressed';
      updates.blocked = true;
    } else if (
      updates.status === 'subscribed' ||
      updates.status === 'unsubscribed'
    ) {
      updates.blocked = false;
    }
    if (updates.email || updates.status === 'subscribed' || updates.blocked === false) {
      const current = await EmailMarketingSubscriber.findOne(
        buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
      )
        .select('email')
        .lean();
      if (!current) return errorResponse(res, 404, 'Subscriber not found');
      const email = updates.email || current.email;
      const suppressed = await EmailMarketingSuppression.exists(
        buildWorkspaceFilter(req.emailMarketing, { email, status: 'active' }),
      );
      if (suppressed) {
        updates.status = 'suppressed';
        updates.blocked = true;
      }
    }
    const subscriber = await EmailMarketingSubscriber.findOneAndUpdate(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!subscriber) return errorResponse(res, 404, 'Subscriber not found');
    await recordEmailMarketingAudit({
      req,
      action: 'subscriber.updated',
      resourceType: 'subscriber',
      resourceId: subscriber._id,
      metadata: { fields: Object.keys(req.validated.body) },
    });
    return successResponse(res, 200, 'Subscriber updated successfully', subscriber);
  } catch (error) {
    return next(error);
  }
};

export const deleteSubscriber = async (req, res, next) => {
  try {
    const subscriber = await EmailMarketingSubscriber.findOneAndDelete(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!subscriber) return errorResponse(res, 404, 'Subscriber not found');
    await recordEmailMarketingAudit({
      req,
      action: 'subscriber.deleted',
      resourceType: 'subscriber',
      resourceId: subscriber._id,
      metadata: { email: subscriber.email },
    });
    return successResponse(res, 200, 'Subscriber deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};

export const bulkUpdateSubscribers = async (req, res, next) => {
  try {
    const { ids, action, tags = [], reason = '' } = req.validated.body;
    const scoped = buildWorkspaceFilter(req.emailMarketing, { _id: { $in: ids } });
    const subscribers = await EmailMarketingSubscriber.find(scoped)
      .select('_id email')
      .lean();
    if (!subscribers.length) {
      return errorResponse(res, 404, 'No matching subscribers found');
    }
    const selectedIds = subscribers.map((subscriber) => subscriber._id);
    let update;
    if (action === 'delete') {
      const result = await EmailMarketingSubscriber.deleteMany(
        buildWorkspaceFilter(req.emailMarketing, { _id: { $in: selectedIds } }),
      );
      await recordEmailMarketingAudit({
        req,
        action: 'subscriber.bulk_delete',
        resourceType: 'subscriber',
        metadata: { requested: ids.length, deleted: result.deletedCount },
      });
      return successResponse(res, 200, 'Subscribers deleted successfully', {
        requested: ids.length,
        matched: subscribers.length,
        deleted: result.deletedCount,
      });
    } else if (action === 'add_tags') {
      update = { $addToSet: { tags: { $each: cleanTags(tags) } }, $set: { updatedBy: req.user._id } };
    } else if (action === 'reactivate') {
      const complaintEmails = await EmailMarketingSuppression.find(
        buildWorkspaceFilter(req.emailMarketing, {
          email: { $in: subscribers.map((subscriber) => subscriber.email) },
          type: 'complaint',
          status: 'active',
        }),
      )
        .select('email')
        .lean();
      const protectedEmails = new Set(complaintEmails.map((entry) => entry.email));
      const releasable = subscribers.filter(
        (subscriber) => !protectedEmails.has(subscriber.email),
      );
      await EmailMarketingSuppression.updateMany(
        buildWorkspaceFilter(req.emailMarketing, {
          email: { $in: releasable.map((subscriber) => subscriber.email) },
          status: 'active',
        }),
        { $set: { status: 'released', updatedBy: req.user._id } },
      );
      update = {
        $set: {
          status: 'subscribed',
          blocked: false,
          updatedBy: req.user._id,
        },
      };
      selectedIds.splice(
        0,
        selectedIds.length,
        ...releasable.map((subscriber) => subscriber._id),
      );
    } else {
      const type = action === 'unsubscribe' ? 'unsubscribe' : 'manual';
      const complaintEntries = await EmailMarketingSuppression.find(
        buildWorkspaceFilter(req.emailMarketing, {
          email: { $in: subscribers.map((subscriber) => subscriber.email) },
          type: 'complaint',
          status: 'active',
        }),
      )
        .select('email')
        .lean();
      const complaintEmails = new Set(
        complaintEntries.map((entry) => entry.email),
      );
      const mutableSubscribers = subscribers.filter(
        (subscriber) => !complaintEmails.has(subscriber.email),
      );
      selectedIds.splice(
        0,
        selectedIds.length,
        ...mutableSubscribers.map((subscriber) => subscriber._id),
      );
      if (!mutableSubscribers.length) {
        return successResponse(
          res,
          200,
          'Complaint-suppressed subscribers were left unchanged',
          {
            requested: ids.length,
            matched: subscribers.length,
            modified: 0,
            protected: complaintEmails.size,
          },
        );
      }
      await EmailMarketingSuppression.bulkWrite(
        mutableSubscribers.map((subscriber) => ({
          updateOne: {
            filter: {
              workspaceId: req.emailMarketing.workspaceId,
              email: subscriber.email,
            },
            update: {
              $set: {
                type,
                reason: reason || type,
                status: 'active',
                subscriberId: subscriber._id,
                updatedBy: req.user._id,
              },
              $setOnInsert: {
                workspaceId: req.emailMarketing.workspaceId,
                email: subscriber.email,
                source: 'crm',
                createdBy: req.user._id,
              },
            },
            upsert: true,
          },
        })),
      );
      update = {
        $set: {
          status: action === 'unsubscribe' ? 'unsubscribed' : 'suppressed',
          blocked: action === 'suppress',
          updatedBy: req.user._id,
        },
      };
    }
    const result = await EmailMarketingSubscriber.updateMany(
      buildWorkspaceFilter(req.emailMarketing, { _id: { $in: selectedIds } }),
      update,
      { runValidators: true },
    );
    await recordEmailMarketingAudit({
      req,
      action: `subscriber.bulk_${action}`,
      resourceType: 'subscriber',
      metadata: { requested: ids.length, matched: subscribers.length, modified: result.modifiedCount },
    });
    return successResponse(res, 200, 'Subscribers updated successfully', {
      requested: ids.length,
      matched: subscribers.length,
      modified: result.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const importSubscribersJson = async (req, res, next) => {
  try {
    const result = await importSubscriberRows({
      req,
      rows: req.validated.body.rows,
      source: 'json',
      updateExisting: req.validated.body.updateExisting,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'subscriber.imported',
      resourceType: 'subscriber_import',
      resourceId: result._id,
      metadata: { added: result.added, updated: result.updated, skipped: result.skipped },
    });
    return successResponse(res, 201, 'Subscriber import completed', result);
  } catch (error) {
    return next(error);
  }
};

export const importSubscribersCsv = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 400, 'CSV file is required');
    const rows = parseCsvText(req.file.buffer.toString('utf8'));
    const updateExisting = String(req.body.updateExisting).toLowerCase() === 'true';
    const result = await importSubscriberRows({
      req,
      rows,
      fileName: req.file.originalname,
      source: 'csv',
      updateExisting,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'subscriber.csv_imported',
      resourceType: 'subscriber_import',
      resourceId: result._id,
      metadata: { added: result.added, updated: result.updated, skipped: result.skipped },
    });
    return successResponse(res, 201, 'CSV import completed', result);
  } catch (error) {
    return next(error);
  }
};
