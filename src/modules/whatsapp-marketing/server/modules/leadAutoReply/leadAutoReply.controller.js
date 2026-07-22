import * as leadAutoReplyService from "./leadAutoReply.service.js";
async function processAllLeads(req, res) {
  try {
    const result = await leadAutoReplyService.processAllPendingLeads();
    res.json({
      message: "Lead processing completed",
      ...result
    });
  } catch (error) {
    console.error("Error processing leads:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process leads"
    });
  }
}
async function processLead(req, res) {
  try {
    const lead = req.body;
    if (!lead || !lead.id) {
      return res.status(400).json({ error: "Lead data is required" });
    }
    const result = await leadAutoReplyService.processNewLead(lead);
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error processing lead:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process lead"
    });
  }
}
async function sendReply(req, res) {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await leadAutoReplyService.sendManualReply(leadId, message);
    if (result.success) {
      res.json({ success: true, message: "Reply sent successfully" });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send reply"
    });
  }
}
export {
  processAllLeads,
  processLead,
  sendReply
};
