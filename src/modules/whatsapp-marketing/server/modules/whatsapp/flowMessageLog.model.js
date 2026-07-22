import mongoose, { Schema } from "mongoose";
const WhatsAppFlowMessageLogSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    flowMongoId: { type: String, index: true },
    flowId: { type: String, required: true, index: true },
    flowName: { type: String, required: true, index: true },
    flowToken: { type: String, index: true },
    contactPhone: { type: String, required: true, index: true },
    contactName: { type: String },
    messageId: { type: String, index: true, sparse: true },
    status: {
      type: String,
      enum: ["accepted", "failed"],
      required: true,
      index: true
    },
    providerHttpStatus: { type: Number },
    error: { type: String },
    requestPayload: { type: Schema.Types.Mixed },
    providerResponse: { type: Schema.Types.Mixed },
    attemptedAt: { type: Date, required: true, default: Date.now, index: true },
    acceptedAt: { type: Date },
    failedAt: { type: Date }
  },
  { timestamps: true, collection: "whatsapp_flow_message_logs" }
);
WhatsAppFlowMessageLogSchema.index({ userId: 1, attemptedAt: -1 });
WhatsAppFlowMessageLogSchema.index({ userId: 1, flowId: 1, attemptedAt: -1 });
const WhatsAppFlowMessageLog = mongoose.models.WhatsAppFlowMessageLog || mongoose.model(
  "WhatsAppFlowMessageLog",
  WhatsAppFlowMessageLogSchema
);
export {
  WhatsAppFlowMessageLog
};
