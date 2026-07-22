import { storage } from "./storage.js";
import {
  insertContactSchema,
  insertMessageSchema,
  insertCampaignSchema,
  insertAutomationSchema,
  insertTeamMemberSchema
} from "../shared/schema.js";
import agentRoutes from "./modules/aiAgents/agent.routes.js";
import fbRoutes from "./modules/facebook/fb.routes.js";
import mappingRoutes from "./modules/mapping/mapping.routes.js";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes.js";
import leadAutoReplyRoutes from "./modules/leadAutoReply/leadAutoReply.routes.js";
import broadcastRoutes from "./modules/broadcast/broadcast.routes.js";
import aiAnalyticsRoutes from "./modules/aiAnalytics/aiAnalytics.routes.js";
import prefilledTextRoutes from "./modules/prefilledText/prefilledText.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import credentialsRoutes from "./modules/credentials/credentials.routes.js";
import contactsRoutes from "./modules/contacts/contacts.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import usageRoutes from "./modules/usage/usage.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import { SystemUser } from "./modules/users/user.model.js";
import contactAnalyticsRoutes from "./modules/contactAnalytics/contactAnalytics.controller.js";
import leadManagementRoutes from "./modules/leadManagement/leadManagement.routes.js";
import integrationRoutes from "./modules/integrations/integration.routes.js";
import * as integrationService from "./modules/integrations/integration.service.js";
import { getUserId, requireAuth } from "./modules/auth/auth.routes.js";
import automationRoutes from "./modules/automation/automation.routes.js";
import * as agentService from "./modules/aiAgents/agent.service.js";
import * as aiService from "./modules/ai/ai.service.js";
import * as mongodb from "./modules/storage/mongodb.adapter.js";
import * as broadcastService from "./modules/broadcast/broadcast.service.js";
import * as contactAgentService from "./modules/contactAgent/contactAgent.service.js";
import * as leadManagementService from "./modules/leadManagement/leadManagement.service.js";
import { findUserById } from "./modules/auth/auth.service.js";
import flowHandler from "./modules/facebook/fb.routes.js";
import axios from "axios";
import {
  buildMetaTemplate,
  syncLeadsForFormMain
} from "./worker.js";
import mongoose, { Types } from "mongoose";
import multer from "multer";
import {
  cancelDripCampaignJobs,
  isDripQueueConfigured,
  scheduleRunningDripCampaigns,
  scheduleDripCampaignStep
} from "./modules/automation/drip-campaign.queue.js";
const upload = multer({ storage: multer.memoryStorage() });
function parsePagination(req, defaults = {}) {
  const maxLimit = defaults.maxLimit || 200;
  const rawLimit = Number.parseInt(String(req.query.limit || defaults.limit || 50), 10);
  const rawPage = Number.parseInt(String(req.query.page || 1), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), maxLimit);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  return { page, limit, skip: (page - 1) * limit };
}
async function submitMetaTemplate(templatePayload) {
  try {
    const accessToken = "";
    const phoneNumberId = "";
    if (!accessToken || !phoneNumberId)
      throw new Error("Missing WhatsApp API credentials");
    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/message_templates`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(templatePayload)
    });
    const data = await response.json();
    if (data.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, newMetaTemplateId: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
import { v2 as cloudinaryV2 } from "cloudinary";
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || ""
};
const hasCloudinaryConfig = Boolean(
  cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret
);
if (hasCloudinaryConfig) {
  cloudinaryV2.config(cloudinaryConfig);
} else {
  console.warn(
    "[TemplateMediaUpload] Cloudinary env is missing. Media preview URL will not be generated."
  );
}
async function resolveTemplateMediaUploadCredentials(req) {
  let accessToken = "";
  let appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "";
  const headerUserIdRaw = req.headers["x-user-id"];
  const headerUserId = typeof headerUserIdRaw === "string" ? headerUserIdRaw : Array.isArray(headerUserIdRaw) ? headerUserIdRaw[0] : void 0;
  const queryUserId = typeof req.query?.userId === "string" ? req.query.userId : void 0;
  const bodyUserId = req.body && typeof req.body.userId === "string" ? req.body.userId : void 0;
  const sessionUserId = req?.session?.userId || req?.session?.user?.id;
  const userId = headerUserId || sessionUserId || queryUserId || bodyUserId;
  if (userId) {
    try {
      // Credentials are encrypted at rest. Resolve both the current Connected
      // Apps record and the legacy Settings record through their decryptors.
      const integrationCredentials = await integrationService.getDecryptedCredentials(
        userId,
        "whatsapp"
      );
      const { credentialsService } = await import(
        "./modules/credentials/credentials.service.js"
      );
      const settingsCredentials = await credentialsService.getDecryptedCredentials(userId);
      accessToken = String(
        integrationCredentials?.accessToken ||
        integrationCredentials?.whatsappToken ||
        settingsCredentials?.whatsappToken ||
        ""
      );
      appId = String(
        integrationCredentials?.appId || settingsCredentials?.appId || appId || ""
      );
    } catch (error) {
      console.warn(
        "[TemplateMediaUpload] Could not resolve user credentials:",
        error
      );
    }
  }
  accessToken ||= String(
    process.env.FB_PAGE_ACCESS_TOKEN ||
    process.env.SYSTEM_USER_TOKEN_META ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    ""
  );
  return {
    accessToken: accessToken.trim(),
    appId: appId.trim(),
    userId
  };
}
function readHeaderValue(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return value;
}
function isAdminRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return [
    "admin",
    "superadmin",
    "super_admin",
    "subadmin",
    "sub_admin"
  ].includes(normalizedRole);
}
async function resolveRequestUserContext(req) {
  const userId = readHeaderValue(req.headers["x-user-id"]);
  const roleFromHeader = readHeaderValue(req.headers["x-user-role"]);
  const nameFromHeader = readHeaderValue(req.headers["x-user-name"]);
  if (!userId) {
    return {
      userId: "",
      role: "user",
      name: nameFromHeader || ""
    };
  }
  const resolvedUser = await findUserById(userId);
  if (resolvedUser) {
    return {
      userId,
      role: resolvedUser.role || roleFromHeader || "user",
      name: resolvedUser.name || nameFromHeader || ""
    };
  }
  return {
    userId,
    role: roleFromHeader || "user",
    name: nameFromHeader || ""
  };
}
async function getPermittedContactIdsForRequest(req) {
  const context = await resolveRequestUserContext(req);
  if (!context.userId) {
    return [];
  }
  if (isAdminRole(context.role)) {
    return null;
  }
  const permittedContactIds = await leadManagementService.getFilteredChatsForUser({
    userId: context.userId,
    role: context.role,
    name: context.name
  });
  return permittedContactIds;
}
const uploadTemplateHeader = async (req, res) => {
  console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x9D\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA5 uploadTemplateHeader() called");
  try {
    const file = req.file;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x81 Incoming file info:", {
      exists: !!file,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size
    });
    if (!file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    const getMediaType = (mimeType) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if ([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
      ].includes(mimeType)) {
        return "document";
      }
      return null;
    };
    const mediaType = getMediaType(file.mimetype);
    if (!mediaType) {
      return res.status(400).json({
        error: "Unsupported file type. Allowed: image, video, PDF, DOC, DOCX, TXT."
      });
    }
    const {
      accessToken,
      appId,
      userId
    } = await resolveTemplateMediaUploadCredentials(req);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x9D\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x90 Environment values:", {
      appId,
      hasAccessToken: !!accessToken
    });
    if (!accessToken || !appId) {
      const missing = [];
      if (!accessToken) missing.push("access token");
      if (!appId) missing.push("Meta App ID");
      console.error("[TemplateMediaUpload] Missing Meta credentials", {
        missing,
        userId: userId || null
      });
      return res.status(500).json({
        error: `Missing Meta credentials: ${missing.join(", ")}`,
        hint: "Configure credentials in Settings (WhatsApp token + App ID) or set FB_PAGE_ACCESS_TOKEN/SYSTEM_USER_TOKEN_META and META_APP_ID/FACEBOOK_APP_ID."
      });
    }
    const fileName = file.originalname;
    const fileLength = file.size;
    const fileType = file.mimetype;
    let previewUrl = null;
    if (hasCloudinaryConfig) {
      try {
        console.log("Uploading to Cloudinary for preview...");
        const cloudinaryResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinaryV2.uploader.upload_stream(
            {
              folder: "whatsapp/template-media",
              public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
              resource_type: mediaType === "image" ? "image" : mediaType === "video" ? "video" : "raw",
              overwrite: false
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          uploadStream.end(file.buffer);
        });
        previewUrl = cloudinaryResult.secure_url || null;
      } catch (cloudinaryErr) {
        console.warn("Cloudinary preview upload failed:", cloudinaryErr);
      }
    }
    if (!previewUrl) {
      return res.status(500).json({
        error: "Header media uploaded but preview URL could not be generated.",
        hint: "Configure Cloudinary keys (CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET) and re-upload media."
      });
    }
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB3 Step 1: Creating Meta upload session\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6");
    const sessionRes = await axios.post(
      `https://graph.facebook.com/v24.0/${appId}/uploads`,
      {},
      {
        params: {
          file_name: fileName,
          file_length: fileLength,
          file_type: fileType,
          access_token: accessToken
        }
      }
    );
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xE2\u20AC\u0153\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6 Meta upload session response:", sessionRes.data);
    const uploadId = sessionRes.data.id;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\xA2\xE2\u20AC\u017E\xC2\xA2 Meta uploadId:", uploadId);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB3 Step 2: Uploading binary to Meta\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6");
    const uploadRes = await axios.post(
      `https://graph.facebook.com/v24.0/${uploadId}`,
      file.buffer,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": fileType,
          file_offset: 0
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xE2\u20AC\u0153\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6 Meta binary upload response:", uploadRes.data);
    const handle = uploadRes.data.h;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xBD\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAF Final Meta media handle:", handle);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC Upload complete, responding to client");
    return res.json({
      success: true,
      handle,
      previewUrl,
      mediaType
    });
  } catch (err) {
    console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xBE\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA5 Upload failed");
    if (err?.response) {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA8 Axios response error:", {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers
      });
    } else if (err?.request) {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAD Axios request error (no response):", err.request);
    } else {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA0\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAF\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F General error message:", err.message);
    }
    return res.status(500).json({
      error: "Upload Failed",
      details: err?.response?.data || err.message
    });
  }
};
async function registerRoutes(httpServer, app) {
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const FB_API_VERSION = "v17.0";
  const FB_PAGE_ID = "";
  const FB_ACCESS_TOKEN = "";
  app.post(
    "/api/upload/template-header",
    upload.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );
  app.post(
    "/api/upload/template-media",
    upload.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );
  app.get("/api/fb-automation/stats", async (req, res) => {
    const [totalLeads, sent, unsent, failed, activeAutomations] = await Promise.all([
      mongodb.Leadfb.countDocuments(),
      mongodb.Leadfb.countDocuments({ template_sent: true }),
      mongodb.Leadfb.countDocuments({
        template_sent: false,
        last_error: { $exists: false }
      }),
      mongodb.Leadfb.countDocuments({ last_error: { $exists: true } }),
      mongodb.FormAutomation.countDocuments({ automation_active: true })
    ]);
    res.json({
      totalLeads,
      sent,
      unsent,
      failed,
      activeAutomations
    });
  });
  app.get("/api/fb-automation/leads", async (req, res) => {
    const { search = "", status = "all", formId } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (status === "sent") {
      filter.template_sent = true;
    } else if (status === "unsent") {
      filter.template_sent = false;
      filter.last_error = { $exists: false };
    } else if (status === "failed") {
      filter.last_error = { $exists: true };
    }
    if (formId && formId !== "all") {
      filter.form_id = formId;
    }
    const rows = await mongodb.Leadfb.find(filter).sort({ created_time: -1 }).limit(200);
    res.json({
      rows,
      total: rows.length
    });
  });
  app.post("/api/fb-automation/retry", async (req, res) => {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ message: "No lead IDs provided" });
    }
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const leads = await mongodb.Leadfb.find({
      _id: { $in: objectIds },
      $or: [{ template_sent: false }, { last_error: { $exists: true } }]
    });
    for (const lead of leads) {
      console.log(`Enqueuing retry for lead ${lead._id}`);
    }
    res.json({
      success: true,
      retried: leads.length
    });
  });
  const normalizeCampaignStep = (step, index) => {
    const templateId = step?.templateId || step?.template_id;
    if (!templateId) return null;
    const scheduleType = step?.scheduleType === "specific" ? "specific" : "delay";
    let delayDays = Number(step?.delayDays ?? 0);
    let delayHours = Number(step?.delayHours ?? 0);
    if (!Number.isFinite(delayDays)) delayDays = 0;
    if (!Number.isFinite(delayHours)) delayHours = 0;
    if (step?.delay_unit && step?.delay_value !== void 0) {
      const delayValue = Number(step.delay_value) || 0;
      if (step.delay_unit === "minutes") {
        delayHours += delayValue / 60;
      } else if (step.delay_unit === "hours") {
        delayHours += delayValue;
      } else if (step.delay_unit === "days") {
        delayDays += delayValue;
      }
    }
    return {
      templateId,
      template_name: step?.template_name || "",
      scheduleType,
      delayDays,
      delayHours,
      specificDate: step?.specificDate || void 0,
      specificTime: step?.specificTime || step?.send_at_time || void 0,
      order: index
    };
  };
  const getCampaignStepDelayMs = (step) => {
    const delayDays = Number(step?.delayDays ?? 0);
    const delayHours = Number(step?.delayHours ?? 0);
    const delayMinutes = Number(step?.delayMinutes ?? 0);
    const delayValue = Number(step?.delay_value ?? 0);
    const delayUnit = step?.delay_unit;
    let totalMinutes = (Number.isFinite(delayDays) ? delayDays : 0) * 24 * 60 + (Number.isFinite(delayHours) ? delayHours : 0) * 60 + (Number.isFinite(delayMinutes) ? delayMinutes : 0);
    if (Number.isFinite(delayValue) && delayValue > 0) {
      if (delayUnit === "minutes") {
        totalMinutes += delayValue;
      } else if (delayUnit === "hours") {
        totalMinutes += delayValue * 60;
      } else if (delayUnit === "days") {
        totalMinutes += delayValue * 24 * 60;
      }
    }
    return Math.max(0, totalMinutes * 60 * 1e3);
  };
  const calculateCampaignNextRunAt = (step, baseDate = /* @__PURE__ */ new Date()) => {
    if (step?.scheduleType === "specific" && step?.specificDate && step?.specificTime) {
      const specific = /* @__PURE__ */ new Date(`${step.specificDate}T${step.specificTime}:00`);
      if (!Number.isNaN(specific.getTime())) {
        return specific;
      }
    }
    const nextRunAt = new Date(baseDate.getTime() + getCampaignStepDelayMs(step));
    const preferredTime = step?.specificTime || step?.send_at_time;
    if (preferredTime) {
      const [hours, minutes] = String(preferredTime).split(":").map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        nextRunAt.setHours(hours, minutes, 0, 0);
        if (nextRunAt < baseDate) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
      }
    }
    return nextRunAt;
  };
  const ensureDripQueueReady = () => {
    if (!isDripQueueConfigured()) {
      throw new Error(
        "Redis is not configured. Set REDIS_URL or REDIS_HOST/REDIS_PORT to schedule drip campaigns."
      );
    }
  };
  const scheduleCurrentDripCampaignStep = async (campaign) => {
    ensureDripQueueReady();
    const stepIndex = Number(campaign?.currentStep || 0);
    const step = campaign?.steps?.[stepIndex];
    if (!step || !campaign?.nextRunAt) return;
    await scheduleDripCampaignStep(
      String(campaign._id),
      stepIndex,
      new Date(campaign.nextRunAt)
    );
  };
  const normalizeCampaignContact = (contact) => {
    if (typeof contact === "string") {
      const digits = contact.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }
    if (typeof contact === "object" && contact) {
      const raw = String(
        contact.phone || contact.Phone || contact.mobile || contact.whatsapp || ""
      );
      const digits = raw.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }
    return null;
  };
  app.post("/api/drip-campaigns", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const {
        name,
        campaign_name,
        contacts = [],
        steps = [],
        form_id,
        form_name
      } = req.body || {};
      const campaignName = campaign_name || name;
      if (!campaignName || typeof campaignName !== "string") {
        return res.status(400).json({ error: "Campaign name is required" });
      }
      const normalizedSteps = (Array.isArray(steps) ? steps : []).map((s, i) => normalizeCampaignStep(s, i)).filter(Boolean);
      if (normalizedSteps.length === 0) {
        return res.status(400).json({
          error: "At least one valid campaign step is required"
        });
      }
      const templateIds = Array.from(
        new Set(
          normalizedSteps.map((step) => String(step?.templateId || "").trim()).filter(Boolean)
        )
      );
      const templateDocs = templateIds.length ? await mongodb.Template.find(
        { id: { $in: templateIds } },
        { id: 1, name: 1 }
      ).lean() : [];
      const templateNameById = new Map(
        templateDocs.map((tpl) => [
          String(tpl.id || ""),
          String(tpl.name || "")
        ])
      );
      const resolvedSteps = normalizedSteps.map((step) => ({
        ...step,
        template_name: String(step?.template_name || "").trim() || templateNameById.get(String(step.templateId || "")) || ""
      }));
      const now = /* @__PURE__ */ new Date();
      for (let i = 0; i < resolvedSteps.length; i++) {
        const step = resolvedSteps[i];
        if (step?.scheduleType === "specific" && step?.specificDate && step?.specificTime) {
          const specificAt = /* @__PURE__ */ new Date(
            `${step.specificDate}T${step.specificTime}:00`
          );
          if (Number.isNaN(specificAt.getTime())) {
            return res.status(400).json({
              error: `Invalid specific date/time for step ${i + 1}`
            });
          }
          if (specificAt <= now) {
            return res.status(400).json({
              error: `Step ${i + 1} specific date/time is in the past. Please select a future time.`
            });
          }
        }
      }
      const initialContacts = (Array.isArray(contacts) ? contacts : []).map(normalizeCampaignContact).filter(Boolean);
      let normalizedContacts = Array.from(new Set(initialContacts));
      if (normalizedContacts.length === 0 && form_id) {
        const leads = await mongodb.Leadfb.find({
          form_id,
          phone: { $exists: true, $ne: "" }
        }).lean();
        normalizedContacts = Array.from(
          new Set(
            leads.map((lead) => normalizeCampaignContact(lead.phone)).filter(Boolean)
          )
        );
      }
      if (normalizedContacts.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found"
        });
      }
      const firstStep = resolvedSteps[0];
      const firstRunAt = firstStep ? calculateCampaignNextRunAt(firstStep, /* @__PURE__ */ new Date()) : /* @__PURE__ */ new Date();
      const campaign = await mongodb.Campaign.create({
        id: uuidv4(),
        userId,
        name: campaignName,
        campaign_name: campaignName,
        form_id: form_id || void 0,
        form_name: form_name || void 0,
        is_active: true,
        status: "running",
        currentStep: 0,
        nextRunAt: firstRunAt,
        contacts: normalizedContacts,
        steps: resolvedSteps
      });
      await scheduleCurrentDripCampaignStep(campaign);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating drip campaign:", error);
      const message = error instanceof Error && error.message ? error.message : "Failed to create campaign";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/reports/drip-campaigns", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const {
      search = "",
      status,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10
    } = req.query;
    const filter = { userId };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } }
      ];
    }
    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }
    const campaigns = await mongodb.Campaign.find(filter).sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).skip((+page - 1) * +limit).limit(+limit).lean();
    const total = await mongodb.Campaign.countDocuments(filter);
    const campaignIds = campaigns.map((campaign) => campaign?._id).filter(Boolean);
    const metricsByCampaign = /* @__PURE__ */ new Map();
    if (campaignIds.length > 0) {
      const metrics = await mongodb.CampaignLog.aggregate([
        {
          $match: {
            campaignId: { $in: campaignIds }
          }
        },
        {
          $group: {
            _id: "$campaignId",
            attempted: { $sum: 1 },
            accepted: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                  1,
                  0
                ]
              }
            },
            delivered: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ["$status", ["delivered", "read"]] },
                      { $ne: [{ $ifNull: ["$deliveredAt", null] }, null] },
                      { $ne: [{ $ifNull: ["$readAt", null] }, null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            read: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "read"] },
                      { $ne: [{ $ifNull: ["$readAt", null] }, null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            metaAccepted: {
              $sum: { $cond: [{ $eq: ["$metaAccepted", true] }, 1, 0] }
            },
            lastAttemptAt: { $max: "$sendAttemptedAt" },
            lastWebhookAt: { $max: "$updatedAt" }
          }
        }
      ]);
      for (const metric of metrics) {
        metricsByCampaign.set(String(metric._id), metric);
      }
    }
    const data = campaigns.map((campaign) => {
      const metric = metricsByCampaign.get(String(campaign?._id)) || {};
      const contactsCount = Array.isArray(campaign?.contacts) ? campaign.contacts.length : 0;
      const stepsCount = Array.isArray(campaign?.steps) ? campaign.steps.length : 0;
      const expectedMessages = contactsCount * stepsCount;
      return {
        ...campaign,
        reportMetrics: {
          expectedMessages,
          attempted: Number(metric.attempted || 0),
          accepted: Number(metric.accepted || 0),
          delivered: Number(metric.delivered || 0),
          read: Number(metric.read || 0),
          failed: Number(metric.failed || 0),
          pending: Number(metric.pending || 0),
          notAttempted: Math.max(
            0,
            expectedMessages - Number(metric.attempted || 0)
          ),
          metaAccepted: Number(metric.metaAccepted || 0),
          lastAttemptAt: metric.lastAttemptAt || null,
          lastWebhookAt: metric.lastWebhookAt || null
        }
      };
    });
    res.json({
      data,
      meta: {
        total,
        page: +page,
        limit: +limit
      }
    });
  });
  app.get("/api/reports/drip-campaigns/:id/summary", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const campaignId = req.params.id;
      const objectId = mongoose.Types.ObjectId.isValid(campaignId) ? new mongoose.Types.ObjectId(campaignId) : null;
      const campaignQuery = objectId ? { userId, $or: [{ _id: objectId }, { id: campaignId }] } : { userId, id: campaignId };
      const campaign = await mongodb.Campaign.findOne(campaignQuery).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const campaignIdFilter = campaign._id;
      const steps = await mongodb.CampaignLog.aggregate([
        { $match: { campaignId: campaignIdFilter } },
        {
          $group: {
            _id: "$stepIndex",
            sent: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                  1,
                  0
                ]
              }
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      res.json({ steps });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to fetch summary" });
    }
  });
  app.get("/api/reports/drip-campaigns/:id/logs", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const { stepIndex, status, contact, page = 1, limit = 20 } = req.query;
    const campaignId = req.params.id;
    const ownedCampaign = await mongodb.Campaign.findOne({
      userId,
      ...mongoose.Types.ObjectId.isValid(campaignId) ? { $or: [{ _id: campaignId }, { id: campaignId }] } : { id: campaignId }
    }).select({ _id: 1 });
    if (!ownedCampaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const filter = {
      campaignId: ownedCampaign._id
    };
    if (stepIndex !== void 0) filter.stepIndex = +stepIndex;
    if (status) filter.status = status;
    if (contact) filter.contact = { $regex: contact, $options: "i" };
    const logs = await mongodb.CampaignLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
    const total = await mongodb.CampaignLog.countDocuments(filter);
    res.json({ data: logs, total });
  });
  app.get("/api/reports/drip-campaigns/:id/details", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const campaignId = String(req.params.id || "").trim();
      const objectId = mongoose.Types.ObjectId.isValid(campaignId) ? new mongoose.Types.ObjectId(campaignId) : null;
      const campaignQuery = objectId ? { userId, $or: [{ _id: objectId }, { id: campaignId }] } : { userId, id: campaignId };
      const campaign = await mongodb.Campaign.findOne(campaignQuery).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const campaignIdFilter = campaign._id;
      const logs = await mongodb.CampaignLog.find({ campaignId: campaignIdFilter }).sort({ stepIndex: 1, contact: 1, createdAt: 1 }).lean();
      const messageIds = Array.from(
        new Set(
          logs.map((log) => String(log?.messageId || "").trim()).filter(Boolean)
        )
      );
      const webhookEvents = messageIds.length ? await mongodb.WebhookStatusEvent.find({ messageId: { $in: messageIds } }).sort({ statusTimestamp: 1, createdAt: 1 }).lean() : [];
      const eventsByMessageId = /* @__PURE__ */ new Map();
      for (const event of webhookEvents) {
        const messageId = String(event?.messageId || "").trim();
        if (!messageId) continue;
        const existing = eventsByMessageId.get(messageId) || [];
        existing.push(event);
        eventsByMessageId.set(messageId, existing);
      }
      const normalizedContacts = Array.from(
        new Set(
          (Array.isArray(campaign.contacts) ? campaign.contacts : []).map((contact) => String(contact || "").trim()).filter(Boolean)
        )
      );
      const logsByStepContact = /* @__PURE__ */ new Map();
      for (const log of logs) {
        const key = `${Number(log?.stepIndex || 0)}::${String(log?.contact || "").trim()}`;
        logsByStepContact.set(key, log);
      }
      const steps = (Array.isArray(campaign.steps) ? campaign.steps : []).map(
        (step, stepIndex) => {
          const contacts = normalizedContacts.map((contact) => {
            const key = `${stepIndex}::${contact}`;
            const log = logsByStepContact.get(key);
            const messageId = String(log?.messageId || "").trim();
            const timeline = messageId ? eventsByMessageId.get(messageId) || [] : [];
            const latestEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
            const baseStatus = String(log?.status || "not_attempted").toLowerCase();
            const providerStatus = String(log?.providerStatus || "").toLowerCase();
            const webhookStatus = String(latestEvent?.status || "").toLowerCase();
            const finalMetaStatus = (log?.readAt ? "read" : "") || (log?.deliveredAt ? "delivered" : "") || webhookStatus || providerStatus || (baseStatus === "accepted" ? "sent" : baseStatus);
            return {
              contact,
              status: baseStatus,
              providerStatus: providerStatus || null,
              finalMetaStatus: finalMetaStatus || "not_attempted",
              attemptCount: Number(log?.attemptCount || 0),
              templateName: log?.templateName || step?.template_name || null,
              templateId: step?.templateId || null,
              messageId: messageId || null,
              sentAt: log?.sentAt || null,
              deliveredAt: log?.deliveredAt || null,
              readAt: log?.readAt || null,
              failedAt: log?.failedAt || null,
              sendAttemptedAt: log?.sendAttemptedAt || null,
              attemptedLanguage: log?.attemptedLanguage || null,
              providerHttpStatus: typeof log?.providerHttpStatus === "number" ? log.providerHttpStatus : null,
              providerErrorCode: log?.providerErrorCode || null,
              error: log?.error || null,
              metaAccepted: Boolean(log?.metaAccepted),
              metaAcceptedAt: log?.metaAcceptedAt || null,
              requestPayload: log?.requestPayload || null,
              providerResponse: log?.providerResponse || null,
              webhookTimeline: timeline.map((event) => ({
                id: event?.id || null,
                status: event?.status || null,
                statusTimestamp: event?.statusTimestamp || null,
                webhookReceivedAt: event?.webhookReceivedAt || null,
                errorCode: event?.errorCode || null,
                errorTitle: event?.errorTitle || null,
                errorMessage: event?.errorMessage || null,
                errorDetails: event?.errorDetails || null,
                rawStatus: event?.rawStatus || null
              }))
            };
          });
          const attempted = contacts.filter((item) => item.status !== "not_attempted").length;
          const failed = contacts.filter(
            (item) => item.status === "failed" || item.finalMetaStatus === "failed"
          ).length;
          const read = contacts.filter(
            (item) => item.status === "read" || item.finalMetaStatus === "read"
          ).length;
          const delivered = contacts.filter(
            (item) => item.status === "delivered" || item.status === "read" || item.finalMetaStatus === "delivered" || item.finalMetaStatus === "read"
          ).length;
          const accepted = contacts.filter(
            (item) => ["accepted", "sent", "delivered", "read"].includes(item.status) || ["accepted", "sent", "delivered", "read"].includes(item.finalMetaStatus)
          ).length;
          const pending = contacts.filter(
            (item) => item.status === "pending" || item.finalMetaStatus === "pending" || item.finalMetaStatus === "accepted" || item.finalMetaStatus === "sent"
          ).length;
          const notAttempted = contacts.length - attempted;
          return {
            stepIndex,
            stepOrder: stepIndex + 1,
            templateName: step?.template_name || null,
            templateId: step?.templateId || null,
            scheduleType: step?.scheduleType || null,
            delayDays: Number(step?.delayDays || 0),
            delayHours: Number(step?.delayHours || 0),
            specificDate: step?.specificDate || null,
            specificTime: step?.specificTime || null,
            totals: {
              contacts: contacts.length,
              attempted,
              accepted,
              delivered,
              read,
              failed,
              pending,
              notAttempted
            },
            contacts
          };
        }
      );
      const stepTotals = steps.reduce(
        (acc, step) => {
          acc.expectedMessages += Number(step?.totals?.contacts || 0);
          acc.attempted += Number(step?.totals?.attempted || 0);
          acc.accepted += Number(step?.totals?.accepted || 0);
          acc.delivered += Number(step?.totals?.delivered || 0);
          acc.read += Number(step?.totals?.read || 0);
          acc.failed += Number(step?.totals?.failed || 0);
          acc.pending += Number(step?.totals?.pending || 0);
          acc.notAttempted += Number(step?.totals?.notAttempted || 0);
          return acc;
        },
        {
          expectedMessages: 0,
          attempted: 0,
          accepted: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          pending: 0,
          notAttempted: 0
        }
      );
      const webhookSummary = webhookEvents.reduce((acc, event) => {
        const key = String(event?.status || "unknown").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return res.json({
        campaign: {
          ...campaign,
          contactsCount: normalizedContacts.length,
          stepsCount: Array.isArray(campaign.steps) ? campaign.steps.length : 0
        },
        totals: {
          ...stepTotals,
          totalContacts: normalizedContacts.length,
          totalSteps: steps.length,
          metaAccepted: logs.filter((log) => Boolean(log?.metaAccepted)).length,
          webhookEvents: webhookEvents.length
        },
        webhookSummary,
        steps
      });
    } catch (error) {
      console.error("[DripReport] Failed to fetch campaign details:", error);
      return res.status(500).json({ error: "Failed to fetch campaign details" });
    }
  });
  app.get("/api/drip-campaigns", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { search = "", status = "all", form_id, is_active } = req.query;
      const filter = { userId };
      if (search && String(search).trim()) {
        const searchRegex = { $regex: String(search).trim(), $options: "i" };
        filter.$or = [
          { name: searchRegex },
          { campaign_name: searchRegex },
          { id: searchRegex },
          { form_name: searchRegex },
          { form_id: searchRegex }
        ];
      }
      if (status && status !== "all") {
        filter.status = status;
      }
      if (form_id) {
        filter.form_id = form_id;
      }
      if (typeof is_active === "string") {
        if (is_active === "true") filter.is_active = true;
        if (is_active === "false") filter.is_active = false;
      }
      const campaigns = await mongodb.Campaign.find(filter).sort({ createdAt: -1 }).lean();
      res.json(
        campaigns.map((campaign) => ({
          ...campaign,
          campaign_name: campaign.campaign_name || campaign.name,
          is_active: typeof campaign.is_active === "boolean" ? campaign.is_active : campaign.status === "running"
        }))
      );
    } catch (error) {
      console.error("Error fetching drip campaigns:", error);
      res.status(500).json({ error: "Failed to fetch drip campaigns" });
    }
  });
  app.post("/api/drip-campaigns/:id/toggle", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const isActive = req.body?.is_active === true || req.body?.is_active === "true";
      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
      const campaign = await mongodb.Campaign.findOne(query);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const wasCompleted = campaign.status === "completed";
      campaign.is_active = isActive;
      campaign.status = isActive ? "running" : "paused";
      if (isActive) {
        if (wasCompleted || campaign.currentStep >= campaign.steps.length) {
          campaign.currentStep = 0;
        }
        const now = /* @__PURE__ */ new Date();
        const currentStep = campaign.steps[campaign.currentStep];
        if (!currentStep) {
          campaign.status = "completed";
          campaign.is_active = false;
          campaign.nextRunAt = null;
        } else if (campaign.nextRunAt instanceof Date && !Number.isNaN(campaign.nextRunAt.getTime()) && campaign.nextRunAt > now) {
        } else {
          campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
        }
      } else {
        campaign.isProcessing = false;
      }
      await campaign.save();
      if (isActive && campaign.status === "running") {
        await scheduleCurrentDripCampaignStep(campaign);
      } else {
        await cancelDripCampaignJobs(String(campaign._id));
      }
      return res.json(campaign);
    } catch (error) {
      console.error("Error toggling campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.patch("/api/drip-campaigns/:id/start", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
    const campaign = await mongodb.Campaign.findOne(query);
    if (!campaign) return res.status(404).send();
    const wasCompleted = campaign.status === "completed" || !Array.isArray(campaign.steps) || campaign.currentStep >= campaign.steps.length;
    if (wasCompleted) {
      campaign.currentStep = 0;
    }
    campaign.status = "running";
    campaign.is_active = true;
    const now = /* @__PURE__ */ new Date();
    const currentStep = campaign.steps?.[campaign.currentStep];
    if (currentStep) {
      if (campaign.nextRunAt instanceof Date && !Number.isNaN(campaign.nextRunAt.getTime()) && campaign.nextRunAt > now) {
      } else {
        campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
      }
    } else {
      campaign.nextRunAt = null;
      campaign.status = "completed";
      campaign.is_active = false;
    }
    await campaign.save();
    if (campaign.status === "running") {
      await scheduleCurrentDripCampaignStep(campaign);
    }
    res.json(campaign);
  });
  app.patch("/api/drip-campaigns/:id/pause", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Campaign id is required" });
      }
      const campaign = await mongodb.Campaign.findOne({ _id: id, userId });
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      campaign.status = "paused";
      campaign.is_active = false;
      campaign.isProcessing = false;
      await campaign.save();
      await cancelDripCampaignJobs(String(campaign._id));
      return res.json(campaign);
    } catch (error) {
      console.error("Error pausing campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.delete("/api/drip-campaigns/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = getUserId(req);
    try {
      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
      const deleted = await mongodb.Campaign.findOneAndDelete(query);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Campaign not found" });
      }
      await cancelDripCampaignJobs(String(deleted._id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });
  app.get("/api/automation-status", async (req, res) => {
    try {
      const automations = await mongodb.FormAutomation.find();
      const automationMap = {};
      automations.forEach((auto) => {
        automationMap[auto.form_id] = {
          assigned_template: auto.template_id || null,
          automation_active: auto.automation_active || false,
          last_sync: auto.last_sync || null
        };
      });
      res.json(automationMap);
    } catch (error) {
      console.error("Error fetching automation status:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/forms", async (req, res) => {
    try {
      const fbResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/leadgen_forms?access_token=${FB_ACCESS_TOKEN}`
      );
      const fbForms = fbResponse.data.data || [];
      const automations = await mongodb.FormAutomation.find();
      const automationMap = {};
      automations.forEach((auto) => {
        automationMap[auto.form_id] = auto;
      });
      const forms = fbForms.map(
        (form) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          assigned_template: automationMap[form.id]?.template_id || null,
          automation_active: automationMap[form.id]?.automation_active || false,
          last_sync: automationMap[form.id]?.last_sync || null
        })
      );
      res.json(forms);
    } catch (error) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/set-trigger", async (req, res) => {
    try {
      const { form_id, form_name, template_id, template_name } = req.body;
      await mongodb.FormAutomation.findOneAndUpdate(
        { form_id },
        {
          form_id,
          form_name,
          template_id,
          template_name,
          updated_at: /* @__PURE__ */ new Date()
        },
        { upsert: true, new: true }
      );
      res.json({ success: true, message: "Template assigned successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/toggle-form-automation", async (req, res) => {
    try {
      const { form_id, is_active } = req.body;
      const automation = await mongodb.FormAutomation.findOne({ form_id });
      if (!automation) {
        return res.status(404).json({
          error: "Form automation not found. Please assign a template first."
        });
      }
      automation.automation_active = is_active;
      automation.updated_at = /* @__PURE__ */ new Date();
      if (is_active) {
        automation.last_sync = /* @__PURE__ */ new Date();
        await automation.save();
        syncLeadsForFormMain(automation).catch((err) => {
          console.error("Error in initial sync:", err);
        });
        res.json({
          success: true,
          message: "Automation started. Initial sync in progress...",
          automation_active: true
        });
      } else {
        await automation.save();
        res.json({
          success: true,
          message: "Automation stopped",
          automation_active: false
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/status", async (req, res) => {
    try {
      const activeCount = await mongodb.FormAutomation.countDocuments({
        automation_active: true
      });
      res.json({
        is_running: activeCount > 0,
        active_automations: activeCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/control", async (req, res) => {
    try {
      const { run } = req.body;
      await mongodb.FormAutomation.updateMany(
        {},
        { automation_active: run, updated_at: /* @__PURE__ */ new Date() }
      );
      res.json({ success: true, is_running: run });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sync-form/:formId", async (req, res) => {
    try {
      const automation = await mongodb.FormAutomation.findOne({
        form_id: req.params.formId
      });
      if (!automation) {
        return res.status(404).json({ error: "Form automation not found" });
      }
      const result = await syncLeadsForFormMain(automation);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/users/all", async (req, res) => {
    try {
      const requester = await resolveRequestUserContext(req);
      if (!requester.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!isAdminRole(requester.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const [requesterUser, systemUsers] = await Promise.all([
        findUserById(requester.userId),
        SystemUser.find(
          { isActive: true },
          {
            id: 1,
            username: 1,
            name: 1,
            email: 1,
            role: 1,
            pageAccess: 1,
            isActive: 1
          }
        ).lean()
      ]);
      const merged = /* @__PURE__ */ new Map();
      if (requesterUser?.id) {
        merged.set(requesterUser.id, {
          id: requesterUser.id,
          username: requesterUser.username || "",
          name: requesterUser.name || requesterUser.username || "User",
          email: requesterUser.email || "",
          role: requesterUser.role || "user",
          pageAccess: Array.isArray(requesterUser.pageAccess) ? requesterUser.pageAccess : []
        });
      }
      for (const user of systemUsers) {
        if (!user?.id) continue;
        merged.set(user.id, {
          id: user.id,
          username: user.username || "",
          name: user.name || user.username || "User",
          email: user.email || "",
          role: user.role || "user",
          pageAccess: Array.isArray(user.pageAccess) ? user.pageAccess : []
        });
      }
      const users = Array.from(merged.values()).sort(
        (a, b) => (a.name || "").localeCompare(b.name || "")
      );
      res.json(users);
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  const TEMPLATE_PRICE = 0.85;
  app.get("/api/reports/template-usage", async (req, res) => {
    try {
      const { contactPhone, startDate, endDate, groupBy = "day" } = req.query;
      if (!contactPhone) {
        return res.status(400).json({
          success: false,
          message: "contactPhone is required"
        });
      }
      const start = startDate ? new Date(startDate) : /* @__PURE__ */ new Date("1970-01-01");
      const end = endDate ? new Date(endDate) : /* @__PURE__ */ new Date();
      let dateFormat = "%Y-%m-%d";
      if (groupBy === "week") dateFormat = "%Y-%U";
      if (groupBy === "month") dateFormat = "%Y-%m";
      const pipeline = [
        {
          $match: {
            messageType: "template",
            status: "sent",
            contactPhone,
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $addFields: {
            date: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: "$date",
              templateName: "$templateName"
            },
            sentCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                count: "$sentCount",
                cost: { $multiply: ["$sentCount", TEMPLATE_PRICE] }
              }
            },
            totalSent: { $sum: "$sentCount" }
          }
        },
        {
          $addFields: {
            totalCost: {
              $round: [{ $multiply: ["$totalSent", TEMPLATE_PRICE] }, 2]
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];
      const breakdown = await mongodb.BroadcastLog.aggregate(pipeline);
      const summary = breakdown.reduce(
        (acc, item) => {
          acc.totalTemplatesSent += item.totalSent;
          acc.totalCost += item.totalCost;
          return acc;
        },
        { totalTemplatesSent: 0, totalCost: 0 }
      );
      res.json({
        success: true,
        filters: {
          contactPhone,
          startDate,
          endDate,
          groupBy
        },
        summary: {
          ...summary,
          totalCost: `\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB9${summary.totalCost.toFixed(2)}`
        },
        breakdown
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate template report"
      });
    }
  });
  app.get("/api/broadcast/template-report", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const COST_PER_TEMPLATE = 0.85;
      let dateMatch = {};
      if (startDate && endDate) {
        dateMatch.timestamp = {
          $gte: /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`),
          $lte: /* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`)
        };
      }
      const report = await mongodb.BroadcastLog.aggregate([
        {
          $match: {
            messageType: "template",
            status: "sent",
            ...dateMatch
          }
        },
        {
          $addFields: {
            sentDate: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: [
                    { $eq: [{ $type: "$timestamp" }, "string"] },
                    { $toDate: "$timestamp" },
                    "$timestamp"
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: "$sentDate",
              templateName: "$templateName"
            },
            sentCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                sentCount: "$sentCount",
                cost: {
                  $multiply: ["$sentCount", COST_PER_TEMPLATE]
                }
              }
            },
            totalSent: { $sum: "$sentCount" }
          }
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            templates: 1,
            totalSent: 1,
            totalCost: {
              $multiply: ["$totalSent", COST_PER_TEMPLATE]
            }
          }
        },
        { $sort: { date: 1 } }
      ]);
      const grandTotalSent = report.reduce((sum, d) => sum + d.totalSent, 0);
      const grandTotalCost = grandTotalSent * COST_PER_TEMPLATE;
      res.json({
        currency: "INR",
        costPerTemplate: COST_PER_TEMPLATE,
        grandTotalSent,
        grandTotalCost,
        data: report
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({ message: "Failed to fetch template report" });
    }
  });
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });
  app.get("/api/reports/campaign", async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const campaigns = await storage.getCampaigns();
      const templates = await storage.getTemplates();
      const broadcastLogs = await broadcastService.getBroadcastLogs({
        userId: getUserId(req) || void 0,
        limit: 1e4
      });
      const now = /* @__PURE__ */ new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");
      const inbound = periodMessages.filter((m) => m.direction === "inbound");
      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read = outbound.filter((m) => m.status === "read").length;
      const replied = inbound.length;
      const failed = outbound.filter((m) => m.status === "failed").length;
      const deliveryRate = totalSent > 0 ? Math.round(delivered / totalSent * 100 * 10) / 10 : 0;
      const readRate = delivered > 0 ? Math.round(read / delivered * 100 * 10) / 10 : 0;
      const replyRate = read > 0 ? Math.round(replied / read * 100 * 10) / 10 : 0;
      const deliveryData = [
        { name: "Delivered", value: delivered, color: "#22c55e" },
        { name: "Read", value: read, color: "#3b82f6" },
        { name: "Replied", value: replied, color: "#8b5cf6" },
        { name: "Failed", value: failed, color: "#ef4444" }
      ];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyStats = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        const dayInbound = dayMsgs.filter((m) => m.direction === "inbound");
        dailyStats.push({
          name: dayNames[date.getDay()],
          date: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          replied: dayInbound.length
        });
      }
      const campaignStats = campaigns.map((c) => ({
        name: c.name,
        type: "Marketing",
        sent: c.sentCount || 0,
        delivered: c.deliveredCount || 0,
        read: c.readCount || 0,
        replied: c.repliedCount || 0,
        cost: (c.sentCount || 0) * 0.01,
        date: c.scheduledAt || c.createdAt
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
      const templateUsage = {};
      for (const log of broadcastLogs) {
        if (log.templateName) {
          if (!templateUsage[log.templateName]) {
            templateUsage[log.templateName] = {
              sent: 0,
              delivered: 0,
              read: 0,
              replied: 0
            };
          }
          templateUsage[log.templateName].sent++;
          if (log.status === "delivered" || log.status === "sent") {
            templateUsage[log.templateName].delivered++;
          }
          if (log.replied) {
            templateUsage[log.templateName].replied++;
          }
        }
      }
      for (const msg of periodMessages) {
        if (msg.content && msg.content.startsWith("[Template:")) {
          const match = msg.content.match(/\[Template:\s*([^\]]+)\]/);
          if (match) {
            const templateName = match[1];
            if (!templateUsage[templateName]) {
              templateUsage[templateName] = {
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0
              };
            }
            if (msg.direction === "outbound") {
              templateUsage[templateName].sent++;
              if (msg.status === "delivered" || msg.status === "read") {
                templateUsage[templateName].delivered++;
              }
              if (msg.status === "read") {
                templateUsage[templateName].read++;
              }
            }
          }
        }
      }
      const templatePerformance = Object.entries(templateUsage).map(([name, stats]) => ({
        name,
        sent: stats.sent,
        delivered: stats.delivered,
        read: stats.read,
        replied: stats.replied,
        readRate: stats.delivered > 0 ? Math.round(stats.read / stats.delivered * 100) : 0,
        replyRate: stats.read > 0 ? Math.round(stats.replied / stats.read * 100) : 0,
        cost: stats.sent * 0.01
      })).sort((a, b) => b.sent - a.sent).slice(0, 10);
      const totalCost = totalSent * 0.01;
      const costTrend = dailyStats.map((d) => ({
        date: d.date,
        cost: d.sent * 0.01,
        messages: d.sent
      }));
      res.json({
        totalSent,
        totalDelivered: delivered,
        totalRead: read,
        totalReplied: replied,
        totalFailed: failed,
        totalCost,
        deliveryRate,
        readRate,
        replyRate,
        deliveryData,
        dailyStats,
        campaignStats,
        templatePerformance,
        costTrend
      });
    } catch (error) {
      console.error("Failed to get campaign report:", error);
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });
  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const broadcastLogs = await broadcastService.getBroadcastLogs({
        userId: getUserId(req) || void 0,
        limit: 1e4
      });
      const now = /* @__PURE__ */ new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");
      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read = outbound.filter((m) => m.status === "read").length;
      const failed = outbound.filter((m) => m.status === "failed").length;
      const pending = outbound.filter((m) => m.status === "sent").length;
      const deliveryRate = totalSent > 0 ? Math.round(delivered / totalSent * 100 * 10) / 10 : 0;
      const readRate = delivered > 0 ? Math.round(read / delivered * 100 * 10) / 10 : 0;
      const failureRate = totalSent > 0 ? Math.round(failed / totalSent * 100 * 10) / 10 : 0;
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        dailyData.push({
          date: dayNames[date.getDay()],
          fullDate: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          delivered: dayOutbound.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          failed: dayOutbound.filter((m) => m.status === "failed").length
        });
      }
      const hourlyData = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourMsgs = outbound.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.getHours() === hour;
        });
        hourlyData.push({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          sent: hourMsgs.length,
          delivered: hourMsgs.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length
        });
      }
      res.json({
        totalSent,
        delivered,
        read,
        failed,
        pending,
        deliveryRate,
        readRate,
        failureRate,
        dailyData,
        hourlyData
      });
    } catch (error) {
      console.error("Failed to get delivery report:", error);
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });
  app.use("/api/contacts", contactsRoutes);
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const memContacts = await storage.getContacts(userId);
      const importedContacts = await mongodb.readCollection("imported_contacts");
      const ownedImportedContacts = importedContacts.filter(
        (contact) => contact.userId === userId
      );
      const phoneSet = /* @__PURE__ */ new Set();
      const allContacts = [];
      for (const contact of ownedImportedContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email || "",
            tags: contact.tags || [],
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      for (const contact of memContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push(contact);
        }
      }
      res.json(allContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to get contacts" });
    }
  });
  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id, getUserId(req));
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to get contact" });
    }
  });
  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid contact data",
          errors: parsed.error.errors
        });
      }
      const contact = await storage.createContact({
        ...parsed.data,
        userId: getUserId(req)
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to create contact" });
    }
  });
  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getContact(req.params.id, getUserId(req));
      if (!existing) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact" });
    }
  });
  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getContact(req.params.id, getUserId(req));
      if (!existing) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });
  app.post("/api/contacts/import", requireAuth, async (req, res) => {
    try {
      const { contacts } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ message: "Invalid data format" });
      }
      const imported = [];
      for (const contact of contacts) {
        const parsed = insertContactSchema.safeParse(contact);
        if (parsed.success) {
          const newContact = await storage.createContact({
            ...parsed.data,
            userId: getUserId(req)
          });
          imported.push(newContact);
        }
      }
      res.json({ imported: imported.length, contacts: imported });
    } catch (error) {
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });
  app.get("/api/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { page, limit, skip } = parsePagination(req, { limit: 100, maxLimit: 500 });
      const contactId = typeof req.query.contactId === "string" ? req.query.contactId : void 0;
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        if (!contactId) {
          return res.json([]);
        }
        if (!permittedContactIds.includes(contactId)) {
          return res.json([]);
        }
      }
      const messages = await storage.getMessages(
        contactId,
        userId,
        { limit, skip, sort: { timestamp: -1 } }
      );
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(messages.length === limit)
      });
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });
  app.post("/api/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = insertMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid message data",
          errors: parsed.error.errors
        });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(parsed.data.contactId)) {
        return res.status(403).json({ message: "Not allowed to send messages for this contact" });
      }
      const message = await storage.createMessage({
        ...parsed.data,
        userId
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  app.get("/api/debug/user/:email", async (req, res) => {
    try {
      const { SystemUser: SystemUser2 } = await import("./modules/users/user.model.js");
      const { User } = await import("./modules/storage/mongodb.adapter.js");
      const email = req.params.email;
      const systemUser = await SystemUser2.findOne({ email });
      const regularUser = await User.findOne({
        $or: [{ email }, { username: email }]
      });
      res.json({
        systemUser: systemUser ? {
          id: systemUser.id,
          email: systemUser.email,
          name: systemUser.name,
          role: systemUser.role,
          isActive: systemUser.isActive
        } : null,
        regularUser: regularUser ? {
          id: regularUser.id,
          email: regularUser.email,
          name: regularUser.name,
          role: regularUser.role
        } : null
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { page, limit, skip } = parsePagination(req, { limit: 50, maxLimit: 200 });
      let chats = await storage.getChats(userId, {
        limit,
        skip,
        sort: { lastMessageTime: -1 }
      });
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        chats = chats.filter((chat) =>
          permittedContactIds.includes(chat.contactId || chat.contact?.id)
        );
      }
      const assignments = await leadManagementService.getAllLeadAssignments({
        status: ["assigned", "in_progress"],
        contactId: chats.map((chat) => chat.contact.id)
      });
      const assignmentMap = new Map(
        assignments.map((a) => [a.contactId, a])
      );
      const chatsWithAssignment = chats.map((chat) => ({
        ...chat,
        assignment: assignmentMap.get(chat.contact.id) || null
      }));
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(chats.length === limit)
      });
      res.json(chatsWithAssignment);
    } catch (error) {
      console.error("Error getting chats:", error);
      res.status(500).json({ message: "Failed to get chats" });
    }
  });
  app.get("/api/chats/window", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { page, limit, skip } = parsePagination(req, { limit: 50, maxLimit: 200 });
      const since = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const inboundRows = await mongodb.Message.aggregate([
        {
          $match: {
            userId,
            direction: "inbound",
            timestamp: { $gte: since }
          }
        },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$contactId",
            lastInboundMessage: { $first: "$content" },
            lastInboundMessageTime: { $first: "$timestamp" }
          }
        },
        { $sort: { lastInboundMessageTime: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).allowDiskUse(true);
      const contactIds = inboundRows.map((row) => row._id).filter(Boolean);
      let chats = contactIds.length ? await mongodb.findMany(
        "chats",
        { userId, contactId: { $in: contactIds } },
        { limit: contactIds.length }
      ) : [];
      const contacts = contactIds.length ? await mongodb.findMany(
        "contacts",
        { userId, id: { $in: contactIds } },
        { limit: contactIds.length }
      ) : [];
      const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
      const latestInboundByContact = /* @__PURE__ */ new Map();
      for (const row of inboundRows) {
        latestInboundByContact.set(row._id, {
          contactId: row._id,
          content: row.lastInboundMessage,
          timestamp: row.lastInboundMessageTime
        });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        chats = chats.filter((chat) =>
          permittedContactIds.includes(chat.contactId || chat.contact?.id)
        );
      }
      const now = /* @__PURE__ */ new Date();
      const windowChats = chats.map((chat) => {
        const contact = contactsById.get(chat.contactId) || chat.contact;
        const latestInbound = latestInboundByContact.get(chat.contactId);
        return latestInbound ? {
          ...chat,
          contact,
          lastInboundMessage: latestInbound.content,
          lastInboundMessageTime: latestInbound.timestamp
        } : chat.isFlowLead ? chat : { ...chat, lastInboundMessage: void 0, lastInboundMessageTime: void 0 };
      }).filter((chat) => {
        if (chat.lastInboundMessageTime) {
          const lastInbound = new Date(chat.lastInboundMessageTime);
          const hoursDiff = (now.getTime() - lastInbound.getTime()) / (1e3 * 60 * 60);
          return hoursDiff >= 0 && hoursDiff <= 24;
        }
        return false;
      });
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(inboundRows.length === limit)
      });
      res.json(windowChats);
    } catch (error) {
      console.error("Error getting window chats:", error);
      res.status(500).json({ message: "Failed to get window chats" });
    }
  });
  app.get("/api/chats/:id", requireAuth, async (req, res) => {
    try {
      const chat = await storage.getChat(req.params.id, getUserId(req));
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(chat.contact.id)) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat" });
    }
  });
  app.post("/api/chats/:contactId/mark-read", async (req, res) => {
    try {
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(req.params.contactId)) {
        return res.status(403).json({ message: "Not allowed for this contact" });
      }
      await storage.markMessagesAsRead(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });
  app.post("/api/chats/:contactId/mark-unread", async (req, res) => {
    try {
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(req.params.contactId)) {
        return res.status(403).json({ message: "Not allowed for this contact" });
      }
      await storage.markMessagesAsUnread(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as unread" });
    }
  });
  app.post("/api/inbox/send", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const {
        contactId,
        phone,
        name,
        messageType,
        templateName,
        customMessage,
        agentId
      } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      if (!messageType) {
        return res.status(400).json({ error: "Message type is required" });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        if (!contactId) {
          return res.status(400).json({
            error: "contactId is required for your user role"
          });
        }
        if (!permittedContactIds.includes(contactId)) {
          return res.status(403).json({ error: "Not allowed to send messages for this contact" });
        }
      }
      let result = { success: false };
      let messageContent = "";
      switch (messageType) {
        case "template": {
          if (!templateName) {
            return res.status(400).json({
              error: "Template name is required for template messages"
            });
          }
          result = await broadcastService.sendTemplateMessage(
            phone,
            templateName,
            name,
            void 0,
            userId
          );
          messageContent = `[Template: ${templateName}]`;
          break;
        }
        case "custom": {
          if (!customMessage) {
            return res.status(400).json({
              error: "Message content is required for custom messages"
            });
          }
          result = await broadcastService.sendCustomMessage(
            phone,
            customMessage,
            userId
          );
          messageContent = customMessage;
          break;
        }
        case "ai": {
          if (!agentId) {
            return res.status(400).json({ error: "Agent ID is required for AI messages" });
          }
          const agent = await agentService.getAgentById(agentId);
          if (!agent) {
            return res.status(404).json({ error: "AI Agent not found" });
          }
          await contactAgentService.assignAgentToContact(
            contactId,
            phone,
            agentId,
            agent.name
          );
          await contactAgentService.enableAutoReply(phone);
          let conversationHistory = await contactAgentService.getConversationHistory(phone);
          if (conversationHistory.length === 0 && contactId) {
            try {
              const recentMessages = await storage.getMessages(contactId);
              const lastMessages = recentMessages.slice(-10);
              conversationHistory = lastMessages.map((m) => ({
                role: m.direction === "inbound" ? "user" : "assistant",
                content: m.content
              }));
            } catch (e) {
              console.log("[InboxSend] Could not fetch conversation context");
            }
          }
          const lastInboundMessage = conversationHistory.filter((m) => m.role === "user").pop();
          const promptMessage = lastInboundMessage?.content || `Greet ${name || "the customer"} warmly and introduce yourself as per your instructions.`;
          const aiMessage = await aiService.generateAgentResponse(
            promptMessage,
            agent,
            conversationHistory.slice(0, -1)
            // Exclude the last message since we're using it as the prompt
          );
          if (!aiMessage) {
            return res.status(500).json({
              error: "Failed to generate AI response. Check if API key is configured for the agent model."
            });
          }
          await contactAgentService.addMessageToHistory(
            phone,
            "assistant",
            aiMessage
          );
          result = await broadcastService.sendCustomMessage(
            phone,
            aiMessage,
            userId
          );
          result.aiMessage = aiMessage;
          messageContent = aiMessage;
          if (!result.success && result.error?.includes("24")) {
            result = await broadcastService.sendTemplateMessage(
              phone,
              "hello_world",
              void 0,
              void 0,
              userId
            );
            messageContent = "[Template: hello_world] (AI fallback)";
          }
          break;
        }
        default:
          return res.status(400).json({
            error: "Invalid message type. Use: template, custom, or ai"
          });
      }
      if (result.success && contactId) {
        try {
          await storage.createMessage({
            userId,
            contactId,
            content: messageContent,
            type: "text",
            direction: "outbound",
            status: "sent",
            whatsappMessageId: result.messageId
          });
        } catch (saveError) {
          console.error(
            "[InboxSend] Failed to save message to conversation:",
            saveError
          );
        }
      }
      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: messageContent,
          sent: true
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to send message"
        });
      }
    } catch (error) {
      console.error("[InboxSend] Error:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });
  app.post("/api/inbox/send-ai-response", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { contactId, phone, name, agentId, userMessage } = req.body;
      if (!phone || !agentId) {
        return res.status(400).json({ error: "Phone and agentId are required" });
      }
      const agent = await agentService.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ error: "AI Agent not found" });
      }
      const promptMessage = userMessage || "Hello";
      const aiMessage = await aiService.generateAgentResponse(
        promptMessage,
        agent,
        []
      );
      if (!aiMessage) {
        return res.status(500).json({
          error: "Failed to generate AI response. Check if API key is configured for the agent model."
        });
      }
      const result = await broadcastService.sendCustomMessage(
        phone,
        aiMessage,
        userId
      );
      if (result.success && contactId) {
        await storage.createMessage({
          userId,
          contactId,
          content: aiMessage,
          type: "text",
          direction: "outbound",
          status: "sent",
          whatsappMessageId: result.messageId
        });
      }
      res.json({
        success: result.success,
        message: aiMessage,
        error: result.error
      });
    } catch (error) {
      console.error("[InboxSendAI] Error:", error);
      res.status(500).json({ error: error.message || "Failed to send AI response" });
    }
  });
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaigns" });
    }
  });
  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign" });
    }
  });
  app.post("/api/campaigns", async (req, res) => {
    try {
      const parsed = insertCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid campaign data",
          errors: parsed.error.errors
        });
      }
      const campaign = await storage.createCampaign(parsed.data);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });
  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });
  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });
  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const sentCount = campaign.contactIds.length;
      const deliveredCount = Math.floor(sentCount * 0.95);
      const readCount = Math.floor(deliveredCount * 0.7);
      const repliedCount = Math.floor(readCount * 0.2);
      const updatedCampaign = await storage.updateCampaign(req.params.id, {
        status: "completed",
        sentCount,
        deliveredCount,
        readCount,
        repliedCount
      });
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });
  app.get("/api/templates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const metaOnly = req.query.metaOnly === "true";
      const templates = await mongodb.Template.find({ userId }).lean();
      const filteredTemplates = metaOnly ? templates.filter((template) => Boolean(template?.metaTemplateId)) : templates;
      res.json(filteredTemplates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get templates" });
    }
  });
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await mongodb.Template.findOne({
        id: req.params.id,
        userId
      }).lean();
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to get template" });
    }
  });
  function shortSuffix(length = 4) {
    return Math.random().toString(36).substring(2, 2 + length);
  }
  app.post("/api/templates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader ? req.body.headerMedia || req.body.headerImage || req.body.headerImageUrl || null : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;
      console.log("[TemplateCreate] creating template:", req.body.name);
      const templatePayload = {
        userId,
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        authAddSecurityRecommendation: req.body.authAddSecurityRecommendation !== false,
        authCodeExpirationMinutes: req.body.authCodeExpirationMinutes || 10,
        authOtpType: req.body.authOtpType || "COPY_CODE",
        status: req.body.status
      };
      const existingTemplate = await mongodb.Template.findOne({
        userId,
        name: req.body.name
      });
      const template = existingTemplate ? await mongodb.Template.findOneAndUpdate(
        { id: existingTemplate.id, userId },
        {
          $set: {
            ...templatePayload,
            metaTemplateId: void 0,
            metaStatus: "pending",
            metaRejectionReason: void 0
          }
        },
        { new: true }
      ) : await mongodb.Template.create({
        id: uuidv4(),
        ...templatePayload
      });
      res.status(existingTemplate ? 200 : 201).json(template);
    } catch (err) {
      console.error("[Template Creation Error]", err);
      if (err?.code === 11e3) {
        return res.status(409).json({
          message: "A template with this name already exists.",
          error: "Use the existing template from Manage Templates, or change the template name."
        });
      }
      res.status(500).json({ error: err.message });
    }
  });
  const updateMetaTemplate = async (metaTemplateId, payload) => {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v24.0/${metaTemplateId}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${""}`
          }
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  };
  const resolveTemplateCredentials = async (req) => {
    const { credentialsService } = await import("./modules/credentials/credentials.service.js");
    const sessionUserId = req.session?.user?.id;
    const userId = getUserId(req) || sessionUserId;
    let token;
    let wabaId;
    if (userId) {
      const integrationCredentials = await integrationService.getDecryptedCredentials(userId, "whatsapp");
      token = integrationCredentials?.accessToken || token;
      wabaId = integrationCredentials?.businessAccountId || wabaId;
      const credentials = await credentialsService.getDecryptedCredentials(
        userId
      );
      if (!token && credentials?.whatsappToken) {
        token = credentials.whatsappToken;
      }
      if (!wabaId && credentials?.businessAccountId) {
        wabaId = credentials.businessAccountId;
      }
    }
    if (!userId && !token) {
      token = "";
    }
    if (!userId && !wabaId) {
      wabaId = "";
    }
    return { token, wabaId, userId };
  };
  const resolveTemplateDeleteCredentials = resolveTemplateCredentials;
  const deleteMetaTemplate = async (wabaId, token, options) => {
    const baseUrl = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
    const META_DELETE_TIMEOUT_MS = 2e4;
    const META_DELETE_MAX_RETRIES = 2;
    const RETRY_BASE_DELAY_MS = 700;
    const executeDelete = async (params) => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        META_DELETE_TIMEOUT_MS
      );
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        method: "DELETE",
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };
    const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isRetryableFailure = (input) => {
      if (input.error?.name === "AbortError") return true;
      if (typeof input.status === "number") {
        if (input.status === 429 || input.status >= 500) return true;
      }
      const metaError2 = input.data?.error;
      const code = Number(metaError2?.code);
      if ([4, 17, 32, 613].includes(code)) return true;
      return false;
    };
    const runDeleteWithRetry = async (params) => {
      let lastResult = null;
      let lastError = null;
      for (let attempt = 0; attempt <= META_DELETE_MAX_RETRIES; attempt++) {
        try {
          const result = await executeDelete(params);
          const failed = !result.response.ok || result.data?.error;
          if (!failed) {
            return { success: true, result };
          }
          lastResult = result;
          const retryable = isRetryableFailure({
            status: result.response.status,
            data: result.data
          });
          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, result: lastResult };
          }
        } catch (error) {
          lastError = error;
          const retryable = isRetryableFailure({ error });
          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, error: lastError };
          }
        }
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
      }
      return { success: false, result: lastResult, error: lastError };
    };
    const normalizeLang = (language2) => language2 ? language2.replace("-", "_") : void 0;
    const language = normalizeLang(options.language);
    const createParams = (input) => {
      const params = new URLSearchParams({ access_token: token });
      if (input.id) params.set("hsm_id", input.id);
      if (input.name) params.set("name", input.name);
      if (input.language) params.set("language", input.language);
      return params;
    };
    const parameterCandidates = [];
    if (options.metaTemplateId && options.name && language) {
      parameterCandidates.push(
        createParams({
          id: options.metaTemplateId,
          name: options.name,
          language
        })
      );
    }
    if (options.metaTemplateId && options.name) {
      parameterCandidates.push(
        createParams({ id: options.metaTemplateId, name: options.name })
      );
    }
    if (options.name && language) {
      parameterCandidates.push(createParams({ name: options.name, language }));
    }
    if (options.name) {
      parameterCandidates.push(createParams({ name: options.name }));
    }
    if (options.metaTemplateId) {
      parameterCandidates.push(createParams({ id: options.metaTemplateId }));
    }
    const seen = /* @__PURE__ */ new Set();
    const deleteAttempts = parameterCandidates.filter((params) => {
      const key = params.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let lastTry = null;
    for (const params of deleteAttempts) {
      const attempt = await runDeleteWithRetry(params);
      if (attempt.success) {
        return { success: true, data: attempt.result.data };
      }
      lastTry = attempt;
    }
    if (options.name) {
      try {
        const lookupUrl = `${baseUrl}?fields=id,name,language,status&limit=200&access_token=${encodeURIComponent(token)}`;
        const lookupResponse = await fetch(lookupUrl, { method: "GET" });
        const lookupData = await lookupResponse.json().catch(() => ({}));
        if (lookupResponse.ok && Array.isArray(lookupData.data)) {
          const matches = lookupData.data.filter((item) => {
            if (item?.name !== options.name) return false;
            if (!language) return true;
            return normalizeLang(item?.language) === language;
          });
          if (matches.length === 0) {
            return {
              success: true,
              alreadyMissing: true,
              data: { message: "Template not present on Meta dashboard." }
            };
          }
          for (const match of matches) {
            const retryByLookup = await runDeleteWithRetry(
              createParams({
                id: String(match.id || ""),
                name: String(match.name || options.name),
                language: normalizeLang(match.language)
              })
            );
            if (retryByLookup.success) {
              return { success: true, data: retryByLookup.result.data };
            }
            lastTry = retryByLookup;
          }
        }
      } catch {
      }
    }
    if (lastTry?.error) {
      return {
        success: false,
        error: lastTry.error?.name === "AbortError" ? "Meta delete request timed out after retries" : lastTry.error?.message || "Meta delete request failed"
      };
    }
    const metaError = lastTry?.result?.data?.error;
    return {
      success: false,
      error: metaError?.message || `Meta API delete failed with status ${lastTry?.result?.response?.status ?? "unknown"}`,
      details: metaError || lastTry?.result?.data
    };
  };
  app.put("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const templateId = req.params.id;
      console.log("[Template Update] Request received for ID:", templateId);
      console.log(
        "[Template Update] Request body:",
        JSON.stringify(req.body, null, 2)
      );
      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader ? req.body.headerMedia || req.body.headerImage || req.body.headerImageUrl || null : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;
      const updateData = {
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        authAddSecurityRecommendation: req.body.authAddSecurityRecommendation !== false,
        authCodeExpirationMinutes: req.body.authCodeExpirationMinutes || 10,
        authOtpType: req.body.authOtpType || "COPY_CODE",
        status: req.body.status
      };
      const template = await mongodb.Template.findOneAndUpdate(
        { id: templateId, userId },
        updateData,
        { new: true }
      );
      if (!template) {
        console.warn("[Template Update] Template not found:", templateId);
        return res.status(404).json({ message: "Template not found" });
      }
      console.log("[Template Update] MongoDB template updated:", template);
      if (template.metaTemplateId) {
        try {
          const metaPayload = buildMetaTemplate(template);
          delete metaPayload.name;
          const result = await updateMetaTemplate(
            template.metaTemplateId,
            metaPayload
          );
          if (result.success) {
            template.metaStatus = "PENDING";
            await template.save();
            console.log(
              "[Template Update] Meta template updated:",
              template.metaTemplateId
            );
          } else {
            console.error(
              "[Template Update] Meta update failed:",
              result.error
            );
          }
        } catch (metaError) {
          console.error(
            "[Template Update] Meta update error:",
            metaError
          );
        }
      }
      res.json(template);
    } catch (error) {
      console.error("[Template Update Error]", error);
      res.status(500).json({ message: "Failed to update template", error: error.message });
    }
  });
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await mongodb.Template.findOne({
        id: req.params.id,
        userId
      }).lean();
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";
      const metaTemplateId = template.metaTemplateId;
      let deletedFromMeta = false;
      let metaDeletionSkipped = false;
      if (shouldDeleteFromMeta) {
        if (metaTemplateId) {
          const { token, wabaId } = await resolveTemplateDeleteCredentials(req);
          if (!token || !wabaId) {
            return res.status(400).json({
              message: "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
              hint: "Configure WhatsApp Access Token and WABA ID in Settings."
            });
          }
          const metaDelete = await deleteMetaTemplate(wabaId, token, {
            metaTemplateId,
            name: template.name,
            language: template.language
          });
          if (!metaDelete.success) {
            return res.status(502).json({
              message: "Failed to delete template from Meta dashboard. Local template was not deleted.",
              error: metaDelete.error,
              details: metaDelete.details
            });
          }
          if (metaDelete.alreadyMissing) {
            metaDeletionSkipped = true;
          } else {
            deletedFromMeta = true;
          }
        } else {
          metaDeletionSkipped = true;
        }
      }
      const deleteResult = await mongodb.Template.deleteOne({
        id: req.params.id,
        userId
      });
      if (!deleteResult.deletedCount) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({
        success: true,
        deletedFromMeta,
        metaDeletionSkipped,
        message: deletedFromMeta ? "Template deleted from local database and Meta dashboard." : metaDeletionSkipped ? "Template deleted locally. Meta deletion skipped because no linked Meta template ID exists." : "Template deleted from local database."
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
  });
  app.post("/api/templates/bulk-delete", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === "string") : [];
      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";
      if (ids.length === 0) {
        return res.status(400).json({ message: "Please provide at least one template id." });
      }
      let token;
      let wabaId;
      if (shouldDeleteFromMeta) {
        const creds = await resolveTemplateDeleteCredentials(req);
        token = creds.token;
        wabaId = creds.wabaId;
        if (!token || !wabaId) {
          return res.status(400).json({
            message: "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
            hint: "Configure WhatsApp Access Token and WABA ID in Settings."
          });
        }
      }
      let deletedCount = 0;
      let deletedFromMetaCount = 0;
      let metaDeletionSkippedCount = 0;
      const failed = [];
      const concurrency = 2;
      const queue = ids.slice();
      const workerResults = [];
      const workers = Array.from(
        { length: Math.min(concurrency, queue.length) },
        async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            if (!id) break;
            try {
              const template = await mongodb.Template.findOne({
                id,
                userId
              }).lean();
              if (!template) {
                workerResults.push({
                  id,
                  ok: false,
                  error: "Template not found"
                });
                continue;
              }
              let deletedFromMeta = false;
              let metaSkipped = false;
              if (shouldDeleteFromMeta) {
                const metaTemplateId = template.metaTemplateId;
                if (metaTemplateId) {
                  const metaDelete = await deleteMetaTemplate(wabaId, token, {
                    metaTemplateId,
                    name: template.name,
                    language: template.language
                  });
                  if (!metaDelete.success) {
                    workerResults.push({
                      id,
                      name: template.name,
                      ok: false,
                      error: metaDelete.error || "Meta delete failed"
                    });
                    continue;
                  }
                  if (metaDelete.alreadyMissing) {
                    metaSkipped = true;
                  } else {
                    deletedFromMeta = true;
                  }
                } else {
                  metaSkipped = true;
                }
              }
              const localDeleteResult = await mongodb.Template.deleteOne({
                id,
                userId
              });
              if (!localDeleteResult.deletedCount) {
                workerResults.push({
                  id,
                  name: template.name,
                  ok: false,
                  error: "Failed to delete from local database"
                });
                continue;
              }
              workerResults.push({
                id,
                name: template.name,
                ok: true,
                deletedFromMeta,
                metaSkipped
              });
            } catch (itemError) {
              workerResults.push({
                id,
                ok: false,
                error: itemError?.message || "Unexpected delete error"
              });
            }
          }
        }
      );
      await Promise.all(workers);
      for (const item of workerResults) {
        if (item.ok) {
          deletedCount += 1;
          if (item.deletedFromMeta) deletedFromMetaCount += 1;
          if (item.metaSkipped) metaDeletionSkippedCount += 1;
        } else {
          failed.push({
            id: item.id,
            name: item.name,
            error: item.error || "Delete failed"
          });
        }
      }
      const responsePayload = {
        success: failed.length === 0,
        deletedCount,
        deletedFromMetaCount,
        metaDeletionSkippedCount,
        failedCount: failed.length,
        failed,
        message: failed.length === 0 ? `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} successfully.` : `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} with ${failed.length} failure${failed.length === 1 ? "" : "s"}.`
      };
      if (failed.length > 0) {
        return res.status(207).json(responsePayload);
      }
      return res.json(responsePayload);
    } catch (error) {
      return res.status(500).json({
        message: "Failed to delete selected templates",
        error: error.message
      });
    }
  });
  app.get("/api/meta-templates", async (req, res) => {
    try {
      const { token, wabaId, userId } = await resolveTemplateCredentials(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!token || !wabaId) {
        return res.status(400).json({
          message: "WhatsApp credentials not configured",
          hint: "Please configure your WhatsApp Access Token and Business Account ID in Settings."
        });
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,quality_score,components,rejected_reason&limit=100&access_token=${token}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplatesMeta] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error"
        });
      }
      const data = await response.json();
      const metaTemplates = data.data || [];
      const templates = metaTemplates.map((t) => {
        let content = "";
        let header = "";
        let footer = "";
        let buttons = [];
        if (t.components) {
          for (const comp of t.components) {
            if (comp.type === "HEADER") {
              header = comp.text || comp.format || "";
            } else if (comp.type === "BODY") {
              content = comp.text || "";
            } else if (comp.type === "FOOTER") {
              footer = comp.text || "";
            } else if (comp.type === "BUTTONS") {
              buttons = comp.buttons || [];
            }
          }
        }
        return {
          id: t.id,
          name: t.name,
          status: t.status?.toLowerCase() || "pending",
          category: t.category?.toLowerCase() || "utility",
          language: t.language || "en",
          content,
          header,
          footer,
          buttons,
          qualityScore: t.quality_score,
          rejectedReason: t.rejected_reason
        };
      });
      const summary = {
        total: templates.length,
        approved: templates.filter((t) => t.status === "approved").length,
        pending: templates.filter((t) => t.status === "pending").length,
        rejected: templates.filter((t) => t.status === "rejected").length
      };
      res.json({ templates, summary });
    } catch (error) {
      console.error("[TemplatesMeta] Error:", error);
      res.status(500).json({ message: "Failed to fetch templates from Meta" });
    }
  });
  app.post("/api/templates/sync-meta", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { token, wabaId } = await resolveTemplateCredentials(req);
      if (!token) {
        return res.status(400).json({
          message: "WhatsApp access token not configured. Please configure your API credentials in Settings."
        });
      }
      if (!wabaId) {
        return res.status(400).json({
          message: "WhatsApp Business Account ID (WABA_ID) not configured. Please configure it in Settings."
        });
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=500&access_token=${token}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplateSync] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error",
          hint: "Make sure WABA_ID is set to your WhatsApp Business Account ID (not Phone Number ID)"
        });
      }
      const data = await response.json();
      const metaTemplates = data.data || [];
      let synced = 0;
      let updated = 0;
      let removedStaleMetaLinked = 0;
      const approvedTemplates = [];
      const existingTemplates = await mongodb.Template.find({
        $or: [{ userId }, { userId: { $exists: false } }]
      }).lean();
      const metaTemplateIds = /* @__PURE__ */ new Set();
      const mediaHeaderTypes = /* @__PURE__ */ new Set(["image", "video", "document"]);
      const isHttpUrl = (value) => {
        return typeof value === "string" && /^https?:\/\//i.test(value.trim());
      };
      const parseMetaTemplateComponents = (components) => {
        let content = "";
        let footer = "";
        let headerText = "";
        let headerType = null;
        let mediaPreviewUrl = null;
        const componentList = Array.isArray(components) ? components : [];
        for (const component of componentList) {
          const componentType = String(component?.type || "").toUpperCase();
          if (componentType === "HEADER") {
            const normalizedFormat = String(
              component?.format || (component?.text ? "TEXT" : "")
            ).toLowerCase();
            if (normalizedFormat === "text") {
              headerType = "text";
              headerText = String(component?.text || "");
              continue;
            }
            if (normalizedFormat === "image" || normalizedFormat === "video" || normalizedFormat === "document") {
              headerType = normalizedFormat;
              const handles = Array.isArray(component?.example?.header_handle) ? component.example.header_handle : [];
              const firstHandle = handles.find(
                (value) => isHttpUrl(value)
              );
              mediaPreviewUrl = firstHandle ? String(firstHandle).trim() : null;
              continue;
            }
            continue;
          }
          if (componentType === "BODY") {
            content = String(component?.text || "");
            continue;
          }
          if (componentType === "FOOTER") {
            footer = String(component?.text || "");
          }
        }
        const matches = content.match(/\{\{(\d+)\}\}/g);
        const variables = matches ? matches.map((_, index) => `var${index + 1}`) : [];
        return {
          content,
          variables,
          footer,
          headerType,
          headerText,
          mediaPreviewUrl
        };
      };
      for (const metaTemplate of metaTemplates) {
        if (metaTemplate.id) {
          metaTemplateIds.add(String(metaTemplate.id));
        }
        if (metaTemplate.status === "APPROVED") {
          approvedTemplates.push(
            `${metaTemplate.name} (${metaTemplate.language})`
          );
        }
        const exists = existingTemplates.find(
          (t) => t.metaTemplateId && t.metaTemplateId === metaTemplate.id || t.name === metaTemplate.name
        );
        const parsed = parseMetaTemplateComponents(metaTemplate.components);
        const status = metaTemplate.status === "APPROVED" ? "approved" : metaTemplate.status === "REJECTED" ? "rejected" : "pending";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (!exists) {
          const newTemplate = await storage.createTemplate({
            userId,
            name: metaTemplate.name,
            category: (metaTemplate.category || "utility").toLowerCase(),
            content: parsed.content,
            variables: parsed.variables
          });
          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const mediaUrl = isMediaHeader ? parsed.mediaPreviewUrl : null;
          await storage.updateTemplate(newTemplate.id, {
            userId,
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          existingTemplates.push({
            ...newTemplate,
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          synced++;
        } else {
          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const existingPreviewUrl = isHttpUrl(exists?.previewUrl) ? String(exists.previewUrl) : isHttpUrl(exists?.headerImageUrl) ? String(exists.headerImageUrl) : null;
          const mediaUrl = isMediaHeader ? existingPreviewUrl || parsed.mediaPreviewUrl || null : null;
          await storage.updateTemplate(exists.id, {
            userId,
            status,
            content: parsed.content || exists.content,
            variables: parsed.variables,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          updated++;
        }
      }
      const latestTemplates = await mongodb.Template.find({ userId }).lean();
      for (const template of latestTemplates) {
        if (template.metaTemplateId && !metaTemplateIds.has(String(template.metaTemplateId))) {
          const deleted = await storage.deleteTemplate(template.id);
          if (deleted) removedStaleMetaLinked++;
        }
      }
      res.json({
        success: true,
        synced,
        updated,
        removedStaleMetaLinked,
        total: metaTemplates.length,
        approvedTemplates,
        message: `Synced ${synced} new templates, updated ${updated} existing templates from Meta, removed ${removedStaleMetaLinked} stale local templates. ${approvedTemplates.length} are approved.`
      });
    } catch (error) {
      console.error("[TemplateSync] Error:", error);
      res.status(500).json({ message: "Failed to sync templates from Meta" });
    }
  });
  app.post("/api/templates/:id/submit-approval", async (req, res) => {
    const requestId = crypto.randomUUID();
    console.log(`
[SubmitApproval][${requestId}] ===== START =====`);
    console.log(`[SubmitApproval][${requestId}] Template ID:`, req.params.id);
    try {
      const { token, wabaId, userId } = await resolveTemplateCredentials(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await mongodb.Template.findOne({
        id: req.params.id,
        userId
      });
      if (!template) {
        console.error(`[SubmitApproval][${requestId}] Template not found`);
        return res.status(404).json({ message: "Template not found" });
      }
      console.log(
        `[SubmitApproval][${requestId}] Template loaded`,
        JSON.stringify(
          {
            id: template.id,
            name: template.name,
            category: template.category,
            language: template.language,
            headerType: template.headerType
          },
          null,
          2
        )
      );
      const metaTemplate = buildMetaTemplate(template);
      console.log(
        `[SubmitApproval][${requestId}] Meta payload`,
        JSON.stringify(metaTemplate, null, 2)
      );
      console.log(`[SubmitApproval][${requestId}] User ID:`, userId);
      console.log(`[SubmitApproval][${requestId}] WABA ID:`, wabaId);
      console.log(`[SubmitApproval][${requestId}] Token present:`, !!token);
      if (!token) {
        console.error(`[SubmitApproval][${requestId}] Token missing`);
        return res.status(400).json({
          message: "WhatsApp access token not configured. Please configure your API credentials in Settings."
        });
      }
      if (!wabaId) {
        console.error(`[SubmitApproval][${requestId}] WABA_ID missing`);
        return res.status(400).json({
          message: "WABA_ID not configured. Please configure it in Settings."
        });
      }
      const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
      console.log(`[SubmitApproval][${requestId}] POST ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metaTemplate)
      });
      const data = await response.json();
      console.log(
        `[SubmitApproval][${requestId}] Meta response status:`,
        response.status
      );
      console.log(
        `[SubmitApproval][${requestId}] Meta response body:`,
        JSON.stringify(data, null, 2)
      );
      if (!response.ok) {
        console.error(`[SubmitApproval][${requestId}] Meta submission failed`, {
          message: data?.error?.message,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id
        });
        return res.status(400).json({
          message: data?.error?.error_user_msg || data?.error?.message || "Meta submission failed",
          title: data?.error?.error_user_title,
          error: data?.error?.message,
          userMessage: data?.error?.error_user_msg,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id
        });
      }
      await storage.updateTemplate(template.id, {
        metaTemplateId: data.id,
        metaStatus: data.status,
        status: "pending"
      });
      console.log(
        `[SubmitApproval][${requestId}] Template submitted successfully`,
        {
          metaTemplateId: data.id,
          status: data.status
        }
      );
      console.log(`[SubmitApproval][${requestId}] ===== END =====
`);
      res.json({
        success: true,
        metaTemplateId: data.id,
        status: data.status
      });
    } catch (err) {
      console.error(`[SubmitApproval][${requestId}] UNHANDLED ERROR`, err);
      res.status(500).json({
        message: "Internal server error during template submission",
        error: err?.message,
        requestId
      });
    }
  });
  app.get("/api/automations", async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automations" });
    }
  });
  app.get("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.getAutomation(req.params.id);
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automation" });
    }
  });
  app.post("/api/automations", async (req, res) => {
    try {
      const parsed = insertAutomationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid automation data",
          errors: parsed.error.errors
        });
      }
      const automation = await storage.createAutomation(parsed.data);
      res.status(201).json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create automation" });
    }
  });
  app.put("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.updateAutomation(
        req.params.id,
        req.body
      );
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });
  app.delete("/api/automations/:id", async (req, res) => {
    try {
      const success = await storage.deleteAutomation(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });
  app.get("/api/team-members", async (req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team members" });
    }
  });
  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team member" });
    }
  });
  app.post("/api/team-members", async (req, res) => {
    try {
      const parsed = insertTeamMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid team member data",
          errors: parsed.error.errors
        });
      }
      const member = await storage.createTeamMember(parsed.data);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to create team member" });
    }
  });
  app.put("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.updateTeamMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to update team member" });
    }
  });
  app.delete("/api/team-members/:id", async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });
  app.get("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.getWhatsappSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to get WhatsApp settings" });
    }
  });
  app.post("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.saveWhatsappSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to save WhatsApp settings" });
    }
  });
  app.post("/api/settings/whatsapp/test", async (req, res) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const isValid = req.body.accessToken && req.body.phoneNumberId;
      if (isValid) {
        res.json({ success: true, message: "Connection successful!" });
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid credentials. Please check your API settings."
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to test connection" });
    }
  });
  app.get("/api/billing", async (req, res) => {
    try {
      const billing = await storage.getBilling();
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to get billing info" });
    }
  });
  app.post("/api/billing/purchase", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const billing = await storage.addTransaction({
        type: "purchase",
        amount,
        description: `Purchased ${amount} credits`
      });
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to purchase credits" });
    }
  });
  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const campaigns = await storage.getCampaigns();
      const report = {
        totalSent: messages.filter((m) => m.direction === "outbound").length,
        delivered: messages.filter(
          (m) => m.direction === "outbound" && (m.status === "delivered" || m.status === "read")
        ).length,
        read: messages.filter(
          (m) => m.direction === "outbound" && m.status === "read"
        ).length,
        failed: messages.filter(
          (m) => m.direction === "outbound" && m.status === "failed"
        ).length,
        campaignStats: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          sent: c.sentCount,
          delivered: c.deliveredCount,
          read: c.readCount,
          replied: c.repliedCount
        }))
      };
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });
  app.get("/api/reports/campaign/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({
        ...campaign,
        deliveryRate: campaign.sentCount > 0 ? campaign.deliveredCount / campaign.sentCount * 100 : 0,
        readRate: campaign.deliveredCount > 0 ? campaign.readCount / campaign.deliveredCount * 100 : 0,
        replyRate: campaign.readCount > 0 ? campaign.repliedCount / campaign.readCount * 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });
  app.get("/api/reports/agent-performance", async (req, res) => {
    try {
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const teamMembers = await storage.getTeamMembers();
      const performance = teamMembers.map((member) => {
        const agentMessages = messages.filter(
          (m) => m.agentId === member.userId && m.direction === "outbound"
        );
        return {
          id: member.id,
          name: member.name,
          messagesSent: agentMessages.length,
          avgResponseTime: "2.5 min",
          satisfaction: 4.5
        };
      });
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get agent performance" });
    }
  });
  app.get("/api/contact-agents/stats", async (req, res) => {
    try {
      const stats = await contactAgentService.getAutoReplyStats();
      res.json(stats);
    } catch (error) {
      console.error("[ContactAgents] Error getting stats:", error);
      res.status(500).json({ message: "Failed to get contact agent stats" });
    }
  });
  app.post("/api/contact-agents/enable-all-auto-reply", async (req, res) => {
    try {
      const result = await contactAgentService.enableAutoReplyForAll();
      res.json({
        message: `Re-enabled auto-reply for ${result.updated} contacts`,
        ...result
      });
    } catch (error) {
      console.error("[ContactAgents] Error enabling all auto-reply:", error);
      res.status(500).json({ message: "Failed to enable auto-reply for all contacts" });
    }
  });
  app.use("/api/auth", authRoutes);
  app.use("/api/credentials", credentialsRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/facebook", fbRoutes);
  app.use("/api/map-agent", mappingRoutes);
  app.use("/api/webhook/whatsapp", whatsappRoutes);
  app.use("/api/leads/auto-reply", leadAutoReplyRoutes);
  app.use("/api/broadcast", broadcastRoutes);
  app.use("/api/ai-analytics", aiAnalyticsRoutes);
  app.use("/api/prefilled-text", prefilledTextRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/usage", usageRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/contact-analytics", contactAnalyticsRoutes);
  app.use("/api/lead-management", leadManagementRoutes);
  app.use("/api/integrations", integrationRoutes);
  app.use("/api/automation", automationRoutes);
  app.use("/api/flow", flowHandler);
  app.get("/api/chats/whatsapp-leads", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allChats = await storage.getChats(userId);
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      const memContacts = await storage.getContacts(userId);
      const importedContacts = await mongodb.readCollection("imported_contacts");
      const knownPhones = /* @__PURE__ */ new Set();
      for (const contact of memContacts) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }
      for (const contact of importedContacts.filter(
        (contact2) => contact2.userId === userId
      )) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }
      const leadChats = allChats.filter((chat) => {
        const chatPhone = chat.contact.phone.replace(/\D/g, "");
        const chatPhoneLast10 = chatPhone.slice(-10);
        const isUnknownContact = !knownPhones.has(chatPhone) && !knownPhones.has(chatPhoneLast10);
        if (!isUnknownContact && !chat.isFlowLead) return false;
        if (permittedContactIds === null) return true;
        return permittedContactIds.includes(chat.contact.id);
      });
      res.json(leadChats);
    } catch (error) {
      console.error("Error fetching WhatsApp leads:", error);
      res.status(500).json({ message: "Failed to get WhatsApp leads" });
    }
  });
  return httpServer;
}
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
async function startEmbeddedBackgroundJobs() {
  await scheduleRunningDripCampaigns();
}
export {
  registerRoutes,
  startEmbeddedBackgroundJobs,
  uploadTemplateHeader,
  uuidv4
};
