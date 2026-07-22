import mongoose, { Schema } from "mongoose";
const WhatsAppFlowResponseSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    contactId: { type: String, index: true },
    contactPhone: { type: String, required: true, index: true },
    contactName: { type: String },
    phoneNumberId: { type: String, index: true },
    wabaId: { type: String, index: true },
    inboundMessageId: { type: String, index: true },
    inboundWhatsappMessageId: { type: String, index: true },
    contextMessageId: { type: String, index: true },
    flowToken: { type: String, index: true },
    flowId: { type: String, index: true },
    flowName: { type: String, index: true },
    replyName: { type: String },
    responseJson: { type: Schema.Types.Mixed },
    parsedReplyBody: { type: Schema.Types.Mixed },
    rawMessage: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true
  }
);
WhatsAppFlowResponseSchema.index({ userId: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index({ userId: 1, flowName: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index({ userId: 1, contactPhone: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index(
  { userId: 1, inboundWhatsappMessageId: 1 },
  { unique: true, sparse: true }
);
const WhatsAppFlowResponse = mongoose.models.WhatsAppFlowResponse || mongoose.model("WhatsAppFlowResponse", WhatsAppFlowResponseSchema);
export {
  WhatsAppFlowResponse
};
