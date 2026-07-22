import { credentialsService } from "../credentials/credentials.service.js";
import * as integrationService from "../integrations/integration.service.js";
async function getUserWhatsAppCredentials(userId) {
  try {
    const integrationCreds = await integrationService.getDecryptedCredentials(userId, "whatsapp");
    if (integrationCreds?.accessToken && integrationCreds?.phoneNumberId) {
      console.log("[WhatsApp Service] Using credentials from Connected Apps");
      return {
        token: integrationCreds.accessToken,
        phoneNumberId: integrationCreds.phoneNumberId,
        businessAccountId: integrationCreds.businessAccountId
      };
    }
    const creds = await credentialsService.getDecryptedCredentials(userId);
    if (creds?.whatsappToken && creds?.phoneNumberId) {
      return {
        token: creds.whatsappToken,
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId
      };
    }
    return null;
  } catch (error) {
    console.error("[WhatsApp Service] Error getting user credentials:", error);
    return null;
  }
}
async function getUserWhatsAppConnectionCredentials(userId) {
  return integrationService.getDecryptedCredentials(userId, "whatsapp");
}
async function hasWebhookVerifyToken(token) {
  return integrationService.hasWhatsAppWebhookVerifyToken(token);
}
async function getWhatsAppCredentialsForUser(userId) {
  if (!userId) {
    console.warn("[WhatsApp Service] Refusing WhatsApp operation without an authenticated account owner");
    return null;
  }
  return getUserWhatsAppCredentials(userId);
}
async function getWhatsAppCredentialsStrict(userId) {
  if (!userId) {
    return null;
  }
  const userCreds = await getUserWhatsAppCredentials(userId);
  if (userCreds) {
    return userCreds;
  }
  return null;
}
async function ensureWebhookSubscription(credentials) {
  if (!credentials.businessAccountId) {
    return { success: false, error: "WhatsApp Business Account ID is missing" };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.businessAccountId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(
          Math.max(5e3, Number(2e4))
        )
      }
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.success !== false) return { success: true };
    return {
      success: false,
      error: data?.error?.message || "Unable to subscribe WABA to message webhooks"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook subscription failed"
    };
  }
}
async function sendTextMessage(to, message, userId) {
  console.log("\u{1F4E8} [WhatsApp Service] sendTextMessage called", {
    to,
    userId,
    messageLength: message?.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  const start = Date.now();
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    console.error("\u274C [WhatsApp Service] Credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  console.log("\u{1F510} Credentials loaded", {
    phoneNumberId: credentials.phoneNumberId,
    tokenPreview: credentials.token?.slice(0, 8) + "***"
  });
  const url = `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: message }
  };
  console.log("\u27A1\uFE0F Outgoing request", {
    url,
    method: "POST",
    payload
  });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    console.log("\u{1F4E5} Response metadata", {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      timeMs: Date.now() - start
    });
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error("\u26A0\uFE0F Failed to parse JSON response. Raw text:", text);
      throw err;
    }
    console.log("\u{1F4E6} Response body", data);
    if (response.ok && data?.messages?.[0]?.id) {
      console.log("\u2705 Message sent successfully", {
        messageId: data.messages[0].id
      });
      return { success: true, messageId: data.messages[0].id };
    }
    console.error("\u274C WhatsApp API returned error", data?.error);
    return {
      success: false,
      error: data?.error?.message || "Failed to send message"
    };
  } catch (error) {
    console.error("\u{1F525} [WhatsApp Service] Exception sending message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendTemplateMessage(to, templateName, languageCode = "en", components = [], userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    console.error("[WhatsApp Service] Credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const subscription = await ensureWebhookSubscription(credentials);
  if (!subscription.success) {
    console.warn(
      `[WhatsApp Service] WABA webhook subscription could not be verified: ${subscription.error}`
    );
  }
  const metaTemplateName = templateName.toLowerCase().replace(/\s+/g, "_");
  console.log(`[WhatsApp Service] Sending template: "${metaTemplateName}" to ${to}`);
  const languageCodesToTry = [languageCode, "en", "en_US", "en_GB"];
  const uniqueLanguages = Array.from(new Set(languageCodesToTry));
  for (const langCode of uniqueLanguages) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: langCode }
      }
    };
    if (components.length > 0) {
      payload.template.components = components;
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${credentials.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(
            Math.max(5e3, Number(2e4))
          )
        }
      );
      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        console.log(`[WhatsApp Service] Template sent successfully with lang: ${langCode}`);
        return {
          success: true,
          messageId: data.messages[0].id,
          acceptedRecipient: data.contacts?.[0]?.wa_id || to,
          providerResponse: data,
          providerHttpStatus: response.status,
          messageStatus: data.messages[0]?.message_status || "accepted",
          attemptedLanguage: langCode
        };
      }
      const errorCode = data.error?.code;
      const errorMsg = data.error?.message || "";
      if (errorCode === 132001 || errorMsg.includes("does not exist")) {
        console.log(`[WhatsApp Service] Template not found with lang "${langCode}", trying next...`);
        continue;
      }
      return {
        success: false,
        error: data.error?.message || "Failed to send template",
        providerResponse: data,
        providerHttpStatus: response.status,
        attemptedLanguage: langCode,
        errorCode: data.error?.code
      };
    } catch (error) {
      console.error("[WhatsApp Service] Error sending template:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  return {
    success: false,
    error: `Template "${templateName}" not found in any supported language`
  };
}
async function sendImageMessage(to, imageUrl, caption, userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: { link: imageUrl }
    };
    if (caption) {
      payload.image.caption = caption;
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to send image"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendDocumentMessage(to, documentUrl, filename, caption, userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: {
        link: documentUrl,
        filename
      }
    };
    if (caption) {
      payload.document.caption = caption;
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to send document"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendVideoMessage(to, videoUrl, caption, userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "video",
      video: { link: videoUrl }
    };
    if (caption) {
      payload.video.caption = caption;
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to send video"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendReplyMessage(to, message, replyToMessageId, userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          context: { message_id: replyToMessageId },
          type: "text",
          text: { body: message }
        })
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to send reply"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function markMessageAsRead(messageId, userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return false;
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        })
      }
    );
    return response.ok;
  } catch (error) {
    console.error("[WhatsApp Service] Error marking message as read:", error);
    return false;
  }
}
async function getUserByPhoneNumberId(phoneNumberId) {
  try {
    const connectedAccountUserId = await integrationService.findUserIdByWhatsAppPhoneNumberId(phoneNumberId);
    if (connectedAccountUserId) return connectedAccountUserId;
    return await credentialsService.findUserByPhoneNumberId(phoneNumberId);
  } catch (error) {
    console.error("[WhatsApp Service] Error finding user by phone number ID:", error);
    return null;
  }
}
async function sendReplyButtonMessage(to, bodyText, buttons, userId, options) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const normalizedButtons = buttons.filter((button) => button.id?.trim() && button.title?.trim()).slice(0, 3).map((button) => ({
    type: "reply",
    reply: {
      id: button.id.slice(0, 256),
      title: button.title.slice(0, 20)
    }
  }));
  if (!bodyText?.trim()) {
    return { success: false, error: "Interactive message body is required" };
  }
  if (normalizedButtons.length === 0) {
    return sendTextMessage(to, bodyText, userId);
  }
  const interactive = {
    type: "button",
    body: { text: bodyText.slice(0, 1024) },
    action: { buttons: normalizedButtons }
  };
  if (options?.headerText?.trim()) {
    interactive.header = { type: "text", text: options.headerText.trim().slice(0, 60) };
  }
  if (options?.footerText?.trim()) {
    interactive.footer = { text: options.footerText.trim().slice(0, 60) };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "interactive",
          interactive
        })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data?.error?.message || "Failed to send interactive reply buttons"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendFlowMessage(userId, options) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "interactive",
      interactive: {
        type: "flow",
        header: options.headerText ? {
          type: "text",
          text: options.headerText
        } : void 0,
        body: {
          text: options.bodyText || `Please complete the ${options.flowName} flow`
        },
        footer: options.footerText ? {
          text: options.footerText
        } : void 0,
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: options.flowToken || `flow_${Date.now()}`,
            flow_id: options.flowId,
            flow_cta: options.ctaText || "Start",
            flow_action: "navigate",
            flow_action_payload: options.flowActionPayload ? {
              screen: options.entryPointId || "START",
              data: options.flowActionPayload
            } : {
              screen: options.entryPointId || "START"
            }
          }
        }
      }
    };
    if (!payload.interactive.header) {
      delete payload.interactive.header;
    }
    if (!payload.interactive.footer) {
      delete payload.interactive.footer;
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(
          Math.max(5e3, Number(2e4))
        )
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      console.log(`[WhatsApp Service] Flow message sent to ${options.to}, messageId: ${data.messages[0].id}`);
      return {
        success: true,
        messageId: data.messages[0].id,
        providerHttpStatus: response.status,
        requestPayload: payload,
        providerResponse: data
      };
    }
    console.error("[WhatsApp Service] Flow send failed:", data.error);
    return {
      success: false,
      error: data.error?.message || "Failed to send flow message",
      providerHttpStatus: response.status,
      requestPayload: payload,
      providerResponse: data
    };
  } catch (error) {
    console.error("[WhatsApp Service] Error sending flow message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
export {
  getUserByPhoneNumberId,
  getUserWhatsAppConnectionCredentials,
  getUserWhatsAppCredentials,
  getWhatsAppCredentialsForUser,
  getWhatsAppCredentialsStrict,
  hasWebhookVerifyToken,
  markMessageAsRead,
  sendDocumentMessage,
  sendFlowMessage,
  sendImageMessage,
  sendReplyButtonMessage,
  sendReplyMessage,
  sendTemplateMessage,
  sendTextMessage,
  sendVideoMessage
};
