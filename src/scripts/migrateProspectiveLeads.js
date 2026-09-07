import 'dotenv/config';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import LeadStatusHistory from '../models/LeadStatusHistory.js';
import { invalidateLeadMetricsCaches } from '../services/cacheService.js';

const apply = process.argv.includes('--apply');

const countProspective = async () => {
  const [
    companies,
    customers,
    leads,
    companyDetails,
    customerDetails,
    companyComments,
    customerComments,
    leadComments,
    historyOld,
    historyNew,
  ] = await Promise.all([
    Company.countDocuments({ leadStatus: 'Prospective' }),
    Customer.countDocuments({ leadStatus: 'Prospective' }),
    Lead.countDocuments({ status: 'Prospective' }),
    Company.collection.countDocuments({ 'statusDetails.status': 'Prospective' }),
    Customer.collection.countDocuments({ 'statusDetails.status': 'Prospective' }),
    Company.collection.countDocuments({ 'comments.status': 'Prospective' }),
    Customer.collection.countDocuments({ 'comments.status': 'Prospective' }),
    Lead.collection.countDocuments({ 'comments.status': 'Prospective' }),
    LeadStatusHistory.countDocuments({ oldStatus: 'Prospective' }),
    LeadStatusHistory.countDocuments({ newStatus: 'Prospective' }),
  ]);
  return {
    companies,
    customers,
    leads,
    companyDetails,
    customerDetails,
    companyComments,
    customerComments,
    leadComments,
    historyOld,
    historyNew,
  };
};

try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  const before = await countProspective();

  if (apply) {
    await Promise.all([
      Company.collection.updateMany({ leadStatus: 'Prospective' }, { $set: { leadStatus: 'Interested' } }),
      Customer.collection.updateMany({ leadStatus: 'Prospective' }, { $set: { leadStatus: 'Interested' } }),
      Lead.collection.updateMany({ status: 'Prospective' }, { $set: { status: 'Interested' } }),
      Company.collection.updateMany({ 'statusDetails.status': 'Prospective' }, { $set: { 'statusDetails.status': 'Interested' } }),
      Customer.collection.updateMany({ 'statusDetails.status': 'Prospective' }, { $set: { 'statusDetails.status': 'Interested' } }),
      LeadStatusHistory.collection.updateMany({ oldStatus: 'Prospective' }, { $set: { oldStatus: 'Interested' } }),
      LeadStatusHistory.collection.updateMany({ newStatus: 'Prospective' }, { $set: { newStatus: 'Interested' } }),
      Company.collection.updateMany(
        { 'comments.status': 'Prospective' },
        { $set: { 'comments.$[comment].status': 'Interested' } },
        { arrayFilters: [{ 'comment.status': 'Prospective' }] },
      ),
      Customer.collection.updateMany(
        { 'comments.status': 'Prospective' },
        { $set: { 'comments.$[comment].status': 'Interested' } },
        { arrayFilters: [{ 'comment.status': 'Prospective' }] },
      ),
      Lead.collection.updateMany(
        { 'comments.status': 'Prospective' },
        { $set: { 'comments.$[comment].status': 'Interested' } },
        { arrayFilters: [{ 'comment.status': 'Prospective' }] },
      ),
    ]);
    await invalidateLeadMetricsCaches();
  }

  const after = apply ? await countProspective() : before;
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before, after }, null, 2));
} catch (error) {
  console.error(`Prospective lead migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  process.exit(process.exitCode || 0);
}
