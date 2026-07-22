import { Router } from "express";
import { requireAuth, getUserId } from "../auth/auth.routes.js";
import { BlockedContact, Chat, Message, Contact } from "../storage/mongodb.adapter.js";
import crypto from "crypto";
const router = Router();
router.post("/block", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { phone, name, reason } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    const existing = await BlockedContact.findOne({ userId, phone: normalizedPhone });
    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: "Contact is already blocked" });
      }
      await BlockedContact.updateOne(
        { userId, phone: normalizedPhone },
        { $set: { isActive: true, reason: reason || "", blockedAt: (/* @__PURE__ */ new Date()).toISOString() } }
      );
    } else {
      await BlockedContact.create({
        id: crypto.randomUUID(),
        userId,
        phone: normalizedPhone,
        name: name || "",
        reason: reason || "",
        blockedAt: (/* @__PURE__ */ new Date()).toISOString(),
        isActive: true
      });
    }
    res.json({ success: true, message: "Contact blocked successfully" });
  } catch (error) {
    console.error("[Contacts] Error blocking contact:", error);
    res.status(500).json({ error: "Failed to block contact" });
  }
});
router.post("/unblock", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    const result = await BlockedContact.updateOne(
      { userId, phone: normalizedPhone },
      { $set: { isActive: false } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Blocked contact not found" });
    }
    res.json({ success: true, message: "Contact unblocked successfully" });
  } catch (error) {
    console.error("[Contacts] Error unblocking contact:", error);
    res.status(500).json({ error: "Failed to unblock contact" });
  }
});
router.get("/blocked", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const blockedContacts = await BlockedContact.find({ userId, isActive: true }).sort({ blockedAt: -1 }).lean();
    res.json(blockedContacts);
  } catch (error) {
    console.error("[Contacts] Error fetching blocked contacts:", error);
    res.status(500).json({ error: "Failed to fetch blocked contacts" });
  }
});
router.delete("/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { contactId } = req.params;
    await Chat.deleteOne({ contactId });
    await Message.deleteMany({ contactId });
    await Contact.deleteOne({ id: contactId });
    res.json({ success: true, message: "Contact deleted successfully" });
  } catch (error) {
    console.error("[Contacts] Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});
router.patch("/chats/:chatId/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { chatId } = req.params;
    await Chat.updateOne(
      { id: chatId },
      { $set: { unreadCount: 0 } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Contacts] Error marking chat as read:", error);
    res.status(500).json({ error: "Failed to mark chat as read" });
  }
});
router.patch("/chats/contact/:contactId/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { contactId } = req.params;
    await Chat.updateOne(
      { contactId },
      { $set: { unreadCount: 0 } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Contacts] Error marking chat as read:", error);
    res.status(500).json({ error: "Failed to mark chat as read" });
  }
});
async function isContactBlocked(userId, phone) {
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[BlockCheck] Checking if ${normalizedPhone} is blocked for user ${userId}`);
  const blocked = await BlockedContact.findOne({
    userId,
    phone: normalizedPhone,
    isActive: true
  });
  console.log(`[BlockCheck] Result for ${normalizedPhone}: ${blocked ? "BLOCKED" : "not blocked"}`);
  return !!blocked;
}
async function isPhoneBlocked(phone) {
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[BlockCheck] Checking if ${normalizedPhone} is blocked by any user`);
  const blocked = await BlockedContact.findOne({
    phone: normalizedPhone,
    isActive: true
  });
  if (blocked) {
    console.log(`[BlockCheck] Found: ${normalizedPhone} is blocked by user ${blocked.userId}`);
    return { blocked: true, userId: blocked.userId };
  }
  console.log(`[BlockCheck] ${normalizedPhone} is not blocked by anyone`);
  return { blocked: false };
}
async function listAllBlockedContacts() {
  const all = await BlockedContact.find({ isActive: true }).lean();
  console.log(`[BlockCheck] All blocked contacts:`, JSON.stringify(all, null, 2));
  return all;
}
var stdin_default = router;
export {
  stdin_default as default,
  isContactBlocked,
  isPhoneBlocked,
  listAllBlockedContacts
};
