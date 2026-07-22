import crypto from "crypto";
import { UserCredentials } from "../storage/mongodb.adapter.js";
import {
  decryptStoredValue,
  encrypt,
  maskSecret
} from "../encryption/encryption.service.js";
async function getCredentialsByUserId(userId) {
  try {
    const creds = await UserCredentials.findOne({ userId });
    if (!creds) return null;
    return creds.toObject();
  } catch (error) {
    console.error("[Credentials] Error getting credentials:", error);
    return null;
  }
}
async function getDecryptedCredentials(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    return {
      whatsappToken: decryptStoredValue(stored.whatsappToken),
      phoneNumberId: decryptStoredValue(stored.phoneNumberId),
      businessAccountId: decryptStoredValue(stored.businessAccountId),
      webhookVerifyToken: decryptStoredValue(stored.webhookVerifyToken),
      appId: decryptStoredValue(stored.appId),
      appSecret: decryptStoredValue(stored.appSecret),
      openaiApiKey: decryptStoredValue(stored.openaiApiKey),
      geminiApiKey: decryptStoredValue(stored.geminiApiKey),
      facebookAccessToken: decryptStoredValue(stored.facebookAccessToken),
      facebookPageId: decryptStoredValue(stored.facebookPageId)
    };
  } catch (error) {
    console.error("[Credentials] Error getting credentials:", error);
    return null;
  }
}
async function getMaskedCredentialsForUser(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    const decrypted = await getDecryptedCredentials(userId);
    if (!decrypted) return null;
    return {
      whatsappToken: maskSecret(decrypted.whatsappToken),
      phoneNumberId: maskSecret(decrypted.phoneNumberId, 3),
      businessAccountId: maskSecret(decrypted.businessAccountId, 3),
      webhookVerifyToken: maskSecret(decrypted.webhookVerifyToken),
      appId: maskSecret(decrypted.appId, 3),
      appSecret: maskSecret(decrypted.appSecret),
      openaiApiKey: maskSecret(decrypted.openaiApiKey, 3),
      geminiApiKey: maskSecret(decrypted.geminiApiKey, 3),
      facebookAccessToken: maskSecret(decrypted.facebookAccessToken),
      facebookPageId: maskSecret(decrypted.facebookPageId, 3)
    };
  } catch (error) {
    console.error("[Credentials] Error masking credentials:", error);
    return null;
  }
}
async function saveCredentials(userId, input) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await UserCredentials.findOne({ userId });
    const data = {};
    if (input.whatsappToken) data.whatsappToken = encrypt(input.whatsappToken);
    if (input.phoneNumberId) {
      data.phoneNumberId = encrypt(input.phoneNumberId);
      data.phoneNumberIdHash = hashLookupValue(input.phoneNumberId);
    }
    if (input.businessAccountId) data.businessAccountId = encrypt(input.businessAccountId);
    if (input.webhookVerifyToken) {
      data.webhookVerifyToken = encrypt(input.webhookVerifyToken);
      data.webhookVerifyTokenHash = hashLookupValue(input.webhookVerifyToken);
    }
    if (input.appId) data.appId = encrypt(input.appId);
    if (input.appSecret) data.appSecret = encrypt(input.appSecret);
    if (input.openaiApiKey) data.openaiApiKey = encrypt(input.openaiApiKey);
    if (input.geminiApiKey) data.geminiApiKey = encrypt(input.geminiApiKey);
    if (input.facebookAccessToken) data.facebookAccessToken = encrypt(input.facebookAccessToken);
    if (input.facebookPageId) data.facebookPageId = encrypt(input.facebookPageId);
    if (existing) {
      const updateData = {
        ...data,
        updatedAt: now
      };
      await UserCredentials.updateOne(
        { userId },
        { $set: updateData }
      );
      const updated = await UserCredentials.findOne({ userId });
      return updated ? updated.toObject() : null;
    } else {
      const newCreds = await UserCredentials.create({
        id: crypto.randomUUID(),
        userId,
        ...data,
        isVerified: false,
        createdAt: now,
        updatedAt: now
      });
      return newCreds.toObject();
    }
  } catch (error) {
    console.error("[Credentials] Error saving credentials:", error);
    return null;
  }
}
async function updateVerificationStatus(userId, isVerified) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await UserCredentials.updateOne(
      { userId },
      {
        $set: {
          isVerified,
          lastVerifiedAt: isVerified ? now : void 0,
          updatedAt: now
        }
      }
    );
    return true;
  } catch (error) {
    console.error("[Credentials] Error updating verification status:", error);
    return false;
  }
}
async function deleteCredentials(userId) {
  try {
    await UserCredentials.deleteOne({ userId });
    return true;
  } catch (error) {
    console.error("[Credentials] Error deleting credentials:", error);
    return false;
  }
}
async function getCredentialsByPhoneNumberId(phoneNumberId) {
  try {
    const cred = await UserCredentials.findOne({
      $or: [
        { phoneNumberIdHash: hashLookupValue(phoneNumberId) },
        { phoneNumberId }
      ]
    });
    if (cred) {
      const decrypted = await getDecryptedCredentials(cred.userId);
      if (decrypted) {
        return { userId: cred.userId, credentials: decrypted };
      }
    }
    return null;
  } catch (error) {
    console.error("[Credentials] Error finding credentials by phone ID:", error);
    return null;
  }
}
async function hasCredentials(userId) {
  try {
    const creds = await UserCredentials.findOne({ userId });
    return !!creds;
  } catch (error) {
    return false;
  }
}
async function getCredentialStatus(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    const creds = await getDecryptedCredentials(userId);
    if (!stored || !creds) {
      return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
    }
    return {
      hasWhatsApp: !!(creds.whatsappToken && creds.phoneNumberId),
      hasOpenAI: !!creds.openaiApiKey,
      hasGemini: !!creds.geminiApiKey,
      hasFacebook: !!creds.facebookAccessToken,
      isVerified: stored.isVerified
    };
  } catch (error) {
    return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
  }
}
async function findUserByPhoneNumberId(phoneNumberId) {
  try {
    const cred = await UserCredentials.findOne({
      $or: [
        { phoneNumberIdHash: hashLookupValue(phoneNumberId) },
        { phoneNumberId }
      ]
    });
    return cred ? cred.userId : null;
  } catch (error) {
    console.error("[Credentials] Error finding user by phone ID:", error);
    return null;
  }
}
async function hasWebhookVerifyToken(token) {
  try {
    const credential = await UserCredentials.findOne({
      $or: [
        { webhookVerifyTokenHash: hashLookupValue(token) },
        { webhookVerifyToken: token }
      ]
    }).select({ _id: 1 });
    return Boolean(credential);
  } catch (error) {
    console.error("[Credentials] Error finding webhook verify token:", error);
    return false;
  }
}
function hashLookupValue(value) {
  return crypto.createHash("sha256").update(String(value).trim()).digest("hex");
}
const credentialsService = {
  getCredentialsByUserId,
  getDecryptedCredentials,
  getMaskedCredentialsForUser,
  saveCredentials,
  updateVerificationStatus,
  deleteCredentials,
  getCredentialsByPhoneNumberId,
  hasCredentials,
  getCredentialStatus,
  findUserByPhoneNumberId,
  hasWebhookVerifyToken
};
export {
  credentialsService,
  deleteCredentials,
  findUserByPhoneNumberId,
  getCredentialStatus,
  getCredentialsByPhoneNumberId,
  getCredentialsByUserId,
  getDecryptedCredentials,
  getMaskedCredentialsForUser,
  hasCredentials,
  hasWebhookVerifyToken,
  saveCredentials,
  updateVerificationStatus
};
