import Company from '../models/Company.js';
import LeadStatusHistory from '../models/LeadStatusHistory.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isAdminUser } from '../utils/hierarchy.js';
import { logActivity } from '../utils/activity.js';

const normalizeAssignees = (assignedTo) => {
  if (!assignedTo) return [];
  return Array.isArray(assignedTo) ? assignedTo.filter(Boolean) : [assignedTo];
};

const isAssignedToUser = (lead, userId) => normalizeAssignees(lead.assignedTo)
  .some((assigneeId) => assigneeId?.toString() === userId.toString());

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private
export const getCompanies = async (req, res, next) => {
  try {
    const query = isAdminUser(req.user) ? {} : { assignedTo: req.user._id };

    const companies = await Company.find(query)
      .populate('createdBy', 'name role email')
      .sort({ createdAt: -1 });
    
    return successResponse(res, 200, 'Companies fetched successfully', companies);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new company
// @route   POST /api/companies
// @access  Private
export const createCompany = async (req, res, next) => {
  try {
    const { 
      companyName, customerName, customerDesignation, email1, email2, 
      mobileNo, phoneNo, products, businessType, address1, address2, 
      city, state, country, website1, website2, followTypeDate, followType,
      leadStatus, assignedTo, messageNotes, scheduledDateTime
    } = req.body;

    const finalLeadStatus = scheduledDateTime ? 'Demo Scheduled' : leadStatus || 'New';

    const company = await Company.create({
      companyName,
      customerName,
      customerDesignation,
      email1,
      email2,
      mobileNo,
      phoneNo,
      products,
      businessType,
      address1,
      address2,
      city,
      state,
      country,
      website1,
      website2,
      followTypeDate,
      scheduledDateTime,
      followType,
      messageNotes,
      leadStatus: finalLeadStatus,
      assignedTo: [assignedTo || req.user._id],
      createdBy: req.user._id // Taken from authMiddleware
    });

    await LeadStatusHistory.create({
      lead: company._id,
      leadModel: 'Company',
      oldStatus: null,
      newStatus: finalLeadStatus,
      changedBy: req.user._id,
    });

    await logActivity({
      user: req.user._id,
      actionType: 'lead_created',
      description: `Created company lead ${company.companyName}`,
      entityType: 'Company',
      entityId: company._id,
    });

    const populatedCompany = await Company.findById(company._id).populate('createdBy', 'name role email').populate('assignedTo', 'name role email');

    return successResponse(res, 201, 'Company created successfully', populatedCompany);
  } catch (error) {
    next(error);
  }
};

// @desc    Get company by ID
// @route   GET /api/companies/:id
// @access  Private
export const getCompanyById = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id).populate('createdBy', 'name role email');
    
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const canView = isAdminUser(req.user)
      || isAssignedToUser(company, req.user._id);
    if (!canView) {
       return res.status(403).json({ success: false, message: 'Not authorized to view this company' });
    }

    return successResponse(res, 200, 'Company fetched successfully', company);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a company
// @route   PUT /api/companies/:id
// @access  Private
export const updateCompany = async (req, res, next) => {
  try {
    let company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    const canEdit = isAdminUser(req.user)
      || isAssignedToUser(company, req.user._id);
    if (!canEdit) {
       return res.status(403).json({ success: false, message: 'Not authorized to edit this company' });
    }

    const { 
      companyName, customerName, customerDesignation, email1, email2, 
      mobileNo, phoneNo, products, businessType, address1, address2, 
      city, state, country, website1, website2, followTypeDate, followType,
      leadStatus, assignedTo, messageNotes, scheduledDateTime
    } = req.body;
    const oldStatus = company.leadStatus;
    const finalLeadStatus = scheduledDateTime ? 'Demo Scheduled' : leadStatus;

    company = await Company.findByIdAndUpdate(req.params.id, {
      companyName, customerName, customerDesignation, email1, email2, 
      mobileNo, phoneNo, products, businessType, address1, address2, 
      city, state, country, website1, website2, followTypeDate, followType,
      messageNotes, scheduledDateTime,
      leadStatus: finalLeadStatus || oldStatus
    }, { new: true, runValidators: true }).populate('createdBy', 'name role email');

    if (assignedTo) {
      await Company.findByIdAndUpdate(company._id, { $addToSet: { assignedTo } });
      company = await Company.findById(company._id).populate('createdBy', 'name role email').populate('assignedTo', 'name role email');
    }

    if (finalLeadStatus && oldStatus !== finalLeadStatus) {
      await LeadStatusHistory.create({
        lead: company._id,
        leadModel: 'Company',
        oldStatus,
        newStatus: finalLeadStatus,
        changedBy: req.user._id,
      });
    }

    return successResponse(res, 200, 'Company updated successfully', company);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a company
// @route   DELETE /api/companies/:id
// @access  Private
export const deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    if (!isAdminUser(req.user) && company.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this company' });
    }

    await company.deleteOne();

    return successResponse(res, 200, 'Company deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create companies from Excel import
// @route   POST /api/companies/bulk
// @access  Private
export const bulkCreateCompanies = async (req, res, next) => {
  try {
    const companiesData = req.body.data;
    
    if (!companiesData || !Array.isArray(companiesData) || companiesData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid data provided for bulk import' });
    }

    // Map through array and add createdBy field
    const companiesToInsert = companiesData.map(item => ({
      name: item.name || item.Name,
      email: item.email || item.Email || '',
      phone: item.phone || item.Phone || '',
      industry: item.industry || item.Industry || '',
      type: item.type || item.Type || 'Prospect',
      revenue: item.revenue || item.Revenue ? Number(item.revenue || item.Revenue) : 0,
      address: item.address || item.Address || '',
      createdBy: req.user._id
    })).filter(c => c.name); // Ensure name exists

    if (companiesToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid company records found to import' });
    }

    const result = await Company.insertMany(companiesToInsert);

    return successResponse(res, 201, `${result.length} Companies imported successfully`, { count: result.length });
  } catch (error) {
    next(error);
  }
};
