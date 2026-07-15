import Lead from '../models/Lead.js';
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

    return successResponse(res, 200, 'Stats fetched', stats.length > 0 ? stats[0] : defaultStats);
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
