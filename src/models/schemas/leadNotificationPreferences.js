import mongoose from 'mongoose';

const leadNotificationPreferencesSchema = new mongoose.Schema(
  {
    emailEnabled: { type: Boolean, default: false },
    whatsappEnabled: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

export default leadNotificationPreferencesSchema;
