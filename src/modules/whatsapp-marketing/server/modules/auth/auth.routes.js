import { Router } from "express";
import * as authService from "./auth.service.js";
import { findUserById } from "./auth.service.js";
import {
  authenticateSellersLaunch,
  SellersLaunchConfigError,
  isSellersLaunchTokenError,
  isSellersLaunchTokenExpiredError
} from "./sellerslaunch.service.js";
const router = Router();
function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
}
function getUserId(req) {
  return req.headers["x-user-id"] || null;
}
function getUser(req) {
  const userHeader = req.headers["x-user"];
  if (!userHeader) return null;
  try {
    return JSON.parse(userHeader);
  } catch {
    return null;
  }
}
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const user = await authService.validateLogin(username, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        pageAccess: user.pageAccess
      }
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});
router.post("/register", async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: "Username, password, and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const user = await authService.createUser(username, password, name, email);
    if (!user) {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("[Auth] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
router.post("/sellerslaunch", async (req, res) => {
  const startedAt = Date.now();
  try {
    const user = await authenticateSellersLaunch(req.body?.token);
    console.log(`[Auth] Sellers launch success user=${user.id} ${Date.now() - startedAt}ms`);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown sellers launch error";
    const errorName = error instanceof Error ? error.name : typeof error;
    const errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    console.error(
      `[Auth] Sellers launch failed name=${errorName} code=${errorCode} ${Date.now() - startedAt}ms: ${errorMessage}`
    );
    if (error instanceof SellersLaunchConfigError) {
      return res.status(500).json({ error: error.message });
    }
    if (isSellersLaunchTokenExpiredError(error)) {
      return res.status(401).json({ error: "Launch link expired. Please open it again from sellers dashboard." });
    }
    if (isSellersLaunchTokenError(error)) {
      return res.status(401).json({
        error: (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "") || "Invalid launch token"
      });
    }
    console.error("[Auth] Sellers launch error:", error);
    return res.status(500).json({ error: "Failed to launch seller workspace" });
  }
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({ error: "Email or username is required" });
    }
    const configuredAppUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || "";
    const host = req.get("host");
    const appUrl = configuredAppUrl ? configuredAppUrl.replace(/\/+$/, "") : host ? `${req.protocol}://${host}` : "";
    const result = await authService.requestPasswordReset(identifier, appUrl);
    const response = {
      success: true,
      message: "If an account exists with that email/username, a reset link has been sent.",
      delivered: result.delivered
    };
    if (process.env.NODE_ENV !== "production" && result.debugResetUrl) {
      response.debugResetUrl = result.debugResetUrl;
    }
    res.json(response);
  } catch (error) {
    console.error("[Auth] Forgot password error:", error);
    res.status(500).json({ error: "Failed to process forgot password request" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    const result = await authService.resetPasswordWithToken(token, password);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to reset password" });
    }
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("[Auth] Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
router.post("/logout", (req, res) => {
  res.json({ success: true });
});
router.get("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = await findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess
    }
  });
});
router.get("/check", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.json({ authenticated: false, user: null });
  }
  const user = await findUserById(userId);
  res.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess
    } : null
  });
});
router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { name, email, phone } = req.body;
    const updatedUser = await authService.updateUserProfile(userId, { name, email, phone });
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        pageAccess: updatedUser.pageAccess
      }
    });
  } catch (error) {
    console.error("[Auth] Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});
var stdin_default = router;
export {
  stdin_default as default,
  getUser,
  getUserId,
  requireAuth
};
