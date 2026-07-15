import Company from '../models/Company.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all companies
// @route   GET /api/companies
// @access  Private
export const getCompanies = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

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
      city, state, country, website1, website2, followTypeDate, followType 
    } = req.body;

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
      followType,
      createdBy: req.user._id // Taken from authMiddleware
    });

    const populatedCompany = await Company.findById(company._id).populate('createdBy', 'name role email');

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

    if (req.user.role !== 'admin' && company.createdBy._id.toString() !== req.user._id.toString()) {
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

    if (req.user.role !== 'admin' && company.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to edit this company' });
    }

    const { 
      companyName, customerName, customerDesignation, email1, email2, 
      mobileNo, phoneNo, products, businessType, address1, address2, 
      city, state, country, website1, website2, followTypeDate, followType 
    } = req.body;

    company = await Company.findByIdAndUpdate(req.params.id, {
      companyName, customerName, customerDesignation, email1, email2, 
      mobileNo, phoneNo, products, businessType, address1, address2, 
      city, state, country, website1, website2, followTypeDate, followType 
    }, { new: true, runValidators: true }).populate('createdBy', 'name role email');

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

    if (req.user.role !== 'admin' && company.createdBy.toString() !== req.user._id.toString()) {
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
