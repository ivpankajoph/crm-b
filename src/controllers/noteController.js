import Note from '../models/Note.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all notes for logged in user
// @route   GET /api/notes
// @access  Private
export const getNotes = async (req, res, next) => {
  try {
    const notes = await Note.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    return successResponse(res, 200, 'Notes fetched successfully', notes);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
export const createNote = async (req, res, next) => {
  try {
    const { title, content, color, isSticky, positionX, positionY } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const note = await Note.create({
      title,
      content,
      color,
      isSticky,
      positionX,
      positionY,
      createdBy: req.user._id
    });

    return successResponse(res, 201, 'Note created successfully', note);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a note (including position and sticky status)
// @route   PUT /api/notes/:id
// @access  Private
export const updateNote = async (req, res, next) => {
  try {
    let note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (note.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to update this note' });
    }

    const { title, content, color, isSticky, positionX, positionY } = req.body;

    note.title = title !== undefined ? title : note.title;
    note.content = content !== undefined ? content : note.content;
    note.color = color !== undefined ? color : note.color;
    note.isSticky = isSticky !== undefined ? isSticky : note.isSticky;
    note.positionX = positionX !== undefined ? positionX : note.positionX;
    note.positionY = positionY !== undefined ? positionY : note.positionY;

    await note.save();

    return successResponse(res, 200, 'Note updated successfully', note);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    if (note.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this note' });
    }

    await note.deleteOne();

    return successResponse(res, 200, 'Note deleted successfully');
  } catch (error) {
    next(error);
  }
};
