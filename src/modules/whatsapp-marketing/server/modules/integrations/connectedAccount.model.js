import mongoose, { Schema } from "mongoose";
const ConnectedAccountSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  providerId: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  status: {
    type: String,
    enum: ["connected", "disconnected", "error", "pending", "expired"],
    default: "pending"
  },
  credentials: { type: Map, of: String, required: true },
  metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  isDefault: { type: Boolean, default: false },
  lastVerifiedAt: { type: Date },
  lastSyncAt: { type: Date },
  expiresAt: { type: Date },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: "connected_accounts",
  timestamps: true
});
ConnectedAccountSchema.index({ userId: 1, providerId: 1 });
ConnectedAccountSchema.index({ userId: 1, providerId: 1, isDefault: 1 });
const ConnectedAccount = mongoose.models.ConnectedAccount || mongoose.model("ConnectedAccount", ConnectedAccountSchema);
function toConnectedAccountData(doc) {
  const credentialsObj = {};
  if (doc.credentials) {
    doc.credentials.forEach((value, key) => {
      credentialsObj[key] = value;
    });
  }
  const metadataObj = {};
  if (doc.metadata) {
    doc.metadata.forEach((value, key) => {
      metadataObj[key] = value;
    });
  }
  return {
    id: doc.id,
    userId: doc.userId,
    providerId: doc.providerId,
    providerName: doc.providerName,
    status: doc.status,
    credentials: credentialsObj,
    metadata: metadataObj,
    isDefault: doc.isDefault,
    lastVerifiedAt: doc.lastVerifiedAt?.toISOString(),
    lastSyncAt: doc.lastSyncAt?.toISOString(),
    expiresAt: doc.expiresAt?.toISOString(),
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
export {
  ConnectedAccount,
  toConnectedAccountData
};
