import { Router } from "express";
import { reportsService } from "./reports.service.js";
import { getUserId } from "../auth/auth.routes.js";
import { requireAuth } from "../auth/auth.routes.js";
import * as billingController from "./billing.controller.js";
const router = Router();
function parseTimeFilter(req) {
  const period = req.query.period || "week";
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  return {
    period,
    startDate,
    endDate
  };
}
router.get("/ai-agents", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getAIAgentPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching AI agent performance:", error);
    res.status(500).json({ error: "Failed to fetch AI agent performance data" });
  }
});
router.get("/customer-replies", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCustomerReplies(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching customer replies:", error);
    res.status(500).json({ error: "Failed to fetch customer replies data" });
  }
});
router.get("/user-engagement", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getUserEngagement(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching user engagement:", error);
    res.status(500).json({ error: "Failed to fetch user engagement data" });
  }
});
router.get("/spending", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getSpendingReport(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching spending report:", error);
    res.status(500).json({ error: "Failed to fetch spending data" });
  }
});
router.get("/overview", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getDashboardOverview(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching overview:", error);
    res.status(500).json({ error: "Failed to fetch overview data" });
  }
});
router.get("/campaign-performance", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCampaignPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching campaign performance:", error);
    res.status(500).json({ error: "Failed to fetch campaign performance data" });
  }
});
router.get("/blocked-contacts", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const data = await reportsService.getBlockedContactsReport(userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching blocked contacts report:", error);
    res.status(500).json({ error: "Failed to fetch blocked contacts report" });
  }
});
router.get("/24hour-window", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.get24HourWindowStats(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching 24-hour window stats:", error);
    res.status(500).json({ error: "Failed to fetch 24-hour window stats" });
  }
});
router.get("/enhanced-dashboard", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  try {
    const userId = getUserId(req);
    const filter = parseTimeFilter(req);
    const data = await reportsService.getEnhancedDashboardStats(filter, userId);
    console.log(
      `[Reports] enhanced-dashboard user=${userId} period=${filter.period} ${Date.now() - startedAt}ms`
    );
    res.json(data);
  } catch (error) {
    console.error(
      `[Reports] Error fetching enhanced dashboard stats after ${Date.now() - startedAt}ms:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch enhanced dashboard stats" });
  }
});
router.get("/billing/summary", requireAuth, billingController.getBillingSummary);
router.get("/billing/conversations", requireAuth, billingController.getConversationsBilling);
router.get("/billing/all-users", requireAuth, billingController.getAllUsersBilling);
var stdin_default = router;
export {
  stdin_default as default
};
