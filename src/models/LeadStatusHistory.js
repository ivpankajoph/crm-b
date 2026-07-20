import mongoose from 'mongoose';

const leadStatusHistorySchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'leadModel',
    },
    leadModel: {
      type: String,
      required: true,
      enum: ['Customer', 'Company', 'Lead'],
    },
    oldStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

leadStatusHistorySchema.index({ lead: 1, leadModel: 1, changedAt: -1 });
leadStatusHistorySchema.index({ newStatus: 1, changedAt: -1 });

const LeadStatusHistory = mongoose.model('LeadStatusHistory', leadStatusHistorySchema);

export default LeadStatusHistory;
