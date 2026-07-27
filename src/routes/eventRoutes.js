import express from 'express';
import { getEvents, getEventsPaged, createEvent, deleteEvent, addMeetingReport } from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/paged', protect, getEventsPaged);

router.route('/')
  .get(protect, getEvents)
  .post(protect, createEvent);

router.route('/:id')
  .delete(protect, deleteEvent);

router.route('/:id/report')
  .post(protect, addMeetingReport);

export default router;
