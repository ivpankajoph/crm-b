import Task from '../models/Task.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { escapeRegex, pagedData, paginationMeta, parseDateParam, parsePagination, safeSort } from '../services/listQueryService.js';

// @desc    Get all tasks for logged in user
// @route   GET /api/tasks
// @access  Private
export const getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    return successResponse(res, 200, 'Tasks fetched successfully', tasks);
  } catch (error) {
    next(error);
  }
};

export const getTasksPaged = async (req, res, next) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query);
    const filter = { createdBy: req.user._id };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }];
    }
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.priority && req.query.priority !== 'all') filter.priority = req.query.priority;
    if (req.query.startDate || req.query.endDate) {
      const startDate = parseDateParam(req.query.startDate);
      const endDate = parseDateParam(req.query.endDate, { endOfDay: true });
      if ((req.query.startDate && !startDate) || (req.query.endDate && !endDate)) {
        return errorResponse(res, 400, 'Invalid task date range');
      }
      filter.dueDate = {};
      if (startDate) filter.dueDate.$gte = startDate;
      if (endDate) filter.dueDate.$lte = endDate;
    }
    const [items, total] = await Promise.all([
      Task.find(filter)
        .sort(safeSort(req.query, ['createdAt', 'dueDate', 'title', 'priority']))
        .skip(skip)
        .limit(limit)
        .lean(),
      Task.countDocuments(filter),
    ]);
    return successResponse(res, 200, 'Tasks page fetched successfully', pagedData(
      items,
      paginationMeta({ page, limit, total }),
    ));
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const task = await Task.create({
      title,
      description,
      status: status || 'Todo',
      priority: priority || 'Medium',
      dueDate,
      createdBy: req.user._id
    });

    return successResponse(res, 201, 'Task created successfully', task);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res, next) => {
  try {
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    const { title, description, status, priority, dueDate } = req.body;

    task.title = title !== undefined ? title : task.title;
    task.description = description !== undefined ? description : task.description;
    task.status = status !== undefined ? status : task.status;
    task.priority = priority !== undefined ? priority : task.priority;
    task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;

    await task.save();

    return successResponse(res, 200, 'Task updated successfully', task);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await task.deleteOne();

    return successResponse(res, 200, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};
