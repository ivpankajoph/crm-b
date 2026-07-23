import { errorResponse, successResponse } from '../../../utils/response.js';
import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingBillingAccount from '../models/EmailMarketingBillingAccount.js';
import EmailMarketingCreditTransaction from '../models/EmailMarketingCreditTransaction.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import {
  addPurchasedCredits,
  ensureBillingAccount,
} from '../services/billingService.js';

const getBillingPayload = async (req) => {
  const account = await ensureBillingAccount({
    workspaceId: req.emailMarketing.workspaceId,
    actorUserId: req.user._id,
  });
  const transactions = await EmailMarketingCreditTransaction.find({
    workspaceId: req.emailMarketing.workspaceId,
    accountId: account._id,
  })
    .sort({ createdAt: -1 })
    .limit(250)
    .lean();
  const config = getEmailMarketingConfig();
  return {
    account,
    transactions,
    config: {
      creditsEnforced: config.creditsEnforced,
      purchasesEnabled: config.creditPurchasesEnabled,
      currency: account.currency,
    },
  };
};

export const getBilling = async (req, res, next) => {
  try {
    return successResponse(
      res,
      200,
      'Email Marketing billing fetched successfully',
      await getBillingPayload(req),
    );
  } catch (error) {
    return next(error);
  }
};

export const updateBillingProfile = async (req, res, next) => {
  try {
    await ensureBillingAccount({
      workspaceId: req.emailMarketing.workspaceId,
      actorUserId: req.user._id,
    });
    const account = await EmailMarketingBillingAccount.findOneAndUpdate(
      { workspaceId: req.emailMarketing.workspaceId },
      {
        $set: {
          ...req.validated.body,
          updatedBy: req.user._id,
        },
      },
      { new: true, runValidators: true },
    );
    await recordEmailMarketingAudit({
      req,
      action: 'billing.profile_updated',
      resourceType: 'billing_account',
      resourceId: account._id,
      metadata: { fields: Object.keys(req.validated.body) },
    });
    return successResponse(
      res,
      200,
      'Billing profile updated successfully',
      await getBillingPayload(req),
    );
  } catch (error) {
    return next(error);
  }
};

export const purchaseCredits = async (req, res, next) => {
  try {
    const transaction = await addPurchasedCredits({
      workspaceId: req.emailMarketing.workspaceId,
      actorUserId: req.user._id,
      ...req.validated.body,
    });
    await recordEmailMarketingAudit({
      req,
      action: 'billing.credits_added',
      resourceType: 'credit_transaction',
      resourceId: transaction._id,
      metadata: {
        credits: req.validated.body.credits,
        amount: req.validated.body.amount,
      },
    });
    return successResponse(
      res,
      201,
      'Email credits added successfully',
      await getBillingPayload(req),
    );
  } catch (error) {
    return next(error);
  }
};

export const getCreditBalance = async (req, res, next) => {
  try {
    const account = await ensureBillingAccount({
      workspaceId: req.emailMarketing.workspaceId,
      actorUserId: req.user._id,
    });
    if (!account) return errorResponse(res, 404, 'Billing account not found');
    return successResponse(res, 200, 'Credit balance fetched successfully', {
      creditBalance: account.creditBalance,
      creditsUsed: account.creditsUsed,
      frozen: account.frozen,
      creditsEnforced: getEmailMarketingConfig().creditsEnforced,
    });
  } catch (error) {
    return next(error);
  }
};
