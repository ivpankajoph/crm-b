import Lead from '../models/Lead.js';
import Customer from '../models/Customer.js';
import Company from '../models/Company.js';
import Notification from '../models/Notification.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
export const getLeads = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const leads = await Lead.find(query)
      .populate('createdBy', 'name role email')
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
    let matchStage = {};
    if (req.user.role !== 'admin') {
      matchStage.createdBy = req.user._id;
    }

    const stats = await Lead.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          interested: { 
            $sum: { $cond: [{ $eq: ["$status", "Interested"] }, 1, 0] } 
          },
          notInterested: { 
            $sum: { $cond: [{ $eq: ["$status", "Not Interested"] }, 1, 0] } 
          },
          prospective: { 
            $sum: { $cond: [{ $eq: ["$status", "Prospective"] }, 1, 0] } 
          },
          committed: { 
            $sum: { $cond: [{ $eq: ["$status", "Committed"] }, 1, 0] } 
          },
          converted: { 
            $sum: { $cond: [{ $eq: ["$status", "Converted"] }, 1, 0] } 
          },
          totalMeetings: { $sum: "$meetingsCount" }
        }
      }
    ]);

    const defaultStats = {
      totalLeads: 0,
      interested: 0,
      notInterested: 0,
      prospective: 0,
      committed: 0,
      converted: 0,
      totalMeetings: 0
    };

    let resultStats = stats.length > 0 ? stats[0] : defaultStats;

    // Override totalLeads with Customer + Company count
    const customerCount = await Customer.countDocuments(matchStage);
    const companyCount = await Company.countDocuments(matchStage);
    resultStats.totalLeads = customerCount + companyCount;

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
    let query = {};
    if (req.user.role !== 'admin') {
      query = { $or: [{ createdBy: req.user._id }, { assignedTo: req.user._id }] };
    }

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
        assignedTo: c.assignedTo?.name || '---',
        commentsCount: c.comments?.length || 0,
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
        assignedTo: c.assignedTo?.name || '---',
        commentsCount: c.comments?.length || 0,
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

// @desc    Create a new lead
// @route   POST /api/leads
// @access  Private
export const createLead = async (req, res, next) => {
  try {
    const { name, email, phone, company, status, meetingsCount } = req.body;

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      status: status || 'New',
      meetingsCount: meetingsCount || 0,
      createdBy: req.user._id
    });

    const populatedLead = await Lead.findById(lead._id).populate('createdBy', 'name role email');

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
    
    if (type === 'Customer') {
      lead = await Customer.findById(id).populate('createdBy', 'name').populate('assignedTo', 'name').populate('comments.createdBy', 'name');
    } else if (type === 'Company') {
      lead = await Company.findById(id).populate('createdBy', 'name').populate('assignedTo', 'name').populate('comments.createdBy', 'name');
    }

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
    const { status } = req.body;
    let lead;
    
    if (type === 'Customer') {
      lead = await Customer.findByIdAndUpdate(id, { leadStatus: status }, { new: true });
    } else if (type === 'Company') {
      lead = await Company.findByIdAndUpdate(id, { leadStatus: status }, { new: true });
    }

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

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
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      attachment = {
        url: fileUrl,
        fileType: req.file.mimetype.startsWith('video/') ? 'video' : 'image'
      };
    }
    
    const comment = { text, createdBy: req.user._id, createdAt: new Date() };
    if (attachment) {
      comment.attachment = attachment;
    }

    let lead;
    if (type === 'Customer') {
      lead = await Customer.findByIdAndUpdate(id, { $push: { comments: comment } }, { new: true }).populate('comments.createdBy', 'name');
    } else if (type === 'Company') {
      lead = await Company.findByIdAndUpdate(id, { $push: { comments: comment } }, { new: true }).populate('comments.createdBy', 'name');
    }

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
    let lead;
    
    if (type === 'Customer') {
      lead = await Customer.findByIdAndUpdate(id, { assignedTo }, { new: true }).populate('assignedTo', 'name');
    } else if (type === 'Company') {
      lead = await Company.findByIdAndUpdate(id, { assignedTo }, { new: true }).populate('assignedTo', 'name');
    }

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
