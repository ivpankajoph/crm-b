import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  company: {
    type: String,
  },
  designation: {
    type: String,
  },
  address: {
    type: String,
  },
  website: {
    type: String,
  },
  messageNotes: {
    type: String,
  },
  scheduledDateTime: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['New', 'Demo Scheduled', 'Prospective', 'Interested', 'Not Interested', 'Committed', 'Converted', 'Follow Up'],
    default: 'New',
  },
  meetingsCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

leadSchema.index({ createdBy: 1, assignedTo: 1, status: 1, createdAt: -1 });
leadSchema.index({ scheduledDateTime: 1 });

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
