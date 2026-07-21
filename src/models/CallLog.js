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
    fromNumber: String,
    toNumber: String,
    webhookToken: { type: String, select: false },
    browserDialCode: { type: String, select: false },
    browserDialExpiresAt: { type: Date, select: false },
    status: {
      type: String,
      enum: ['queued', 'ringing', 'in-progress', 'completed', 'failed'],
      default: 'queued',
    },
    recordingUrl: String,
    recordingId: String,
    recordingFormat: { type: String, default: 'mp3' },
    recordingDurationMs: { type: Number, default: 0 },
    recordingStatus: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
    transcriptText: String,
    transcriptionStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    transcriptionError: String,
    hangupCause: String,
    hangupCauseCode: String,
    answeredAt: Date,
    endedAt: Date,
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
