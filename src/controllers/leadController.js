import Lead from '../models/Lead.js';
import Customer from '../models/Customer.js';
import Company from '../models/Company.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import CallLog from '../models/CallLog.js';
import LeadStatusHistory from '../models/LeadStatusHistory.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getDownlineUserIds, isAdminUser, normalizeRole } from '../utils/hierarchy.js';
import { logActivity } from '../utils/activity.js';
import Setting from '../models/Setting.js';
import { createPlivoBridge, prepareBrowserCall } from './telephonyController.js';
import { normalizePhone } from '../services/plivoService.js';

const STATUS_ALIASES = {
  demo_scheduled: 'Demo Scheduled',
  followup: 'Follow Up',
  follow_up: 'Follow Up',
  prospective: 'Prospective',
  committed: 'Committed',
  converted: 'Converted',
  not_interested: 'Not Interested',
};

const TRACKED_STATUSES = ['Demo Scheduled', 'Follow Up', 'Prospective', 'Committed', 'Converted', 'Not Interested'];

const normalizeStatus = (status) => STATUS_ALIASES[status?.toString().trim().toLowerCase()] || status;

const getLeadModel = (type) => {
  if (type === 'Customer') return Customer;
  if (type === 'Company') return Company;
  if (type === 'Lead') return Lead;
  return null;
};

const getLeadStatusField = (type) => (type === 'Lead' ? 'status' : 'leadStatus');

const getLeadName = (lead) => lead.companyName || lead.name || lead.customerName || 'lead';

const buildLeadVisibilityQuery = (user) => (isAdminUser(user) ? {} : { assignedTo: user._id });

const normalizeAssignees = (assignedTo) => {
  if (!assignedTo) return [];
  return Array.isArray(assignedTo) ? assignedTo.filter(Boolean) : [assignedTo];
};

const assigneeNames = (assignedTo) => {
  const assignees = normalizeAssignees(assignedTo);
  if (assignees.length === 0) return '---';
  return assignees.map((user) => user?.name || 'Unknown').join(', ');
};

const ensureAssigneeArray = async (Model, lead) => {
  await Model.updateOne(
    { _id: lead._id },
    { $set: { assignedTo: normalizeAssignees(lead.assignedTo) } }
  );
};

const canAssignToTeam = (user) => {
  const role = normalizeRole(user?.role);
  return role === 'team_leader' || role === 'team_manager';
};

const isTeamLeaderRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'team_leader' || normalizedRole === 'team_manager';
};

const isEmployeeRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'employee' || normalizedRole === 'team_member' || normalizedRole === 'user';
};

const getAssignableUserIds = async (user) => {
  if (isAdminUser(user)) {
    const users = await User.find({ isActive: true })
      .select('_id role')
      .lean();
    return users.filter((item) => isTeamLeaderRole(item.role)).map((item) => item._id);
  }

  if (!canAssignToTeam(user)) {
    return [];
  }

  const downlineIds = await getDownlineUserIds(user._id);
  const managedEmployees = await Employee.find({ manager: user._id, status: { $ne: 'Inactive' } })
    .select('email')
    .lean();
  const managedEmployeeEmails = managedEmployees.map((employee) => employee.email).filter(Boolean);
  const users = await User.find({
    $or: [
      { _id: { $in: downlineIds.filter((id) => id.toString() !== user._id.toString()) } },
      { email: { $in: managedEmployeeEmails } },
    ],
    isActive: true,
  })
    .select('_id role')
    .lean();

  return users.filter((item) => isEmployeeRole(item.role)).map((item) => item._id);
};

const getVisibleAssigneeIds = async (user) => {
  if (isAdminUser(user)) {
    const users = await User.find({ isActive: true }).select('_id').lean();
    return users.map((item) => item._id);
  }

  const downlineIds = await getDownlineUserIds(user._id);
  return downlineIds;
};

const assertCanAssignToUser = async (user, assignedTo) => {
  if (!assignedTo) return false;
  const assignableIds = await getAssignableUserIds(user);
  return assignableIds.some((id) => id.toString() === assignedTo.toString());
};

const findUnifiedLeadForUser = async (type, id, user, populate = false) => {
  const Model = getLeadModel(type);
  if (!Model) return null;

  const query = { _id: id, ...buildLeadVisibilityQuery(user) };

  let dbQuery = Model.findOne(query);
  if (populate) {
    dbQuery = dbQuery
      .populate('createdBy', 'name role email')
      .populate('assignedTo', 'name role email')
      .populate('comments.createdBy', 'name');
  }

  return dbQuery;
};

const dateRangeForToday = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const analyzeTranscript = (transcriptText = '') => {
  const transcript = transcriptText.trim();
  if (!transcript) {
    return {
      aiSummary: 'Recording received. Transcript is not available yet.',
      aiQualityScore: 5,
      aiSentiment: 'neutral',
      aiSuggestion: 'Add manual notes after reviewing the recording.',
      keyPoints: [],
    };
  }

  const positiveWords = ['yes', 'interested', 'good', 'demo', 'budget', 'approved', 'buy', 'converted'];
  const negativeWords = ['no', 'not interested', 'expensive', 'later', 'busy', 'reject'];
  const lower = transcript.toLowerCase();
  const positiveScore = positiveWords.filter((word) => lower.includes(word)).length;
  const negativeScore = negativeWords.filter((word) => lower.includes(word)).length;
  const aiSentiment = positiveScore > negativeScore ? 'positive' : negativeScore > positiveScore ? 'negative' : 'neutral';
  const aiQualityScore = Math.max(1, Math.min(10, 5 + positiveScore - negativeScore));

  return {
    aiSummary: transcript.length > 220 ? `${transcript.slice(0, 220)}...` : transcript,
    aiQualityScore,
    aiSentiment,
    aiSuggestion: aiSentiment === 'positive'
      ? 'Schedule the next step quickly and confirm decision maker availability.'
      : aiSentiment === 'negative'
        ? 'Capture the objection, send a concise value proof, and set a low-pressure follow-up.'
        : 'Clarify pain points, timeline, budget, and next action in the next conversation.',
    keyPoints: transcript.split(/[.!?]/).map((item) => item.trim()).filter(Boolean).slice(0, 5),
  };
};

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
export const getLeads = async (req, res, next) => {
  try {
    const query = buildLeadVisibilityQuery(req.user);

    const leads = await Lead.find(query)
      .populate('createdBy', 'name role email')
      .populate('assignedTo', 'name role email')
      .sort({ createdAt: -1 });
    
    return successResponse(res, 200, 'Leads fetched successfully', leads);
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead statistics
// @route   GET /api/leads/stats
// @access  Private
export const getLeadStats = async (req, res, next) => {
  try {
    const { period = 'today', startDate: startDateParam, endDate: endDateParam, month, year } = req.query;
    let matchStage = buildLeadVisibilityQuery(req.user);

    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);

    const applyDateRange = (start, end) => {
      if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return false;
      }
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
      return true;
    };

    if (period === 'today') {
      applyDateRange(startDate, endDate);
    } else if (period === 'date') {
      if (!startDateParam || !endDateParam) {
        return errorResponse(res, 400, 'Start date and end date are required');
      }
      applyDateRange(new Date(startDateParam), new Date(endDateParam));
    } else if (period === 'month') {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return errorResponse(res, 400, 'Month is required');
      }
      const [selectedYear, selectedMonth] = month.split('-').map(Number);
      startDate = new Date(selectedYear, selectedMonth - 1, 1);
      endDate = new Date(selectedYear, selectedMonth, 0);
      applyDateRange(startDate, endDate);
    } else if (period === 'year') {
      const selectedYear = Number(year);
      if (!selectedYear || selectedYear < 1900) {
        return errorResponse(res, 400, 'Year is required');
      }
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31);
      applyDateRange(startDate, endDate);
    }

    const defaultStats = {
      totalLeads: 0,
      demoScheduled: 0,
      interested: 0,
      notInterested: 0,
      prospective: 0,
      committed: 0,
      converted: 0,
      followUp: 0,
      today: {
        demoScheduled: 0,
        followUp: 0,
        prospective: 0,
        committed: 0,
        converted: 0,
        notInterested: 0,
      },
    };

    let resultStats = { ...defaultStats };

    const countByStatus = async (status) => {
      const [customerCount, companyCount] = await Promise.all([
        Customer.countDocuments({ ...matchStage, leadStatus: status }),
        Company.countDocuments({ ...matchStage, leadStatus: status }),
      ]);
      return customerCount + companyCount;
    };

    const [
      customerCount,
      companyCount,
      demoScheduled,
      interested,
      notInterested,
      prospective,
      committed,
      converted,
      followUp,
    ] = await Promise.all([
      Customer.countDocuments(matchStage),
      Company.countDocuments(matchStage),
      countByStatus('Demo Scheduled'),
      countByStatus('Interested'),
      countByStatus('Not Interested'),
      countByStatus('Prospective'),
      countByStatus('Committed'),
      countByStatus('Converted'),
      countByStatus('Follow Up'),
    ]);

    resultStats.totalLeads = customerCount + companyCount;
    resultStats.demoScheduled = demoScheduled;
    resultStats.interested = interested;
    resultStats.notInterested = notInterested;
    resultStats.prospective = prospective;
    resultStats.committed = committed;
    resultStats.converted = converted;
    resultStats.followUp = followUp;

    const { start, end } = dateRangeForToday();
    const visibleLeadIds = [
      ...(await Customer.find(matchStage).select('_id').lean()).map((lead) => lead._id),
      ...(await Company.find(matchStage).select('_id').lean()).map((lead) => lead._id),
    ];

    const [todayDemo, todayHistory] = await Promise.all([
      Promise.all([
        Customer.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
        Company.countDocuments({ ...matchStage, scheduledDateTime: { $gte: start, $lte: end } }),
      ]),
      LeadStatusHistory.aggregate([
        {
          $match: {
            lead: { $in: visibleLeadIds },
            newStatus: { $in: TRACKED_STATUSES },
            changedAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: '$newStatus', count: { $sum: 1 } } },
      ]),
    ]);

    resultStats.today.demoScheduled = todayDemo[0] + todayDemo[1];
    todayHistory.forEach((item) => {
      if (item._id === 'Follow Up') resultStats.today.followUp = item.count;
      if (item._id === 'Prospective') resultStats.today.prospective = item.count;
      if (item._id === 'Committed') resultStats.today.committed = item.count;
      if (item._id === 'Converted') resultStats.today.converted = item.count;
      if (item._id === 'Not Interested') resultStats.today.notInterested = item.count;
    });

    return successResponse(res, 200, 'Stats fetched', resultStats);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all combined leads (Customers + Companies)
// @route   GET /api/leads/all
// @access  Private
export const getAllCombinedLeads = async (req, res, next) => {
  try {
    const query = buildLeadVisibilityQuery(req.user);

    const [customers, companies] = await Promise.all([
      Customer.find(query).populate('createdBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 }).lean(),
      Company.find(query).populate('createdBy', 'name').populate('assignedTo', 'name').sort({ createdAt: -1 }).lean()
    ]);

    const unifiedLeads = [
      ...customers.map(c => ({
        _id: c._id,
        name: c.name,
        email: c.email || '',
        phone: c.phone || '',
        type: 'Customer',
        leadStatus: c.leadStatus || 'New',
        createdBy: c.createdBy?.name || 'System',
        assignedTo: assigneeNames(c.assignedTo),
        commentsCount: c.comments?.length || 0,
        followTypeDate: c.scheduledDateTime || null,
        scheduledDateTime: c.scheduledDateTime || null,
        createdAt: c.createdAt
      })),
      ...companies.map(c => ({
        _id: c._id,
        name: c.companyName,
        email: c.email1 || '',
        phone: c.mobileNo || c.phoneNo || '',
        type: 'Company',
        leadStatus: c.leadStatus || 'New',
        createdBy: c.createdBy?.name || 'System',
        assignedTo: assigneeNames(c.assignedTo),
        commentsCount: c.comments?.length || 0,
        followTypeDate: c.scheduledDateTime || c.followTypeDate,
        scheduledDateTime: c.scheduledDateTime || c.followTypeDate,
        createdAt: c.createdAt
      }))
    ];

    // Sort combined by date descending
    unifiedLeads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return successResponse(res, 200, 'Combined leads fetched', unifiedLeads);
  } catch (error) {
    next(error);
  }
};

// @desc    Get users current user can assign leads to
// @route   GET /api/leads/assignable-users
// @access  Private
export const getAssignableLeadUsers = async (req, res, next) => {
  try {
    const assignableIds = await getAssignableUserIds(req.user);
    const users = await User.find({ _id: { $in: assignableIds }, isActive: true })
      .select('name email role')
      .sort({ name: 1 })
      .lean();

    return successResponse(res, 200, 'Assignable users fetched', users);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private
export const createLead = async (req, res, next) => {
  try {
    const { name, email, phone, company, status, meetingsCount, designation, address, website, messageNotes, scheduledDateTime, assignedTo } = req.body;
    const finalStatus = scheduledDateTime ? 'Demo Scheduled' : normalizeStatus(status) || 'New';

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      designation,
      address,
      website,
      messageNotes,
      scheduledDateTime,
      assignedTo: [assignedTo || req.user._id],
      status: finalStatus,
      meetingsCount: meetingsCount || 0,
      createdBy: req.user._id
    });

    await LeadStatusHistory.create({
      lead: lead._id,
      leadModel: 'Lead',
      oldStatus: null,
      newStatus: finalStatus,
      changedBy: req.user._id,
    });

    await logActivity({
      user: req.user._id,
      actionType: 'lead_created',
      description: `Created lead ${lead.name}`,
      entityType: 'Lead',
      entityId: lead._id,
    });

    const populatedLead = await Lead.findById(lead._id).populate('createdBy', 'name role email').populate('assignedTo', 'name role email');

    return successResponse(res, 201, 'Lead created successfully', populatedLead);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single unified lead by type and ID
// @route   GET /api/leads/unified/:type/:id
// @access  Private
export const getUnifiedLead = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    let lead;
    
    lead = await findUnifiedLeadForUser(type, id, req.user, true);

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    return successResponse(res, 200, 'Lead fetched', lead);
  } catch (error) {
    next(error);
  }
};

// @desc    Update lead status (unified)
// @route   PUT /api/leads/unified/:type/:id/status
// @access  Private
export const updateLeadStatus = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { status, scheduledDateTime } = req.body;
    const newStatus = normalizeStatus(status);
    const Model = getLeadModel(type);
    if (!Model || !newStatus) return errorResponse(res, 400, 'Invalid lead type or status');
    
    const existingLead = await findUnifiedLeadForUser(type, id, req.user);
    if (!existingLead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const statusField = getLeadStatusField(type);
    const oldStatus = existingLead[statusField];
    const update = { [statusField]: newStatus };
    if (scheduledDateTime) update.scheduledDateTime = scheduledDateTime;
    if (newStatus === 'Demo Scheduled' && scheduledDateTime) update.followTypeDate = scheduledDateTime;

    const lead = await Model.findByIdAndUpdate(id, update, { new: true });

    if (oldStatus !== newStatus) {
      await LeadStatusHistory.create({
        lead: lead._id,
        leadModel: type,
        oldStatus,
        newStatus,
        changedBy: req.user._id,
      });

      await logActivity({
        user: req.user._id,
        actionType: 'lead_status_changed',
        description: `Changed ${getLeadName(lead)} from ${oldStatus || 'blank'} to ${newStatus}`,
        entityType: type,
        entityId: lead._id,
        metadata: { oldStatus, newStatus },
      });
    }

    return successResponse(res, 200, 'Status updated', lead);
  } catch (error) {
    next(error);
  }
};


// @desc    Add comment to lead (unified)
// @route   POST /api/leads/unified/:type/:id/comment
// @access  Private
export const addLeadComment = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { text } = req.body;
    
    let attachment;
    if (req.file) {
      const fileUrl = `/uploads/${req.file.filename}`;
      attachment = {
        url: fileUrl,
        fileType: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
      };
    }
    
    const comment = { text, createdBy: req.user._id, createdAt: new Date() };
    if (attachment) {
      comment.attachment = attachment;
    }

    const Model = getLeadModel(type);
    const existingLead = await findUnifiedLeadForUser(type, id, req.user);
    if (!Model || !existingLead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const lead = await Model.findByIdAndUpdate(id, { $push: { comments: comment } }, { new: true }).populate('comments.createdBy', 'name');

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    return successResponse(res, 200, 'Comment added', lead);
  } catch (error) {
    next(error);
  }
};

// @desc    Assign lead to a user
// @route   PUT /api/leads/unified/:type/:id/assign
// @access  Private
export const assignLead = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { assignedTo } = req.body;
    if (!(await assertCanAssignToUser(req.user, assignedTo))) {
      return errorResponse(res, 403, 'You are not allowed to assign leads to this user');
    }

    const Model = getLeadModel(type);
    const existingLead = await findUnifiedLeadForUser(type, id, req.user);
    if (!Model || !existingLead) return res.status(404).json({ success: false, message: 'Lead not found' });

    await ensureAssigneeArray(Model, existingLead);
    const lead = await Model.findByIdAndUpdate(id, { $addToSet: { assignedTo } }, { new: true }).populate('assignedTo', 'name');

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    await Notification.create({
      title: 'New Lead Assigned',
      message: `You have been assigned a new ${type} lead: ${lead.companyName || lead.name || lead.customerName}.`,
      type: 'info',
      user: assignedTo
    });

    return successResponse(res, 200, 'Lead assigned successfully', lead);
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk assign unified leads
// @route   PUT /api/leads/bulk-assign
// @access  Private
export const bulkAssignLeads = async (req, res, next) => {
  try {
    const { assignedTo, leads = [] } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return errorResponse(res, 400, 'Select at least one lead');
    }

    if (!(await assertCanAssignToUser(req.user, assignedTo))) {
      return errorResponse(res, 403, 'You are not allowed to assign leads to this user');
    }

    const updatedLeads = [];
    for (const item of leads) {
      const Model = getLeadModel(item.type);
      if (!Model || !item.id) continue;

      const existingLead = await findUnifiedLeadForUser(item.type, item.id, req.user);
      if (!existingLead) continue;

      await ensureAssigneeArray(Model, existingLead);
      const updatedLead = await Model.findByIdAndUpdate(
        item.id,
        { $addToSet: { assignedTo } },
        { new: true }
      ).populate('assignedTo', 'name');

      if (updatedLead) {
        updatedLeads.push(updatedLead);
        await Notification.create({
          title: 'New Lead Assigned',
          message: `You have been assigned a new ${item.type} lead: ${getLeadName(updatedLead)}.`,
          type: 'info',
          user: assignedTo,
        });

        await logActivity({
          user: req.user._id,
          actionType: 'lead_assigned',
          description: `Assigned ${getLeadName(updatedLead)} to a user`,
          entityType: item.type,
          entityId: updatedLead._id,
          metadata: { assignedTo },
        });
      }
    }

    return successResponse(res, 200, `${updatedLeads.length} leads assigned successfully`, {
      updatedCount: updatedLeads.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start a click-to-call bridge for a unified lead
// @route   POST /api/leads/unified/:type/:id/call
// @access  Private
export const startLeadCall = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const lead = await findUnifiedLeadForUser(type, id, req.user);
    if (!lead) return errorResponse(res, 404, 'Lead not found');

    const leadPhone = normalizePhone(lead.mobileNo || lead.phoneNo || lead.phone);
    const browserMode = req.body.mode === 'browser';
    const agentPhone = normalizePhone(req.user.phone);
    if (!leadPhone) return errorResponse(res, 400, 'Lead phone must include country code (for example +919876543210)');
    if (!browserMode && !agentPhone) return errorResponse(res, 400, 'Add your phone with country code in your CRM user profile before calling');
    const settings = await Setting.findOne();
    const callerId = normalizePhone(settings?.plivoNumber);
    if (!callerId) return errorResponse(res, 400, 'An admin must select a Plivo virtual number in Calling');

    const callLog = await CallLog.create({
      lead: lead._id,
      leadModel: type,
      calledBy: req.user._id,
      status: 'queued',
      fromNumber: callerId,
      toNumber: leadPhone,
    });
    let providerResponse;
    try {
      if (browserMode) {
        providerResponse = await prepareBrowserCall({ callLog, user: req.user });
      } else {
        providerResponse = await createPlivoBridge({ callLog, agentNumber: agentPhone });
        callLog.providerCallId = providerResponse.request_uuid || providerResponse.requestUuid;
        callLog.status = 'ringing';
        await callLog.save();
      }
    } catch (error) {
      callLog.status = 'failed';
      await callLog.save();
      return errorResponse(res, 502, `Plivo call failed: ${error.message}`);
    }

    await logActivity({
      user: req.user._id,
      actionType: 'click_to_call',
      description: `Started call for ${getLeadName(lead)}`,
      entityType: type,
      entityId: lead._id,
      metadata: { callLog: callLog._id, providerCallId: callLog.providerCallId },
    });

    return successResponse(res, 201, browserMode ? 'Browser call prepared' : 'Call bridge requested', { callLog, providerResponse, mode: browserMode ? 'browser' : 'bridge' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call history for a unified lead
// @route   GET /api/leads/unified/:type/:id/calls
// @access  Private
export const getLeadCallLogs = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const lead = await findUnifiedLeadForUser(type, id, req.user);
    if (!lead) return errorResponse(res, 404, 'Lead not found');

    const calls = await CallLog.find({ lead: id, leadModel: type })
      .populate('calledBy', 'name role')
      .populate('manualCommentBy', 'name')
      .sort({ callDatetime: -1 });

    return successResponse(res, 200, 'Call logs fetched', calls);
  } catch (error) {
    next(error);
  }
};

// @desc    Update manual call comment
// @route   PUT /api/leads/calls/:callLogId/comment
// @access  Private
export const updateCallManualComment = async (req, res, next) => {
  try {
    const { manualComment } = req.body;
    const callLog = await CallLog.findById(req.params.callLogId);
    if (!callLog) return errorResponse(res, 404, 'Call log not found');

    const lead = await findUnifiedLeadForUser(callLog.leadModel, callLog.lead, req.user);
    if (!lead) return errorResponse(res, 404, 'Call log not found');

    callLog.manualComment = manualComment || '';
    callLog.manualCommentBy = req.user._id;
    await callLog.save();

    return successResponse(res, 200, 'Manual comment updated', callLog);
  } catch (error) {
    next(error);
  }
};

// @desc    Telephony webhook for completed calls
// @route   POST /api/leads/webhooks/call-completed
// @access  Provider webhook
export const callCompletedWebhook = async (req, res, next) => {
  try {
    const {
      callLogId,
      providerCallId,
      durationSeconds = 0,
      recordingUrl,
      transcriptText = '',
      status = 'completed',
    } = req.body;

    const query = callLogId ? { _id: callLogId } : { providerCallId };
    const callLog = await CallLog.findOne(query);
    if (!callLog) return errorResponse(res, 404, 'Call log not found');

    const analysis = analyzeTranscript(transcriptText);
    Object.assign(callLog, {
      durationSeconds,
      recordingUrl,
      transcriptText,
      status,
      ...analysis,
    });
    await callLog.save();

    await logActivity({
      user: callLog.calledBy,
      actionType: 'call_completed',
      description: 'Call completed and analysis saved',
      entityType: callLog.leadModel,
      entityId: callLog.lead,
      metadata: { callLog: callLog._id, providerCallId: callLog.providerCallId },
    });

    return successResponse(res, 200, 'Call completion processed', callLog);
  } catch (error) {
    next(error);
  }
};
