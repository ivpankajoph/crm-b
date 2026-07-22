import * as fbService from "./fb.service.js";
async function syncForms(req, res) {
  try {
    const forms = await fbService.syncLeadForms();
    res.json({ success: true, forms, count: forms.length });
  } catch (error) {
    console.error("Error syncing forms:", error);
    res.status(500).json({ error: error.message || "Failed to sync forms" });
  }
}
async function listForms(req, res) {
  try {
    const forms = await fbService.getAllForms();
    res.json(forms);
  } catch (error) {
    console.error("Error listing forms:", error);
    res.status(500).json({ error: "Failed to list forms" });
  }
}
async function getForm(req, res) {
  try {
    const { id } = req.params;
    const form = await fbService.getFormById(id);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }
    res.json(form);
  } catch (error) {
    console.error("Error getting form:", error);
    res.status(500).json({ error: "Failed to get form" });
  }
}
async function syncLeads(req, res) {
  try {
    const { formId } = req.params;
    const leads = await fbService.syncLeadsForForm(formId);
    res.json({ success: true, leads, count: leads.length });
  } catch (error) {
    console.error("Error syncing leads:", error);
    res.status(500).json({ error: error.message || "Failed to sync leads" });
  }
}
async function listLeads(req, res) {
  try {
    const { formId } = req.query;
    const leads = formId ? await fbService.getLeadsByFormId(formId) : await fbService.getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error("Error listing leads:", error);
    res.status(500).json({ error: "Failed to list leads" });
  }
}
async function getLead(req, res) {
  try {
    const { id } = req.params;
    const lead = await fbService.getLeadById(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    console.error("Error getting lead:", error);
    res.status(500).json({ error: "Failed to get lead" });
  }
}
export {
  getForm,
  getLead,
  listForms,
  listLeads,
  syncForms,
  syncLeads
};
