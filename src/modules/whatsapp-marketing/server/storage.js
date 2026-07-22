import { randomUUID } from "crypto";
import * as mongodb from "./modules/storage/mongodb.adapter.js";
function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}
class MongoStorage {
  async getUser(id) {
    const user = await mongodb.findOne("users", { id });
    return user || void 0;
  }
  async getUserByUsername(username) {
    const user = await mongodb.findOne("users", { username });
    return user || void 0;
  }
  async createUser(insertUser) {
    const user = {
      ...insertUser,
      id: randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await mongodb.insertOne("users", user);
    return user;
  }
  async getContacts(userId) {
    return mongodb.findMany("contacts", userId ? { userId } : {});
  }
  async getContact(id, userId) {
    const contact = await mongodb.findOne(
      "contacts",
      userId ? { id, userId } : { id }
    );
    return contact || void 0;
  }
  async getContactByPhone(phone, userId) {
    const normalizedPhone = normalizePhone(phone);
    const contacts = await this.getContacts(userId);
    return contacts.find(
      (c) => normalizePhone(c.phone).endsWith(normalizedPhone.slice(-10)) || normalizedPhone.endsWith(normalizePhone(c.phone).slice(-10))
    );
  }
  async createContact(contact) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newContact = {
      ...contact,
      id: randomUUID(),
      tags: contact.tags || [],
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("contacts", newContact);
    const chat = {
      id: `chat-${newContact.id}`,
      userId: newContact.userId,
      contactId: newContact.id,
      contact: newContact,
      unreadCount: 0,
      status: "open",
      notes: []
    };
    await mongodb.insertOne("chats", chat);
    return newContact;
  }
  async updateContact(id, contact) {
    const updated = await mongodb.updateOne(
      "contacts",
      { id },
      {
        ...contact,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    );
    return updated || void 0;
  }
  async deleteContact(id) {
    await mongodb.deleteOne("messages", { contactId: id });
    await mongodb.deleteOne("chats", { contactId: id });
    return mongodb.deleteOne("contacts", { id });
  }
  async getMessages(contactId, userId, options = {}) {
    const query = {};
    if (contactId) query.contactId = contactId;
    if (userId) query.userId = userId;
    return mongodb.findMany("messages", query, {
      sort: options.sort || { timestamp: -1 },
      skip: options.skip,
      limit: options.limit
    });
  }
  async getMessage(id) {
    const message = await mongodb.findOne("messages", { id });
    return message || void 0;
  }
  async createMessage(message) {
    console.log("[createMessage] \u25B6\uFE0F Called", {
      contactId: message.contactId,
      direction: message.direction,
      type: message.type
    });
    const newMessage = {
      ...message,
      id: randomUUID(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await mongodb.insertOne("messages", newMessage);
      console.log("[createMessage] \u2705 Message inserted", {
        messageId: newMessage.id,
        contactId: newMessage.contactId
      });
    } catch (err) {
      console.error("[createMessage] \u274C Failed to insert message", err);
      throw err;
    }
    let chat;
    try {
      chat = await this.getChatByContactId(message.contactId);
      console.log(
        `[createMessage] \u{1F50D} Chat lookup for contactId=${message.contactId}:`,
        chat ? "FOUND" : "NOT FOUND"
      );
    } catch (err) {
      console.error("[createMessage] \u274C Chat lookup failed", err);
    }
    if (chat) {
      const updateData = {
        lastMessage: newMessage.content,
        lastMessageTime: newMessage.timestamp
      };
      if (message.direction === "inbound") {
        updateData.lastInboundMessageTime = newMessage.timestamp;
        updateData.lastInboundMessage = newMessage.content;
      }
      try {
        await mongodb.updateOne("chats", { id: chat.id }, updateData);
        console.log("[createMessage] \u2705 Chat updated", {
          chatId: chat.id,
          lastMessage: newMessage.content
        });
      } catch (err) {
        console.error("[createMessage] \u274C Failed to update chat", err);
      }
    } else {
      console.warn("[createMessage] \u26A0\uFE0F No chat found, creating new chat", {
        contactId: message.contactId
      });
      const contact = await this.getContact(message.contactId);
      const newChat = {
        id: `chat-${message.contactId}`,
        userId: message.userId,
        contactId: message.contactId,
        contact: contact || {
          id: message.contactId,
          name: "Unknown",
          phone: "",
          tags: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        lastMessage: newMessage.content,
        lastMessageTime: newMessage.timestamp,
        lastInboundMessage: message.direction === "inbound" ? newMessage.content : void 0,
        lastInboundMessageTime: message.direction === "inbound" ? newMessage.timestamp : void 0,
        unreadCount: message.direction === "inbound" ? 1 : 0,
        status: "open",
        notes: []
      };
      await mongodb.insertOne("chats", newChat);
      console.log("[createMessage] \u2705 Chat created", {
        chatId: newChat.id,
        contactId: message.contactId
      });
    }
    return newMessage;
  }
  async updateMessage(id, message) {
    const updated = await mongodb.updateOne(
      "messages",
      { id },
      message
    );
    return updated || void 0;
  }
  async getCampaigns() {
    return mongodb.findMany("campaigns", {});
  }
  async getCampaign(id) {
    const campaign = await mongodb.findOne("campaigns", { id });
    return campaign || void 0;
  }
  async createCampaign(campaign) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newCampaign = {
      ...campaign,
      id: randomUUID(),
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      repliedCount: 0,
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("campaigns", newCampaign);
    return newCampaign;
  }
  async updateCampaign(id, campaign) {
    const updated = await mongodb.updateOne(
      "campaigns",
      { id },
      {
        ...campaign,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    );
    return updated || void 0;
  }
  async deleteCampaign(id) {
    return mongodb.deleteOne("campaigns", { id });
  }
  async getTemplates() {
    return mongodb.findMany("templates", {});
  }
  async getTemplate(id) {
    const template = await mongodb.findOne("templates", { id });
    return template || void 0;
  }
  async createTemplate(template) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newTemplate = {
      ...template,
      id: randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("templates", newTemplate);
    return newTemplate;
  }
  async updateTemplate(id, template) {
    const updated = await mongodb.updateOne(
      "templates",
      { id },
      {
        ...template,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    );
    return updated || void 0;
  }
  async deleteTemplate(id) {
    return mongodb.deleteOne("templates", { id });
  }
  async getAutomations() {
    return mongodb.findMany("automations", {});
  }
  async getAutomation(id) {
    const automation = await mongodb.findOne("automations", { id });
    return automation || void 0;
  }
  async createAutomation(automation) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newAutomation = {
      ...automation,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("automations", newAutomation);
    return newAutomation;
  }
  async updateAutomation(id, automation) {
    const updated = await mongodb.updateOne(
      "automations",
      { id },
      {
        ...automation,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    );
    return updated || void 0;
  }
  async deleteAutomation(id) {
    return mongodb.deleteOne("automations", { id });
  }
  async getTeamMembers() {
    return mongodb.findMany("team_members", {});
  }
  async getTeamMember(id) {
    const member = await mongodb.findOne("team_members", { id });
    return member || void 0;
  }
  async createTeamMember(member) {
    const newMember = {
      ...member,
      id: randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await mongodb.insertOne("team_members", newMember);
    return newMember;
  }
  async updateTeamMember(id, member) {
    const updated = await mongodb.updateOne(
      "team_members",
      { id },
      member
    );
    return updated || void 0;
  }
  async deleteTeamMember(id) {
    return mongodb.deleteOne("team_members", { id });
  }
  async getWhatsappSettings() {
    const settings = await mongodb.findOne(
      "whatsapp_settings",
      {}
    );
    return settings;
  }
  async saveWhatsappSettings(settings) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await this.getWhatsappSettings();
    if (existing) {
      const updated = await mongodb.updateOne(
        "whatsapp_settings",
        { id: existing.id },
        {
          ...settings,
          updatedAt: now
        }
      );
      return updated;
    }
    const newSettings = {
      ...settings,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await mongodb.insertOne("whatsapp_settings", newSettings);
    return newSettings;
  }
  async getBilling() {
    const billing = await mongodb.findOne("billing", {});
    if (!billing) {
      const defaultBilling = {
        id: "billing-1",
        credits: 1500,
        transactions: []
      };
      await mongodb.insertOne("billing", defaultBilling);
      return defaultBilling;
    }
    return billing;
  }
  async updateBilling(billing) {
    const current = await this.getBilling();
    const updated = await mongodb.updateOne(
      "billing",
      { id: current.id },
      billing
    );
    return updated || current;
  }
  async addTransaction(transaction) {
    const billing = await this.getBilling();
    const newTransaction = {
      id: randomUUID(),
      ...transaction,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    billing.transactions.push(newTransaction);
    billing.credits += transaction.amount;
    await mongodb.updateOne(
      "billing",
      { id: billing.id },
      {
        credits: billing.credits,
        transactions: billing.transactions
      }
    );
    return billing;
  }
  async getDashboardStats() {
    const messages = await this.getMessages();
    const campaigns = await this.getCampaigns();
    const outbound = messages.filter((m) => m.direction === "outbound");
    const delivered = outbound.filter(
      (m) => m.status === "delivered" || m.status === "read"
    );
    const read = outbound.filter((m) => m.status === "read");
    const inbound = messages.filter((m) => m.direction === "inbound");
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const thisWeekMessages = messages.filter(
      (m) => new Date(m.timestamp) > weekAgo
    );
    const lastWeekMessages = messages.filter((m) => {
      const msgDate = new Date(m.timestamp);
      return msgDate > new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1e3) && msgDate <= weekAgo;
    });
    const thisWeekOutbound = thisWeekMessages.filter(
      (m) => m.direction === "outbound"
    ).length;
    const lastWeekOutbound = lastWeekMessages.filter((m) => m.direction === "outbound").length || 1;
    const dailyActivity = [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1e3);
      const dayMessages = messages.filter((m) => {
        const msgDate = new Date(m.timestamp);
        return msgDate.toDateString() === date.toDateString();
      });
      dailyActivity.push({
        day: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
        sent: dayMessages.filter((m) => m.direction === "outbound").length,
        delivered: dayMessages.filter(
          (m) => m.direction === "outbound" && (m.status === "delivered" || m.status === "read")
        ).length,
        read: dayMessages.filter(
          (m) => m.direction === "outbound" && m.status === "read"
        ).length
      });
    }
    const campaignPerformance = campaigns.slice(0, 5).map((c) => ({
      name: c.name,
      delivered: c.deliveredCount,
      read: c.readCount
    }));
    return {
      totalMessages: outbound.length,
      delivered: delivered.length,
      readRate: outbound.length > 0 ? Math.round(read.length / outbound.length * 100 * 10) / 10 : 0,
      replied: inbound.length,
      messagesChange: Math.round(
        (thisWeekOutbound - lastWeekOutbound) / lastWeekOutbound * 100 * 10
      ) / 10,
      deliveredChange: 2.1,
      readRateChange: 5.4,
      repliedChange: -1.2,
      dailyActivity,
      campaignPerformance
    };
  }
  async getChats(userId, options = {}) {
    const chats = await mongodb.findMany("chats", userId ? { userId } : {}, {
      sort: options.sort || { lastMessageTime: -1 },
      skip: options.skip,
      limit: options.limit
    });
    const contactIds = chats.map((chat) => chat.contactId).filter(Boolean);
    const contacts = contactIds.length ? await mongodb.findMany(
      "contacts",
      {
        id: { $in: contactIds },
        ...userId ? { userId } : {}
      },
      { limit: contactIds.length }
    ) : [];
    const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
    return chats.map((chat) => {
      const contact = contactsById.get(chat.contactId);
      return {
        ...chat,
        contact: contact || {
          id: chat.contactId,
          name: "Unknown",
          phone: "",
          tags: [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    });
  }
  async getChat(id, userId) {
    const chat = await mongodb.findOne(
      "chats",
      userId ? { id, userId } : { id }
    );
    if (!chat) return void 0;
    const contact = await this.getContact(chat.contactId, userId);
    return {
      ...chat,
      contact: contact || {
        id: chat.contactId,
        name: "Unknown",
        phone: "",
        tags: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async getChatByContactId(contactId, userId) {
    const chat = await mongodb.findOne(
      "chats",
      userId ? { contactId, userId } : { contactId }
    );
    if (!chat) return void 0;
    const contact = await this.getContact(contactId, userId);
    return {
      ...chat,
      contact: contact || {
        id: contactId,
        name: "Unknown",
        phone: "",
        tags: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async updateChat(id, chat) {
    const updated = await mongodb.updateOne("chats", { id }, chat);
    return updated || void 0;
  }
  async updateChatInboundTime(contactId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const chat = await this.getChatByContactId(contactId);
    if (chat) {
      await mongodb.updateOne(
        "chats",
        { contactId },
        {
          lastInboundMessageTime: now,
          unreadCount: (chat.unreadCount || 0) + 1
        }
      );
    } else {
      const contact = await this.getContact(contactId);
      if (contact) {
        const newChat = {
          id: `chat-${contactId}`,
          userId: contact.userId,
          contactId,
          contact,
          lastInboundMessageTime: now,
          unreadCount: 1,
          status: "open",
          notes: []
        };
        await mongodb.insertOne("chats", newChat);
      }
    }
  }
  async markMessagesAsRead(contactId) {
    const messages = await mongodb.findMany("messages", {
      contactId,
      direction: "inbound"
    });
    for (const msg of messages) {
      if (msg.status !== "read") {
        await mongodb.updateOne("messages", { id: msg.id }, { status: "read" });
      }
    }
    await mongodb.updateOne("chats", { contactId }, { unreadCount: 0 });
  }
  async markMessagesAsUnread(contactId) {
    await mongodb.updateOne("chats", { contactId }, { unreadCount: 1 });
  }
  async incrementUnreadCount(contactId) {
    const chat = await this.getChatByContactId(contactId);
    if (chat) {
      await mongodb.updateOne(
        "chats",
        { contactId },
        {
          unreadCount: (chat.unreadCount || 0) + 1
        }
      );
    }
  }
}
const storage = new MongoStorage();
export {
  MongoStorage,
  storage
};
