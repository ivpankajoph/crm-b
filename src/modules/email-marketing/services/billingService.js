import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingBillingAccount from '../models/EmailMarketingBillingAccount.js';
import EmailMarketingCreditTransaction from '../models/EmailMarketingCreditTransaction.js';

const httpError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

export const ensureBillingAccount = async ({
  workspaceId,
  actorUserId,
}) => {
  const config = getEmailMarketingConfig();
  return EmailMarketingBillingAccount.findOneAndUpdate(
    { workspaceId },
    {
      $setOnInsert: {
        workspaceId,
        creditBalance: config.initialCredits,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
};

const createTransaction = async ({
  account,
  actorUserId,
  type,
  credits,
  amount = 0,
  balanceBefore,
  balanceAfter,
  description,
  sourceType = '',
  sourceId = '',
  idempotencyKey = '',
  metadata = {},
}) =>
  EmailMarketingCreditTransaction.create({
    workspaceId: account.workspaceId,
    accountId: account._id,
    type,
    credits,
    amount,
    currency: account.currency,
    balanceBefore,
    balanceAfter,
    description,
    sourceType,
    sourceId: String(sourceId || ''),
    idempotencyKey,
    metadata,
    createdBy: actorUserId,
    updatedBy: actorUserId,
  });

export const debitEmailCredits = async ({
  workspaceId,
  actorUserId,
  credits = 1,
  type,
  sourceType,
  sourceId,
  idempotencyKey,
  description,
}) => {
  if (!getEmailMarketingConfig().creditsEnforced) return null;

  if (idempotencyKey) {
    const existing = await EmailMarketingCreditTransaction.findOne({
      workspaceId,
      idempotencyKey,
    }).lean();
    if (existing) return { transaction: existing, duplicate: true };
  }

  const account = await ensureBillingAccount({ workspaceId, actorUserId });
  if (account.frozen) throw httpError(403, 'Email credit wallet is frozen');
  const updated = await EmailMarketingBillingAccount.findOneAndUpdate(
    {
      _id: account._id,
      workspaceId,
      frozen: false,
      creditBalance: { $gte: credits },
    },
    {
      $inc: { creditBalance: -credits, creditsUsed: credits },
      $set: { updatedBy: actorUserId },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw httpError(402, 'Insufficient email credits');

  const balanceAfter = updated.creditBalance;
  try {
    const transaction = await createTransaction({
      account: updated,
      actorUserId,
      type,
      credits: -credits,
      balanceBefore: balanceAfter + credits,
      balanceAfter,
      description,
      sourceType,
      sourceId,
      idempotencyKey,
    });
    return { transaction, account: updated, duplicate: false };
  } catch (error) {
    await EmailMarketingBillingAccount.updateOne(
      { _id: updated._id, workspaceId },
      {
        $inc: { creditBalance: credits, creditsUsed: -credits },
        $set: { updatedBy: actorUserId },
      },
    );
    if (error.code === 11000) {
      const transaction = await EmailMarketingCreditTransaction.findOne({
        workspaceId,
        idempotencyKey,
      }).lean();
      return { transaction, duplicate: true };
    }
    throw error;
  }
};

export const refundEmailCredits = async ({
  debit,
  actorUserId,
  description,
}) => {
  if (!debit?.transaction || debit.duplicate) return null;
  const transaction = debit.transaction;
  const credits = Math.abs(transaction.credits);
  const refundKey = `refund:${transaction._id}`;
  const existing = await EmailMarketingCreditTransaction.findOne({
    workspaceId: transaction.workspaceId,
    idempotencyKey: refundKey,
  }).lean();
  if (existing) return existing;

  const account = await EmailMarketingBillingAccount.findOneAndUpdate(
    { _id: transaction.accountId, workspaceId: transaction.workspaceId },
    {
      $inc: { creditBalance: credits, creditsUsed: -credits },
      $set: { updatedBy: actorUserId },
    },
    { new: true, runValidators: true },
  );
  return createTransaction({
    account,
    actorUserId,
    type: 'refund',
    credits,
    balanceBefore: account.creditBalance - credits,
    balanceAfter: account.creditBalance,
    description,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    idempotencyKey: refundKey,
    metadata: { originalTransactionId: transaction._id },
  });
};

export const addPurchasedCredits = async ({
  workspaceId,
  actorUserId,
  credits,
  amount,
  idempotencyKey,
}) => {
  if (!getEmailMarketingConfig().creditPurchasesEnabled) {
    throw httpError(
      503,
      'Credit purchases are disabled until a payment gateway is configured',
    );
  }
  const allowedPackages = new Map([
    [5_000, 499],
    [25_000, 1_999],
    [100_000, 6_999],
  ]);
  if (allowedPackages.get(credits) !== amount) {
    throw httpError(400, 'Select a valid server-priced credit package');
  }
  const existing = await EmailMarketingCreditTransaction.findOne({
    workspaceId,
    idempotencyKey,
  }).lean();
  if (existing) return existing;

  const account = await ensureBillingAccount({ workspaceId, actorUserId });
  const updated = await EmailMarketingBillingAccount.findOneAndUpdate(
    { _id: account._id, workspaceId, frozen: false },
    {
      $inc: { creditBalance: credits },
      $set: { updatedBy: actorUserId },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw httpError(403, 'Email credit wallet is frozen');

  try {
    return await createTransaction({
      account: updated,
      actorUserId,
      type: 'purchase',
      credits,
      amount,
      balanceBefore: updated.creditBalance - credits,
      balanceAfter: updated.creditBalance,
      description: `${credits.toLocaleString('en-IN')} email credits`,
      sourceType: 'manual_purchase',
      idempotencyKey,
    });
  } catch (error) {
    await EmailMarketingBillingAccount.updateOne(
      { _id: updated._id, workspaceId },
      { $inc: { creditBalance: -credits } },
    );
    if (error.code === 11000) {
      return EmailMarketingCreditTransaction.findOne({
        workspaceId,
        idempotencyKey,
      });
    }
    throw error;
  }
};
