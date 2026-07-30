import mongoose from 'mongoose';

const leadMessageSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    leadModel: {
      type: String,
      enum: ['Company', 'Customer', 'Lead'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'whatsapp'],
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    providerMessageId: {
      type: String,
      trim: true,
      default: '',
    },
    error: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

leadMessageSchema.index({ lead: 1, leadModel: 1, createdAt: -1 });
leadMessageSchema.index({ providerMessageId: 1, channel: 1 });

const LeadMessage = mongoose.models.LeadMessage
  || mongoose.model('LeadMessage', leadMessageSchema);

export default LeadMessage;
