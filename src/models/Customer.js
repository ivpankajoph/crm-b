import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
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
  website: {
    type: String,
  },
  messageNotes: {
    type: String,
  },
  scheduledDateTime: {
    type: Date,
  },
  address: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
  totalSpend: {
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
  leadStatus: {
    type: String,
    enum: ['New', 'Demo Scheduled', 'Interested', 'Not Interested', 'Prospective', 'Committed', 'Converted', 'Follow Up'],
    default: 'New'
  },
  leadSource: {
    type: String,
    default: 'Direct'
  },
  comments: [{
    text: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    attachment: {
      url: String,
      fileType: String
    }
  }]
}, {
  timestamps: true,
});

customerSchema.index({ createdBy: 1, assignedTo: 1, leadStatus: 1, createdAt: -1 });
customerSchema.index({ scheduledDateTime: 1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
