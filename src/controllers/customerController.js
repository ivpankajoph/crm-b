import Customer from '../models/Customer.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

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

    if (req.user.role !== 'admin' && customer.createdBy._id.toString() !== req.user._id.toString()) {
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
    const { name, email, phone, company, address, status, totalSpend } = req.body;

    const customer = await Customer.create({
      name,
      email,
      phone,
      company,
      address,
      status: status || 'Active',
      totalSpend: totalSpend || 0,
      createdBy: req.user._id
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

    if (req.user.role !== 'admin' && customer.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to update this customer' });
    }

    const { name, email, phone, company, address, status, totalSpend } = req.body;

    customer.name = name || customer.name;
    customer.email = email !== undefined ? email : customer.email;
    customer.phone = phone !== undefined ? phone : customer.phone;
    customer.company = company !== undefined ? company : customer.company;
    customer.address = address !== undefined ? address : customer.address;
    customer.status = status || customer.status;
    customer.totalSpend = totalSpend !== undefined ? totalSpend : customer.totalSpend;

    await customer.save();
    
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

    if (req.user.role !== 'admin' && customer.createdBy.toString() !== req.user._id.toString()) {
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
