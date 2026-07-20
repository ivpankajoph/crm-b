import mongoose from 'mongoose';
import User from '../models/User.js';

export const ADMIN_ROLES = new Set(['admin']);

export const normalizeRole = (role = '') => role.toString().trim().toLowerCase().replace(/\s+/g, '_');

export const isAdminUser = (user) => ADMIN_ROLES.has(normalizeRole(user?.role));

export const getDownlineUserIds = async (userId) => {
  const rootId = new mongoose.Types.ObjectId(userId);
  const descendants = await User.aggregate([
    { $match: { _id: rootId } },
    {
      $graphLookup: {
        from: 'users',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent',
        as: 'downline',
        restrictSearchWithMatch: { isActive: true },
      },
    },
    {
      $project: {
        ids: {
          $concatArrays: [['$_id'], '$downline._id'],
        },
      },
    },
  ]);

  return descendants[0]?.ids || [rootId];
};

export const getVisibleUserIds = async (user) => {
  if (isAdminUser(user)) {
    const users = await User.find({ isActive: true }).select('_id').lean();
    return users.map((u) => u._id);
  }

  return getDownlineUserIds(user._id);
};

export const buildOwnershipQuery = (userIds) => ({
  $or: [{ createdBy: { $in: userIds } }, { assignedTo: { $in: userIds } }],
});
