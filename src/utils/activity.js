import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async ({ user, actionType, description, entityType, entityId, metadata = {} }) => {
  try {
    await ActivityLog.create({
      user,
      actionType,
      description,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    console.error('Activity log failed:', error.message);
  }
};
