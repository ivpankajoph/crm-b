import crypto from "crypto";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ENCRYPTED_VALUE_PREFIX = "enc:v1:";
let fallbackWarningShown = false;
function getEncryptionKey() {
  const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!masterKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CREDENTIAL_ENCRYPTION_KEY is required in production");
    }
    if (!fallbackWarningShown) {
      fallbackWarningShown = true;
      console.warn("[Encryption] CREDENTIAL_ENCRYPTION_KEY not set; development fallback key is active");
    }
    return crypto.scryptSync("default-insecure-key-change-me", "salt", 32);
  }
  return crypto.scryptSync(masterKey, "whatsapp-saas-salt", 32);
}
function encrypt(plaintext) {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "base64")
  ]);
  return `${ENCRYPTED_VALUE_PREFIX}${combined.toString("base64")}`;
}
function decrypt(encryptedData) {
  if (!encryptedData) return "";
  try {
    const key = getEncryptionKey();
    const encoded = encryptedData.startsWith(ENCRYPTED_VALUE_PREFIX) ? encryptedData.slice(ENCRYPTED_VALUE_PREFIX.length) : encryptedData;
    const combined = Buffer.from(encoded, "base64");
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[Encryption] Decryption failed:", error);
    return "";
  }
}
function maskSecret(secret, visibleChars = 4) {
  if (!secret || secret.length <= visibleChars * 2) {
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  }
  const start = secret.substring(0, visibleChars);
  const end = secret.substring(secret.length - visibleChars);
  return `${start}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${end}`;
}
function isEncrypted(value) {
  if (!value) return false;
  if (value.startsWith(ENCRYPTED_VALUE_PREFIX)) return true;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
function decryptStoredValue(value) {
  if (!value) return "";
  if (value.startsWith(ENCRYPTED_VALUE_PREFIX)) return decrypt(value);
  if (isEncrypted(value)) {
    const decrypted = decrypt(value);
    if (decrypted) return decrypted;
  }
  return value;
}
function encryptCredentials(credentials) {
  const encrypted = {};
  if (credentials.whatsappToken) encrypted.whatsappToken = encrypt(credentials.whatsappToken);
  if (credentials.phoneNumberId) encrypted.phoneNumberId = encrypt(credentials.phoneNumberId);
  if (credentials.businessAccountId) encrypted.businessAccountId = encrypt(credentials.businessAccountId);
  if (credentials.webhookVerifyToken) encrypted.webhookVerifyToken = encrypt(credentials.webhookVerifyToken);
  if (credentials.appId) encrypted.appId = encrypt(credentials.appId);
  if (credentials.appSecret) encrypted.appSecret = encrypt(credentials.appSecret);
  if (credentials.openaiApiKey) encrypted.openaiApiKey = encrypt(credentials.openaiApiKey);
  if (credentials.facebookAccessToken) encrypted.facebookAccessToken = encrypt(credentials.facebookAccessToken);
  if (credentials.facebookPageId) encrypted.facebookPageId = encrypt(credentials.facebookPageId);
  return encrypted;
}
function decryptCredentials(encrypted) {
  return {
    whatsappToken: encrypted.whatsappToken ? decrypt(encrypted.whatsappToken) : "",
    phoneNumberId: encrypted.phoneNumberId ? decrypt(encrypted.phoneNumberId) : "",
    businessAccountId: encrypted.businessAccountId ? decrypt(encrypted.businessAccountId) : "",
    webhookVerifyToken: encrypted.webhookVerifyToken ? decrypt(encrypted.webhookVerifyToken) : "",
    appId: encrypted.appId ? decrypt(encrypted.appId) : "",
    appSecret: encrypted.appSecret ? decrypt(encrypted.appSecret) : "",
    openaiApiKey: encrypted.openaiApiKey ? decrypt(encrypted.openaiApiKey) : "",
    facebookAccessToken: encrypted.facebookAccessToken ? decrypt(encrypted.facebookAccessToken) : "",
    facebookPageId: encrypted.facebookPageId ? decrypt(encrypted.facebookPageId) : ""
  };
}
function getMaskedCredentials(encrypted) {
  const decrypted = decryptCredentials(encrypted);
  return {
    whatsappToken: maskSecret(decrypted.whatsappToken),
    phoneNumberId: decrypted.phoneNumberId ? maskSecret(decrypted.phoneNumberId, 3) : "",
    businessAccountId: decrypted.businessAccountId ? maskSecret(decrypted.businessAccountId, 3) : "",
    webhookVerifyToken: maskSecret(decrypted.webhookVerifyToken),
    appId: decrypted.appId ? maskSecret(decrypted.appId, 3) : "",
    appSecret: maskSecret(decrypted.appSecret),
    openaiApiKey: maskSecret(decrypted.openaiApiKey, 3),
    facebookAccessToken: maskSecret(decrypted.facebookAccessToken),
    facebookPageId: decrypted.facebookPageId ? maskSecret(decrypted.facebookPageId, 3) : ""
  };
}
export {
  decrypt,
  decryptCredentials,
  decryptStoredValue,
  encrypt,
  encryptCredentials,
  getMaskedCredentials,
  isEncrypted,
  maskSecret
};
