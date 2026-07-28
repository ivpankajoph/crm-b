import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ['Meeting', 'Call', 'Task', 'Other'],
    default: 'Meeting',
  },
  meetingLink: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled'],
    default: 'Scheduled',
  },
  report: {
    durationMinutes: Number,
    attendees: String,
    transcript: String,
    summary: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'participantModel'
  },
  participantModel: {
    type: String,
    enum: ['User', 'Customer', 'Company']
  }
}, {
  timestamps: true,
});

eventSchema.index({ createdBy: 1, date: -1 });
eventSchema.index({ createdBy: 1, status: 1, date: -1 });
eventSchema.index({ participant: 1, date: -1 });
eventSchema.index({ type: 1, status: 1, createdAt: -1 }, { name: 'event_type_status_createdAt' });

const Event = mongoose.model('Event', eventSchema);

export default Event;
