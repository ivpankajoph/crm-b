import User from '../models/User.js';
import Role from '../models/Role.js';
import Employee from '../models/Employee.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isAdminUser } from '../utils/hierarchy.js';
import { logActivity } from '../utils/activity.js';

// @desc    Get all users
// @route   GET /api/users
// @access  Private
export const getUsers = async (req, res, next) => {
  try {
    const { role, startDate, endDate } = req.query;
    
    let filter = {};
    
    if (role && role !== 'all') {
      filter.role = role;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const users = await User.find(filter)
      .populate('parent', 'name role email')
      .populate('createdBy', 'name role email')
      .sort({ createdAt: -1 });
    return successResponse(res, 200, 'Users fetched successfully', users);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new user
// @route   POST /api/users
// @access  Private
export const createUser = async (req, res, next) => {
  try {
    if (!isAdminUser(req.user)) {
      return errorResponse(res, 403, 'Only admin can create users');
    }

    const { name, email, password, role, phone, parent, status } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return errorResponse(res, 400, 'User with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      parent: parent || null,
      status: status || 'active',
      isActive: status !== 'inactive',
      createdBy: req.user._id,
    });

    // If the role exists in the Role collection, increment its usersCount
    await Role.findOneAndUpdate({ name: role }, { $inc: { usersCount: 1 } });

    // Sync to Employee collection
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Doe';
    
    await Employee.create({
      firstName,
      lastName,
      email,
      phone: phone || 'N/A',
      designation: role || 'Employee',
      department: 'N/A',
      joiningDate: new Date(),
      createdBy: req.user._id
    });

    await logActivity({
      user: req.user._id,
      actionType: 'user_created',
      description: `Created user ${user.name}`,
      entityType: 'User',
      entityId: user._id,
      metadata: { role: user.role, parent: user.parent },
    });

    const userObj = user.toJSON(); // toJSON removes password

    return successResponse(res, 201, 'User created successfully', userObj);
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
export const updateUser = async (req, res, next) => {
  try {
    if (!isAdminUser(req.user)) {
      return errorResponse(res, 403, 'Only admin can edit users');
    }

    const { name, email, password, role, phone, parent, status, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Check duplicate email
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return errorResponse(res, 400, 'User with this email already exists');
      }
    }

    const oldRole = user.role;
    const oldEmail = user.email;

    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone ?? user.phone;
    if (parent !== undefined) {
      user.parent = parent || null;
    }
    if (status) {
      user.status = status;
      user.isActive = status !== 'inactive';
    } else if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
      user.status = user.isActive ? 'active' : 'inactive';
    }
    if (password) {
      user.password = password;
    }
    
    if (role && role !== oldRole) {
      user.role = role;
      await Role.findOneAndUpdate({ name: oldRole }, { $inc: { usersCount: -1 } });
      await Role.findOneAndUpdate({ name: role }, { $inc: { usersCount: 1 } });
    }

    await user.save();

    // Sync updates to Employee
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Doe';
    
    await Employee.findOneAndUpdate(
      { email: oldEmail }, 
      { firstName, lastName, email: user.email, phone: user.phone || 'N/A', designation: user.role }
    );

    await logActivity({
      user: req.user._id,
      actionType: 'user_updated',
      description: `Updated user ${user.name}`,
      entityType: 'User',
      entityId: user._id,
      metadata: { oldRole, newRole: user.role, parent: user.parent, status: user.status },
    });

    const userObj = user.toJSON();

    return successResponse(res, 200, 'User updated successfully', userObj);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    if (!isAdminUser(req.user)) {
      return errorResponse(res, 403, 'Only admin can delete users');
    }

    // Decrease usersCount in Role
    await Role.findOneAndUpdate({ name: user.role }, { $inc: { usersCount: -1 } });

    // Also delete the linked employee if one exists (by email)
    await Employee.findOneAndDelete({ email: user.email });

    await User.findByIdAndDelete(req.params.id);

    return successResponse(res, 200, 'User deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
