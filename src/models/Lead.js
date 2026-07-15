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
  status: {
    type: String,
    enum: ['New', 'Prospective', 'Interested', 'Not Interested', 'Committed', 'Converted'],
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
}, {
  timestamps: true,
});

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
