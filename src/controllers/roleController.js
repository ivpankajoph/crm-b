import Role from '../models/Role.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  PERMISSION_GROUPS,
  PERMISSION_VALUES,
  DATA_SCOPES,
  normalizePermissionList,
  sanitizeDataScopes,
  legacyPermissionsToGrants,
  expandImpliedPermissions,
} from '../constants/permissions.js';
import { logActivity } from '../utils/activity.js';

const sanitizeGrants = (grants) => expandImpliedPermissions(
  normalizePermissionList(grants).filter((grant) => PERMISSION_VALUES.includes(grant)),
).filter((grant) => PERMISSION_VALUES.includes(grant));

export const getPermissionCatalog = async (req, res) => successResponse(
  res,
  200,
  'Permission catalog fetched successfully',
  { groups: PERMISSION_GROUPS, dataScopes: DATA_SCOPES, version: 2 },
);

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private
export const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().populate('createdBy', 'name email');
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const countByRole = new Map(roleCounts.map(({ _id, count }) => [_id, count]));
    const rolesWithAccurateCounts = roles.map((role) => ({
      ...role.toObject(),
      usersCount: countByRole.get(role.name) || 0,
      effectiveGrants: expandImpliedPermissions(normalizePermissionList([
        ...(role.grants || []),
        ...(Number(role.permissionVersion || 1) < 2
          ? legacyPermissionsToGrants(role.permissions || [])
          : []),
      ])),
    }));

    return successResponse(res, 200, 'Roles fetched successfully', rolesWithAccurateCounts);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a role
// @route   POST /api/roles
// @access  Private
export const createRole = async (req, res, next) => {
  try {
    const { name, level, grants, dataScopes, status } = req.body;

    const roleExists = await Role.findOne({ name });

    if (roleExists) {
      return errorResponse(res, 400, 'Role already exists');
    }

    const role = await Role.create({
      name,
      level,
      createdBy: req.user._id,
      grants: sanitizeGrants(grants),
      dataScopes: sanitizeDataScopes(dataScopes),
      status: status === 'inactive' ? 'inactive' : 'active',
      permissionVersion: 2,
    });

    const populatedRole = await Role.findById(role._id).populate('createdBy', 'name email');

    await logActivity({
      user: req.user._id,
      actionType: 'role_created',
      description: `Created role ${role.name}`,
      entityType: 'Role',
      entityId: role._id,
      metadata: { grants: role.grants, dataScopes: role.dataScopes },
    });

    return successResponse(res, 201, 'Role created successfully', populatedRole);
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return errorResponse(res, 404, 'Role not found');

    const { name, level, status } = req.body;
    if (name && name !== role.name) {
      const duplicate = await Role.findOne({ name, _id: { $ne: role._id } });
      if (duplicate) return errorResponse(res, 400, 'Role already exists');

      await User.updateMany({ role: role.name }, { $set: { role: name } });
      role.name = name;
    }
    if (level) role.level = level;
    if (status && ['active', 'inactive'].includes(status)) role.status = status;
    await role.save();

    await logActivity({
      user: req.user._id,
      actionType: 'role_updated',
      description: `Updated role ${role.name}`,
      entityType: 'Role',
      entityId: role._id,
      metadata: { level: role.level, status: role.status },
    });

    return successResponse(res, 200, 'Role updated successfully', role);
  } catch (error) {
    next(error);
  }
};

export const updateRoleAccess = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return errorResponse(res, 404, 'Role not found');

    role.grants = sanitizeGrants(req.body.grants);
    role.dataScopes = sanitizeDataScopes(req.body.dataScopes);
    role.permissionVersion = 2;
    await role.save();

    await logActivity({
      user: req.user._id,
      actionType: 'role_access_updated',
      description: `Updated access for role ${role.name}`,
      entityType: 'Role',
      entityId: role._id,
      metadata: { grants: role.grants, dataScopes: role.dataScopes },
    });

    return successResponse(res, 200, 'Role access updated successfully', role);
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

    if (role.isSystemRole) {
      return errorResponse(res, 400, 'System roles cannot be deleted');
    }

    const assignedUsers = await User.countDocuments({ role: role.name });
    if (assignedUsers > 0) {
      return errorResponse(
        res,
        400,
        `Cannot delete this role because ${assignedUsers} user${assignedUsers === 1 ? ' is' : 's are'} currently assigned to it`
      );
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

    role.permissions = normalizePermissionList(permissions);
    await role.save();

    return successResponse(res, 200, 'Permissions updated successfully', role);
  } catch (error) {
    next(error);
  }
};
