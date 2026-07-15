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
  followType: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, {
  timestamps: true,
});

const Company = mongoose.model('Company', companySchema);

export default Company;
