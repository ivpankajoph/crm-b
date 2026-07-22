import * as mongodb from "../storage/mongodb.adapter.js";
function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}
async function assignAgentToContact(contactId, phone, agentId, agentName) {
  const normalizedPhone = normalizePhone(phone);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await mongodb.findOne("contact_agents", {
    phone: { $regex: normalizedPhone.slice(-10) + "$" }
  });
  if (existing) {
    const updated = await mongodb.updateOne(
      "contact_agents",
      { id: existing.id },
      {
        agentId,
        agentName,
        isActive: true,
        updatedAt: now
      }
    );
    console.log(`[ContactAgent] Updated agent assignment for ${phone}: ${agentId}`);
    return updated;
  }
  const newAssignment = {
    id: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contactId,
    phone: normalizedPhone,
    agentId,
    agentName,
    conversationHistory: [],
    isActive: true,
    autoReplyDisabled: false,
    createdAt: now,
    updatedAt: now
  };
  const result = await mongodb.insertOne("contact_agents", newAssignment);
  console.log(`[ContactAgent] Created agent assignment for ${phone}: ${agentId}`);
  return result;
}
async function getAgentForContact(phone) {
  const normalizedPhone = normalizePhone(phone);
  const assignment = await mongodb.findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ],
    isActive: true
  });
  return assignment;
}
async function addMessageToHistory(phone, role, content) {
  const normalizedPhone = normalizePhone(phone);
  const assignment = await mongodb.findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!assignment) {
    return false;
  }
  const newMessage = {
    role,
    content,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const updatedHistory = [...assignment.conversationHistory || [], newMessage].slice(-20);
  await mongodb.updateOne(
    "contact_agents",
    { id: assignment.id },
    {
      conversationHistory: updatedHistory,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  );
  return true;
}
async function getConversationHistory(phone) {
  const normalizedPhone = normalizePhone(phone);
  const assignment = await mongodb.findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!assignment || !assignment.conversationHistory) {
    return [];
  }
  return assignment.conversationHistory.map((m) => ({
    role: m.role,
    content: m.content
  }));
}
async function removeAgentFromContact(phone) {
  const normalizedPhone = normalizePhone(phone);
  const result = await mongodb.updateOne(
    "contact_agents",
    { $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ] },
    { isActive: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
  return result !== null;
}
async function getAllContactAgents() {
  return mongodb.readCollection("contact_agents");
}
async function disableAutoReply(phone) {
  const normalizedPhone = normalizePhone(phone);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await mongodb.findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (existing) {
    await mongodb.updateOne(
      "contact_agents",
      { id: existing.id },
      { autoReplyDisabled: true, updatedAt: now }
    );
    console.log(`[ContactAgent] Disabled auto-reply for ${phone}`);
    return true;
  }
  const newRecord = {
    id: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    contactId: "",
    phone: normalizedPhone,
    agentId: "",
    agentName: void 0,
    conversationHistory: [],
    isActive: false,
    autoReplyDisabled: true,
    createdAt: now,
    updatedAt: now
  };
  await mongodb.insertOne("contact_agents", newRecord);
  console.log(`[ContactAgent] Created record with auto-reply disabled for ${phone}`);
  return true;
}
async function isAutoReplyDisabled(phone) {
  const normalizedPhone = normalizePhone(phone);
  const record = await mongodb.findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  return record?.autoReplyDisabled === true;
}
async function enableAutoReply(phone) {
  const normalizedPhone = normalizePhone(phone);
  const result = await mongodb.updateOne(
    "contact_agents",
    { $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ] },
    { autoReplyDisabled: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
  console.log(`[ContactAgent] Enabled auto-reply for ${phone}`);
  return result !== null;
}
async function enableAutoReplyForAll() {
  const allRecords = await mongodb.readCollection("contact_agents");
  const disabledRecords = allRecords.filter((r) => r.autoReplyDisabled === true);
  let updated = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const record of disabledRecords) {
    await mongodb.updateOne(
      "contact_agents",
      { id: record.id },
      { autoReplyDisabled: false, updatedAt: now }
    );
    updated++;
    console.log(`[ContactAgent] Re-enabled auto-reply for ${record.phone}`);
  }
  console.log(`[ContactAgent] Bulk re-enabled auto-reply for ${updated}/${allRecords.length} contacts`);
  return { updated, total: allRecords.length };
}
async function getAutoReplyStats() {
  const allRecords = await mongodb.readCollection("contact_agents");
  const disabled = allRecords.filter((r) => r.autoReplyDisabled === true).length;
  return {
    total: allRecords.length,
    enabled: allRecords.length - disabled,
    disabled
  };
}
export {
  addMessageToHistory,
  assignAgentToContact,
  disableAutoReply,
  enableAutoReply,
  enableAutoReplyForAll,
  getAgentForContact,
  getAllContactAgents,
  getAutoReplyStats,
  getConversationHistory,
  isAutoReplyDisabled,
  removeAgentFromContact
};
