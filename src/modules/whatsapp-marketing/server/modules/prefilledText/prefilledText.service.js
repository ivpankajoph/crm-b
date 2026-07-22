import * as mongodb from "../storage/mongodb.adapter.js";
async function getAllMappings() {
  const mappings = await mongodb.readCollection("prefilled_text_mappings");
  return mappings;
}
async function getMappingById(id) {
  return mongodb.findOne("prefilled_text_mappings", { id });
}
async function getMappingByText(text) {
  const normalizedText = text.toLowerCase().trim();
  const mappings = await mongodb.readCollection("prefilled_text_mappings");
  for (const mapping of mappings) {
    if (!mapping.isActive) continue;
    const mappingText = mapping.prefilledText.toLowerCase().trim();
    if (normalizedText === mappingText || normalizedText.includes(mappingText) || mappingText.includes(normalizedText)) {
      return mapping;
    }
  }
  return null;
}
async function createMapping(data) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const mapping = {
    id: `pft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    prefilledText: data.prefilledText,
    agentId: data.agentId,
    agentName: data.agentName,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
  await mongodb.insertOne("prefilled_text_mappings", mapping);
  return mapping;
}
async function updateMapping(id, data) {
  const updated = await mongodb.updateOne(
    "prefilled_text_mappings",
    { id },
    { ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
  return updated;
}
async function deleteMapping(id) {
  await mongodb.deleteOne("prefilled_text_mappings", { id });
  return true;
}
async function findMatchingAgentForMessage(messageText) {
  const normalizedMessage = messageText.toLowerCase().trim();
  const mappings = await mongodb.readCollection("prefilled_text_mappings");
  const activeMappings = mappings.filter((m) => m.isActive);
  activeMappings.sort((a, b) => b.prefilledText.length - a.prefilledText.length);
  for (const mapping of activeMappings) {
    const mappingText = mapping.prefilledText.toLowerCase().trim();
    if (normalizedMessage === mappingText) {
      console.log(`[PrefilledText] Exact match found: "${messageText}" -> Agent: ${mapping.agentName}`);
      return mapping;
    }
    if (normalizedMessage.startsWith(mappingText)) {
      console.log(`[PrefilledText] Prefix match found: "${messageText}" starts with "${mapping.prefilledText}" -> Agent: ${mapping.agentName}`);
      return mapping;
    }
  }
  return null;
}
export {
  createMapping,
  deleteMapping,
  findMatchingAgentForMessage,
  getAllMappings,
  getMappingById,
  getMappingByText,
  updateMapping
};
