import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import UrlCache from '../models/UrlCache.js';

try {
  await connectDB();
  await UrlCache.collection.createIndex(
    { domain: 1 },
    { unique: true, name: 'domain_1' },
  );
  await UrlCache.collection.createIndex(
    { cachedAt: 1 },
    { expireAfterSeconds: 15 * 24 * 60 * 60, name: 'cachedAt_1' },
  );
  console.log('URL enrichment cache indexes are ready');
} catch (error) {
  console.error(`Failed to create URL cache indexes: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

