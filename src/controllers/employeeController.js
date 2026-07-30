import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../utils/response.js';
import { escapeRegex, pagedData, paginationMeta, parsePagination, safeSort } from '../services/listQueryService.js';
import {
  combineEmployeeFilters,
  resolveEmployeeVisibility,
} from '../services/employeeAccessService.js';

const populateFields = [
  { path: 'manager', select: 'name email role' },
  { path: 'user', select: 'name email role parent status isActive' },
  { path: 'createdBy', select: 'name email role' },
];

const normalizeDate = (value) => (value ? new Date(value) : undefined);
const normalizeRole = (value = '') => value.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
const isManagerRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'admin'
    || normalized.includes('manager')
    || normalized === 'team_leader';
};

const resolveSelectedRole = async (requestedRole, currentRole = '') => {
  const roleName = requestedRole?.toString().trim();
  if (!roleName) {
    return currentRole || 'employee';
  }

  if (currentRole && roleName === currentRole) {
    return currentRole;
  }

  const role = await Role.findOne({ name: roleName }).select('name').lean();
  return role?.name || null;
};

const syncRoleUserCounts = async (...roleNames) => {
  const uniqueRoleNames = [...new Set(roleNames.filter(Boolean))];
  await Promise.all(uniqueRoleNames.map(async (roleName) => {
    const usersCount = await User.countDocuments({ role: roleName });
    await Role.updateOne({ name: roleName }, { $set: { usersCount } });
  }));
};

const validateManager = async (managerId, currentUserId = null) => {
  if (!managerId || managerId === 'none') return { manager: null };
  if (!mongoose.isValidObjectId(managerId)) {
    return { error: 'Selected manager is invalid' };
  }

  const manager = await User.findById(managerId)
    .select('_id role parent status isActive')
    .lean();

  if (!manager || manager.isActive === false || manager.status === 'inactive') {
    return { error: 'Selected manager is not an active user' };
  }

  if (!isManagerRole(manager.role)) {
    return { error: 'Selected user is not eligible to be a manager' };
  }

  if (currentUserId && manager._id.toString() === currentUserId.toString()) {
    return { error: 'A user cannot report to themselves' };
  }

  if (currentUserId) {
    const visited = new Set();
    let ancestorId = manager.parent;

    while (ancestorId) {
      const normalizedId = ancestorId.toString();
      if (normalizedId === currentUserId.toString()) {
        return { error: 'This manager assignment would create a circular reporting hierarchy' };
      }
      if (visited.has(normalizedId)) break;
      visited.add(normalizedId);

      const ancestor = await User.findById(ancestorId).select('parent').lean();
      ancestorId = ancestor?.parent || null;
    }
  }

  return { manager: manager._id };
};

const buildEmployeePayload = (body) => ({
  firstName: body.firstName,
  lastName: body.lastName,
  email: body.email,
  phone: body.phone,
  alternatePhone: body.alternatePhone,
  dateOfBirth: normalizeDate(body.dateOfBirth),
  gender: body.gender || '',
  designation: body.designation,
  department: body.department,
  employmentType: body.employmentType || 'Full-time',
  joiningDate: normalizeDate(body.joiningDate),
  workLocation: body.workLocation,
  salary: body.salary ? Number(body.salary) : 0,
  status: body.status || 'Active',
  manager: body.manager || null,
  address: body.address || {},
  emergencyContact: body.emergencyContact || {},
  bankDetails: body.bankDetails || {},
  notes: body.notes,
});

export const getEmployees = async (req, res, next) => {
  try {
    const visibility = await resolveEmployeeVisibility(req.user, req.access);
    const employees = await Employee.find(visibility.query)
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'Employees fetched successfully', employees);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const visibility = await resolveEmployeeVisibility(req.user, req.access);
    const employee = await Employee.findOne(combineEmployeeFilters(
      visibility.query,
      { _id: req.params.id },
    )).populate(populateFields);

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found or not available to you');
    }

    return successResponse(res, 200, 'Employee fetched successfully', employee);
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req, res, next) => {
  let createdUser = null;
  let createdEmployee = null;
  let createdRoleName = null;
  try {
    const { email, firstName, lastName, password, role: requestedRole } = req.body;
    
    if (!password) {
      return errorResponse(res, 400, 'Password is required to create a login account for the employee');
    }

    const selectedRole = await resolveSelectedRole(requestedRole);
    if (!selectedRole) {
      return errorResponse(res, 400, 'Selected role is invalid or no longer exists');
    }
    createdRoleName = selectedRole;

    const managerResult = await validateManager(req.body.manager);
    if (managerResult.error) {
      return errorResponse(res, 400, managerResult.error);
    }

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return errorResponse(res, 400, 'Employee with this email already exists');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 400, 'User with this email already exists');
    }

    // Create User Login Account
    createdUser = await User.create({
      name: `${firstName} ${lastName}`.trim(),
      email,
      password,
      role: selectedRole,
      phone: req.body.phone,
      parent: managerResult.manager,
      createdBy: req.user._id,
      status: req.body.status === 'Inactive' || req.body.status === 'Terminated' ? 'inactive' : 'active',
      isActive: req.body.status !== 'Inactive' && req.body.status !== 'Terminated',
    });

    createdEmployee = await Employee.create({
      ...buildEmployeePayload({ ...req.body, manager: managerResult.manager }),
      user: createdUser._id,
      createdBy: req.user._id,
    });

    await syncRoleUserCounts(selectedRole);

    const populatedEmployee = await Employee.findById(createdEmployee._id).populate(populateFields);
    return successResponse(res, 201, 'Employee and User created successfully', populatedEmployee);
  } catch (error) {
    if (createdEmployee?._id) {
      await Employee.deleteOne({ _id: createdEmployee._id }).catch(() => {});
    }
    if (createdUser?._id) {
      await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    }
    if (createdRoleName) {
      await syncRoleUserCounts(createdRoleName).catch(() => {});
    }
    next(error);
  }
};

export const getEmployeesPaged = async (req, res, next) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query);
    const visibility = await resolveEmployeeVisibility(req.user, req.access);
    const filter = {};
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { firstName: pattern },
        { lastName: pattern },
        { email: pattern },
        { employeeId: pattern },
        { designation: pattern },
      ];
    }
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.department && req.query.department !== 'all') filter.department = req.query.department;
    const scopedFilter = combineEmployeeFilters(visibility.query, filter);

    const [items, total, departments] = await Promise.all([
      Employee.find(scopedFilter)
        .select('employeeId firstName lastName email phone designation department employmentType joiningDate workLocation status manager user createdBy createdAt')
        .populate({ path: 'manager', select: 'name email role' })
        .populate({ path: 'user', select: 'name email role parent status isActive' })
        .populate({ path: 'createdBy', select: 'name email role' })
        .sort(safeSort(req.query, ['createdAt', 'firstName', 'joiningDate']))
        .skip(skip)
        .limit(limit)
        .lean(),
      Employee.countDocuments(scopedFilter),
      Employee.distinct('department', visibility.query),
    ]);
    return successResponse(res, 200, 'Employees page fetched successfully', pagedData(
      items,
      paginationMeta({ page, limit, total }),
      { departments: departments.filter(Boolean).sort() },
    ));
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const visibility = await resolveEmployeeVisibility(req.user, req.access);
    const employee = await Employee.findOne(combineEmployeeFilters(
      visibility.query,
      { _id: req.params.id },
    ));

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found or not available to you');
    }

    const oldEmail = employee.email;
    const linkedUser = employee.user
      ? await User.findById(employee.user)
      : await User.findOne({ email: oldEmail });

    if (req.body.email && req.body.email !== oldEmail) {
      const emailExists = await Employee.findOne({ email: req.body.email });
      if (emailExists) {
        return errorResponse(res, 400, 'Employee with this email already exists');
      }
      const userEmailExists = await User.findOne({
        email: req.body.email,
        ...(linkedUser?._id ? { _id: { $ne: linkedUser._id } } : {}),
      });
      if (userEmailExists) {
        return errorResponse(res, 400, 'User with this email already exists');
      }
    }

    const currentRole = linkedUser?.role || 'employee';
    const selectedRole = await resolveSelectedRole(req.body.role, currentRole);
    if (!selectedRole) {
      return errorResponse(res, 400, 'Selected role is invalid or no longer exists');
    }

    const managerResult = await validateManager(req.body.manager, linkedUser?._id);
    if (managerResult.error) {
      return errorResponse(res, 400, managerResult.error);
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      combineEmployeeFilters(visibility.query, { _id: req.params.id }),
      {
        ...buildEmployeePayload({ ...req.body, manager: managerResult.manager }),
        ...(linkedUser?._id ? { user: linkedUser._id } : {}),
      },
      { new: true, runValidators: true }
    ).populate(populateFields);

    if (linkedUser) {
      const oldRole = linkedUser.role;
      linkedUser.name = `${updatedEmployee.firstName} ${updatedEmployee.lastName}`.trim();
      linkedUser.email = updatedEmployee.email;
      linkedUser.phone = updatedEmployee.phone;
      linkedUser.parent = managerResult.manager;
      linkedUser.role = selectedRole;
      linkedUser.status = updatedEmployee.status === 'Inactive' || updatedEmployee.status === 'Terminated'
        ? 'inactive'
        : 'active';
      linkedUser.isActive = linkedUser.status === 'active';
      await linkedUser.save();

      if (oldRole !== selectedRole) {
        await syncRoleUserCounts(oldRole, selectedRole);
      }
    }

    const populatedEmployee = await Employee.findById(updatedEmployee._id).populate(populateFields);
    return successResponse(res, 200, 'Employee updated successfully', populatedEmployee);
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const visibility = await resolveEmployeeVisibility(req.user, req.access);
    const employee = await Employee.findOne(combineEmployeeFilters(
      visibility.query,
      { _id: req.params.id },
    ));

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found or not available to you');
    }

    await employee.deleteOne();
    return successResponse(res, 200, 'Employee deleted successfully', null);
  } catch (error) {
    next(error);
  }
};

export const getTeamLeaders = async (req, res, next) => {
  try {
    const leaders = await User.find({
      isActive: true,
      $or: [
        { role: { $regex: /^admin$/i } },
        { role: { $regex: /manager/i } },
        { role: { $regex: /^team[\s_-]*leader$/i } },
        { role: { $regex: /^team[\s_-]*manager$/i } },
      ],
    })
      .select('name email role')
      .sort({ role: 1, name: 1 });

    return successResponse(res, 200, 'Team leaders fetched successfully', leaders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's employee profile
// @route   GET /api/employees/me
// @access  Private
export const getMyEmployeeProfile = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ email: req.user.email }).populate(populateFields);
    
    if (!employee) {
      return errorResponse(res, 404, 'Employee profile not found for this user');
    }

    return successResponse(res, 200, 'Employee profile fetched successfully', employee);
  } catch (error) {
    next(error);
  }
};
