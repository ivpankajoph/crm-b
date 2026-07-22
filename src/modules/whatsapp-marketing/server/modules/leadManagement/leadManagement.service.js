import {
  LeadAssignment,
  TeamHierarchy,
  ActivityLog,
  UserActivityStats,
  Contact,
  Chat,
  User
} from "../storage/mongodb.adapter.js";
import { SystemUser } from "../users/user.model.js";
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}
async function assignLead(data) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingAssignment = await LeadAssignment.findOne({
    contactId: data.contactId,
    status: { $in: ["assigned", "in_progress"] }
  });
  if (existingAssignment) {
    const previousAssignment = {
      userId: existingAssignment.assignedToUserId,
      userName: existingAssignment.assignedToUserName,
      assignedAt: existingAssignment.createdAt,
      unassignedAt: now,
      reason: "reassigned"
    };
    existingAssignment.previousAssignments = existingAssignment.previousAssignments || [];
    existingAssignment.previousAssignments.push(previousAssignment);
    existingAssignment.assignedToUserId = data.assignedToUserId;
    existingAssignment.assignedToUserName = data.assignedToUserName || "";
    existingAssignment.assignedByUserId = data.assignedByUserId;
    existingAssignment.assignedByUserName = data.assignedByUserName || "";
    existingAssignment.status = "reassigned";
    existingAssignment.updatedAt = now;
    if (data.priority) existingAssignment.priority = data.priority;
    if (data.notes) existingAssignment.notes = data.notes;
    await existingAssignment.save();
    await logActivity({
      userId: data.assignedByUserId,
      userName: data.assignedByUserName || "",
      actionType: "lead_reassigned",
      contactId: data.contactId,
      contactPhone: data.phone,
      contactName: data.contactName,
      leadAssignmentId: existingAssignment.id,
      metadata: {
        previousUserId: previousAssignment.userId,
        newUserId: data.assignedToUserId
      }
    });
    const updatedAssignment = await LeadAssignment.findOneAndUpdate(
      { id: existingAssignment.id },
      { $set: { status: "assigned" } },
      { new: true }
    );
    return updatedAssignment;
  }
  const assignment = new LeadAssignment({
    id: generateId("la"),
    contactId: data.contactId,
    chatId: data.chatId,
    phone: normalizePhone(data.phone),
    contactName: data.contactName || "",
    assignedToUserId: data.assignedToUserId,
    assignedToUserName: data.assignedToUserName || "",
    assignedByUserId: data.assignedByUserId,
    assignedByUserName: data.assignedByUserName || "",
    status: "assigned",
    priority: data.priority || "medium",
    notes: data.notes || "",
    slaDeadline: data.slaDeadline,
    previousAssignments: [],
    createdAt: now,
    updatedAt: now
  });
  await assignment.save();
  await logActivity({
    userId: data.assignedByUserId,
    userName: data.assignedByUserName || "",
    actionType: "lead_assigned",
    contactId: data.contactId,
    contactPhone: data.phone,
    contactName: data.contactName,
    leadAssignmentId: assignment.id,
    metadata: { assignedToUserId: data.assignedToUserId }
  });
  await updateUserActivityStats(data.assignedToUserId, "leadsAssigned");
  return assignment;
}
async function bulkAssignLeads(data) {
  const results = [];
  const assignedByUser = await SystemUser.findOne({ id: data.assignedByUserId });
  const assignedToUser = await SystemUser.findOne({ id: data.assignedToUserId });
  for (const contactId of data.contactIds) {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) continue;
    const chat = await Chat.findOne({ contactId });
    const assignment = await assignLead({
      contactId,
      chatId: chat?.id,
      phone: contact.phone,
      contactName: contact.name,
      assignedToUserId: data.assignedToUserId,
      assignedToUserName: assignedToUser?.name,
      assignedByUserId: data.assignedByUserId,
      assignedByUserName: assignedByUser?.name,
      priority: data.priority,
      notes: data.notes
    });
    results.push(assignment);
  }
  return results;
}
async function unassignLead(assignmentId, userId, reason) {
  const assignment = await LeadAssignment.findOne({ id: assignmentId });
  if (!assignment) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  assignment.previousAssignments = assignment.previousAssignments || [];
  assignment.previousAssignments.push({
    userId: assignment.assignedToUserId,
    userName: assignment.assignedToUserName,
    assignedAt: assignment.createdAt,
    unassignedAt: now,
    reason: reason || "unassigned"
  });
  assignment.status = "unassigned";
  assignment.updatedAt = now;
  await assignment.save();
  await logActivity({
    userId,
    actionType: "lead_reassigned",
    contactId: assignment.contactId,
    leadAssignmentId: assignmentId,
    metadata: { action: "unassigned", reason }
  });
  return assignment;
}
async function updateLeadStatus(assignmentId, status, userId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updateData = { status, updatedAt: now };
  if (status === "in_progress" && !await LeadAssignment.findOne({ id: assignmentId, firstResponseAt: { $exists: true } })) {
    updateData.firstResponseAt = now;
  }
  if (status === "completed") {
    updateData.resolvedAt = now;
    await updateUserActivityStats(userId, "leadsCompleted");
  }
  const assignment = await LeadAssignment.findOneAndUpdate(
    { id: assignmentId },
    { $set: updateData },
    { new: true }
  );
  if (assignment && status === "completed") {
    await logActivity({
      userId,
      actionType: "lead_completed",
      contactId: assignment.contactId,
      leadAssignmentId: assignmentId
    });
  }
  return assignment;
}
async function getLeadAssignment(contactId) {
  return LeadAssignment.findOne({
    contactId,
    status: { $in: ["assigned", "in_progress"] }
  }).lean();
}
async function getLeadAssignmentsByUser(userId, status) {
  const query = { assignedToUserId: userId };
  if (status) query.status = status;
  return LeadAssignment.find(query).sort({ createdAt: -1 }).lean();
}
async function getAllLeadAssignments(filters) {
  const query = {};
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query.status = { $in: filters.status };
    } else {
      query.status = filters.status;
    }
  }
  if (filters?.userId) query.assignedToUserId = filters.userId;
  if (filters?.contactId) {
    query.contactId = Array.isArray(filters.contactId) ? { $in: filters.contactId } : filters.contactId;
  }
  if (filters?.fromDate || filters?.toDate) {
    query.createdAt = {};
    if (filters.fromDate) query.createdAt.$gte = filters.fromDate;
    if (filters.toDate) query.createdAt.$lte = filters.toDate;
  }
  return LeadAssignment.find(query).sort({ createdAt: -1 }).lean();
}
async function getAssignableUsers() {
  const systemUsers = await SystemUser.find({
    isActive: true,
    role: { $in: ["sub_admin", "manager", "user"] }
  }).select("-password").lean();
  const registeredUsers = await User.find({
    role: { $exists: true, $in: ["sub_admin", "manager", "user"] }
  }).select("-password").lean();
  const seenIds = /* @__PURE__ */ new Set();
  const uniqueUsers = [];
  for (const user of systemUsers) {
    if (user.id && !seenIds.has(user.id)) {
      seenIds.add(user.id);
      uniqueUsers.push(user);
    }
  }
  for (const user of registeredUsers) {
    if (user.id && !seenIds.has(user.id) && user.role) {
      seenIds.add(user.id);
      uniqueUsers.push(user);
    }
  }
  return uniqueUsers;
}
async function getPermittedUserIds(context) {
  if (context.role === "super_admin" || context.role === "sub_admin") {
    return null;
  }
  if (context.role === "manager") {
    const teamHierarchy = await TeamHierarchy.findOne({ managerId: context.userId });
    const teamMemberIds = teamHierarchy?.teamMembers?.map((m) => m.userId) || [];
    return [context.userId, ...teamMemberIds];
  }
  return [context.userId];
}
async function getFilteredChatsForUser(context) {
  const permittedUserIds = await getPermittedUserIds(context);
  if (permittedUserIds === null) {
    return [];
  }
  const assignments = await LeadAssignment.find({
    assignedToUserId: { $in: permittedUserIds },
    status: { $in: ["assigned", "in_progress"] }
  }).select("contactId").lean();
  return assignments.map((a) => a.contactId);
}
async function setTeamHierarchy(managerId, managerName, teamMemberIds) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const teamMembers = await Promise.all(
    teamMemberIds.map(async (userId) => {
      const user = await SystemUser.findOne({ id: userId });
      return {
        userId,
        userName: user?.name || "",
        addedAt: now
      };
    })
  );
  const existing = await TeamHierarchy.findOne({ managerId });
  if (existing) {
    existing.teamMembers = teamMembers;
    existing.managerName = managerName;
    existing.updatedAt = now;
    await existing.save();
    return existing;
  }
  const hierarchy = new TeamHierarchy({
    id: generateId("th"),
    managerId,
    managerName,
    teamMembers,
    createdAt: now,
    updatedAt: now
  });
  await hierarchy.save();
  return hierarchy;
}
async function getTeamHierarchy(managerId) {
  return TeamHierarchy.findOne({ managerId }).lean();
}
async function getAllTeamHierarchies() {
  return TeamHierarchy.find({}).lean();
}
async function logActivity(data) {
  try {
    const log = new ActivityLog({
      id: generateId("al"),
      userId: data.userId,
      userName: data.userName || "",
      userRole: data.userRole || "",
      actionType: data.actionType,
      contactId: data.contactId,
      contactPhone: data.contactPhone,
      contactName: data.contactName,
      leadAssignmentId: data.leadAssignmentId,
      metadata: data.metadata || {},
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    await log.save();
  } catch (error) {
    console.error("[LeadManagement] Error logging activity:", error);
  }
}
async function logUserActivity(data) {
  await logActivity(data);
  if (data.actionType === "message_sent") {
    await updateUserActivityStats(data.userId, "messagesSent");
  } else if (data.actionType === "message_received") {
    await updateUserActivityStats(data.userId, "messagesReceived");
  }
}
async function updateUserActivityStats(userId, field) {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const user = await SystemUser.findOne({ id: userId });
    const existing = await UserActivityStats.findOne({ userId, date: today });
    if (existing) {
      await UserActivityStats.updateOne(
        { userId, date: today },
        {
          $inc: { [field]: 1 },
          $set: { updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
        }
      );
    } else {
      const stats = new UserActivityStats({
        id: generateId("uas"),
        userId,
        userName: user?.name || "",
        date: today,
        [field]: 1,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await stats.save();
    }
  } catch (error) {
    console.error("[LeadManagement] Error updating activity stats:", error);
  }
}
async function getLeadAssignmentReport(filters) {
  const matchStage = {};
  if (filters?.userId) matchStage.assignedToUserId = filters.userId;
  if (filters?.fromDate || filters?.toDate) {
    matchStage.createdAt = {};
    if (filters?.fromDate) matchStage.createdAt.$gte = filters.fromDate;
    if (filters?.toDate) matchStage.createdAt.$lte = filters.toDate;
  }
  const groupBy = filters?.groupBy || "user";
  let groupStage;
  switch (groupBy) {
    case "user":
      groupStage = {
        $group: {
          _id: "$assignedToUserId",
          userName: { $first: "$assignedToUserName" },
          totalAssigned: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          reassigned: { $sum: { $cond: [{ $eq: ["$status", "reassigned"] }, 1, 0] } }
        }
      };
      break;
    case "day":
      groupStage = {
        $group: {
          _id: { $substr: ["$createdAt", 0, 10] },
          totalAssigned: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      };
      break;
    case "status":
      groupStage = {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      };
      break;
    case "priority":
      groupStage = {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      };
      break;
  }
  const pipeline = [
    { $match: matchStage },
    groupStage,
    { $sort: { totalAssigned: -1, count: -1, _id: 1 } }
  ];
  const results = await LeadAssignment.aggregate(pipeline);
  const summary = await LeadAssignment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        reassigned: { $sum: { $cond: [{ $eq: ["$status", "reassigned"] }, 1, 0] } },
        unassigned: { $sum: { $cond: [{ $eq: ["$status", "unassigned"] }, 1, 0] } }
      }
    }
  ]);
  return {
    data: results,
    summary: summary[0] || { total: 0, assigned: 0, inProgress: 0, completed: 0, reassigned: 0, unassigned: 0 }
  };
}
async function getUserActivityReport(filters) {
  const matchStage = {};
  if (filters?.userId) matchStage.userId = filters.userId;
  if (filters?.fromDate || filters?.toDate) {
    matchStage.date = {};
    if (filters?.fromDate) matchStage.date.$gte = filters.fromDate;
    if (filters?.toDate) matchStage.date.$lte = filters.toDate;
  }
  const stats = await UserActivityStats.find(matchStage).sort({ date: -1 }).lean();
  const userSummary = await UserActivityStats.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
        userName: { $first: "$userName" },
        totalMessagesSent: { $sum: "$messagesSent" },
        totalMessagesReceived: { $sum: "$messagesReceived" },
        totalLeadsAssigned: { $sum: "$leadsAssigned" },
        totalLeadsCompleted: { $sum: "$leadsCompleted" },
        avgResponseTime: { $avg: "$avgResponseTimeMinutes" },
        daysActive: { $sum: 1 }
      }
    },
    { $sort: { totalLeadsCompleted: -1 } }
  ]);
  const activityLogs = await ActivityLog.find(matchStage.userId ? { userId: matchStage.userId } : {}).sort({ timestamp: -1 }).limit(100).lean();
  return {
    dailyStats: stats,
    userSummary,
    recentActivity: activityLogs
  };
}
async function getWorkloadDistribution() {
  const activeAssignments = await LeadAssignment.aggregate([
    { $match: { status: { $in: ["assigned", "in_progress"] } } },
    {
      $group: {
        _id: "$assignedToUserId",
        userName: { $first: "$assignedToUserName" },
        activeLeads: { $sum: 1 },
        highPriority: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        urgentPriority: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } }
      }
    },
    { $sort: { activeLeads: -1 } }
  ]);
  return activeAssignments;
}
export {
  assignLead,
  bulkAssignLeads,
  getAllLeadAssignments,
  getAllTeamHierarchies,
  getAssignableUsers,
  getFilteredChatsForUser,
  getLeadAssignment,
  getLeadAssignmentReport,
  getLeadAssignmentsByUser,
  getPermittedUserIds,
  getTeamHierarchy,
  getUserActivityReport,
  getWorkloadDistribution,
  logUserActivity,
  setTeamHierarchy,
  unassignLead,
  updateLeadStatus
};
