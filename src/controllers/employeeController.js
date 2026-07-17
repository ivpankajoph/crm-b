import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

const populateFields = [
  { path: 'manager', select: 'name email role' },
  { path: 'createdBy', select: 'name email role' },
];

const normalizeDate = (value) => (value ? new Date(value) : undefined);

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
    const employees = await Employee.find()
      .populate(populateFields)
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'Employees fetched successfully', employees);
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate(populateFields);

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found');
    }

    return successResponse(res, 200, 'Employee fetched successfully', employee);
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req, res, next) => {
  try {
    const existingEmployee = await Employee.findOne({ email: req.body.email });
    if (existingEmployee) {
      return errorResponse(res, 400, 'Employee with this email already exists');
    }

    const employee = await Employee.create({
      ...buildEmployeePayload(req.body),
      createdBy: req.user._id,
    });

    const populatedEmployee = await Employee.findById(employee._id).populate(populateFields);
    return successResponse(res, 201, 'Employee created successfully', populatedEmployee);
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found');
    }

    if (req.body.email && req.body.email !== employee.email) {
      const emailExists = await Employee.findOne({ email: req.body.email });
      if (emailExists) {
        return errorResponse(res, 400, 'Employee with this email already exists');
      }
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      buildEmployeePayload(req.body),
      { new: true, runValidators: true }
    ).populate(populateFields);

    return successResponse(res, 200, 'Employee updated successfully', updatedEmployee);
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return errorResponse(res, 404, 'Employee not found');
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
      role: { $regex: /^team[\s_-]*leader$/i },
    })
      .select('name email role')
      .sort({ name: 1 });

    return successResponse(res, 200, 'Team leaders fetched successfully', leaders);
  } catch (error) {
    next(error);
  }
};
