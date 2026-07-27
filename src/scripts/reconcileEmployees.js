import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { reconcileMissingUserEmployees } from '../services/employeeUserReconciliationService.js';

const apply = process.argv.includes('--apply');

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const fallbackUser = await User.findOne({ role: { $regex: /^admin$/i } }).select('_id').lean();
  if (!fallbackUser) throw new Error('An admin user is required as the fallback creator');

  const results = await reconcileMissingUserEmployees(fallbackUser._id, {
    dryRun: !apply,
    batchSize: 500,
  });
  const summary = results.reduce((counts, result) => {
    counts[result.action] = (counts[result.action] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', summary }, null, 2));
} catch (error) {
  console.error(`Employee reconciliation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
