import { billingService } from "./billing.service.js";
import { getUserId } from "../auth/auth.routes.js";
function parseBillingFilter(req) {
  const period = req.query.period || "month";
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  return {
    period,
    startDate,
    endDate
  };
}
async function getBillingSummary(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const summary = await billingService.getBillingSummary(userId, filter);
    res.json(summary);
  } catch (error) {
    console.error("[Billing] Error getting billing summary:", error);
    res.status(500).json({ error: "Failed to get billing summary" });
  }
}
async function getConversationsBilling(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await billingService.getConversationsBilling(userId, filter, { limit, offset });
    res.json(result);
  } catch (error) {
    console.error("[Billing] Error getting conversations billing:", error);
    res.status(500).json({ error: "Failed to get conversations billing" });
  }
}
async function getAllUsersBilling(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const result = await billingService.getAllUsersBillingSummary(filter);
    res.json(result);
  } catch (error) {
    console.error("[Billing] Error getting all users billing:", error);
    res.status(500).json({ error: "Failed to get all users billing" });
  }
}
export {
  getAllUsersBilling,
  getBillingSummary,
  getConversationsBilling
};
