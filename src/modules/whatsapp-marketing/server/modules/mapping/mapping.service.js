import { readCollection, addItem, updateItem, deleteItem, findById } from "../storage/index.js";
const COLLECTION = "mapping";
function generateId() {
  return `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function getAllMappings() {
  return readCollection(COLLECTION);
}
async function getMappingById(id) {
  return findById(COLLECTION, id);
}
async function getMappingByFormId(formId) {
  const mappings = await readCollection(COLLECTION);
  return mappings.find((m) => m.formId === formId && m.isActive) || null;
}
async function getMappingByAgentId(agentId) {
  const mappings = await readCollection(COLLECTION);
  return mappings.filter((m) => m.agentId === agentId);
}
async function createMapping(data) {
  const existingMappings = await readCollection(COLLECTION);
  const existingForForm = existingMappings.find((m) => m.formId === data.formId);
  if (existingForForm) {
    const updated = await updateMapping(existingForForm.id, {
      agentId: data.agentId,
      agentName: data.agentName,
      isActive: data.isActive
    });
    return updated;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const mapping = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now
  };
  return addItem(COLLECTION, mapping);
}
async function updateMapping(id, data) {
  return updateItem(COLLECTION, id, {
    ...data,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteMapping(id) {
  return deleteItem(COLLECTION, id);
}
export {
  createMapping,
  deleteMapping,
  getAllMappings,
  getMappingByAgentId,
  getMappingByFormId,
  getMappingById,
  updateMapping
};
