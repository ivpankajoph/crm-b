import { readCollection, addItem, updateItem, deleteItem, findById, updateManyItems } from "../storage/index.js";
const COLLECTION = "agents";
function generateId() {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function getAllAgents() {
  return readCollection(COLLECTION);
}
async function getAgentById(id) {
  return findById(COLLECTION, id);
}
async function createAgent(data) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const agent = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now
  };
  return addItem(COLLECTION, agent);
}
async function updateAgent(id, data) {
  return updateItem(COLLECTION, id, {
    ...data,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteAgent(id) {
  return deleteItem(COLLECTION, id);
}
async function updateAllAgentsToGemini() {
  const updated = await updateManyItems(COLLECTION, {}, {
    model: "gemini-2.0-flash",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const agents = await getAllAgents();
  console.log(`[Agent Service] Updated ${updated} agents to use gemini-2.0-flash`);
  return { updated, agents };
}
async function attachFlowToAgent(agentId, flowId, flowName, entryPointId) {
  return updateItem(COLLECTION, agentId, {
    linkedFlowId: flowId,
    linkedFlowName: flowName,
    flowEntryPointId: entryPointId || "default",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function detachFlowFromAgent(agentId) {
  return updateItem(COLLECTION, agentId, {
    linkedFlowId: void 0,
    linkedFlowName: void 0,
    flowEntryPointId: void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function getAgentsWithFlow(flowId) {
  const agents = await getAllAgents();
  return agents.filter((agent) => agent.linkedFlowId === flowId);
}
export {
  attachFlowToAgent,
  createAgent,
  deleteAgent,
  detachFlowFromAgent,
  getAgentById,
  getAgentsWithFlow,
  getAllAgents,
  updateAgent,
  updateAllAgentsToGemini
};
