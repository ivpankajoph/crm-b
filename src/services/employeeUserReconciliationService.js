import Employee from '../models/Employee.js';
import User from '../models/User.js';

const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Employee',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '-',
  };
};

export const reconcileUserEmployee = async (user, fallbackCreatedBy, { dryRun = false } = {}) => {
  if (!user || /^admin$/i.test(user.role || '')) return { action: 'skipped' };
  const existing = await Employee.findOne({
    $or: [{ user: user._id }, { email: user.email }],
  });

  if (existing) {
    if (!existing.user && !dryRun) {
      existing.user = user._id;
      await existing.save();
      return { action: 'linked', employeeId: existing._id };
    }
    return { action: 'existing', employeeId: existing._id };
  }

  if (dryRun) return { action: 'would-create' };
  const { firstName, lastName } = splitName(user.name);
  const employee = await Employee.create({
    firstName,
    lastName,
    email: user.email,
    phone: user.phone || 'N/A',
    designation: user.role || 'Employee',
    department: user.role || 'General',
    joiningDate: user.createdAt || new Date(),
    status: user.status === 'inactive' ? 'Inactive' : 'Active',
    manager: user.parent || null,
    user: user._id,
    createdBy: user.createdBy || fallbackCreatedBy,
  });
  return { action: 'created', employeeId: employee._id };
};

export const reconcileMissingUserEmployees = async (fallbackCreatedBy, { dryRun = false, batchSize = 100 } = {}) => {
  const cursor = User.find({ isActive: true, role: { $not: /^admin$/i } })
    .select('name email phone role parent status createdAt createdBy')
    .sort({ _id: 1 })
    .lean()
    .cursor({ batchSize: Math.min(Math.max(batchSize, 1), 500) });
  const results = [];
  for await (const user of cursor) {
    results.push(await reconcileUserEmployee(user, fallbackCreatedBy, { dryRun }));
  }
  return results;
};
