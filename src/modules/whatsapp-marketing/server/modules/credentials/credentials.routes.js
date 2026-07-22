import { Router } from "express";
import { requireAuth, getUserId } from "../auth/auth.routes.js";
import * as credentialsService from "./credentials.service.js";
import * as integrationService from "../integrations/integration.service.js";
const router = Router();
function getEmbeddedSignupConfig() {
  const firstEnv = (...keys) => {
    for (const key of keys) {
      const value = String(process.env[key] || "").trim();
      if (value) return value.replace(/^['"]|['"]$/g, "");
    }
    return "";
  };
  const appId = firstEnv(
    "META_APP_ID",
    "WHATSAPP_META_APP_ID",
    "WHATSAPP_APP_ID",
    "FACEBOOK_APP_ID",
    "APP_ID"
  );
  const appSecret = firstEnv(
    "META_APP_SECRET",
    "WHATSAPP_META_APP_SECRET",
    "WHATSAPP_APP_SECRET",
    "FACEBOOK_APP_SECRET",
    "APP_SECRET"
  );
  const configId = firstEnv(
    "META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    "WHATSAPP_CONFIGURATION_ID",
    "WHATSAPP_CONFIG_ID",
    "META_CONFIG_ID",
    "FACEBOOK_CONFIG_ID",
    "EMBEDDED_SIGNUP_CONFIG_ID",
    "CONFIGURATION_ID"
  );
  return {
    appId,
    appSecret,
    configId,
    graphVersion: firstEnv("META_GRAPH_VERSION", "GRAPH_VERSION") || "v21.0",
    isConfigured: Boolean(appId && appSecret && configId)
  };
}
router.get("/embedded-signup/config", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const config = getEmbeddedSignupConfig();
    res.json({
      appId: config.appId,
      configId: config.configId,
      graphVersion: config.graphVersion,
      isConfigured: config.isConfigured
    });
  } catch (error) {
    console.error("[Credentials API] Embedded signup config error:", error);
    res.status(500).json({ error: "Failed to load embedded signup config" });
  }
});
router.post("/embedded-signup/complete", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { code, businessAccountId, phoneNumberId } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Facebook authorization code is required" });
    }
    if (!businessAccountId || !phoneNumberId) {
      return res.status(400).json({
        error: "WhatsApp Business Account ID and Phone Number ID are required from Meta signup"
      });
    }
    const config = getEmbeddedSignupConfig();
    if (!config.isConfigured) {
      return res.status(400).json({ error: "Meta Embedded Signup is not configured" });
    }
    const tokenUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", config.appId);
    tokenUrl.searchParams.set("client_secret", config.appSecret);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(400).json({
        error: "Failed to exchange Facebook code for access token",
        details: tokenData.error?.message || "Meta token exchange failed"
      });
    }
    await credentialsService.saveCredentials(userId, {
      whatsappToken: tokenData.access_token,
      phoneNumberId,
      businessAccountId,
      appId: config.appId,
      appSecret: config.appSecret,
      webhookVerifyToken: `sl_${userId}`
    });
    const testResponse = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );
    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      await credentialsService.updateVerificationStatus(userId, false);
      return res.status(400).json({
        error: "WhatsApp number connected, but verification failed",
        details: errorData.error?.message || "Unable to verify phone number"
      });
    }
    const phoneData = await testResponse.json();
    await credentialsService.updateVerificationStatus(userId, true);
    res.json({
      success: true,
      phoneNumber: phoneData.display_phone_number,
      verifiedName: phoneData.verified_name,
      phoneNumberId,
      businessAccountId
    });
  } catch (error) {
    console.error("[Credentials API] Embedded signup complete error:", error);
    res.status(500).json({ error: "Failed to complete embedded signup", details: error.message });
  }
});
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const stored = await credentialsService.getCredentialsByUserId(userId);
    const connectedWhatsApp = await integrationService.hasUsableCredentials(
      userId,
      "whatsapp"
    );
    if (!stored && !connectedWhatsApp) {
      return res.json({
        hasCredentials: false,
        credentials: null,
        status: { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false }
      });
    }
    const masked = stored ? await credentialsService.getMaskedCredentialsForUser(userId) : null;
    const legacyStatus = await credentialsService.getCredentialStatus(userId);
    const status = {
      ...legacyStatus,
      hasWhatsApp: legacyStatus.hasWhatsApp || connectedWhatsApp,
      isVerified: Boolean(stored?.isVerified || legacyStatus.hasWhatsApp || connectedWhatsApp)
    };
    res.json({
      hasCredentials: true,
      credentials: masked,
      status,
      isVerified: status.isVerified,
      lastVerifiedAt: stored?.lastVerifiedAt,
      source: connectedWhatsApp ? "connected_apps" : "legacy"
    });
  } catch (error) {
    console.error("[Credentials API] Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const {
      whatsappToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken,
      appId,
      appSecret,
      openaiApiKey,
      geminiApiKey,
      facebookAccessToken,
      facebookPageId
    } = req.body;
    const saved = await credentialsService.saveCredentials(userId, {
      whatsappToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken,
      appId,
      appSecret,
      openaiApiKey,
      geminiApiKey,
      facebookAccessToken,
      facebookPageId
    });
    if (!saved) {
      return res.status(500).json({ error: "Failed to save credentials" });
    }
    const masked = await credentialsService.getMaskedCredentialsForUser(userId);
    const status = await credentialsService.getCredentialStatus(userId);
    res.json({
      success: true,
      message: "Credentials saved successfully",
      credentials: masked,
      status
    });
  } catch (error) {
    console.error("[Credentials API] Error saving credentials:", error);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});
router.post("/test/whatsapp", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await credentialsService.getDecryptedCredentials(userId);
    if (!creds || !creds.whatsappToken || !creds.phoneNumberId) {
      return res.status(400).json({ error: "WhatsApp credentials not configured" });
    }
    const testResponse = await fetch(
      `https://graph.facebook.com/v21.0/${creds.phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${creds.whatsappToken}`
        }
      }
    );
    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      await credentialsService.updateVerificationStatus(userId, false);
      return res.status(400).json({
        error: "WhatsApp API connection failed",
        details: errorData.error?.message || "Invalid credentials"
      });
    }
    const data = await testResponse.json();
    await credentialsService.updateVerificationStatus(userId, true);
    res.json({
      success: true,
      message: "WhatsApp API connection successful",
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name
    });
  } catch (error) {
    console.error("[Credentials API] WhatsApp test error:", error);
    const errorUserId = getUserId(req);
    if (errorUserId) {
      await credentialsService.updateVerificationStatus(errorUserId, false);
    }
    res.status(500).json({ error: "Failed to test WhatsApp connection", details: error.message });
  }
});
router.post("/test/openai", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await credentialsService.getDecryptedCredentials(userId);
    if (!creds || !creds.openaiApiKey) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }
    const testResponse = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${creds.openaiApiKey}`
      }
    });
    if (!testResponse.ok) {
      return res.status(400).json({
        error: "OpenAI API connection failed",
        details: "Invalid API key"
      });
    }
    res.json({
      success: true,
      message: "OpenAI API connection successful"
    });
  } catch (error) {
    console.error("[Credentials API] OpenAI test error:", error);
    res.status(500).json({ error: "Failed to test OpenAI connection", details: error.message });
  }
});
router.post("/test/facebook", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await credentialsService.getDecryptedCredentials(userId);
    if (!creds || !creds.facebookAccessToken) {
      return res.status(400).json({ error: "Facebook access token not configured" });
    }
    const testResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${creds.facebookAccessToken}`
    );
    if (!testResponse.ok) {
      return res.status(400).json({
        error: "Facebook API connection failed",
        details: "Invalid access token"
      });
    }
    const data = await testResponse.json();
    res.json({
      success: true,
      message: "Facebook API connection successful",
      name: data.name
    });
  } catch (error) {
    console.error("[Credentials API] Facebook test error:", error);
    res.status(500).json({ error: "Failed to test Facebook connection", details: error.message });
  }
});
router.delete("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    await credentialsService.deleteCredentials(userId);
    res.json({ success: true, message: "Credentials deleted successfully" });
  } catch (error) {
    console.error("[Credentials API] Error deleting credentials:", error);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});
router.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const legacyStatus = await credentialsService.getCredentialStatus(userId);
    const connectedWhatsApp = await integrationService.hasUsableCredentials(
      userId,
      "whatsapp"
    );
    const status = {
      ...legacyStatus,
      hasWhatsApp: legacyStatus.hasWhatsApp || connectedWhatsApp,
      isVerified: Boolean(legacyStatus.isVerified || legacyStatus.hasWhatsApp || connectedWhatsApp)
    };
    res.json(status);
  } catch (error) {
    console.error("[Credentials API] Error getting status:", error);
    res.status(500).json({ error: "Failed to get credentials status" });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
