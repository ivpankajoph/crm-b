import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  systemName: {
    type: String,
    default: 'Antigravity CRM'
  },
  companyName: {
    type: String,
    default: ''
  },
  contactEmail: {
    type: String,
    default: ''
  },
  contactPhone: {
    type: String,
    default: ''
  },
  plivoNumber: {
    type: String,
    default: ''
  },
  activePlivoNumbers: {
    type: [String],
    default: [],
  },
  callingPoolConfigured: {
    type: Boolean,
    default: false,
  },
  plivoNumberPoolCursor: {
    type: Number,
    default: 0,
  },
  plivoApplicationId: {
    type: String,
    default: ''
  },
  plivoInboundApplicationId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);

export default Setting;
