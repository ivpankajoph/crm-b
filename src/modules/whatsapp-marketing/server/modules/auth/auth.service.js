import crypto from "crypto";
import { User } from "../storage/mongodb.adapter.js";
import { SystemUser } from "../users/user.model.js";
import { sendPasswordResetLinkEmail } from "../email/email.service.js";
const PASSWORD_RESET_TTL_MINUTES = 15;
function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return hash === verifyHash;
}
async function findUserByUsername(username) {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error("[Auth] Error finding user:", error);
    return null;
  }
}
async function findUserById(id) {
  try {
    const user = await User.findOne({ id });
    if (user) return user;
    const systemUser = await SystemUser.findOne({ id, isActive: true });
    if (systemUser) {
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error finding user by id:", error);
    return null;
  }
}
async function createUser(username, password, name, email) {
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return null;
    }
    const id = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    const user = await User.create({
      id,
      username,
      password: hashedPassword,
      name,
      email: email || "",
      role: "user",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error("[Auth] Error creating user:", error);
    return null;
  }
}
async function updateUserProfile(userId, updates) {
  try {
    const user = await User.findOne({ id: userId });
    if (user) {
      if (updates.name) user.name = updates.name;
      if (updates.email) user.email = updates.email;
      await user.save();
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    const systemUser = await SystemUser.findOne({ id: userId });
    if (systemUser) {
      if (updates.name) systemUser.name = updates.name;
      if (updates.email) systemUser.email = updates.email;
      await systemUser.save();
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error updating profile:", error);
    return null;
  }
}
async function validateLogin(username, password) {
  try {
    const user = await findUserByUsername(username);
    if (user) {
      if (!verifyPassword(password, user.password)) {
        return null;
      }
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    const systemUser = await SystemUser.findOne({
      $or: [{ username }, { email: username }],
      isActive: true
    });
    if (systemUser) {
      if (!verifyPassword(password, systemUser.password)) {
        return null;
      }
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error validating login:", error);
    return null;
  }
}
async function requestPasswordReset(identifier, appUrl) {
  try {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      return { delivered: false };
    }
    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
    });
    if (!user) {
      return { delivered: false };
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1e3
    );
    user.resetPasswordTokenHash = resetTokenHash;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;
    await user.save();
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    let delivered = false;
    if (user.email) {
      delivered = await sendPasswordResetLinkEmail(
        user.email,
        user.name || user.username,
        resetUrl,
        PASSWORD_RESET_TTL_MINUTES
      );
    }
    if (process.env.NODE_ENV !== "production") {
      return { delivered, debugResetUrl: resetUrl };
    }
    return { delivered };
  } catch (error) {
    console.error("[Auth] Error requesting password reset:", error);
    return { delivered: false };
  }
}
async function resetPasswordWithToken(token, newPassword) {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { success: false, error: "Invalid reset token" };
    }
    if (newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    const tokenHash = hashResetToken(cleanToken);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: /* @__PURE__ */ new Date() }
    });
    if (!user) {
      return { success: false, error: "Reset token is invalid or has expired" };
    }
    user.password = hashPassword(newPassword);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();
    return { success: true };
  } catch (error) {
    console.error("[Auth] Error resetting password:", error);
    return { success: false, error: "Failed to reset password" };
  }
}
async function ensureDefaultAdmin() {
  if (!process.env.MONGODB_URL) {
    console.warn("[Auth] Skipping default admin setup: MONGODB_URL is not configured");
    return;
  }
  try {
    const adminExists = await User.findOne({ username: "admin@whatsapp.com" });
    if (!adminExists) {
      console.log("[Auth] Creating default admin user...");
      await createUser("admin@whatsapp.com", "admin123", "Admin", "admin@whatsapp.com");
      console.log("[Auth] Default admin user created (admin@whatsapp.com / admin123)");
    }
    const admin = await User.findOne({ username: "admin@whatsapp.com" });
    if (admin) {
      if (admin.role !== "super_admin") {
        admin.role = "super_admin";
        await admin.save();
        console.log("[Auth] Admin role updated to super_admin");
      }
    }
  } catch (error) {
    console.error("[Auth] Error ensuring default admin:", error);
  }
}
export {
  createUser,
  ensureDefaultAdmin,
  findUserById,
  findUserByUsername,
  hashPassword,
  requestPasswordReset,
  resetPasswordWithToken,
  updateUserProfile,
  validateLogin,
  verifyPassword
};
