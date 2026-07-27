import 'dotenv/config';
import mongoose from 'mongoose';

const definitions = [
  ['companies', { createdBy: 1, assignedTo: 1, leadStatus: 1, createdAt: -1 }],
  ['companies', { assignedTo: 1, createdAt: -1, leadStatus: 1 }],
  ['companies', { createdAt: -1, leadStatus: 1 }],
  ['companies', { scheduledDateTime: 1, followTypeDate: 1 }],
  ['customers', { createdBy: 1, assignedTo: 1, leadStatus: 1, createdAt: -1 }],
  ['customers', { assignedTo: 1, createdAt: -1, leadStatus: 1 }],
  ['customers', { createdAt: -1, leadStatus: 1 }],
  ['customers', { scheduledDateTime: 1 }],
  ['employees', { status: 1, department: 1, createdAt: -1 }],
  ['employees', { manager: 1, status: 1, createdAt: -1 }],
  ['employees', { createdAt: -1 }],
  ['users', { parent: 1 }],
  ['users', { role: 1, status: 1 }],
  ['users', { createdAt: -1 }],
  ['events', { createdBy: 1, date: -1 }],
  ['events', { createdBy: 1, status: 1, date: -1 }],
  ['events', { participant: 1, date: -1 }],
  ['tasks', { createdBy: 1, dueDate: 1 }],
  ['tasks', { createdBy: 1, status: 1, createdAt: -1 }],
  ['tasks', { createdBy: 1, createdAt: -1 }],
  ['notes', { createdBy: 1, isSticky: 1, createdAt: -1 }],
  ['notifications', { user: 1, createdAt: -1 }],
  ['notifications', { user: 1, isRead: 1, createdAt: -1 }],
];

const sameKey = (left, right) => JSON.stringify(Object.entries(left)) === JSON.stringify(Object.entries(right));

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  for (const [collectionName, key] of definitions) {
    const collection = mongoose.connection.db.collection(collectionName);
    const existing = (await collection.indexes()).find((index) => sameKey(index.key, key));
    if (existing) {
      console.log(`Index already present: ${collectionName}.${existing.name}`);
    } else {
      const name = `part3_${collectionName}_${Object.keys(key).join('_')}`;
      await collection.createIndex(key, { name });
      console.log(`Index created: ${collectionName}.${name}`);
    }
  }
} catch (error) {
  console.error(`Part 3 index creation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
