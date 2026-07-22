import { readCollection, writeCollection, findById, findByField } from "../storage/index.js";
import * as leadAutoReply from "../leadAutoReply/leadAutoReply.service.js";
import * as integrationService from "../integrations/integration.service.js";
import { autoEnrollContact } from "../automation/drips/drip.service.js";
import { Contact } from "../storage/mongodb.adapter.js";
const FB_USER_OR_PAGE_TOKEN = "";
const FB_PAGE_ID = "";
let cachedPageAccessToken = null;
let cachedPageId = null;
async function getFacebookCredentials(userId = "system") {
  const integrationCreds = await integrationService.getDecryptedCredentials(userId, "facebook");
  if (integrationCreds?.accessToken && integrationCreds?.pageId) {
    console.log("[FB] Using credentials from Connected Apps");
    return {
      token: integrationCreds.accessToken,
      pageId: integrationCreds.pageId
    };
  }
  if (FB_USER_OR_PAGE_TOKEN && FB_PAGE_ID) {
    return {
      token: FB_USER_OR_PAGE_TOKEN,
      pageId: FB_PAGE_ID
    };
  }
  return null;
}
async function getPageAccessToken(userId = "system") {
  const creds = await getFacebookCredentials(userId);
  if (!creds) {
    throw new Error("Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.");
  }
  if (cachedPageAccessToken && cachedPageId === creds.pageId) {
    return cachedPageAccessToken;
  }
  const { token, pageId } = creds;
  try {
    const meResponse = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    const meData = await meResponse.json();
    if (meData.category || meData.category_list) {
      console.log("[FB] Token is already a Page Access Token");
      cachedPageAccessToken = token;
      cachedPageId = pageId;
      return cachedPageAccessToken;
    }
    console.log("[FB] Token is a User Access Token, fetching Page Access Token...");
    const accountsResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}`);
    const accountsData = await accountsResponse.json();
    if (accountsData.data && accountsData.data.length > 0) {
      const targetPage = pageId ? accountsData.data.find((p) => p.id === pageId) : accountsData.data[0];
      if (targetPage && targetPage.access_token) {
        console.log(`[FB] Found Page Access Token for page: ${targetPage.name} (${targetPage.id})`);
        cachedPageAccessToken = targetPage.access_token;
        cachedPageId = pageId;
        return targetPage.access_token;
      }
    }
    console.log("[FB] Could not find Page Access Token, using original token");
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  } catch (error) {
    console.error("[FB] Error determining token type:", error);
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  }
}
const FORMS_COLLECTION = "forms";
const LEADS_COLLECTION = "leads";
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function syncLeadForms(userId = "system") {
  const creds = await getFacebookCredentials(userId);
  if (!creds) {
    throw new Error("Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.");
  }
  try {
    const pageToken = await getPageAccessToken(userId);
    const url = `https://graph.facebook.com/v21.0/${creds.pageId}/leadgen_forms?access_token=${pageToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }
    const data = await response.json();
    const forms = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const fbForm of data.data || []) {
      const existingForm = await findByField(FORMS_COLLECTION, "fbFormId", fbForm.id);
      const form = {
        id: existingForm?.id || generateId("form"),
        fbFormId: fbForm.id,
        name: fbForm.name || "Unnamed Form",
        status: fbForm.status || "ACTIVE",
        pageId: creds.pageId,
        createdTime: fbForm.created_time || now,
        syncedAt: now
      };
      forms.push(form);
    }
    await writeCollection(FORMS_COLLECTION, forms);
    return forms;
  } catch (error) {
    console.error("Error syncing lead forms:", error);
    throw error;
  }
}
async function getAllForms() {
  return readCollection(FORMS_COLLECTION);
}
async function getFormById(id) {
  return findById(FORMS_COLLECTION, id);
}
async function getFormByFbId(fbFormId) {
  return findByField(FORMS_COLLECTION, "fbFormId", fbFormId);
}
async function syncLeadsForForm(formId) {
  if (!FB_USER_OR_PAGE_TOKEN) {
    throw new Error("Facebook credentials not configured. Please set FB_PAGE_ACCESS_TOKEN.");
  }
  console.log(`[FB Service] Looking for form with id: ${formId}`);
  let form = await findById(FORMS_COLLECTION, formId);
  if (!form) {
    console.log(`[FB Service] Form not found by id, checking by fbFormId...`);
    form = await findByField(FORMS_COLLECTION, "fbFormId", formId);
    if (!form) {
      console.log(`[FB Service] Form not found by fbFormId either, checking all forms...`);
      const allForms = await readCollection(FORMS_COLLECTION);
      console.log(`[FB Service] Total forms in database: ${allForms.length}`);
      if (allForms.length > 0) {
        allForms.forEach((f) => console.log(`[FB Service] Form: id=${f.id}, fbFormId=${f.fbFormId}, name=${f.name}`));
      }
      const foundForm = allForms.find((f) => f.id === formId || f.fbFormId === formId);
      if (!foundForm) {
        console.log(`[FB Service] Form still not found after checking all forms`);
        throw new Error("Form not found");
      }
      form = foundForm;
    }
  }
  console.log(`[FB Service] Found form: ${form.name} (fbFormId: ${form.fbFormId})`);
  if (!form.fbFormId) {
    throw new Error("Form is missing Facebook Form ID. Please re-sync forms from Facebook.");
  }
  try {
    const pageToken = await getPageAccessToken();
    const url = `https://graph.facebook.com/v21.0/${form.fbFormId}/leads?access_token=${pageToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }
    const data = await response.json();
    const existingLeads = await readCollection(LEADS_COLLECTION);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newLeads = [];
    for (const fbLead of data.data || []) {
      const existingLead = existingLeads.find((l) => l.fbLeadId === fbLead.id);
      if (existingLead) continue;
      const fieldData = {};
      let phone = "";
      let email = "";
      let name = "";
      for (const field of fbLead.field_data || []) {
        fieldData[field.name] = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("phone")) phone = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("email")) email = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("name")) name = field.values?.[0] || "";
      }
      const lead = {
        id: generateId("lead"),
        fbLeadId: fbLead.id,
        formId: form.id,
        formName: form.name,
        fieldData,
        createdTime: fbLead.created_time || now,
        syncedAt: now,
        phone,
        email,
        name
      };
      newLeads.push(lead);
    }
    const allLeads = [...existingLeads, ...newLeads];
    await writeCollection(LEADS_COLLECTION, allLeads);
    for (const lead of newLeads) {
      if (lead.phone && !lead.autoReplySent) {
        console.log(`[FB Service] Triggering auto-reply for new lead: ${lead.id}`);
        const autoReplyLead = {
          id: lead.id,
          formId: lead.formId,
          formName: lead.formName,
          fullName: lead.name,
          email: lead.email,
          phoneNumber: lead.phone,
          fieldData: lead.fieldData,
          createdTime: lead.createdTime,
          autoReplySent: lead.autoReplySent
        };
        leadAutoReply.processNewLead(autoReplyLead).then(async (result) => {
          if (result.success) {
            const currentLeads = await readCollection(LEADS_COLLECTION);
            const idx = currentLeads.findIndex((l) => l.id === lead.id);
            if (idx !== -1) {
              currentLeads[idx].autoReplySent = true;
              currentLeads[idx].autoReplyMessage = result.message;
              currentLeads[idx].autoReplySentAt = (/* @__PURE__ */ new Date()).toISOString();
              await writeCollection(LEADS_COLLECTION, currentLeads);
              console.log(`[FB Service] Auto-reply status saved for lead ${lead.id}`);
            }
          }
        }).catch((err) => {
          console.error(`[FB Service] Auto-reply failed for lead ${lead.id}:`, err);
        });
        triggerDripCampaignsForLead(lead).catch((err) => {
          console.error(`[FB Service] Drip campaign trigger failed for lead ${lead.id}:`, err);
        });
      }
    }
    return newLeads;
  } catch (error) {
    console.error("Error syncing leads:", error);
    throw error;
  }
}
async function getAllLeads() {
  return readCollection(LEADS_COLLECTION);
}
async function getLeadsByFormId(formId) {
  const leads = await readCollection(LEADS_COLLECTION);
  return leads.filter((lead) => lead.formId === formId);
}
async function getLeadById(id) {
  return findById(LEADS_COLLECTION, id);
}
async function triggerDripCampaignsForLead(lead) {
  if (!lead.phone) {
    console.log(`[FB Service] Lead ${lead.id} has no phone number, skipping drip campaigns`);
    return;
  }
  try {
    let contact = await Contact.findOne({ phone: lead.phone });
    if (!contact) {
      contact = await Contact.create({
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: lead.name || "Facebook Lead",
        phone: lead.phone,
        email: lead.email || "",
        source: "facebook_lead",
        tags: ["facebook-lead", lead.formName || "unknown-form"],
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        metadata: {
          fbLeadId: lead.fbLeadId,
          formId: lead.formId,
          formName: lead.formName,
          fieldData: lead.fieldData
        }
      });
      console.log(`[FB Service] Created new contact for Facebook lead: ${contact.phone}`);
    }
    const result = await autoEnrollContact(
      "system",
      contact.id,
      contact.phone,
      "facebook_new_lead",
      {
        contactName: contact.name,
        source: "facebook_lead",
        formName: lead.formName,
        leadId: lead.id
      }
    );
    if (result.enrolled.length > 0) {
      console.log(`[FB Service] Enrolled lead ${lead.id} in drip campaigns: ${result.enrolled.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      console.log(`[FB Service] Skipped campaigns for lead ${lead.id}: ${result.skipped.join(", ")}`);
    }
  } catch (error) {
    console.error(`[FB Service] Error triggering drip campaigns for lead ${lead.id}:`, error);
    throw error;
  }
}
export {
  getAllForms,
  getAllLeads,
  getFormByFbId,
  getFormById,
  getLeadById,
  getLeadsByFormId,
  syncLeadForms,
  syncLeadsForForm
};
