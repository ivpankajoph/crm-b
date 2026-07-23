import mongoose from 'mongoose';

import { successResponse } from '../../../utils/response.js';
import { getPublicEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { EMAIL_MARKETING_PERMISSIONS } from '../constants/permissions.js';
import EmailMarketingAutomation from '../models/EmailMarketingAutomation.js';
import EmailMarketingAutomationExecution from '../models/EmailMarketingAutomationExecution.js';
import EmailMarketingBillingAccount from '../models/EmailMarketingBillingAccount.js';
import EmailMarketingCampaign from '../models/EmailMarketingCampaign.js';
import EmailMarketingCreditTransaction from '../models/EmailMarketingCreditTransaction.js';
import EmailMarketingDomain from '../models/EmailMarketingDomain.js';
import EmailMarketingMembership from '../models/EmailMarketingMembership.js';
import EmailMarketingSegment from '../models/EmailMarketingSegment.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import EmailMarketingTemplate from '../models/EmailMarketingTemplate.js';
import { ensureBillingAccount } from '../services/billingService.js';

const toClient = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(toClient);
  if (typeof value !== 'object') return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      ['__v', 'workspaceId', 'createdBy', 'updatedBy'].includes(key)
    ) {
      continue;
    }
    output[key === '_id' ? 'id' : key] = toClient(item);
  }
  return output;
};

const teamSnapshot = async (workspaceId) => {
  const memberships = await EmailMarketingMembership.find({
    workspaceId,
    role: { $ne: 'owner' },
  })
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  return memberships
    .filter((membership) => membership.userId)
    .map((membership) => ({
      id: String(membership._id),
      name: membership.userId.name || '',
      email: membership.userId.email || '',
      status: membership.status,
      permissions: membership.permissions,
      invitedAt: membership.createdAt,
      lastLoginAt: membership.lastAccessedAt || '',
    }));
};

export const getIntegrationSnapshot = async (req, res, next) => {
  try {
    const workspaceId = req.emailMarketing.workspaceId;
    const granted = new Set(req.emailMarketing.permissions);
    const can = (permission) => granted.has(permission);
    const [
      subscribers,
      templates,
      segments,
      suppressions,
      campaigns,
      domains,
      automations,
      billing,
      teamUsers,
    ] = await Promise.all([
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE)
        ? EmailMarketingSubscriber.find({ workspaceId })
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT)
        ? EmailMarketingTemplate.find({ workspaceId })
            .sort({ updatedAt: -1 })
            .limit(1000)
            .lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE)
        ? EmailMarketingSegment.find({ workspaceId }).sort({ updatedAt: -1 }).lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE)
        ? EmailMarketingSuppression.find({ workspaceId, status: 'active' })
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS)
        ? EmailMarketingCampaign.find({ workspaceId })
            .sort({ updatedAt: -1 })
            .limit(1000)
            .lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_SENDING_DOMAINS)
        ? EmailMarketingDomain.find({ workspaceId }).sort({ updatedAt: -1 }).lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_AUTOMATIONS)
        ? EmailMarketingAutomation.find({ workspaceId })
            .sort({ updatedAt: -1 })
            .limit(1000)
            .lean()
        : [],
      can(EMAIL_MARKETING_PERMISSIONS.VIEW_BILLING)
        ? ensureBillingAccount({
            workspaceId,
            actorUserId: req.user._id,
          })
        : null,
      can(EMAIL_MARKETING_PERMISSIONS.MANAGE_TEAM_ACCESS)
        ? teamSnapshot(workspaceId)
        : [],
    ]);

    let automationItems = automations;
    if (automations.length) {
      const executions = await EmailMarketingAutomationExecution.find({
        workspaceId,
        automationId: { $in: automations.map((automation) => automation._id) },
      })
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();
      const grouped = new Map();
      for (const execution of executions) {
        const key = String(execution.automationId);
        if (!grouped.has(key)) grouped.set(key, []);
        if (grouped.get(key).length < 100) grouped.get(key).push(execution);
      }
      automationItems = automations.map((automation) => ({
        ...automation,
        executions: grouped.get(String(automation._id)) || [],
      }));
    }

    let billingPayload = {
      creditBalance: 0,
      billingName: '',
      billingEmail: '',
      companyName: '',
      gstin: '',
      address: '',
      transactions: [],
    };
    if (billing) {
      const transactions = await EmailMarketingCreditTransaction.find({
        workspaceId,
        accountId: billing._id,
      })
        .sort({ createdAt: -1 })
        .limit(250)
        .lean();
      billingPayload = {
        ...billing.toObject(),
        transactions,
      };
    }

    return successResponse(res, 200, 'Email Marketing data synchronized', {
      state: toClient({
        subscribers,
        templates,
        segments,
        suppressions,
        campaigns: campaigns.map((campaign) => ({
          ...campaign,
          activity: [],
        })),
        domains,
        automations: automationItems,
        billing: billingPayload,
        teamUsers,
      }),
      permissions: req.emailMarketing.permissions,
      config: getPublicEmailMarketingConfig(),
      syncedAt: new Date(),
    });
  } catch (error) {
    return next(error);
  }
};
