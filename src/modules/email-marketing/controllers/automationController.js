import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingAutomation, {
  automationStatuses,
  automationStepTypes,
  automationTriggers,
} from '../models/EmailMarketingAutomation.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import {
  createAutomationExecutions,
  normalizeAutomationPayload,
  validateAutomationDefinition,
} from '../services/automationService.js';
import {
  cancelAutomationExecutions,
  isAutomationQueueConfigured,
  scheduleAutomationExecution,
} from '../services/automationQueueService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';
import { assertSesSendingConfigured } from '../services/sesService.js';
import { resolveEmailMarketingSender } from '../services/senderService.js';
import { escapeRegex } from '../utils/segmentFilter.js';

const serializeAutomation = async (automation, executionLimit = 25) => {
  const object = automation.toObject ? automation.toObject() : automation;
  const executions = await EmailMarketingAutomationExecution.find({
    workspaceId: object.workspaceId,
    automationId: object._id,
  })
    .sort({ createdAt: -1 })
    .limit(executionLimit)
    .lean();
  return { ...object, executions };
};

const validateActivation = async (req, payload) => {
  if (!isAutomationQueueConfigured()) {
    const error = new Error(
      'Configure Email Marketing sending, queue, and Redis before activation',
    );
    error.statusCode = 503;
    throw error;
  }
  assertSesSendingConfigured();
  const settings = req.emailMarketing.workspace.settings || {};
  await resolveEmailMarketingSender(req.emailMarketing, {
    requestedFromName: settings.defaultFromName,
    requestedFromEmail: settings.defaultFromEmail,
    requestedReplyTo: settings.defaultReplyTo,
  });
  await validateAutomationDefinition(req.emailMarketing, payload);
};

export const listAutomations = async (req, res, next) => {
  try {
    const { status, trigger, search } = req.validated.query;
    const items = await EmailMarketingAutomation.find(
      buildWorkspaceFilter(req.emailMarketing, {
        ...(status !== 'all' ? { status } : {}),
        ...(trigger !== 'all' ? { trigger } : {}),
        ...(search
          ? {
              $or: [
                { name: new RegExp(escapeRegex(search), 'i') },
                { description: new RegExp(escapeRegex(search), 'i') },
              ],
            }
          : {}),
      }),
    )
      .sort({ updatedAt: -1 })
      .lean();
    const withExecutions = await Promise.all(
      items.map((item) => serializeAutomation(item, 10)),
    );
    return successResponse(res, 200, 'Automations fetched successfully', {
      items: withExecutions,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAutomation = async (req, res, next) => {
  try {
    const item = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!item) return errorResponse(res, 404, 'Automation not found');
    return successResponse(
      res,
      200,
      'Automation fetched successfully',
      await serializeAutomation(item, 100),
    );
  } catch (error) {
    return next(error);
  }
};

export const createAutomation = async (req, res, next) => {
  try {
    const payload = normalizeAutomationPayload(req.validated.body);
    if (payload.status === 'active') await validateActivation(req, payload);
    else await validateAutomationDefinition(req.emailMarketing, payload);
    const automation = await EmailMarketingAutomation.create({
      ...payload,
      workspaceId: req.emailMarketing.workspaceId,
      activatedAt: payload.status === 'active' ? new Date() : null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'automation.created',
      resourceType: 'automation',
      resourceId: automation._id,
    });
    return successResponse(
      res,
      201,
      'Automation created successfully',
      await serializeAutomation(automation),
    );
  } catch (error) {
    return next(error);
  }
};

export const updateAutomation = async (req, res, next) => {
  try {
    const automation = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!automation) return errorResponse(res, 404, 'Automation not found');
    const merged = normalizeAutomationPayload({
      ...automation.toObject(),
      ...req.validated.body,
    });
    if (merged.status === 'active') await validateActivation(req, merged);
    else await validateAutomationDefinition(req.emailMarketing, merged);
    Object.assign(
      automation,
      normalizeAutomationPayload(req.validated.body),
      { updatedBy: req.user._id },
    );
    if (req.validated.body.status === 'active' && !automation.activatedAt) {
      automation.activatedAt = new Date();
    }
    await automation.save();
    return successResponse(
      res,
      200,
      'Automation updated successfully',
      await serializeAutomation(automation),
    );
  } catch (error) {
    return next(error);
  }
};

export const duplicateAutomation = async (req, res, next) => {
  try {
    const source = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    ).lean();
    if (!source) return errorResponse(res, 404, 'Automation not found');
    const {
      _id,
      createdAt,
      updatedAt,
      executionCount,
      completedCount,
      failedCount,
      emailsSent,
      lastRunAt,
      activatedAt,
      ...copy
    } = source;
    const automation = await EmailMarketingAutomation.create({
      ...copy,
      name: `${source.name} Copy`,
      status: 'draft',
      executionCount: 0,
      completedCount: 0,
      failedCount: 0,
      emailsSent: 0,
      activatedAt: null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    return successResponse(
      res,
      201,
      'Automation duplicated successfully',
      await serializeAutomation(automation),
    );
  } catch (error) {
    return next(error);
  }
};

const setStatus = (status) => async (req, res, next) => {
  try {
    const automation = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!automation) return errorResponse(res, 404, 'Automation not found');
    if (status === 'active') {
      await validateActivation(req, automation.toObject());
      automation.activatedAt ||= new Date();
    } else {
      await cancelAutomationExecutions(
        automation._id,
        req.emailMarketing.workspaceId,
      );
    }
    automation.status = status;
    automation.updatedBy = req.user._id;
    await automation.save();
    return successResponse(
      res,
      200,
      `Automation ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      await serializeAutomation(automation),
    );
  } catch (error) {
    return next(error);
  }
};

export const activateAutomation = setStatus('active');
export const deactivateAutomation = setStatus('inactive');

export const testAutomation = async (req, res, next) => {
  try {
    const automation = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, {
        _id: req.validated.params.id,
      }),
    );
    if (!automation) return errorResponse(res, 404, 'Automation not found');
    await validateActivation(req, automation.toObject());
    const executions = await createAutomationExecutions({
      context: req.emailMarketing,
      actorUserId: req.user._id,
      automationId: req.validated.params.id,
      email: req.validated.body.email,
      triggerContext: {},
      testRun: true,
    });
    await Promise.all(
      executions.map((execution) =>
        scheduleAutomationExecution({
          executionId: execution._id,
          workspaceId: execution.workspaceId,
          runAt: new Date(),
        }),
      ),
    );
    return successResponse(res, 202, 'Automation test queued successfully', {
      executions,
    });
  } catch (error) {
    return next(error);
  }
};

export const triggerAutomations = async (req, res, next) => {
  try {
    if (!isAutomationQueueConfigured()) {
      return errorResponse(
        res,
        503,
        'Automation execution infrastructure is not configured',
      );
    }
    const subscriber = req.validated.body.subscriberId
      ? await EmailMarketingSubscriber.findOne(
          buildWorkspaceFilter(req.emailMarketing, {
            _id: req.validated.body.subscriberId,
          }),
        )
      : await EmailMarketingSubscriber.findOne(
          buildWorkspaceFilter(req.emailMarketing, {
            email: req.validated.body.email,
          }),
        );
    const executions = await createAutomationExecutions({
      context: req.emailMarketing,
      actorUserId: req.user._id,
      trigger: req.validated.body.trigger,
      subscriber,
      email: req.validated.body.email,
      triggerContext: req.validated.body.context,
      idempotencyKey: req.validated.body.idempotencyKey,
    });
    await Promise.all(
      executions
        .filter((execution) => execution.status === 'pending')
        .map((execution) =>
          scheduleAutomationExecution({
            executionId: execution._id,
            workspaceId: execution.workspaceId,
            runAt: execution.scheduledFor || new Date(),
          }),
        ),
    );
    return successResponse(res, 202, 'Automation trigger accepted', {
      matched: executions.length,
      executions,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAutomation = async (req, res, next) => {
  try {
    const automation = await EmailMarketingAutomation.findOne(
      buildWorkspaceFilter(req.emailMarketing, { _id: req.validated.params.id }),
    );
    if (!automation) return errorResponse(res, 404, 'Automation not found');
    if (automation.status === 'active') {
      return errorResponse(res, 409, 'Deactivate this automation before deleting it');
    }
    await cancelAutomationExecutions(
      automation._id,
      req.emailMarketing.workspaceId,
    );
    await Promise.all([
      EmailMarketingAutomationExecution.deleteMany({
        workspaceId: req.emailMarketing.workspaceId,
        automationId: automation._id,
      }),
      automation.deleteOne(),
    ]);
    return successResponse(res, 200, 'Automation deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};

export const getAutomationMeta = async (_req, res) =>
  successResponse(res, 200, 'Automation metadata fetched successfully', {
    triggers: automationTriggers,
    statuses: automationStatuses,
    stepTypes: automationStepTypes,
  });
