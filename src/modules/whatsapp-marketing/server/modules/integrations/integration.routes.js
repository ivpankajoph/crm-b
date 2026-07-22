import { Router } from "express";
import * as integrationService from "./integration.service.js";
import { requireAuth, getUserId } from "../auth/auth.routes.js";
const router = Router();
router.get("/providers", async (req, res) => {
  try {
    const providers = await integrationService.getAllProviders();
    res.json(providers);
  } catch (error) {
    console.error("[Integrations] Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});
router.get("/providers/:providerId", async (req, res) => {
  try {
    const provider = await integrationService.getProviderDetails(req.params.providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.json(provider);
  } catch (error) {
    console.error("[Integrations] Error fetching provider:", error);
    res.status(500).json({ error: "Failed to fetch provider" });
  }
});
router.get("/connections", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connections = await integrationService.getUserConnections(userId);
    res.json(connections);
  } catch (error) {
    console.error("[Integrations] Error fetching connections:", error);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});
router.get("/connections/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connectionsWithStatus = await integrationService.getConnectionsWithStatus(userId);
    res.json(connectionsWithStatus);
  } catch (error) {
    console.error("[Integrations] Error fetching connection status:", error);
    res.status(500).json({ error: "Failed to fetch connection status" });
  }
});
router.get("/whatsapp/profile", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = await integrationService.getWhatsAppProfile(userId);
    res.json(profile);
  } catch (error) {
    console.error("[Integrations] Error fetching WhatsApp profile:", error);
    res.status(500).json({ error: "Failed to fetch WhatsApp profile" });
  }
});
router.get("/connections/:connectionId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connection = await integrationService.getConnectionById(userId, req.params.connectionId);
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    const maskedCredentials = await integrationService.getMaskedCredentials(userId, req.params.connectionId);
    res.json({
      ...connection,
      credentials: maskedCredentials
    });
  } catch (error) {
    console.error("[Integrations] Error fetching connection:", error);
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});
router.post("/connect", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { providerId, credentials, metadata, setAsDefault } = req.body;
    const role = String(req.headers["x-user-role"] || "").trim().toLowerCase();
    const ownerType = ["admin", "superadmin", "super_admin"].includes(role) ? "admin" : "vendor";
    if (!providerId || !credentials) {
      return res.status(400).json({ error: "Provider ID and credentials are required" });
    }
    const result = await integrationService.connectIntegration(userId, {
      providerId,
      credentials,
      metadata: {
        ...metadata || {},
        ownerType,
        ownerRole: role || "user"
      },
      setAsDefault: setAsDefault !== false
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      success: true,
      connection: result.connection,
      message: "Integration connected successfully"
    });
  } catch (error) {
    console.error("[Integrations] Error connecting integration:", error);
    res.status(500).json({ error: "Failed to connect integration" });
  }
});
router.post("/connections/:connectionId/verify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await integrationService.verifyConnection(userId, req.params.connectionId);
    res.json(result);
  } catch (error) {
    console.error("[Integrations] Error verifying connection:", error);
    res.status(500).json({ error: "Failed to verify connection" });
  }
});
router.post("/connections/:connectionId/set-default", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await integrationService.setDefaultConnection(userId, req.params.connectionId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: "Default connection updated" });
  } catch (error) {
    console.error("[Integrations] Error setting default connection:", error);
    res.status(500).json({ error: "Failed to set default connection" });
  }
});
router.delete("/connections/:connectionId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await integrationService.disconnectIntegration(userId, req.params.connectionId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: "Integration disconnected successfully" });
  } catch (error) {
    console.error("[Integrations] Error disconnecting integration:", error);
    res.status(500).json({ error: "Failed to disconnect integration" });
  }
});
router.get("/credentials/:providerId", requireAuth, async (req, res) => {
  res.status(403).json({
    error: "Raw integration credentials are server-only and cannot be returned to clients"
  });
});
router.post("/whatsapp/delink", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (String(req.body?.confirmation || "").trim().toUpperCase() !== "DELINK") {
      return res.status(400).json({ error: "Type DELINK to confirm account deletion" });
    }
    const result = await integrationService.delinkWhatsAppAccount(userId);
    res.json({
      success: true,
      message: "WhatsApp account delinked and local WhatsApp data deleted",
      ...result
    });
  } catch (error) {
    console.error("[Integrations] WhatsApp delink error:", error);
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to delink WhatsApp account",
      details
    });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
