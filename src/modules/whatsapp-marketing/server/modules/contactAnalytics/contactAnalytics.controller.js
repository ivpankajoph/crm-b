import { Router } from "express";
import { contactAnalyticsService } from "./contactAnalytics.service.js";
import * as mongodb from "../storage/mongodb.adapter.js";
import { storage } from "../../storage.js";
const router = Router();
router.get("/reports", async (req, res) => {
  try {
    const { interestLevel, limit, offset } = req.query;
    const result = await contactAnalyticsService.getAllContactReports({
      interestLevel,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(result);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch contact reports" });
  }
});
router.get("/reports/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const report = await contactAnalyticsService.getContactReport(phone);
    if (!report) {
      return res.status(404).json({ error: "Contact report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch contact report" });
  }
});
router.post("/analyze/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const { contactId, contactName } = req.body;
    const userId = req.userId;
    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneLast10 = normalizedPhone.slice(-10);
    const messages = await mongodb.readCollection("messages");
    const contactMessages = messages.filter((m) => {
      const msgContactId = (m.contactId || "").replace(/\D/g, "");
      const msgPhone = (m.phone || "").replace(/\D/g, "");
      const msgIdLast10 = msgContactId.slice(-10);
      const msgPhoneLast10 = msgPhone.slice(-10);
      return msgIdLast10 === phoneLast10 || msgPhoneLast10 === phoneLast10 || msgContactId === normalizedPhone || msgPhone === normalizedPhone;
    });
    contactMessages.sort(
      (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );
    const report = await contactAnalyticsService.analyzeAndUpdateContact(
      contactId || `contact-${normalizedPhone}`,
      normalizedPhone,
      contactName || "Unknown",
      contactMessages,
      userId
    );
    res.json(report);
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing contact:", error);
    res.status(500).json({ error: "Failed to analyze contact" });
  }
});
router.post("/analyze-all", async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await storage.getChats(userId, {
      limit: Math.min(Math.max(Number(req.query.limit) || 500, 1), 2e3),
      sort: { lastMessageTime: -1 }
    });
    const contactAgents = await mongodb.findMany(
      "contact_agents",
      userId ? { userId } : {},
      { limit: 5e3 }
    );
    console.log(`[ContactAnalytics] Analyzing ${chats.length} chats, ${contactAgents.length} agent assignments`);
    const results = [];
    let processed = 0;
    let errors = 0;
    for (const chat of chats) {
      try {
        if (!chat.contact) {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no contact, skipping`);
          continue;
        }
        const contactPhone = (chat.contact.phone || "").replace(/\D/g, "") || "";
        if (!contactPhone) {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no phone, skipping`);
          continue;
        }
        const phoneLast10 = contactPhone.slice(-10);
        const assignment = contactAgents.find((a) => {
          const assignPhone = (a.phone || "").replace(/\D/g, "");
          return assignPhone.includes(phoneLast10) || phoneLast10.includes(assignPhone.slice(-10));
        });
        let conversationMessages = [];
        if (assignment && assignment.conversationHistory && assignment.conversationHistory.length > 0) {
          conversationMessages = assignment.conversationHistory.map((h) => ({
            direction: h.role === "user" ? "inbound" : "outbound",
            content: h.content,
            timestamp: h.timestamp || (/* @__PURE__ */ new Date()).toISOString()
          }));
        } else if (chat.lastInboundMessage || chat.lastMessage) {
          if (chat.lastInboundMessage) {
            conversationMessages.push({
              direction: "inbound",
              content: chat.lastInboundMessage,
              timestamp: chat.lastInboundMessageTime || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
          if (chat.lastMessage && chat.lastMessage !== chat.lastInboundMessage) {
            conversationMessages.push({
              direction: "outbound",
              content: chat.lastMessage,
              timestamp: chat.lastMessageTime || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        if (conversationMessages.length > 0) {
          conversationMessages.sort(
            (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
          );
          processed++;
          console.log(`[ContactAnalytics] Processing ${contactPhone} with ${conversationMessages.length} messages`);
          const report = await contactAnalyticsService.analyzeAndUpdateContact(
            chat.contact.id || chat.contactId,
            contactPhone,
            chat.contact.name || "Unknown",
            conversationMessages,
            userId
          );
          results.push({
            phone: contactPhone,
            name: chat.contact.name,
            interestLevel: report.interestLevel,
            interestScore: report.interestScore
          });
        } else {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no messages, skipping`);
        }
      } catch (err) {
        errors++;
        console.error(`[ContactAnalytics] Error analyzing chat ${chat.id}:`, err);
      }
    }
    console.log(`[ContactAnalytics] Completed: processed=${processed}, results=${results.length}, errors=${errors}`);
    res.json({
      analyzed: results.length,
      results
    });
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing all contacts:", error);
    res.status(500).json({ error: "Failed to analyze contacts" });
  }
});
router.get("/summary", async (req, res) => {
  try {
    const summary = await contactAnalyticsService.getContactAnalyticsSummary();
    res.json(summary);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch analytics summary" });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
