import { Router } from "express";
import { getUserId, requireAuth } from "../auth/auth.routes.js";
import {
  applyUsageFilters,
  buildUsageResponse,
  getTenantUsageEvents
} from "./usage.service.js";
const router = Router();
router.use(requireAuth);
async function usageHandler(type, req, res) {
  try {
    const userId = getUserId(req);
    const ownedEvents = await getTenantUsageEvents(userId, {
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : void 0,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : void 0,
      limit: Number(req.query.scanLimit) || Number(req.query.limit) * 4 || 1e3
    });
    const typedEvents = type === "messages" ? ownedEvents : ownedEvents.filter((event) => event.messageType === "template");
    const filtered = applyUsageFilters(typedEvents, req.query);
    return res.json({
      accountUserId: userId,
      reportType: type,
      ...buildUsageResponse(filtered, req.query)
    });
  } catch (error) {
    console.error(`[Usage] Failed to build ${type} report:`, error);
    return res.status(500).json({ error: `Failed to load ${type} usage` });
  }
}
router.get("/messages", (req, res) => usageHandler("messages", req, res));
router.get("/templates", (req, res) => usageHandler("templates", req, res));
router.get("/pricing", (req, res) => usageHandler("pricing", req, res));
var stdin_default = router;
export {
  stdin_default as default
};
