import Role from '../models/Role.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().populate('createdBy', 'name email');
    return successResponse(res, 200, 'Roles fetched successfully', roles);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a role
// @route   POST /api/roles
// @access  Private
export const createRole = async (req, res, next) => {
  try {
    const { name, level } = req.body;

    const roleExists = await Role.findOne({ name });

    if (roleExists) {
      return errorResponse(res, 400, 'Role already exists');
    }

    const role = await Role.create({
      name,
      level,
      createdBy: req.user._id,
    });

    const populatedRole = await Role.findById(role._id).populate('createdBy', 'name email');

    return successResponse(res, 201, 'Role created successfully', populatedRole);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a role
// @route   DELETE /api/roles/:id
// @access  Private
export const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return errorResponse(res, 404, 'Role not found');
    }

    // Optional: add a check so only admins or the creator can delete
    // if (req.user.role !== 'admin' && role.createdBy.toString() !== req.user._id.toString()) {
    //   return errorResponse(res, 403, 'Not authorized to delete this role');
    // }

    await Role.findByIdAndDelete(req.params.id);

    return successResponse(res, 200, 'Role deleted successfully', null);
  } catch (error) {
    next(error);
  }
};
// @desc    Update role permissions
// @route   PUT /api/roles/:id/permissions
// @access  Private
export const updateRolePermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return errorResponse(res, 404, 'Role not found');
    }

    role.permissions = permissions || [];
    await role.save();

    return successResponse(res, 200, 'Permissions updated successfully', role);
  } catch (error) {
    next(error);
  }
};
