import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  customerName: {
    type: String,
  },
  customerDesignation: {
    type: String,
  },
  email1: {
    type: String,
  },
  email2: {
    type: String,
  },
  mobileNo: {
    type: String,
    required: true,
  },
  phoneNo: {
    type: String,
  },
  products: {
    type: String,
  },
  businessType: {
    type: String,
  },
  address1: {
    type: String,
    required: true,
  },
  address2: {
    type: String,
  },
  city: {
    type: String,
  },
  state: {
    type: String,
  },
  country: {
    type: String,
  },
  website1: {
    type: String,
    required: true,
  },
  website2: {
    type: String,
  },
  followTypeDate: {
    type: Date,
  },
  scheduledDateTime: {
    type: Date,
  },
  followType: {
    type: String,
  },
  messageNotes: {
    type: String,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  leadSource: { type: String, default: 'Direct' },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  leadStatus: {
    type: String,
    enum: ['New', 'Demo Scheduled', 'Interested', 'Not Interested', 'Prospective', 'Committed', 'Converted', 'Follow Up'],
    default: 'New'
  },
  comments: [{
    text: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    attachment: {
      url: String,
      fileType: String
    }
  }]
}, {
  timestamps: true,
});

companySchema.index({ createdBy: 1, assignedTo: 1, leadStatus: 1, createdAt: -1 });
companySchema.index({ scheduledDateTime: 1, followTypeDate: 1 });

const Company = mongoose.model('Company', companySchema);

export default Company;
