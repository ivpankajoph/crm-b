import mongoose from "mongoose";
const FlowLogSchema = new mongoose.Schema(
  {
    wa_id: { type: String, required: true },
    // WhatsApp user ID
    phone: { type: String },
    // User phone number
    flow_id: { type: String, required: true },
    // Which flow user went through
    step: { type: String },
    // Step name
    input: { type: mongoose.Schema.Types.Mixed },
    // Selected option OR typed input
    raw_data: { type: Object }
    // Full webhook payload
  },
  { timestamps: true }
);
const FlowLog = mongoose.model("FlowLog", FlowLogSchema);
var stdin_default = FlowLog;
export {
  stdin_default as default
};
