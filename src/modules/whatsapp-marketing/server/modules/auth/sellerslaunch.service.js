import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../storage/mongodb.adapter.js";
import { ConnectedAccount } from "../integrations/connectedAccount.model.js";
import { hashPassword } from "./auth.service.js";
const SELLERSLOGIN_SSO_ISSUER = "ophmate-backend";
const SELLERSLOGIN_SSO_AUDIENCE = "ophmarketing";
class SellersLaunchConfigError extends Error {
}
function isSellersLaunchTokenExpiredError(error) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "TokenExpiredError";
}
function isSellersLaunchTokenError(error) {
  return typeof error === "object" && error !== null && "name" in error && (error.name === "JsonWebTokenError" || error.name === "NotBeforeError");
}
function getSsoSecret() {
  const secret = String(process.env.OPHMARKETING_SSO_SECRET || "").trim();
  if (!secret) {
    throw new SellersLaunchConfigError(
      "OPHMARKETING_SSO_SECRET is not configured"
    );
  }
  return secret;
}
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function getAccountIdentity(payload) {
  const accountType = normalizeString(payload.accountType).toLowerCase() === "admin" ? "admin" : "vendor";
  const directAccountId = normalizeString(payload.accountId);
  if (directAccountId) return { accountId: directAccountId, accountType };
  const directVendorId = normalizeString(payload.vendorId);
  if (directVendorId) return { accountId: directVendorId, accountType: "vendor" };
  const sub = normalizeString(payload.sub);
  if (sub.startsWith("admin:")) {
    return { accountId: sub.slice("admin:".length), accountType: "admin" };
  }
  if (sub.startsWith("vendor:")) {
    return { accountId: sub.slice("vendor:".length), accountType: "vendor" };
  }
  return { accountId: "", accountType };
}
function buildLaunchUserId(accountId, accountType) {
  return accountType === "admin" ? `admin:${accountId}` : `seller:${accountId}`;
}
async function resolveLaunchUserId(accountId, accountType) {
  const directUserId = buildLaunchUserId(accountId, accountType);
  if (accountType !== "admin") return directUserId;
  const platformWhatsAppAccount = await ConnectedAccount.findOne({
    providerId: "whatsapp",
    status: "connected",
    $or: [
      { "metadata.ownerType": "admin" },
      { "metadata.ownerRole": { $in: ["admin", "superadmin", "super_admin"] } },
      { userId: /^admin:/ }
    ]
  }).sort({ isDefault: -1, updatedAt: -1 }).select({ userId: 1 }).lean();
  return normalizeString(platformWhatsAppAccount?.userId) || directUserId;
}
function buildPreferredUsername(accountId, accountType) {
  const sanitized = accountId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${accountType}_${sanitized || crypto.randomBytes(4).toString("hex")}`;
}
async function getAvailableUsername(userId, preferredUsername) {
  const matchingUser = await User.findOne({ username: preferredUsername });
  if (!matchingUser || matchingUser.id === userId) {
    return preferredUsername;
  }
  return `${preferredUsername}_${crypto.randomBytes(2).toString("hex")}`;
}
const isDuplicateKeyError = (error) => typeof error === "object" && error !== null && "code" in error && error.code === 11e3;
async function authenticateSellersLaunch(token) {
  const cleanToken = normalizeString(token);
  if (!cleanToken) {
    const error = new Error("Launch token is required");
    error.name = "JsonWebTokenError";
    throw error;
  }
  const secret = getSsoSecret();
  const payload = jwt.verify(cleanToken, secret, {
    algorithms: ["HS256"],
    issuer: SELLERSLOGIN_SSO_ISSUER,
    audience: SELLERSLOGIN_SSO_AUDIENCE
  });
  const { accountId, accountType } = getAccountIdentity(payload);
  if (!accountId) {
    const error = new Error("Launch token is missing account identity");
    error.name = "JsonWebTokenError";
    throw error;
  }
  const userId = await resolveLaunchUserId(accountId, accountType);
  const name = normalizeString(payload.name) || `${accountType === "admin" ? "Admin" : "Vendor"} ${accountId.slice(-6)}`;
  const email = normalizeString(payload.email);
  const avatar = normalizeString(payload.avatar);
  const preferredUsername = buildPreferredUsername(accountId, accountType);
  const role = accountType === "admin" ? "admin" : "user";
  let user = await User.findOne({ id: userId });
  if (!user && accountType === "admin" && email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.id = userId;
      if (!user.username) {
        user.username = await getAvailableUsername(userId, preferredUsername);
      }
      if (!user.password) {
        user.password = hashPassword(crypto.randomBytes(24).toString("hex"));
      }
    }
  }
  if (!user) {
    const username = await getAvailableUsername(userId, preferredUsername);
    try {
      user = await User.create({
        id: userId,
        username,
        password: hashPassword(crypto.randomBytes(24).toString("hex")),
        name,
        email,
        role,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      user = await User.findOne({ id: userId }) || (email ? await User.findOne({ email: email.toLowerCase() }) : null);
      if (!user) throw error;
    }
  } else {
    if (user.id !== userId) {
      user.id = userId;
    }
    if (name && user.name !== name) {
      user.name = name;
    }
    if (email && user.email !== email) {
      user.email = email;
    }
    if (user.role !== role) {
      user.role = role;
    }
    await user.save();
  }
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    avatar,
    role: user.role || role
  };
}
export {
  SellersLaunchConfigError,
  authenticateSellersLaunch,
  isSellersLaunchTokenError,
  isSellersLaunchTokenExpiredError
};
