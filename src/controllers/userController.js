import User from '../models/User.js';
import Role from '../models/Role.js';
import { successResponse, errorResponse } from '../utils/response.js';

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

    const users = await User.find(filter).sort({ createdAt: -1 });
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
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return errorResponse(res, 400, 'User with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    // If the role exists in the Role collection, increment its usersCount
    await Role.findOneAndUpdate({ name: role }, { $inc: { usersCount: 1 } });

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
    const { name, email, password, role } = req.body;
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

    user.name = name || user.name;
    user.email = email || user.email;
    if (password) {
      user.password = password;
    }
    
    if (role && role !== oldRole) {
      user.role = role;
      await Role.findOneAndUpdate({ name: oldRole }, { $inc: { usersCount: -1 } });
      await Role.findOneAndUpdate({ name: role }, { $inc: { usersCount: 1 } });
    }

    await user.save();

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
    
    // Decrease usersCount in Role
    await Role.findOneAndUpdate({ name: user.role }, { $inc: { usersCount: -1 } });

    await User.findByIdAndDelete(req.params.id);

    return successResponse(res, 200, 'User deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
