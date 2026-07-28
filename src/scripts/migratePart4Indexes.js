import 'dotenv/config';
import mongoose from 'mongoose';
import { summarizeExplain } from '../utils/queryDiagnostics.js';

const sameKey = (left, right) => JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));

const candidates = [
  { collection: 'notifications', name: 'notification_user_createdAt', key: { user: 1, createdAt: -1 }, sampleField: 'user', sort: { createdAt: -1 } },
  { collection: 'notes', name: 'note_owner_sticky_createdAt', key: { createdBy: 1, isSticky: 1, createdAt: -1 }, sampleField: 'createdBy', fixed: { isSticky: false }, sort: { createdAt: -1 } },
  { collection: 'tasks', name: 'task_owner_status_dueDate', key: { createdBy: 1, status: 1, dueDate: 1 }, sampleField: 'createdBy', fixed: { status: 'Todo' }, sort: { dueDate: 1 } },
  { collection: 'events', name: 'event_type_status_createdAt', key: { type: 1, status: 1, createdAt: -1 }, fixed: { type: 'Meeting', status: 'Scheduled' }, sort: { createdAt: -1 } },
  { collection: 'messages', name: 'message_sender_recipient_createdAt', key: { sender: 1, recipient: 1, createdAt: -1 }, sampleFields: ['sender', 'recipient'], sort: { createdAt: -1 } },
  { collection: 'messages', name: 'message_recipient_sender_createdAt', key: { recipient: 1, sender: 1, createdAt: -1 }, sampleFields: ['recipient', 'sender'], sort: { createdAt: -1 } },
  { collection: 'employees', name: 'employee_manager_status', key: { manager: 1, status: 1 }, sampleField: 'manager', fixed: { status: 'Active' } },
  { collection: 'leadstatushistories', name: 'lead_history_changedBy_status_changedAt', key: { changedBy: 1, newStatus: 1, changedAt: 1 }, sampleField: 'changedBy', fixed: { newStatus: 'Converted' }, sort: { changedAt: 1 } },
  { collection: 'customers', name: 'customer_createdBy_createdAt', key: { createdBy: 1, createdAt: -1 }, sampleField: 'createdBy', sort: { createdAt: -1 } },
  { collection: 'customers', name: 'customer_assignedTo_createdAt', key: { assignedTo: 1, createdAt: -1 }, sampleField: 'assignedTo', sort: { createdAt: -1 } },
  { collection: 'customers', name: 'customer_leadStatus_createdAt', key: { leadStatus: 1, createdAt: 1 }, fixed: { leadStatus: 'New' }, sort: { createdAt: 1 } },
  { collection: 'companies', name: 'company_createdBy_createdAt', key: { createdBy: 1, createdAt: -1 }, sampleField: 'createdBy', sort: { createdAt: -1 } },
  { collection: 'companies', name: 'company_assignedTo_createdAt', key: { assignedTo: 1, createdAt: -1 }, sampleField: 'assignedTo', sort: { createdAt: -1 } },
  { collection: 'companies', name: 'company_leadStatus_createdAt', key: { leadStatus: 1, createdAt: 1 }, fixed: { leadStatus: 'New' }, sort: { createdAt: 1 } },
  { collection: 'attendances', name: 'attendance_date_user', key: { date: -1, user: 1 }, sort: { date: -1 } },
];

const buildRepresentativeFilter = async (collection, candidate) => {
  const projection = {};
  for (const field of [candidate.sampleField, ...(candidate.sampleFields || [])].filter(Boolean)) projection[field] = 1;
  const sample = Object.keys(projection).length
    ? await collection.findOne(Object.fromEntries(Object.keys(projection).map((field) => [field, { $ne: null }])), { projection })
    : null;
  const filter = { ...(candidate.fixed || {}) };
  if (candidate.sampleField && sample?.[candidate.sampleField] != null) {
    const value = sample[candidate.sampleField];
    filter[candidate.sampleField] = Array.isArray(value) ? value[0] : value;
  }
  for (const field of candidate.sampleFields || []) {
    if (sample?.[field] != null) filter[field] = sample[field];
  }
  return filter;
};

const explain = async (collection, filter, sort = {}) => {
  const result = await collection.find(filter).sort(sort).limit(50).explain('executionStats');
  return summarizeExplain(result);
};

const apply = process.argv.includes('--apply');

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const report = [];
  for (const candidate of candidates) {
    const collection = mongoose.connection.db.collection(candidate.collection);
    const indexes = await collection.indexes();
    const existing = indexes.find((index) => sameKey(index.key, candidate.key));
    const filter = await buildRepresentativeFilter(collection, candidate);
    const before = await explain(collection, filter, candidate.sort);
    let action = existing ? `already-present:${existing.name}` : 'dry-run';
    let after = before;
    if (apply && !existing) {
      await collection.createIndex(candidate.key, { name: candidate.name });
      action = 'created';
      after = await explain(collection, filter, candidate.sort);
    }
    report.push({ collection: candidate.collection, index: candidate.name, action, filterFields: Object.keys(filter), before, after });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', indexes: report }, null, 2));
} catch (error) {
  console.error(`Part 4 index migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
