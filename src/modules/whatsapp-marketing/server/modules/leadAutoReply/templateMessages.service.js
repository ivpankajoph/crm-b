function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isValidTemplateParameter(param) {
  if (!param || typeof param !== "object") return false;
  const type = String(param.type || "").toLowerCase();
  if (!type) {
    return isNonEmptyString(param.text);
  }
  switch (type) {
    case "text":
      return isNonEmptyString(param.text);
    case "image":
      return isNonEmptyString(param.image?.link) || isNonEmptyString(param.image?.id);
    case "video":
      return isNonEmptyString(param.video?.link) || isNonEmptyString(param.video?.id);
    case "document":
      return isNonEmptyString(param.document?.link) || isNonEmptyString(param.document?.id);
    case "currency": {
      const amount = param.currency?.amount_1000;
      return isNonEmptyString(param.currency?.fallback_value) && isNonEmptyString(param.currency?.code) && typeof amount === "number" && Number.isFinite(amount);
    }
    case "date_time":
      return isNonEmptyString(param.date_time?.fallback_value);
    default:
      return true;
  }
}
function getWhatsAppCredentials() {
  const token = "";
  const phoneNumberId = "";
  if (!token || !phoneNumberId) {
    return null;
  }
  return { token, phoneNumberId };
}
async function sendTemplateMessage(to, template, options) {
  console.log("[TemplateMessage] ===== START =====");
  console.log("[TemplateMessage] To:", to);
  console.log(
    "[TemplateMessage] Raw template config:",
    JSON.stringify(template, null, 2)
  );
  const credentials = getWhatsAppCredentials();
  if (!credentials) {
    console.error("[TemplateMessage] WhatsApp credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const metaTemplateName = template.name.toLowerCase().replace(/\s+/g, "_");
  const primaryLanguage = template.languageCode || "en_US";
  const allowLanguageFallback = options?.allowLanguageFallback !== false;
  const languageCodesToTry = allowLanguageFallback ? Array.from(/* @__PURE__ */ new Set([primaryLanguage, "en_US", "en", "en_GB"])) : [primaryLanguage];
  console.log("[TemplateMessage] Normalized template name:", metaTemplateName);
  console.log(
    "[TemplateMessage] Language attempt order:",
    languageCodesToTry
  );
  let lastAttempt = {};
  for (const langCode of languageCodesToTry) {
    console.log("--------------------------------------------");
    console.log(`[TemplateMessage] Attempting language: ${langCode}`);
    let components = void 0;
    if (template.components) {
      const hasValidParams = template.components.some(
        (comp) => comp.parameters && comp.parameters.length > 0
      );
      if (hasValidParams) {
        for (const component of template.components) {
          if (component.parameters) {
            for (const param of component.parameters) {
              if (!isValidTemplateParameter(param)) {
                console.error(
                  "[TemplateMessage] \u274C Invalid template parameter:",
                  param
                );
                return {
                  success: false,
                  error: "Invalid WhatsApp template parameters",
                  attemptedLanguage: langCode
                };
              }
            }
          }
        }
        components = template.components;
      } else {
        components = template.components;
      }
    }
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: langCode },
        ...components !== void 0 ? { components } : {}
      }
    };
    console.log(
      "[TemplateMessage] Payload:",
      JSON.stringify(messagePayload, null, 2)
    );
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(messagePayload)
        }
      );
      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }
      lastAttempt = {
        providerHttpStatus: response.status,
        providerResponse: data,
        requestPayload: messagePayload,
        attemptedLanguage: langCode,
        errorCode: data?.error?.code
      };
      console.log("[TemplateMessage] HTTP Status:", response.status);
      console.log("[TemplateMessage] Response:", JSON.stringify(data, null, 2));
      if (response.ok && data?.messages?.[0]?.id) {
        console.log(
          `[TemplateMessage] \u2705 Success | Message ID: ${data.messages[0].id}`
        );
        console.log("[TemplateMessage] ===== END =====");
        return {
          success: true,
          messageId: data.messages[0].id,
          messageStatus: data.messages?.[0]?.message_status,
          ...lastAttempt
        };
      }
      const errorMsg = data?.error?.message || "Unknown Meta error";
      const errorCode = data?.error?.code;
      console.error("[TemplateMessage] \u274C Meta Error:", errorMsg, errorCode);
      if (errorCode === 132001 || errorMsg.toLowerCase().includes("does not exist")) {
        console.log("[TemplateMessage] Template not found, trying next language...");
        continue;
      }
      if (errorCode === 132e3 || errorCode === 132012 || errorMsg.toLowerCase().includes("parameters does not match") || errorMsg.toLowerCase().includes("parameter format does not match")) {
        console.error("[TemplateMessage] \u274C Parameter mismatch - check template variables");
        return {
          success: false,
          error: `${errorMsg}. Template requires variables but none/incorrect were provided.`,
          ...lastAttempt
        };
      }
      console.log("[TemplateMessage] ===== END =====");
      return { success: false, error: errorMsg, ...lastAttempt };
    } catch (error) {
      console.error("[TemplateMessage] \u274C Fetch Exception:", error);
      lastAttempt = {
        requestPayload: messagePayload,
        attemptedLanguage: langCode
      };
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        ...lastAttempt
      };
    }
  }
  console.error(
    `[TemplateMessage] \u274C Template "${metaTemplateName}" not found in any language`
  );
  console.log("[TemplateMessage] ===== END =====");
  return {
    success: false,
    error: `Template "${metaTemplateName}" not found in Meta`,
    ...lastAttempt
  };
}
async function sendHelloWorldTemplate(to) {
  return sendTemplateMessage(to, {
    name: "hello_world",
    languageCode: "en_US"
  });
}
async function getAvailableTemplates() {
  const credentials = getWhatsAppCredentials();
  if (!credentials) {
    return { templates: [], error: "WhatsApp credentials not configured" };
  }
  try {
    const phoneInfoResponse = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}?fields=account_mode`,
      {
        headers: {
          Authorization: `Bearer ${credentials.token}`
        }
      }
    );
    const phoneInfo = await phoneInfoResponse.json();
    console.log("[TemplateMessage] Phone info:", phoneInfo);
    return { templates: [], error: "Template listing requires WABA ID" };
  } catch (error) {
    return {
      templates: [],
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
export {
  getAvailableTemplates,
  sendHelloWorldTemplate,
  sendTemplateMessage
};
