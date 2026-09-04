import mongoose from 'mongoose';

const callbackRouteSchema = new mongoose.Schema(
  {
    customerNumber: { type: String, required: true, trim: true },
    virtualNumber: { type: String, required: true, trim: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'leadModel' },
    leadModel: { type: String, required: true, enum: ['Customer', 'Company', 'Lead'] },
    lastOutboundCall: { type: mongoose.Schema.Types.ObjectId, ref: 'CallLog', required: true },
    lastCalledAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

callbackRouteSchema.index(
  { customerNumber: 1, virtualNumber: 1 },
  { unique: true, name: 'callback_customer_virtual_unique' },
);
callbackRouteSchema.index({ employee: 1, lastCalledAt: -1 });

const CallbackRoute = mongoose.model('CallbackRoute', callbackRouteSchema);

export default CallbackRoute;
