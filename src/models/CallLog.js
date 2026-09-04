import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      required() { return this.direction !== 'inbound' || !['no-route', 'invalid'].includes(this.routeStatus); },
      refPath: 'leadModel',
    },
    leadModel: {
      type: String,
      required() { return this.direction !== 'inbound' || !['no-route', 'invalid'].includes(this.routeStatus); },
      enum: ['Customer', 'Company', 'Lead'],
    },
    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    direction: { type: String, enum: ['outbound', 'inbound'], default: 'outbound' },
    routeStatus: {
      type: String,
      enum: ['not-applicable', 'routed', 'busy', 'offline', 'no-route', 'invalid'],
      default: 'not-applicable',
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
    providerLegId: { type: String, trim: true },
    fromNumber: String,
    toNumber: String,
    virtualNumber: String,
    customerNumber: String,
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
    transcriptionStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    transcriptionError: String,
    transcriptionSource: { type: String, enum: ['plivo', 'gemini'] },
    transcriptionAttempts: { type: Number, default: 0 },
    transcriptionStartedAt: Date,
    transcriptionCompletedAt: Date,
    transcriptLanguage: String,
    transcriptSegments: [{
      startTime: String,
      endTime: String,
      speaker: String,
      text: String,
      language: String,
      _id: false,
    }],
    hangupCause: String,
    hangupCauseCode: String,
    answeredAt: Date,
    endedAt: Date,
    missedNotificationSentAt: Date,
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
callLogSchema.index(
  { providerCallId: 1, direction: 1 },
  { unique: true, partialFilterExpression: { direction: 'inbound', providerCallId: { $type: 'string' } } },
);
callLogSchema.index({ fromNumber: 1, callDatetime: -1 });
callLogSchema.index({ virtualNumber: 1, callDatetime: -1 });
callLogSchema.index({ direction: 1, calledBy: 1, callDatetime: -1 });

const CallLog = mongoose.model('CallLog', callLogSchema);

export default CallLog;
