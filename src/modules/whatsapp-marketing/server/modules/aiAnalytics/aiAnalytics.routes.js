import { Router } from "express";
import * as aiAnalyticsService from "./aiAnalytics.service.js";
const router = Router();
router.get("/qualifications", async (req, res) => {
  try {
    const { category, source, campaignId, agentId } = req.query;
    let qualifications = await aiAnalyticsService.getQualifications();
    if (category && typeof category === "string") {
      qualifications = qualifications.filter((q) => q.category === category);
    }
    if (source && typeof source === "string") {
      qualifications = qualifications.filter((q) => q.source === source);
    }
    if (campaignId && typeof campaignId === "string") {
      qualifications = qualifications.filter((q) => q.campaignId === campaignId);
    }
    if (agentId && typeof agentId === "string") {
      qualifications = qualifications.filter((q) => q.agentId === agentId);
    }
    qualifications.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(qualifications);
  } catch (error) {
    console.error("Error getting qualifications:", error);
    res.status(500).json({ error: "Failed to get qualifications" });
  }
});
router.get("/qualifications/stats", async (req, res) => {
  try {
    const stats = await aiAnalyticsService.getQualificationStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting qualification stats:", error);
    res.status(500).json({ error: "Failed to get qualification stats" });
  }
});
router.get("/qualifications/report", async (req, res) => {
  try {
    const report = await aiAnalyticsService.getQualificationReport();
    res.json(report);
  } catch (error) {
    console.error("Error getting qualification report:", error);
    res.status(500).json({ error: "Failed to get qualification report" });
  }
});
router.get("/qualifications/:id", async (req, res) => {
  try {
    const qualification = await aiAnalyticsService.getQualificationById(req.params.id);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error getting qualification:", error);
    res.status(500).json({ error: "Failed to get qualification" });
  }
});
router.post("/qualifications", async (req, res) => {
  try {
    const { phone, name, message, source, campaignId, campaignName, agentId, agentName, contactId } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ error: "Phone and name are required" });
    }
    const qualification = await aiAnalyticsService.createOrUpdateQualification(
      phone,
      name,
      message || "",
      source || "manual",
      { campaignId, campaignName, agentId, agentName, contactId }
    );
    res.status(201).json(qualification);
  } catch (error) {
    console.error("Error creating qualification:", error);
    res.status(500).json({ error: "Failed to create qualification" });
  }
});
router.put("/qualifications/:id/category", async (req, res) => {
  try {
    const { category, notes } = req.body;
    if (!category || !["interested", "not_interested", "pending"].includes(category)) {
      return res.status(400).json({ error: "Valid category is required (interested, not_interested, pending)" });
    }
    const qualification = await aiAnalyticsService.updateQualificationCategory(req.params.id, category, notes);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error updating qualification category:", error);
    res.status(500).json({ error: "Failed to update qualification category" });
  }
});
router.put("/qualifications/:id/notes", async (req, res) => {
  try {
    const { notes } = req.body;
    const qualification = await aiAnalyticsService.updateQualificationNotes(req.params.id, notes || "");
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error updating qualification notes:", error);
    res.status(500).json({ error: "Failed to update qualification notes" });
  }
});
router.delete("/qualifications/:id", async (req, res) => {
  try {
    const success = await aiAnalyticsService.deleteQualification(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting qualification:", error);
    res.status(500).json({ error: "Failed to delete qualification" });
  }
});
router.get("/qualifications/by-phone/:phone", async (req, res) => {
  try {
    const qualification = await aiAnalyticsService.getQualificationByPhone(req.params.phone);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found for this phone" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error getting qualification by phone:", error);
    res.status(500).json({ error: "Failed to get qualification" });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
