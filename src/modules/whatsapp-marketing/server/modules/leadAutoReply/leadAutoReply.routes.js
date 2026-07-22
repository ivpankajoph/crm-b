import { Router } from "express";
import * as controller from "./leadAutoReply.controller.js";
const router = Router();
router.post("/process-all", controller.processAllLeads);
router.post("/process", controller.processLead);
router.post("/send/:leadId", controller.sendReply);
var stdin_default = router;
export {
  stdin_default as default
};
