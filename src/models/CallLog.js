import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema(
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
    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    callDatetime: {
      type: Date,
      default: Date.now,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    providerCallId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'ringing', 'completed', 'failed'],
      default: 'queued',
    },
    recordingUrl: String,
    transcriptText: String,
    aiSummary: String,
    aiQualityScore: Number,
    aiSentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
    aiSuggestion: String,
    keyPoints: [String],
    manualComment: String,
    manualCommentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

callLogSchema.index({ lead: 1, leadModel: 1, callDatetime: -1 });
callLogSchema.index({ calledBy: 1, callDatetime: -1 });
callLogSchema.index({ providerCallId: 1 });

const CallLog = mongoose.model('CallLog', callLogSchema);

export default CallLog;
