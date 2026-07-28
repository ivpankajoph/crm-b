import express from 'express';
import { getNotes, getNotesPaged, getStickyNotes, createNote, updateNote, deleteNote } from '../controllers/noteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/paged', protect, getNotesPaged);
router.get('/sticky', protect, getStickyNotes);

router.route('/')
  .get(protect, getNotes)
  .post(protect, createNote);

router.route('/:id')
  .put(protect, updateNote)
  .delete(protect, deleteNote);

export default router;
