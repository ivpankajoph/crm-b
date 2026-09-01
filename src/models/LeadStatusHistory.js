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
    entryType: {
      type: String,
      enum: ['status_change', 'details_saved'],
      default: 'status_change',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    comment: {
      type: String,
      maxlength: 4000,
      default: null,
    },
    call: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CallLog',
      default: null,
    },
  },
  { timestamps: true }
);

leadStatusHistorySchema.index({ lead: 1, leadModel: 1, changedAt: -1 });
leadStatusHistorySchema.index({ newStatus: 1, changedAt: -1 });
leadStatusHistorySchema.index({ changedAt: -1, newStatus: 1, leadModel: 1 });
leadStatusHistorySchema.index(
  { changedBy: 1, newStatus: 1, changedAt: 1 },
  { name: 'lead_history_changedBy_status_changedAt' },
);

const LeadStatusHistory = mongoose.model('LeadStatusHistory', leadStatusHistorySchema);

export default LeadStatusHistory;
