import { interestClassificationService } from "./interest.service.js";
const getInterestLists = async (req, res) => {
  try {
    const userId = req.userId || "default";
    const lists = await interestClassificationService.getInterestLists(userId);
    res.json(lists);
  } catch (error) {
    console.error("[Interest] Error getting interest lists:", error);
    res.status(500).json({ error: error.message });
  }
};
const classifyContact = async (req, res) => {
  try {
    const userId = req.userId || "default";
    const { messageContent, contactId, contactPhone } = req.body;
    if (!messageContent || !contactId || !contactPhone) {
      return res.status(400).json({
        error: "Missing required fields: messageContent, contactId, contactPhone"
      });
    }
    const result = await interestClassificationService.classifyAndUpdateContact(
      messageContent,
      contactId,
      contactPhone,
      userId
    );
    res.json(result);
  } catch (error) {
    console.error("[Interest] Error classifying contact:", error);
    res.status(500).json({ error: error.message });
  }
};
const manuallyClassify = async (req, res) => {
  try {
    const userId = req.userId || "default";
    const { contactId } = req.params;
    const { status } = req.body;
    if (!["interested", "not_interested", "neutral"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be: interested, not_interested, or neutral"
      });
    }
    await interestClassificationService.manuallyClassifyContact(contactId, userId, status);
    res.json({ success: true, message: "Contact classified successfully" });
  } catch (error) {
    console.error("[Interest] Error manually classifying contact:", error);
    res.status(500).json({ error: error.message });
  }
};
const getClassificationLogs = async (req, res) => {
  try {
    const userId = req.userId || "default";
    const { contactId, status, limit, offset } = req.query;
    const result = await interestClassificationService.getClassificationLogs(userId, {
      contactId,
      status,
      limit: limit ? parseInt(limit) : void 0,
      offset: offset ? parseInt(offset) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Interest] Error getting classification logs:", error);
    res.status(500).json({ error: error.message });
  }
};
const getInterestReport = async (req, res) => {
  try {
    const userId = req.userId || "default";
    const { days } = req.query;
    const report = await interestClassificationService.getInterestReport(
      userId,
      days ? parseInt(days) : 7
    );
    res.json(report);
  } catch (error) {
    console.error("[Interest] Error getting interest report:", error);
    res.status(500).json({ error: error.message });
  }
};
const testClassification = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await interestClassificationService.classifyMessage(
      message,
      "test",
      "test",
      true
    );
    res.json(result);
  } catch (error) {
    console.error("[Interest] Error testing classification:", error);
    res.status(500).json({ error: error.message });
  }
};
export {
  classifyContact,
  getClassificationLogs,
  getInterestLists,
  getInterestReport,
  manuallyClassify,
  testClassification
};
