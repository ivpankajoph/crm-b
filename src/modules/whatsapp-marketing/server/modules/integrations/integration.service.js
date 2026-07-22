import crypto from "crypto";
import mongoose from "mongoose";
import { ConnectedAccount, toConnectedAccountData } from "./connectedAccount.model.js";
import { INTEGRATION_PROVIDERS, getProviderById } from "./integration.providers.js";
import { encrypt, decrypt, maskSecret } from "../encryption/encryption.service.js";
async function getAllProviders() {
  return INTEGRATION_PROVIDERS;
}
async function getProviderDetails(providerId) {
  return getProviderById(providerId) || null;
}
async function getUserConnections(userId) {
  try {
    const accounts = await ConnectedAccount.find({ userId }).sort({ createdAt: -1 });
    return accounts.map(toConnectedAccountData);
  } catch (error) {
    console.error("[Integrations] Error fetching user connections:", error);
    return [];
  }
}
function normalizeMetaProfile(data, source) {
  return {
    displayPhoneNumber: String(data.display_phone_number || data.displayPhoneNumber || "").trim(),
    verifiedName: String(data.verified_name || data.verifiedName || "").trim(),
    qualityRating: String(data.quality_rating || data.qualityRating || "").trim(),
    source
  };
}
async function fetchWhatsAppPhoneProfile(credentials, source) {
  const accessToken = credentials.accessToken || credentials.whatsappToken;
  const phoneNumberId = credentials.phoneNumberId;
  if (!accessToken || !phoneNumberId) return null;
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  const profile = normalizeMetaProfile(data, source);
  return {
    ...profile,
    phoneNumberId
  };
}
async function getWhatsAppProfile(userId) {
  try {
    let account = await ConnectedAccount.findOne({
      userId,
      providerId: "whatsapp",
      isDefault: true,
      status: "connected"
    });
    if (!account) {
      account = await ConnectedAccount.findOne({
        userId,
        providerId: "whatsapp",
        status: "connected"
      }).sort({ updatedAt: -1 });
    }
    if (account) {
      const metadata = {};
      account.metadata?.forEach((value, key) => {
        metadata[key] = value;
      });
      const metadataProfile = normalizeMetaProfile(metadata, "connected_apps");
      const phoneNumberId = account.credentials instanceof Map ? account.credentials.get("phoneNumberId") : account.credentials?.phoneNumberId;
      if (metadataProfile.displayPhoneNumber || metadataProfile.verifiedName) {
        return {
          isConnected: true,
          isVerified: true,
          provider: "connected_apps",
          phoneNumberId: phoneNumberId ? maskSecret(decrypt(phoneNumberId), 3) : "",
          ...metadataProfile,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString()
        };
      }
      const decryptedCredentials = {};
      account.credentials?.forEach((value, key) => {
        decryptedCredentials[key] = decrypt(value);
      });
      const liveProfile = await fetchWhatsAppPhoneProfile(
        decryptedCredentials,
        "connected_apps_live"
      );
      if (liveProfile) {
        account.metadata.set("displayPhoneNumber", liveProfile.displayPhoneNumber);
        account.metadata.set("verifiedName", liveProfile.verifiedName);
        account.metadata.set("qualityRating", liveProfile.qualityRating);
        account.lastVerifiedAt = /* @__PURE__ */ new Date();
        await account.save();
        return {
          isConnected: true,
          isVerified: true,
          provider: "connected_apps",
          phoneNumberId: maskSecret(liveProfile.phoneNumberId, 3),
          displayPhoneNumber: liveProfile.displayPhoneNumber,
          verifiedName: liveProfile.verifiedName,
          qualityRating: liveProfile.qualityRating,
          source: liveProfile.source,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString()
        };
      }
    }
    const credentialsModule = await import("../credentials/credentials.service.js");
    const stored = await credentialsModule.getCredentialsByUserId(userId);
    const legacyCredentials = await credentialsModule.getDecryptedCredentials(userId);
    const legacyProfile = legacyCredentials ? await fetchWhatsAppPhoneProfile(legacyCredentials, "legacy_live") : null;
    return {
      isConnected: Boolean(legacyProfile || stored?.isVerified),
      isVerified: Boolean(legacyProfile || stored?.isVerified),
      provider: stored ? "legacy" : "",
      phoneNumberId: legacyCredentials?.phoneNumberId ? maskSecret(legacyCredentials.phoneNumberId, 3) : "",
      displayPhoneNumber: legacyProfile?.displayPhoneNumber || "",
      verifiedName: legacyProfile?.verifiedName || "",
      qualityRating: legacyProfile?.qualityRating || "",
      source: legacyProfile?.source || (stored ? "legacy" : ""),
      lastVerifiedAt: stored?.lastVerifiedAt
    };
  } catch (error) {
    console.error("[Integrations] Error fetching WhatsApp profile:", error);
    return {
      isConnected: false,
      isVerified: false,
      provider: "",
      phoneNumberId: "",
      displayPhoneNumber: "",
      verifiedName: "",
      qualityRating: "",
      source: "",
      lastVerifiedAt: void 0
    };
  }
}
async function getConnectionByProvider(userId, providerId) {
  try {
    let account = await ConnectedAccount.findOne({ userId, providerId, isDefault: true });
    if (!account) {
      account = await ConnectedAccount.findOne({ userId, providerId });
    }
    if (!account || account.status !== "connected") return null;
    return account ? toConnectedAccountData(account) : null;
  } catch (error) {
    console.error("[Integrations] Error fetching connection:", error);
    return null;
  }
}
async function getConnectionById(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    return account ? toConnectedAccountData(account) : null;
  } catch (error) {
    console.error("[Integrations] Error fetching connection by ID:", error);
    return null;
  }
}
async function connectIntegration(userId, input) {
  try {
    const provider = getProviderById(input.providerId);
    if (!provider) {
      return { success: false, error: "Invalid provider" };
    }
    for (const field of provider.requiredFields) {
      if (!input.credentials[field.key]) {
        return { success: false, error: `Missing required field: ${field.label}` };
      }
    }
    const encryptedCredentials = {};
    for (const [key, value] of Object.entries(input.credentials)) {
      if (value) {
        encryptedCredentials[key] = encrypt(value);
      }
    }
    if (input.setAsDefault) {
      await ConnectedAccount.updateMany(
        { userId, providerId: input.providerId },
        { $set: { isDefault: false } }
      );
    }
    const existingConnection = await ConnectedAccount.findOne({
      userId,
      providerId: input.providerId,
      isDefault: true
    });
    const connectionId = crypto.randomUUID();
    const now = /* @__PURE__ */ new Date();
    if (existingConnection) {
      existingConnection.credentials = new Map(Object.entries(encryptedCredentials));
      existingConnection.metadata = new Map(Object.entries(input.metadata || {}));
      existingConnection.status = "pending";
      existingConnection.updatedAt = now;
      existingConnection.errorMessage = void 0;
      await existingConnection.save();
      const verifyResult2 = await verifyConnection(userId, existingConnection.id);
      if (verifyResult2.success) {
        existingConnection.status = "connected";
        existingConnection.lastVerifiedAt = now;
        if (verifyResult2.metadata) {
          for (const [key, value] of Object.entries(verifyResult2.metadata)) {
            existingConnection.metadata.set(key, value);
          }
        }
      } else {
        existingConnection.status = "error";
        existingConnection.errorMessage = verifyResult2.message;
      }
      await existingConnection.save();
      return {
        success: verifyResult2.success,
        connection: toConnectedAccountData(existingConnection),
        error: verifyResult2.success ? void 0 : verifyResult2.message
      };
    }
    const isFirstConnection = !await ConnectedAccount.findOne({ userId, providerId: input.providerId });
    const newConnection = new ConnectedAccount({
      id: connectionId,
      userId,
      providerId: input.providerId,
      providerName: provider.name,
      status: "pending",
      credentials: new Map(Object.entries(encryptedCredentials)),
      metadata: new Map(Object.entries(input.metadata || {})),
      isDefault: input.setAsDefault || isFirstConnection,
      createdAt: now,
      updatedAt: now
    });
    await newConnection.save();
    const verifyResult = await verifyConnection(userId, connectionId);
    if (verifyResult.success) {
      newConnection.status = "connected";
      newConnection.lastVerifiedAt = now;
      if (verifyResult.metadata) {
        for (const [key, value] of Object.entries(verifyResult.metadata)) {
          newConnection.metadata.set(key, value);
        }
      }
    } else {
      newConnection.status = "error";
      newConnection.errorMessage = verifyResult.message;
    }
    await newConnection.save();
    return {
      success: verifyResult.success,
      connection: toConnectedAccountData(newConnection),
      error: verifyResult.success ? void 0 : verifyResult.message
    };
  } catch (error) {
    console.error("[Integrations] Error connecting integration:", error);
    return { success: false, error: "Failed to connect integration" };
  }
}
async function disconnectIntegration(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: "Connection not found" };
    }
    await ConnectedAccount.deleteOne({ id: connectionId, userId });
    if (account.isDefault) {
      const nextConnection = await ConnectedAccount.findOne({
        userId,
        providerId: account.providerId
      });
      if (nextConnection) {
        nextConnection.isDefault = true;
        await nextConnection.save();
      }
    }
    return { success: true };
  } catch (error) {
    console.error("[Integrations] Error disconnecting integration:", error);
    return { success: false, error: "Failed to disconnect integration" };
  }
}
async function setDefaultConnection(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: "Connection not found" };
    }
    await ConnectedAccount.updateMany(
      { userId, providerId: account.providerId },
      { $set: { isDefault: false } }
    );
    account.isDefault = true;
    await account.save();
    return { success: true };
  } catch (error) {
    console.error("[Integrations] Error setting default connection:", error);
    return { success: false, error: "Failed to set default connection" };
  }
}
async function verifyConnection(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, message: "Connection not found" };
    }
    const decryptedCredentials = {};
    account.credentials.forEach((value, key) => {
      decryptedCredentials[key] = decrypt(value);
    });
    switch (account.providerId) {
      case "whatsapp":
        return await verifyWhatsAppConnection(decryptedCredentials);
      case "facebook":
        return await verifyFacebookConnection(decryptedCredentials);
      case "gemini":
        return await verifyGeminiConnection(decryptedCredentials);
      case "openai":
        return await verifyOpenAIConnection(decryptedCredentials);
      case "smtp":
        return await verifySMTPConnection(decryptedCredentials);
      default:
        return { success: true, message: "Connection saved (verification not available for this provider)" };
    }
  } catch (error) {
    console.error("[Integrations] Error verifying connection:", error);
    return { success: false, message: "Verification failed" };
  }
}
async function verifyWhatsAppConnection(credentials) {
  try {
    const { accessToken, phoneNumberId } = credentials;
    if (!accessToken || !phoneNumberId) {
      return { success: false, message: "Missing access token or phone number ID" };
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid WhatsApp credentials"
      };
    }
    const data = await response.json();
    return {
      success: true,
      message: "WhatsApp connection verified successfully",
      metadata: {
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating
      }
    };
  } catch (error) {
    console.error("[Integrations] WhatsApp verification error:", error);
    return { success: false, message: "Failed to verify WhatsApp connection" };
  }
}
async function verifyFacebookConnection(credentials) {
  try {
    const { accessToken, pageId } = credentials;
    if (!accessToken) {
      return { success: false, message: "Missing access token" };
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
    );
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid Facebook credentials"
      };
    }
    const data = await response.json();
    return {
      success: true,
      message: "Facebook connection verified successfully",
      metadata: {
        name: data.name,
        id: data.id
      }
    };
  } catch (error) {
    console.error("[Integrations] Facebook verification error:", error);
    return { success: false, message: "Failed to verify Facebook connection" };
  }
}
async function verifyGeminiConnection(credentials) {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: "Missing API key" };
    }
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.list();
    return {
      success: true,
      message: "Gemini AI connection verified successfully",
      metadata: {
        modelsAvailable: true
      }
    };
  } catch (error) {
    console.error("[Integrations] Gemini verification error:", error);
    return {
      success: false,
      message: error.message || "Invalid Gemini API key"
    };
  }
}
async function verifyOpenAIConnection(credentials) {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: "Missing API key" };
    }
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid OpenAI API key"
      };
    }
    return {
      success: true,
      message: "OpenAI connection verified successfully"
    };
  } catch (error) {
    console.error("[Integrations] OpenAI verification error:", error);
    return { success: false, message: "Failed to verify OpenAI connection" };
  }
}
async function verifySMTPConnection(credentials) {
  return {
    success: true,
    message: "SMTP credentials saved (send a test email to verify)"
  };
}
async function getDecryptedCredentials(userId, providerId) {
  try {
    let account = await ConnectedAccount.findOne({
      userId,
      providerId,
      isDefault: true,
      status: "connected"
    });
    if (!account) {
      account = await ConnectedAccount.findOne({
        userId,
        providerId,
        status: "connected"
      });
    }
    if (!account) return null;
    const result = {};
    account.credentials.forEach((value, key) => {
      result[key] = decrypt(value);
    });
    return result;
  } catch (error) {
    console.error("[Integrations] Error getting decrypted credentials:", error);
    return null;
  }
}
const WHATSAPP_USER_SCOPED_COLLECTIONS = [
  "templates",
  "contacts",
  "messages",
  "whatsapp_chats",
  "campaigns",
  "campaignlogs",
  "broadcast_lists",
  "broadcast_logs",
  "scheduled_messages",
  "scheduled_broadcasts",
  "blocked_contacts",
  "imported_contacts",
  "interest_classification_logs",
  "contact_analytics",
  "webhook_status_events",
  "whatsappflows",
  "whatsappflowresponses",
  "flowsynccheckpoints",
  "flowdefinitions",
  "flowinstances",
  "triggers",
  "triggerexecutions",
  "realtimeevents",
  "dripcampaigns",
  "dripruns",
  "segments",
  "automationmetrics",
  "engagementheatmaps",
  "aiinsights",
  "automationworkflows",
  "automationexecutions",
  "automationlogs",
  "automationrecipients",
  "formautomations"
];
async function delinkWhatsAppAccount(userId) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection is not available");
  const contacts = await db.collection("contacts").find({ userId }, { projection: { id: 1, _id: 1 } }).toArray();
  const contactIds = contacts.flatMap(
    (item) => [item.id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const campaigns = await db.collection("campaigns").find({ userId }, { projection: { id: 1, _id: 1 } }).toArray();
  const campaignIds = campaigns.flatMap(
    (item) => [item.id, item._id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const flows = await db.collection("flowdefinitions").find({ userId }, { projection: { _id: 1 } }).toArray();
  const flowIds = flows.flatMap(
    (item) => [item._id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const deleted = {};
  const remove = async (collection, filter) => {
    const result = await db.collection(collection).deleteMany(filter);
    deleted[collection] = (deleted[collection] || 0) + result.deletedCount;
  };
  if (contactIds.length) {
    await Promise.all([
      remove("contact_agents", { contactId: { $in: contactIds } }),
      remove("segmentmembers", { contactId: { $in: contactIds } }),
      remove("lead_assignments", { contactId: { $in: contactIds } })
    ]);
  }
  if (campaignIds.length) {
    await Promise.all([
      remove("campaignrecipients", { campaignId: { $in: campaignIds } }),
      remove("campaignactivitylogs", { campaignId: { $in: campaignIds } })
    ]);
  }
  if (flowIds.length) {
    await remove("flowinstances", { flowId: { $in: flowIds } });
  }
  for (const collection of WHATSAPP_USER_SCOPED_COLLECTIONS) {
    await remove(collection, { userId });
  }
  await remove("connected_accounts", { userId, providerId: "whatsapp" });
  await db.collection("user_credentials").updateOne(
    { userId },
    {
      $unset: {
        whatsappToken: "",
        phoneNumberId: "",
        phoneNumberIdHash: "",
        businessAccountId: "",
        webhookVerifyToken: "",
        webhookVerifyTokenHash: "",
        appId: "",
        appSecret: "",
        flowEndpointToken: "",
        flowEndpointPrivateKey: "",
        flowEndpointPublicKey: "",
        lastVerifiedAt: ""
      },
      $set: {
        isVerified: false,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  return {
    deleted,
    totalDeleted: Object.values(deleted).reduce((sum, count) => sum + count, 0)
  };
}
async function hasUsableCredentials(userId, providerId) {
  const credentials = await getDecryptedCredentials(userId, providerId);
  if (!credentials) return false;
  if (providerId === "whatsapp") {
    return Boolean(credentials.accessToken && credentials.phoneNumberId);
  }
  return Object.values(credentials).some(Boolean);
}
async function findUserIdByWhatsAppPhoneNumberId(phoneNumberId) {
  const normalizedPhoneNumberId = String(phoneNumberId || "").trim();
  if (!normalizedPhoneNumberId) return null;
  try {
    const accounts = await ConnectedAccount.find({
      providerId: "whatsapp",
      status: "connected"
    }).sort({ isDefault: -1, updatedAt: -1 }).select({ userId: 1, credentials: 1 }).lean();
    for (const account of accounts) {
      const encryptedPhoneNumberId = account.credentials instanceof Map ? account.credentials.get("phoneNumberId") : account.credentials?.phoneNumberId;
      if (encryptedPhoneNumberId && decrypt(String(encryptedPhoneNumberId)).trim() === normalizedPhoneNumberId) {
        return String(account.userId);
      }
    }
    return null;
  } catch (error) {
    console.error(
      "[Integrations] Error finding WhatsApp owner by phone number ID:",
      error
    );
    return null;
  }
}
async function getMaskedCredentials(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) return null;
    const result = {};
    account.credentials.forEach((value, key) => {
      const decrypted = decrypt(value);
      result[key] = maskSecret(decrypted);
    });
    return result;
  } catch (error) {
    console.error("[Integrations] Error getting masked credentials:", error);
    return null;
  }
}
async function getConnectionsWithStatus(userId) {
  const connections = await getUserConnections(userId);
  const connectionMap = new Map(connections.map((c) => [c.providerId, c]));
  return INTEGRATION_PROVIDERS.map((provider) => {
    const connection = connectionMap.get(provider.id) || null;
    return {
      provider,
      connection,
      isConnected: connection?.status === "connected"
    };
  });
}
export {
  connectIntegration,
  delinkWhatsAppAccount,
  disconnectIntegration,
  findUserIdByWhatsAppPhoneNumberId,
  getAllProviders,
  getConnectionById,
  getConnectionByProvider,
  getConnectionsWithStatus,
  getDecryptedCredentials,
  getMaskedCredentials,
  getProviderDetails,
  getUserConnections,
  getWhatsAppProfile,
  hasUsableCredentials,
  setDefaultConnection,
  verifyConnection
};
