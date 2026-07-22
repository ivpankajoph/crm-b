import {
  Contact,
  FormAutomation,
  LeadDripStatus,
  Leadfb,
  Template
} from "./modules/storage/mongodb.adapter.js";
import axios from "axios";
import { sendTemplateMessage } from "./modules/broadcast/broadcast.service.js";
import { v2 as cloudinary } from "cloudinary";
import { uuidv4 } from "./routes.js";
import { storage } from "./storage.js";
const FB_API_VERSION = "v17.0";
const FB_ACCESS_TOKEN = "";
const SYSTEM_USER_TOKEN_META = "";
const WHATSAPP_API_VERSION = "v22.0";
const WHATSAPP_PHONE_NUMBER_ID = "";
const WHATSAPP_ACCESS_TOKEN = "";
const WHATSAPP_BUSINESS_ACCOUNT_ID = "";
async function migrateExistingLeads() {
  try {
    const result = await Leadfb.updateMany(
      { template_sent: { $ne: true } },
      // Find leads where template_sent is not true
      { $set: { template_sent: true } }
    );
    console.log(
      `Migrated ${result.modifiedCount} existing leads to template_sent: true`
    );
  } catch (error) {
    console.error("Error migrating existing leads:", error.message);
  }
}
async function fetchAllLeadsFromFacebook(formId) {
  let allLeads = [];
  let url = `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100`;
  while (url) {
    try {
      const response = await axios.get(url);
      const data = response.data;
      allLeads = allLeads.concat(data.data || []);
      url = data.paging?.cursors?.after ? `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100&after=${data.paging.cursors.after}` : "";
    } catch (error) {
      console.error(`Error fetching leads for form ${formId}:`, error.message);
      break;
    }
  }
  return allLeads;
}
function normalizeLead(fbLead, formId, formName, templateId, templateName) {
  const normalized = {
    lead_id: fbLead.id,
    form_id: formId,
    form_name: formName,
    created_time: new Date(fbLead.created_time),
    template_sent: false,
    // Always start as false for new leads
    automation_active: true,
    template_id: templateId,
    template_name: templateName,
    raw_field_data: fbLead.field_data
  };
  fbLead.field_data?.forEach((field) => {
    const key = field.name;
    const value = field.values?.[0] || "";
    if (key === "full_name" || key === "FULL_NAME") {
      normalized.full_name = value;
    } else if (key === "email" || key === "EMAIL") {
      normalized.email = value;
    } else if (key === "phone_number" || key === "PHONE") {
      normalized.phone = value;
    } else if (key === "date_of_birth" || key === "DOB") {
      normalized.dob = value;
    } else if (key === "0") {
      normalized.category = value;
    } else if (key === "1") {
      normalized.opt_in = value;
    }
  });
  return normalized;
}
async function getTemplateDetails(templateId) {
  try {
    console.log("\u{1F50D} Fetching template from DB:", templateId);
    const template = await Template.findOne({
      $or: [
        { id: templateId },
        // Meta template ID
        { name: templateId }
        // template name
      ]
    }).lean();
    if (!template) {
      console.error("\u274C Template not found in DB:", templateId);
      return null;
    }
    if (template.metaStatus !== "APPROVED" && template.status !== "approved") {
      console.warn(`\u26A0\uFE0F Template found but not approved: ${template.name}`, {
        status: template.status,
        metaStatus: template.metaStatus
      });
      return null;
    }
    console.log("\u2705 Template loaded from DB:", {
      name: template.name,
      language: template.language,
      category: template.category
    });
    return {
      id: template.id,
      name: template.name,
      language: template.language,
      status: template.metaStatus || template.status,
      components: [
        {
          type: "BODY",
          text: template.content
        }
      ],
      raw: template
      // keep full DB object if needed
    };
  } catch (error) {
    console.error("\u{1F525} Error fetching template from DB:", error.message);
    return null;
  }
}
function buildTemplateParameters(template, lead) {
  const components = [];
  template.components?.forEach((component) => {
    if (component.type === "HEADER" && component.format === "TEXT") {
      const headerText = component.text || "";
      const variableCount = (headerText.match(/\{\{(\d+)\}\}/g) || []).length;
      if (variableCount > 0) {
        const parameters = [];
        for (let i = 1; i <= variableCount; i++) {
          parameters.push({
            type: "text",
            text: lead.full_name || "Customer"
          });
        }
        components.push({
          type: "header",
          parameters
        });
      }
    }
    if (component.type === "BODY") {
      const bodyText = component.text || "";
      const variableCount = (bodyText.match(/\{\{(\d+)\}\}/g) || []).length;
      if (variableCount > 0) {
        const parameters = [];
        for (let i = 1; i <= variableCount; i++) {
          let value = "Customer";
          switch (i) {
            case 1:
              value = lead.full_name || "Customer";
              break;
            case 2:
              value = lead.category || lead.email || "";
              break;
            case 3:
              value = lead.phone || "";
              break;
            case 4:
              value = lead.dob || "";
              break;
            default:
              value = "";
          }
          parameters.push({
            type: "text",
            text: value
          });
        }
        components.push({
          type: "body",
          parameters
        });
      }
    }
    if (component.type === "BUTTONS") {
      component.buttons?.forEach((button, index) => {
        if (button.type === "URL" && button.url?.includes("{{")) {
          components.push({
            type: "button",
            sub_type: "url",
            index: index.toString(),
            parameters: [
              {
                type: "text",
                text: lead.lead_id || ""
                // or any dynamic value
              }
            ]
          });
        }
      });
    }
  });
  return components;
}
async function sendWhatsAppTemplate(lead, templateId) {
  try {
    if (!lead.phone) {
      console.error(`No phone number for lead ${lead.lead_id}`);
      return { success: false, error: "No phone number" };
    }
    let phoneNumber = lead.phone.replace(/[\s\-\(\)]/g, "");
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+91" + phoneNumber;
    }
    console.log(`Fetching template details for: ${templateId}`);
    const template = await getTemplateDetails(templateId);
    if (!template) {
      return { success: false, error: `Template not found: ${templateId}` };
    }
    console.log(`Using template: ${template.name} (${template.language})`);
    const components = buildTemplateParameters(template, lead);
    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: {
        name: template.name,
        language: {
          code: template.language || "en"
        }
      }
    };
    if (components.length > 0) {
      payload.template.components = components;
    }
    console.log(
      `Sending WhatsApp template "${template.name}" to ${phoneNumber}`
    );
    console.log("Payload:", JSON.stringify(payload, null, 2));
    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${SYSTEM_USER_TOKEN_META}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(
      `\u2705 WhatsApp message sent successfully to ${lead.full_name || phoneNumber}`
    );
    console.log(`Message ID: ${response.data.messages?.[0]?.id}`);
    return {
      success: true,
      message_id: response.data.messages?.[0]?.id,
      phone_number: phoneNumber,
      template_name: template.name
    };
  } catch (error) {
    console.error(
      `\u274C Error sending WhatsApp to ${lead.phone}:`,
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      error_code: error.response?.data?.error?.code
    };
  }
}
async function syncLeadsForFormMain(formAutomation) {
  try {
    console.log(
      `Syncing leads for form: ${formAutomation.form_name} (${formAutomation.form_id})`
    );
    const fbLeads = await fetchAllLeadsFromFacebook(formAutomation.form_id);
    console.log(`Fetched ${fbLeads.length} leads from Facebook`);
    let newLeadsCount = 0;
    let updatedLeadsCount = 0;
    let templatesSentCount = 0;
    let templatesFailedCount = 0;
    for (const fbLead of fbLeads) {
      const normalizedLead = normalizeLead(
        fbLead,
        formAutomation.form_id,
        formAutomation.form_name,
        formAutomation.template_id,
        formAutomation.template_name
      );
      const existingLead = await Leadfb.findOne({
        lead_id: normalizedLead.lead_id
      });
      if (!existingLead) {
        console.log(
          `\u{1F195} New lead found: ${normalizedLead.full_name || normalizedLead.email}`
        );
        const newLead = await Leadfb.create({
          ...normalizedLead,
          template_sent: false,
          synced_at: /* @__PURE__ */ new Date()
        });
        newLeadsCount++;
        if (newLead.phone && formAutomation.template_id) {
          console.log(
            `\u{1F4F1} Sending WhatsApp template (${formAutomation.template_name}) to new lead...`
          );
          const result = await sendTemplateMessage(
            newLead.phone,
            formAutomation.template_name
            // Using template_id from the form's automation
          );
          if (result.success) {
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent: true,
              template_sent_at: /* @__PURE__ */ new Date(),
              whatsapp_message_id: result.messageId,
              whatsapp_phone_number: result.phone_number,
              template_used: result.template_name
            });
            console.log(`\u{1F4E8} WhatsApp message sent: Message ID ${result}`);
            templatesSentCount++;
            try {
              const contactId = await getOrCreateContactId(newLead);
              const messageContent = `Template sent: ${formAutomation.template_name}`;
              if (contactId) {
                await storage.createMessage({
                  contactId,
                  content: messageContent,
                  type: "text",
                  direction: "outbound",
                  status: "sent"
                });
              }
            } catch (saveError) {
              console.error(
                "[TemplateSync] Failed to save message to conversation:",
                saveError
              );
            }
            console.log(
              `\u2705 Template "${result.template_name}" sent successfully and lead updated: template_sent = true`
            );
          } else {
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent_error: result.error,
              template_sent_error_code: result.error_code,
              last_template_attempt: /* @__PURE__ */ new Date()
            });
            templatesFailedCount++;
            console.log(`\u274C Template send failed: ${result.error}`);
          }
        } else {
          console.log(
            `\u26A0\uFE0F No phone number or template configured for form, skipping WhatsApp send`
          );
        }
      } else {
        await Leadfb.findOneAndUpdate(
          { lead_id: normalizedLead.lead_id },
          {
            synced_at: /* @__PURE__ */ new Date()
            // Preserve existing template_sent status
          }
        );
        updatedLeadsCount++;
      }
    }
    formAutomation.last_sync = /* @__PURE__ */ new Date();
    formAutomation.last_sync_stats = {
      new_leads: newLeadsCount,
      updated_leads: updatedLeadsCount,
      templates_sent: templatesSentCount,
      templates_failed: templatesFailedCount,
      total_leads: fbLeads.length
    };
    await formAutomation.save();
    console.log(
      `\u2728 Sync complete: ${newLeadsCount} new, ${updatedLeadsCount} updated, ${templatesSentCount} templates sent, ${templatesFailedCount} failed`
    );
    return {
      newLeadsCount,
      updatedLeadsCount,
      templatesSentCount,
      templatesFailedCount,
      totalLeads: fbLeads.length
    };
  } catch (error) {
    console.error(
      `Error syncing form ${formAutomation.form_id}:`,
      error.message
    );
    throw error;
  }
}
async function retryFailedTemplates() {
  try {
    console.log("\u{1F501} Retrying failed template sends...");
    const startTime = Date.now();
    const failedLeads = await Leadfb.find({
      template_sent: false,
      phone: { $exists: true, $ne: "" }
    }).limit(5);
    console.log(
      `\u{1F4CC} Found ${failedLeads.length} failed leads`,
      failedLeads.map((l) => ({
        id: l._id,
        phone: l.phone,
        form_id: l.form_id,
        error: l.template_sent_error
      }))
    );
    let retrySuccessCount = 0;
    let retryFailCount = 0;
    for (const lead of failedLeads) {
      console.log(`\u27A1\uFE0F Processing lead ${lead._id} | phone=${lead.phone}`);
      const automation = await FormAutomation.findOne({
        form_id: lead.form_id
      });
      if (!automation) {
        console.warn(
          `\u26A0\uFE0F No automation found for form_id=${lead.form_id} (lead=${lead._id})`
        );
        retryFailCount++;
        continue;
      }
      if (!automation.template_id) {
        console.warn(
          `\u26A0\uFE0F No template_id in automation for form_id=${lead.form_id} (lead=${lead._id})`
        );
        retryFailCount++;
        continue;
      }
      console.log(`\u{1F4E4} Sending WhatsApp template`, {
        leadId: lead._id,
        templateId: automation.template_id,
        phone: lead.phone
      });
      const result = await sendTemplateMessage(
        lead.phone,
        automation.template_name
      );
      console.log(`\u{1F4E8} WhatsApp response for lead ${lead._id}:`, result);
      if (result.success) {
        await Leadfb.findByIdAndUpdate(lead._id, {
          template_sent: true,
          template_sent_at: /* @__PURE__ */ new Date(),
          whatsapp_message_id: result.messageId,
          whatsapp_phone_number: result.phone_number,
          template_used: result.template_name,
          $unset: {
            template_sent_error: "",
            template_sent_error_code: ""
          }
        });
        console.log(`\u2705 Template sent successfully for lead ${lead._id}`, {
          message_id: result.messageId,
          template: result.template_name
        });
        retrySuccessCount++;
      } else {
        await Leadfb.findByIdAndUpdate(lead._id, {
          template_sent_error: result.error,
          template_sent_error_code: result.error_code,
          last_template_attempt: /* @__PURE__ */ new Date()
        });
        console.error(`\u274C Template send failed for lead ${lead._id}`, {
          error: result.error,
          error_code: result.error_code
        });
        retryFailCount++;
      }
    }
    console.log(`\u{1F3C1} Retry complete`, {
      success: retrySuccessCount,
      failed: retryFailCount,
      duration_ms: Date.now() - startTime
    });
    return { retrySuccessCount, retryFailCount };
  } catch (error) {
    console.error("\u{1F525} Fatal error in retryFailedTemplates", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}
function calculateNextSendTime(step, currentTime = /* @__PURE__ */ new Date()) {
  const nextTime = new Date(currentTime);
  if (step.delay_unit === "minutes") {
    nextTime.setMinutes(nextTime.getMinutes() + step.delay_value);
  } else if (step.delay_unit === "hours") {
    nextTime.setHours(nextTime.getHours() + step.delay_value);
  } else if (step.delay_unit === "days") {
    nextTime.setDate(nextTime.getDate() + step.delay_value);
  }
  if (step.send_at_time) {
    const [hours, minutes] = step.send_at_time.split(":").map(Number);
    nextTime.setHours(hours, minutes, 0, 0);
    if (nextTime < /* @__PURE__ */ new Date()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }
  return nextTime;
}
async function processDripCampaigns() {
  try {
    console.log("\u{1F504} Processing drip campaign messages...");
    const now = /* @__PURE__ */ new Date();
    const pendingLeads = await LeadDripStatus.find({
      status: "active",
      next_send_time: { $lte: now }
    }).populate("campaign_id");
    console.log(`Found ${pendingLeads.length} leads ready for next message`);
    for (const leadStatus of pendingLeads) {
      try {
        const campaign = leadStatus.campaign_id;
        if (!campaign || !campaign.is_active) {
          console.log(
            `Campaign inactive for lead ${leadStatus.lead_id}, skipping...`
          );
          continue;
        }
        const nextStepIndex = leadStatus.current_step + 1;
        if (nextStepIndex >= campaign.steps.length) {
          leadStatus.status = "completed";
          leadStatus.completed_at = /* @__PURE__ */ new Date();
          leadStatus.next_send_time = null;
          await leadStatus.save();
          console.log(`\u2705 Campaign completed for lead ${leadStatus.lead_id}`);
          continue;
        }
        const nextStep = campaign.steps[nextStepIndex];
        const lead = await Leadfb.findOne({ lead_id: leadStatus.lead_id });
        if (!lead) {
          console.log(
            `Lead ${leadStatus.lead_id} not found, marking as failed`
          );
          leadStatus.status = "failed";
          await leadStatus.save();
          continue;
        }
        console.log(
          `\u{1F4F1} Sending step ${nextStepIndex + 1} to ${lead.full_name || lead.phone}`
        );
        const result = await sendWhatsAppTemplate(lead, nextStep.template_id);
        leadStatus.steps_completed.push({
          step_order: nextStepIndex,
          template_id: nextStep.template_id,
          sent_at: /* @__PURE__ */ new Date(),
          message_id: result.message_id,
          success: result.success,
          error: result.error
        });
        if (result.success) {
          leadStatus.current_step = nextStepIndex;
          if (nextStepIndex + 1 < campaign.steps.length) {
            leadStatus.next_send_time = calculateNextSendTime(
              campaign.steps[nextStepIndex + 1]
            );
            console.log(
              `\u2705 Message sent. Next message scheduled for ${leadStatus.next_send_time}`
            );
          } else {
            leadStatus.status = "completed";
            leadStatus.completed_at = /* @__PURE__ */ new Date();
            leadStatus.next_send_time = null;
            console.log(
              `\u2705 Final message sent. Campaign completed for ${lead.full_name}`
            );
          }
        } else {
          leadStatus.status = "failed";
          console.log(`\u274C Failed to send message: ${result.error}`);
        }
        leadStatus.last_updated = /* @__PURE__ */ new Date();
        await leadStatus.save();
      } catch (error) {
        console.error(
          `Error processing lead ${leadStatus.lead_id}:`,
          error.message
        );
      }
    }
    console.log("\u2728 Drip campaign processing complete");
  } catch (error) {
    console.error("Error in processDripCampaigns:", error.message);
  }
}
async function getCampaignStats(campaignId) {
  const total = await LeadDripStatus.countDocuments({
    campaign_id: campaignId
  });
  const active = await LeadDripStatus.countDocuments({
    campaign_id: campaignId,
    status: "active"
  });
  const completed = await LeadDripStatus.countDocuments({
    campaign_id: campaignId,
    status: "completed"
  });
  const failed = await LeadDripStatus.countDocuments({
    campaign_id: campaignId,
    status: "failed"
  });
  return { total, active, completed, failed };
}
async function retrySend(fn, retries = 3, delayMs = 1e3) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      console.warn(`[RETRY] Attempt ${attempt} failed`);
      if (attempt >= retries) throw err;
      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
}
async function sendWithLimit(items, limit, handler) {
  const executing = [];
  for (const item of items) {
    const p = handler(item).finally(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}
async function parallelLimit(items, limit, handler) {
  const executing = [];
  for (const item of items) {
    const p = handler(item).finally(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}
async function retry(fn, retries = 3) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1e3));
    }
  }
}
function buildMetaTemplate(template) {
  const components = [];
  const isAuthenticationTemplate = String(template.category || "").toUpperCase() === "AUTHENTICATION" || template.templateType === "one_time_password";
  if (isAuthenticationTemplate) {
    const bodyComponent2 = {
      type: "BODY",
      add_security_recommendation: template.authAddSecurityRecommendation !== false
    };
    const expirationMinutes = Number(
      template.authCodeExpirationMinutes || 10
    );
    if (Number.isFinite(expirationMinutes) && expirationMinutes > 0) {
      components.push(bodyComponent2, {
        type: "FOOTER",
        code_expiration_minutes: expirationMinutes
      });
    } else {
      components.push(bodyComponent2);
    }
    components.push({
      type: "BUTTONS",
      buttons: [
        {
          type: "OTP",
          otp_type: "COPY_CODE",
          text: "Copy code"
        }
      ]
    });
    return {
      name: template.name,
      category: "AUTHENTICATION",
      language: template.language || "en_US",
      components
    };
  }
  const mediaHandle = template.headerImageUrl || template.headerMedia || template.headerImage;
  if (template.headerType === "text" && template.headerText) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: template.headerText,
      example: {
        header_text: ["Sample Header"]
      }
    });
  }
  if (template.headerType === "image" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  if (template.headerType === "video" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "VIDEO",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  if (template.headerType === "document" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "DOCUMENT",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  let processedContent = template.content;
  let index = 1;
  processedContent = processedContent.replace(/\{\{[^}]+\}\}/g, () => {
    return `{{${index++}}}`;
  });
  const bodyComponent = {
    type: "BODY",
    text: processedContent
  };
  if (index > 1) {
    bodyComponent.example = {
      body_text: [
        Array.from({ length: index - 1 }, (_, i) => `Sample${i + 1}`)
      ]
    };
  }
  components.push(bodyComponent);
  if (template.footer) {
    components.push({
      type: "FOOTER",
      text: template.footer
    });
  }
  if (template.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons.map((btn) => {
        if (btn.type === "quick_reply") {
          return { type: "QUICK_REPLY", text: btn.text };
        }
        if (btn.type === "url") {
          return {
            type: "URL",
            text: btn.text,
            url: btn.url,
            example: [process.env.SITE_URL || ""]
          };
        }
        if (btn.type === "phone_number") {
          return {
            type: "PHONE_NUMBER",
            text: btn.text,
            phone_number: btn.phone_number
          };
        }
      })
    });
  }
  return {
    name: template.name,
    category: template.category.toUpperCase(),
    language: template.language || "en_US",
    components
  };
}
function validateMetaTemplate(template) {
  const errors = [];
  const isAuthenticationTemplate = String(template.category || "").toUpperCase() === "AUTHENTICATION" || template.templateType === "one_time_password";
  if (!isAuthenticationTemplate && !template.content?.trim()) {
    errors.push("Body text is required");
  }
  if (template.buttons?.length > 3) {
    errors.push("Max 3 buttons allowed");
  }
  template.buttons?.forEach((btn) => {
    if (btn.text.length > 30) {
      errors.push("Button text must be \u2264 30 characters");
    }
    if (btn.type === "url" && !btn.url) {
      errors.push("URL button requires a valid URL");
    }
    if (btn.type === "phone_number" && !btn.phone_number) {
      errors.push("Phone button requires phone_number");
    }
  });
  if (["image", "video", "document"].includes(template.headerType) && !template.headerImageUrl && !template.headerMedia && !template.headerImage) {
    errors.push("Selected header media type requires uploaded media handle");
  }
  return errors;
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET
});
async function uploadHeaderImage(base64) {
  const res = await cloudinary.uploader.upload(base64, {
    folder: "whatsapp-templates",
    resource_type: "image"
  });
  return res.secure_url;
}
async function getOrCreateContactId(lead) {
  let contact = await Contact.findOne({ phone: lead.phone });
  if (!contact) {
    contact = await Contact.create({
      id: uuidv4(),
      phone: lead.phone,
      name: lead.full_name || lead.phone || "Facebook Lead",
      source: "facebook"
    });
  }
  return contact.id;
}
export {
  buildMetaTemplate,
  getOrCreateContactId,
  migrateExistingLeads,
  parallelLimit,
  processDripCampaigns,
  retry,
  retryFailedTemplates,
  retrySend,
  sendWithLimit,
  syncLeadsForFormMain,
  uploadHeaderImage,
  validateMetaTemplate
};
