import mongoose from 'mongoose';

const templateSchema = new mongoose.Schema({
  metaId: String,
  name: String,
  language: String,
  category: String,
  status: String,
  components: mongoose.Schema.Types.Mixed,
  qualityScore: mongoose.Schema.Types.Mixed,
}, { _id: false });

const phoneSchema = new mongoose.Schema({
  metaId: String,
  displayPhoneNumber: String,
  verifiedName: String,
  qualityRating: String,
  codeVerificationStatus: String,
  platformType: String,
  throughput: mongoose.Schema.Types.Mixed,
}, { _id: false });

const accountSchema = new mongoose.Schema({
  metaId: String,
  name: String,
  businessId: String,
  businessName: String,
  currency: String,
  timezoneId: String,
  messageTemplateNamespace: String,
  phones: [phoneSchema],
  templates: [templateSchema],
}, { _id: false });

const whatsappConnectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  accessToken: { type: String, required: true, select: false },
  graphVersion: { type: String, default: 'v23.0' },
  metaUserId: String,
  metaUserName: String,
  businessIds: [String],
  wabaIds: [String],
  status: { type: String, enum: ['connected', 'error'], default: 'connected' },
  lastSyncAt: Date,
  lastSyncError: String,
  accounts: [accountSchema],
}, { timestamps: true });

export default mongoose.model('WhatsAppConnection', whatsappConnectionSchema);
