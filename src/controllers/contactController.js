import Contact from '../models/Contact.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all contacts
// @route   GET /api/contacts
// @access  Private
export const getContacts = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    const contacts = await Contact.find(query)
      .populate('createdBy', 'name role email')
      .sort({ createdAt: -1 });
    
    return successResponse(res, 200, 'Contacts fetched successfully', contacts);
  } catch (error) {
    next(error);
  }
};

// @desc    Get contact by ID
// @route   GET /api/contacts/:id
// @access  Private
export const getContactById = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('createdBy', 'name role email');

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    if (req.user.role !== 'admin' && contact.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this contact' });
    }

    return successResponse(res, 200, 'Contact fetched successfully', contact);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new contact
// @route   POST /api/contacts
// @access  Private
export const createContact = async (req, res, next) => {
  try {
    const { name, email, phone, companyName, designation, status } = req.body;

    const contact = await Contact.create({
      name,
      email,
      phone,
      companyName,
      designation,
      status: status || 'Active',
      createdBy: req.user._id
    });

    const populatedContact = await Contact.findById(contact._id).populate('createdBy', 'name role email');

    return successResponse(res, 201, 'Contact created successfully', populatedContact);
  } catch (error) {
    next(error);
  }
};

// @desc    Update contact
// @route   PUT /api/contacts/:id
// @access  Private
export const updateContact = async (req, res, next) => {
  try {
    let contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    if (req.user.role !== 'admin' && contact.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to update this contact' });
    }

    const { name, email, phone, companyName, designation, status } = req.body;

    contact.name = name || contact.name;
    contact.email = email !== undefined ? email : contact.email;
    contact.phone = phone !== undefined ? phone : contact.phone;
    contact.companyName = companyName !== undefined ? companyName : contact.companyName;
    contact.designation = designation !== undefined ? designation : contact.designation;
    contact.status = status || contact.status;

    await contact.save();
    
    contact = await Contact.findById(contact._id).populate('createdBy', 'name role email');

    return successResponse(res, 200, 'Contact updated successfully', contact);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a contact
// @route   DELETE /api/contacts/:id
// @access  Private
export const deleteContact = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    if (req.user.role !== 'admin' && contact.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this contact' });
    }

    await contact.deleteOne();

    return successResponse(res, 200, 'Contact deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create contacts from Excel import
// @route   POST /api/contacts/bulk
// @access  Private
export const bulkCreateContacts = async (req, res, next) => {
  try {
    const contactsData = req.body.data;
    
    if (!contactsData || !Array.isArray(contactsData) || contactsData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid data provided for bulk import' });
    }

    const contactsToInsert = contactsData.map(item => ({
      name: item.name || item.Name,
      email: item.email || item.Email || '',
      phone: item.phone || item.Phone || '',
      companyName: item.companyName || item.company || item.Company || '',
      designation: item.designation || item.Designation || item.jobTitle || item['Job Title'] || '',
      status: item.status || item.Status || 'Active',
      createdBy: req.user._id
    })).filter(c => c.name);

    if (contactsToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid contact records found to import' });
    }

    const result = await Contact.insertMany(contactsToInsert);

    return successResponse(res, 201, `${result.length} Contacts imported successfully`, { count: result.length });
  } catch (error) {
    next(error);
  }
};
