import { Router } from "express";
import { requireAuth, getUserId } from "../auth/auth.routes.js";
import * as triggerService from "./triggers/trigger.service.js";
import * as flowService from "./flows/flow.service.js";
import * as dripService from "./drips/drip.service.js";
import * as segmentService from "./segments/segment.service.js";
import * as analyticsService from "./analytics/analytics.service.js";
import { interestClassificationService } from "./interest/interest.service.js";
const router = Router();
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const dateRange = req.query.startDate && req.query.endDate ? {
      start: new Date(req.query.startDate),
      end: new Date(req.query.endDate)
    } : void 0;
    const metrics = await analyticsService.getDashboardMetrics(userId, dateRange);
    res.json(metrics);
  } catch (error) {
    console.error("[Automation] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});
router.get("/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, eventSource, search, page, limit } = req.query;
    const result = await triggerService.getTriggers(userId, {
      status,
      eventSource,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get triggers error:", error);
    res.status(500).json({ error: "Failed to get triggers" });
  }
});
router.get("/triggers/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await triggerService.getTriggerStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Trigger stats error:", error);
    res.status(500).json({ error: "Failed to get trigger stats" });
  }
});
router.get("/triggers/activity", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const activity = await triggerService.getRecentActivity(userId, limit);
    res.json(activity);
  } catch (error) {
    console.error("[Automation] Activity error:", error);
    res.status(500).json({ error: "Failed to get activity" });
  }
});
router.get("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.getTriggerById(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Get trigger error:", error);
    res.status(500).json({ error: "Failed to get trigger" });
  }
});
router.post("/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.createTrigger(userId, req.body);
    res.status(201).json(trigger);
  } catch (error) {
    console.error("[Automation] Create trigger error:", error);
    res.status(500).json({ error: "Failed to create trigger" });
  }
});
router.put("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.updateTrigger(userId, req.params.triggerId, req.body);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Update trigger error:", error);
    res.status(500).json({ error: "Failed to update trigger" });
  }
});
router.delete("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await triggerService.deleteTrigger(userId, req.params.triggerId);
    if (!deleted) return res.status(404).json({ error: "Trigger not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete trigger error:", error);
    res.status(500).json({ error: "Failed to delete trigger" });
  }
});
router.post("/triggers/:triggerId/activate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.activateTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Activate trigger error:", error);
    res.status(500).json({ error: "Failed to activate trigger" });
  }
});
router.post("/triggers/:triggerId/pause", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.pauseTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Pause trigger error:", error);
    res.status(500).json({ error: "Failed to pause trigger" });
  }
});
router.post("/triggers/:triggerId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await triggerService.duplicateTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.status(201).json(trigger);
  } catch (error) {
    console.error("[Automation] Duplicate trigger error:", error);
    res.status(500).json({ error: "Failed to duplicate trigger" });
  }
});
router.get("/triggers/:triggerId/executions", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, startDate, endDate, page, limit } = req.query;
    const result = await triggerService.getTriggerExecutions(userId, req.params.triggerId, {
      status,
      startDate: startDate ? new Date(startDate) : void 0,
      endDate: endDate ? new Date(endDate) : void 0,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Executions error:", error);
    res.status(500).json({ error: "Failed to get executions" });
  }
});
router.post("/events", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { sourceType, eventType, payload, contactId } = req.body;
    const result = await triggerService.processEvent(userId, {
      sourceType,
      eventType,
      payload,
      contactId
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Process event error:", error);
    res.status(500).json({ error: "Failed to process event" });
  }
});
router.get("/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await flowService.getFlows(userId, {
      status,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get flows error:", error);
    res.status(500).json({ error: "Failed to get flows" });
  }
});
router.get("/flows/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await flowService.getFlowStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Flow stats error:", error);
    res.status(500).json({ error: "Failed to get flow stats" });
  }
});
router.get("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.getFlowById(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Get flow error:", error);
    res.status(500).json({ error: "Failed to get flow" });
  }
});
router.post("/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.createFlow(userId, req.body);
    res.status(201).json(flow);
  } catch (error) {
    console.error("[Automation] Create flow error:", error);
    res.status(500).json({ error: "Failed to create flow" });
  }
});
router.put("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.updateFlow(userId, req.params.flowId, req.body);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Update flow error:", error);
    res.status(500).json({ error: "Failed to update flow" });
  }
});
router.delete("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await flowService.deleteFlow(userId, req.params.flowId);
    if (!deleted) return res.status(404).json({ error: "Flow not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete flow error:", error);
    res.status(500).json({ error: "Failed to delete flow" });
  }
});
router.post("/flows/:flowId/publish", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.publishFlow(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Publish flow error:", error);
    res.status(400).json({ error: error.message || "Failed to publish flow" });
  }
});
router.post("/flows/:flowId/unpublish", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.unpublishFlow(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Unpublish flow error:", error);
    res.status(500).json({ error: "Failed to unpublish flow" });
  }
});
router.post("/flows/:flowId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await flowService.duplicateFlow(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.status(201).json(flow);
  } catch (error) {
    console.error("[Automation] Duplicate flow error:", error);
    res.status(500).json({ error: "Failed to duplicate flow" });
  }
});
router.post("/flows/:flowId/run", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, variables, context } = req.body;
    const instance = await flowService.startFlowInstance(userId, req.params.flowId, {
      contactId,
      entryType: "manual",
      variables,
      context
    });
    res.status(201).json(instance);
  } catch (error) {
    console.error("[Automation] Run flow error:", error);
    res.status(400).json({ error: error.message || "Failed to run flow" });
  }
});
router.get("/flows/:flowId/instances", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, contactId, page, limit } = req.query;
    const result = await flowService.getFlowInstances(userId, req.params.flowId, {
      status,
      contactId,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get instances error:", error);
    res.status(500).json({ error: "Failed to get instances" });
  }
});
router.post("/flows/instances/:instanceId/cancel", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const instance = await flowService.cancelFlowInstance(userId, req.params.instanceId);
    if (!instance) return res.status(404).json({ error: "Instance not found" });
    res.json(instance);
  } catch (error) {
    console.error("[Automation] Cancel instance error:", error);
    res.status(500).json({ error: "Failed to cancel instance" });
  }
});
router.get("/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await dripService.getCampaigns(userId, {
      status,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get campaigns error:", error);
    res.status(500).json({ error: "Failed to get campaigns" });
  }
});
router.get("/campaigns/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await dripService.getCampaignStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Campaign stats error:", error);
    res.status(500).json({ error: "Failed to get campaign stats" });
  }
});
router.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.getCampaignById(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Get campaign error:", error);
    res.status(500).json({ error: "Failed to get campaign" });
  }
});
router.post("/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.createCampaign(userId, req.body);
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Create campaign error:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});
router.put("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.updateCampaign(userId, req.params.campaignId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Update campaign error:", error);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});
router.delete("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await dripService.deleteCampaign(userId, req.params.campaignId);
    if (!deleted) return res.status(404).json({ error: "Campaign not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete campaign error:", error);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});
router.post("/campaigns/:campaignId/launch", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.launchCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Launch campaign error:", error);
    res.status(400).json({ error: error.message || "Failed to launch campaign" });
  }
});
router.post("/campaigns/:campaignId/pause", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.pauseCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Pause campaign error:", error);
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});
router.post("/campaigns/:campaignId/resume", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.resumeCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Resume campaign error:", error);
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});
router.post("/campaigns/:campaignId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.duplicateCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Duplicate campaign error:", error);
    res.status(500).json({ error: "Failed to duplicate campaign" });
  }
});
router.post("/campaigns/:campaignId/enroll", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, contactPhone, variables } = req.body;
    const run = await dripService.enrollContact(userId, req.params.campaignId, contactId, contactPhone, variables);
    res.status(201).json(run);
  } catch (error) {
    console.error("[Automation] Enroll error:", error);
    res.status(400).json({ error: error.message || "Failed to enroll contact" });
  }
});
router.post("/campaigns/:campaignId/unenroll", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, reason } = req.body;
    const run = await dripService.unenrollContact(userId, req.params.campaignId, contactId, reason);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (error) {
    console.error("[Automation] Unenroll error:", error);
    res.status(500).json({ error: "Failed to unenroll contact" });
  }
});
router.get("/campaigns/:campaignId/runs", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, page, limit } = req.query;
    const result = await dripService.getCampaignRuns(userId, req.params.campaignId, {
      status,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get runs error:", error);
    res.status(500).json({ error: "Failed to get runs" });
  }
});
router.post("/campaigns/:campaignId/steps", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.addStep(userId, req.params.campaignId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Add step error:", error);
    res.status(500).json({ error: "Failed to add step" });
  }
});
router.post("/campaigns/:campaignId/steps/reorder", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { stepOrder } = req.body;
    const campaign = await dripService.reorderSteps(userId, req.params.campaignId, stepOrder);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Reorder steps error:", error);
    res.status(500).json({ error: "Failed to reorder steps" });
  }
});
router.put("/campaigns/:campaignId/steps/:stepId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.updateStep(userId, req.params.campaignId, req.params.stepId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign or step not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Update step error:", error);
    res.status(500).json({ error: "Failed to update step" });
  }
});
router.delete("/campaigns/:campaignId/steps/:stepId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await dripService.removeStep(userId, req.params.campaignId, req.params.stepId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Remove step error:", error);
    res.status(500).json({ error: "Failed to remove step" });
  }
});
router.get("/segments", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, type, search, page, limit } = req.query;
    const result = await segmentService.getSegments(userId, {
      status,
      type,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get segments error:", error);
    res.status(500).json({ error: "Failed to get segments" });
  }
});
router.get("/segments/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await segmentService.getSegmentStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Segment stats error:", error);
    res.status(500).json({ error: "Failed to get segment stats" });
  }
});
router.get("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await segmentService.getSegmentById(userId, req.params.segmentId);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (error) {
    console.error("[Automation] Get segment error:", error);
    res.status(500).json({ error: "Failed to get segment" });
  }
});
router.post("/segments", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await segmentService.createSegment(userId, req.body);
    res.status(201).json(segment);
  } catch (error) {
    console.error("[Automation] Create segment error:", error);
    res.status(500).json({ error: "Failed to create segment" });
  }
});
router.put("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await segmentService.updateSegment(userId, req.params.segmentId, req.body);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (error) {
    console.error("[Automation] Update segment error:", error);
    res.status(500).json({ error: "Failed to update segment" });
  }
});
router.delete("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await segmentService.deleteSegment(userId, req.params.segmentId);
    if (!deleted) return res.status(404).json({ error: "Segment not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete segment error:", error);
    res.status(500).json({ error: "Failed to delete segment" });
  }
});
router.post("/segments/:segmentId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await segmentService.duplicateSegment(userId, req.params.segmentId);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.status(201).json(segment);
  } catch (error) {
    console.error("[Automation] Duplicate segment error:", error);
    res.status(500).json({ error: "Failed to duplicate segment" });
  }
});
router.post("/segments/:segmentId/refresh", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const memberCount = await segmentService.refreshSegmentMembers(req.params.segmentId, userId);
    res.json({ success: true, memberCount });
  } catch (error) {
    console.error("[Automation] Refresh segment error:", error);
    res.status(500).json({ error: "Failed to refresh segment" });
  }
});
router.get("/segments/:segmentId/members", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { page, limit } = req.query;
    const result = await segmentService.getSegmentMembers(userId, req.params.segmentId, {
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get members error:", error);
    res.status(500).json({ error: "Failed to get members" });
  }
});
router.post("/segments/:segmentId/members", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId } = req.body;
    const member = await segmentService.addManualMember(userId, req.params.segmentId, contactId);
    if (!member) return res.status(400).json({ error: "Contact already in segment or segment not found" });
    res.status(201).json(member);
  } catch (error) {
    console.error("[Automation] Add member error:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});
router.delete("/segments/:segmentId/members/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const removed = await segmentService.removeMember(userId, req.params.segmentId, req.params.contactId);
    if (!removed) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Remove member error:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});
router.post("/segments/preview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { ruleGroup, limit } = req.body;
    const result = await segmentService.previewSegment(userId, ruleGroup, limit || 10);
    res.json(result);
  } catch (error) {
    console.error("[Automation] Preview segment error:", error);
    res.status(500).json({ error: "Failed to preview segment" });
  }
});
router.get("/analytics/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { triggerId, startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await analyticsService.getTriggerPerformance(userId, triggerId, dateRange);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Trigger analytics error:", error);
    res.status(500).json({ error: "Failed to get trigger analytics" });
  }
});
router.get("/analytics/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { flowId, startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await analyticsService.getFlowPerformance(userId, flowId, dateRange);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Flow analytics error:", error);
    res.status(500).json({ error: "Failed to get flow analytics" });
  }
});
router.get("/analytics/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { campaignId, startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await analyticsService.getCampaignPerformance(userId, campaignId, dateRange);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Campaign analytics error:", error);
    res.status(500).json({ error: "Failed to get campaign analytics" });
  }
});
router.get("/analytics/heatmap", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { period } = req.query;
    const heatmap = await analyticsService.generateEngagementHeatmap(userId, period);
    res.json(heatmap);
  } catch (error) {
    console.error("[Automation] Heatmap error:", error);
    res.status(500).json({ error: "Failed to generate heatmap" });
  }
});
router.get("/analytics/insights", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { scope, status, limit } = req.query;
    const insights = await analyticsService.getAIInsights(userId, {
      scope,
      status,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(insights);
  } catch (error) {
    console.error("[Automation] Insights error:", error);
    res.status(500).json({ error: "Failed to get insights" });
  }
});
router.post("/analytics/insights/generate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const insights = await analyticsService.generateAIInsights(userId);
    res.json(insights);
  } catch (error) {
    console.error("[Automation] Generate insights error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});
router.put("/analytics/insights/:insightId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.body;
    const insight = await analyticsService.updateInsightStatus(userId, req.params.insightId, status);
    if (!insight) return res.status(404).json({ error: "Insight not found" });
    res.json(insight);
  } catch (error) {
    console.error("[Automation] Update insight error:", error);
    res.status(500).json({ error: "Failed to update insight" });
  }
});
router.post("/analytics/export", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { reportType, format, startDate, endDate } = req.body;
    const dateRange = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const report = await analyticsService.exportReport(userId, reportType, format, dateRange);
    res.json(report);
  } catch (error) {
    console.error("[Automation] Export error:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});
router.get("/interest/lists", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const lists = await interestClassificationService.getInterestLists(userId);
    res.json(lists);
  } catch (error) {
    console.error("[Interest] Get lists error:", error);
    res.status(500).json({ error: "Failed to get interest lists" });
  }
});
router.post("/interest/classify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { messageContent, contactId, contactPhone } = req.body;
    if (!messageContent || !contactId || !contactPhone) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = await interestClassificationService.classifyAndUpdateContact(
      messageContent,
      contactId,
      contactPhone,
      userId
    );
    res.json(result);
  } catch (error) {
    console.error("[Interest] Classify error:", error);
    res.status(500).json({ error: "Failed to classify contact" });
  }
});
router.put("/interest/contacts/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.body;
    if (!["interested", "not_interested", "neutral"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await interestClassificationService.manuallyClassifyContact(
      req.params.contactId,
      userId,
      status
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Interest] Manual classify error:", error);
    res.status(500).json({ error: "Failed to classify contact" });
  }
});
router.get("/interest/logs", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, status, limit, offset } = req.query;
    const result = await interestClassificationService.getClassificationLogs(userId, {
      contactId,
      status,
      limit: limit ? parseInt(limit) : void 0,
      offset: offset ? parseInt(offset) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Interest] Get logs error:", error);
    res.status(500).json({ error: "Failed to get logs" });
  }
});
router.get("/interest/report", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { days } = req.query;
    const report = await interestClassificationService.getInterestReport(
      userId,
      days ? parseInt(days) : 7
    );
    res.json(report);
  } catch (error) {
    console.error("[Interest] Get report error:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
});
router.post("/interest/test", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await interestClassificationService.classifyMessage(message, "test", "test", true);
    res.json(result);
  } catch (error) {
    console.error("[Interest] Test classify error:", error);
    res.status(500).json({ error: "Failed to test classification" });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
