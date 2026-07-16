import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import { successResponse, errorResponse } from '../utils/response.js';

// @desc    Get all events
// @route   GET /api/events
// @access  Private
export const getEvents = async (req, res, next) => {
  try {
    const query = { 
      $or: [
        { createdBy: req.user._id },
        { participant: req.user._id, participantModel: 'User' }
      ]
    };
    
    // Optional: filter by month/year via query params
    const { month, year, status } = req.query;
    if (month && year) {
      const startDate = new Date(year, parseInt(month), 1);
      const endDate = new Date(year, parseInt(month) + 1, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    if (status) {
      query.status = status;
    }

    const events = await Event.find(query)
      .populate('participant', 'name companyName email')
      .populate('createdBy', 'name')
      .sort({ date: 1 });
    return successResponse(res, 200, 'Events fetched successfully', events);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new event
// @route   POST /api/events
// @access  Private
export const createEvent = async (req, res, next) => {
  try {
    const { title, date, type, participant, participantModel, meetingLink } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Title and date are required' });
    }

    const event = await Event.create({
      title,
      date,
      type: type || 'Meeting',
      meetingLink,
      participant,
      participantModel,
      createdBy: req.user._id
    });

    if (participantModel === 'User' && participant) {
      await Notification.create({
        title: 'New Meeting Scheduled',
        message: `You have been scheduled for a ${type || 'Meeting'}: ${title}.`,
        type: 'info',
        user: participant
      });
    }

    return successResponse(res, 201, 'Event created successfully', event);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
    }

    await event.deleteOne();

    return successResponse(res, 200, 'Event deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Add a report to a meeting and complete it
// @route   POST /api/events/:id/report
// @access  Private
export const addMeetingReport = async (req, res, next) => {
  try {
    const { durationMinutes, attendees, transcript, summary } = req.body;
    
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.createdBy.toString() !== req.user._id.toString() && event.participant?.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'Not authorized to add report to this event' });
    }

    event.status = 'Completed';
    event.report = {
      durationMinutes,
      attendees,
      transcript,
      summary
    };

    await event.save();

    return successResponse(res, 200, 'Meeting report added successfully', event);
  } catch (error) {
    next(error);
  }
};
