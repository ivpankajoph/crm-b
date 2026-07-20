import Customer from '../models/Customer.js';
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

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
  try {
    const query = isAdminUser(req.user) ? {} : { assignedTo: req.user._id };

    const customers = await Customer.find(query)
      .populate('createdBy', 'name role email')
      .sort({ createdAt: -1 });
    
    return successResponse(res, 200, 'Customers fetched successfully', customers);
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Private
export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name role email');

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const canView = isAdminUser(req.user)
      || isAssignedToUser(customer, req.user._id);
    if (!canView) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this customer' });
    }

    return successResponse(res, 200, 'Customer fetched successfully', customer);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
export const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, company, address, status, totalSpend, designation, website, messageNotes, scheduledDateTime, assignedTo, leadStatus } = req.body;
    const finalLeadStatus = scheduledDateTime ? 'Demo Scheduled' : leadStatus || 'New';

    const customer = await Customer.create({
      name,
      email,
      phone,
      company,
      address,
      designation,
      website,
      messageNotes,
      scheduledDateTime,
      assignedTo: [assignedTo || req.user._id],
      leadStatus: finalLeadStatus,
      status: status || 'Active',
      totalSpend: totalSpend || 0,
      createdBy: req.user._id
    });

    await LeadStatusHistory.create({
      lead: customer._id,
      leadModel: 'Customer',
      oldStatus: null,
      newStatus: finalLeadStatus,
      changedBy: req.user._id,
    });

    await logActivity({
      user: req.user._id,
      actionType: 'lead_created',
      description: `Created customer lead ${customer.name}`,
      entityType: 'Customer',
      entityId: customer._id,
    });

    const populatedCustomer = await Customer.findById(customer._id).populate('createdBy', 'name role email');

    return successResponse(res, 201, 'Customer created successfully', populatedCustomer);
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res, next) => {
  try {
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const canEdit = isAdminUser(req.user)
      || isAssignedToUser(customer, req.user._id);
    if (!canEdit) {
       return res.status(403).json({ success: false, message: 'Not authorized to update this customer' });
    }

    const { name, email, phone, company, address, status, totalSpend, designation, website, messageNotes, scheduledDateTime, assignedTo, leadStatus } = req.body;
    const oldStatus = customer.leadStatus;
    const finalLeadStatus = scheduledDateTime ? 'Demo Scheduled' : leadStatus;

    customer.name = name || customer.name;
    customer.email = email !== undefined ? email : customer.email;
    customer.phone = phone !== undefined ? phone : customer.phone;
    customer.company = company !== undefined ? company : customer.company;
    customer.address = address !== undefined ? address : customer.address;
    customer.designation = designation !== undefined ? designation : customer.designation;
    customer.website = website !== undefined ? website : customer.website;
    customer.messageNotes = messageNotes !== undefined ? messageNotes : customer.messageNotes;
    customer.scheduledDateTime = scheduledDateTime !== undefined ? scheduledDateTime : customer.scheduledDateTime;
    if (assignedTo !== undefined) {
      customer.assignedTo = Array.from(new Set([...normalizeAssignees(customer.assignedTo).map((id) => id.toString()), assignedTo].filter(Boolean)));
    }
    customer.leadStatus = finalLeadStatus || customer.leadStatus;
    customer.status = status || customer.status;
    customer.totalSpend = totalSpend !== undefined ? totalSpend : customer.totalSpend;

    await customer.save();

    if (finalLeadStatus && oldStatus !== finalLeadStatus) {
      await LeadStatusHistory.create({
        lead: customer._id,
        leadModel: 'Customer',
        oldStatus,
        newStatus: finalLeadStatus,
        changedBy: req.user._id,
      });
    }
    
    // populate before return
    customer = await Customer.findById(customer._id).populate('createdBy', 'name role email');

    return successResponse(res, 200, 'Customer updated successfully', customer);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private
export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!isAdminUser(req.user) && customer.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this customer' });
    }

    await customer.deleteOne();

    return successResponse(res, 200, 'Customer deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create customers from Excel import
// @route   POST /api/customers/bulk
// @access  Private
export const bulkCreateCustomers = async (req, res, next) => {
  try {
    const customersData = req.body.data;
    
    if (!customersData || !Array.isArray(customersData) || customersData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid data provided for bulk import' });
    }

    // Map through array and add createdBy field
    const customersToInsert = customersData.map(item => ({
      name: item.name || item.Name,
      email: item.email || item.Email || '',
      phone: item.phone || item.Phone || '',
      company: item.company || item.Company || '',
      address: item.address || item.Address || '',
      status: item.status || item.Status || 'Active',
      totalSpend: item.totalSpend || item.TotalSpend ? Number(item.totalSpend || item.TotalSpend) : 0,
      createdBy: req.user._id
    })).filter(c => c.name); // Ensure name exists

    if (customersToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid customer records found to import' });
    }

    const result = await Customer.insertMany(customersToInsert);

    return successResponse(res, 201, `${result.length} Customers imported successfully`, { count: result.length });
  } catch (error) {
    next(error);
  }
};
