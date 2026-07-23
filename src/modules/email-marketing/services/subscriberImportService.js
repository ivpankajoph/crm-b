import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import EmailMarketingImport from '../models/EmailMarketingImport.js';
import EmailMarketingSubscriber from '../models/EmailMarketingSubscriber.js';
import EmailMarketingSuppression from '../models/EmailMarketingSuppression.js';
import { normalizeImportedSubscriber } from '../utils/csv.js';

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validStatuses = new Set(['subscribed', 'unsubscribed', 'suppressed']);

const normalizeTags = (tags = []) =>
  Array.from(
    new Set(
      tags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
        .slice(0, 50),
    ),
  );

export const importSubscriberRows = async ({
  req,
  rows,
  fileName = '',
  source = 'json',
  updateExisting = false,
}) => {
  const { maxImportRows } = getEmailMarketingConfig();
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('Import contains no subscriber rows');
    error.statusCode = 400;
    throw error;
  }
  if (rows.length > maxImportRows) {
    const error = new Error(`Import cannot exceed ${maxImportRows} rows`);
    error.statusCode = 413;
    throw error;
  }

  const importRecord = await EmailMarketingImport.create({
    workspaceId: req.emailMarketing.workspaceId,
    fileName,
    source,
    status: 'processing',
    totalRows: rows.length,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  try {
    const errors = [];
    const seen = new Set();
    const normalizedRows = [];

    rows.forEach((rawRow, index) => {
      const row = normalizeImportedSubscriber(rawRow);
      if (!validEmail.test(row.email)) {
        errors.push({ row: index + 2, message: 'Invalid or missing email' });
        return;
      }
      if (seen.has(row.email)) {
        errors.push({ row: index + 2, message: 'Duplicate email in import' });
        return;
      }
      seen.add(row.email);
      normalizedRows.push({
        ...row,
        status: validStatuses.has(row.status) ? row.status : 'subscribed',
        tags: normalizeTags(row.tags),
      });
    });

    const emails = normalizedRows.map((row) => row.email);
    const [existingSubscribers, activeSuppressions] = await Promise.all([
      EmailMarketingSubscriber.find({
        workspaceId: req.emailMarketing.workspaceId,
        email: { $in: emails },
      })
        .select('email')
        .lean(),
      EmailMarketingSuppression.find({
        workspaceId: req.emailMarketing.workspaceId,
        email: { $in: emails },
        status: 'active',
      })
        .select('email')
        .lean(),
    ]);

    const existingEmails = new Set(
      existingSubscribers.map((subscriber) => subscriber.email),
    );
    const suppressedEmails = new Set(
      activeSuppressions.map((suppression) => suppression.email),
    );
    const operations = [];
    let skipped = errors.length;

    normalizedRows.forEach((row) => {
      const exists = existingEmails.has(row.email);
      if (exists && !updateExisting) {
        skipped += 1;
        return;
      }

      const suppressed = suppressedEmails.has(row.email);
      const data = {
        firstName: row.firstName.slice(0, 120),
        lastName: row.lastName.slice(0, 120),
        phone: row.phone.slice(0, 40),
        source: row.source.slice(0, 120) || 'csv_import',
        tags: row.tags,
        notes: row.notes.slice(0, 5000),
        status: suppressed ? 'suppressed' : row.status,
        blocked: suppressed || row.status === 'suppressed',
        updatedBy: req.user._id,
      };

      operations.push({
        updateOne: {
          filter: {
            workspaceId: req.emailMarketing.workspaceId,
            email: row.email,
          },
          update: updateExisting
            ? {
                $set: data,
                $setOnInsert: {
                  workspaceId: req.emailMarketing.workspaceId,
                  email: row.email,
                  createdBy: req.user._id,
                },
              }
            : {
                $setOnInsert: {
                  ...data,
                  workspaceId: req.emailMarketing.workspaceId,
                  email: row.email,
                  createdBy: req.user._id,
                },
              },
          upsert: true,
        },
      });
    });

    const result = operations.length
      ? await EmailMarketingSubscriber.bulkWrite(operations, { ordered: false })
      : { upsertedCount: 0, modifiedCount: 0 };
    const added = result.upsertedCount || 0;
    const updated = updateExisting ? result.modifiedCount || 0 : 0;

    importRecord.status = 'completed';
    importRecord.added = added;
    importRecord.updated = updated;
    importRecord.skipped = skipped;
    importRecord.rowErrors = errors.slice(0, 100);
    importRecord.updatedBy = req.user._id;
    await importRecord.save();

    return importRecord;
  } catch (error) {
    importRecord.status = 'failed';
    importRecord.rowErrors = [{ row: 0, message: error.message }];
    importRecord.updatedBy = req.user._id;
    await importRecord.save();
    throw error;
  }
};
