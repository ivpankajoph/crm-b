import { FlowDefinition, FlowInstance } from "./flow.model.js";
async function createFlow(userId, data) {
  const flow = new FlowDefinition({
    ...data,
    userId,
    status: "draft",
    nodes: data.nodes || [
      { id: "start-1", type: "start", position: { x: 250, y: 50 }, data: { label: "Start", config: {} } }
    ],
    edges: data.edges || []
  });
  return flow.save();
}
async function getFlowById(userId, flowId) {
  return FlowDefinition.findOne({ _id: flowId, userId });
}
async function getFlows(userId, filters) {
  const query = { userId };
  if (filters?.status) query.status = filters.status;
  if (filters?.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { description: { $regex: filters.search, $options: "i" } }
    ];
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;
  const [flows, total] = await Promise.all([
    FlowDefinition.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    FlowDefinition.countDocuments(query)
  ]);
  return { flows, total };
}
async function updateFlow(userId, flowId, data) {
  return FlowDefinition.findOneAndUpdate(
    { _id: flowId, userId },
    { $set: data },
    { new: true }
  );
}
async function deleteFlow(userId, flowId) {
  const result = await FlowDefinition.deleteOne({ _id: flowId, userId });
  if (result.deletedCount > 0) {
    await FlowInstance.updateMany(
      { flowId, status: "running" },
      { $set: { status: "cancelled", completedAt: /* @__PURE__ */ new Date() } }
    );
    return true;
  }
  return false;
}
async function publishFlow(userId, flowId) {
  const flow = await FlowDefinition.findOne({ _id: flowId, userId });
  if (!flow) return null;
  const validation = validateFlow(flow);
  if (!validation.valid) {
    throw new Error(`Flow validation failed: ${validation.errors.join(", ")}`);
  }
  return FlowDefinition.findOneAndUpdate(
    { _id: flowId, userId },
    {
      $set: { status: "published", publishedAt: /* @__PURE__ */ new Date() },
      $inc: { version: 1 }
    },
    { new: true }
  );
}
async function unpublishFlow(userId, flowId) {
  return FlowDefinition.findOneAndUpdate(
    { _id: flowId, userId },
    { $set: { status: "draft" } },
    { new: true }
  );
}
async function duplicateFlow(userId, flowId) {
  const original = await FlowDefinition.findOne({ _id: flowId, userId });
  if (!original) return null;
  const duplicate = new FlowDefinition({
    ...original.toObject(),
    _id: void 0,
    name: `${original.name} (Copy)`,
    status: "draft",
    version: 1,
    publishedAt: void 0,
    totalInstances: 0,
    activeInstances: 0,
    completedInstances: 0,
    failedInstances: 0,
    createdAt: void 0,
    updatedAt: void 0
  });
  return duplicate.save();
}
function validateFlow(flow) {
  const errors = [];
  const startNodes = flow.nodes.filter((n) => n.type === "start");
  if (startNodes.length === 0) {
    errors.push("Flow must have at least one start node");
  }
  if (startNodes.length > 1) {
    errors.push("Flow can only have one start node");
  }
  const endNodes = flow.nodes.filter((n) => n.type === "end");
  if (endNodes.length === 0) {
    errors.push("Flow must have at least one end node");
  }
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  for (const edge of flow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge references non-existent source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge references non-existent target node: ${edge.target}`);
    }
  }
  const reachable = /* @__PURE__ */ new Set();
  const queue = startNodes.map((n) => n.id);
  while (queue.length > 0) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of flow.edges) {
      if (edge.source === current && !reachable.has(edge.target)) {
        queue.push(edge.target);
      }
    }
  }
  for (const node of flow.nodes) {
    if (node.type !== "start" && !reachable.has(node.id)) {
      errors.push(`Node "${node.data.label}" (${node.id}) is not reachable from start`);
    }
  }
  return { valid: errors.length === 0, errors };
}
async function startFlowInstance(userId, flowId, options) {
  const flow = await FlowDefinition.findOne({ _id: flowId, userId, status: "published" });
  if (!flow) {
    throw new Error("Flow not found or not published");
  }
  const startNode = flow.nodes.find((n) => n.type === "start");
  if (!startNode) {
    throw new Error("Flow has no start node");
  }
  const instance = new FlowInstance({
    flowId: flow._id,
    flowVersion: flow.version,
    userId,
    contactId: options.contactId,
    status: "running",
    currentNodeId: startNode.id,
    context: options.context || {},
    variables: options.variables || {},
    entryType: options.entryType,
    triggerId: options.triggerId,
    nodeHistory: [{
      nodeId: startNode.id,
      nodeType: startNode.type,
      enteredAt: /* @__PURE__ */ new Date(),
      status: "entered"
    }]
  });
  await instance.save();
  await FlowDefinition.updateOne(
    { _id: flow._id },
    { $inc: { totalInstances: 1, activeInstances: 1 } }
  );
  processFlowInstanceAsync(instance, flow);
  return instance;
}
async function processFlowInstanceAsync(instance, flow) {
  try {
    let currentNodeId = instance.currentNodeId;
    while (true) {
      const currentNode = flow.nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) break;
      if (currentNode.type === "end") {
        await completeFlowInstance(instance, "completed");
        break;
      }
      const result = await executeFlowNode(currentNode, instance, flow);
      const historyEntry = instance.nodeHistory.find((h) => h.nodeId === currentNodeId && h.status === "entered");
      if (historyEntry) {
        historyEntry.status = result.success ? "completed" : "failed";
        historyEntry.exitedAt = /* @__PURE__ */ new Date();
        historyEntry.result = result.data;
        if (!result.success) historyEntry.error = result.error;
      }
      if (!result.success) {
        await completeFlowInstance(instance, "failed", result.error);
        break;
      }
      if (result.waitFor) {
        instance.status = "waiting";
        instance.waitingFor = result.waitFor;
        instance.waitingUntil = result.waitUntil;
        await instance.save();
        break;
      }
      const nextNodeId = getNextNode(currentNode, flow, result.data);
      if (!nextNodeId) {
        await completeFlowInstance(instance, "completed");
        break;
      }
      currentNodeId = nextNodeId;
      instance.currentNodeId = nextNodeId;
      instance.nodeHistory.push({
        nodeId: nextNodeId,
        nodeType: flow.nodes.find((n) => n.id === nextNodeId)?.type || "unknown",
        enteredAt: /* @__PURE__ */ new Date(),
        status: "entered"
      });
      await instance.save();
    }
  } catch (error) {
    await completeFlowInstance(instance, "failed", error.message);
  }
}
async function executeFlowNode(node, instance, flow) {
  const { type, data: nodeData } = node;
  const config = nodeData.config;
  try {
    switch (type) {
      case "start":
        return { success: true, data: { started: true } };
      case "message":
        return { success: true, data: { messageSent: true, content: config.message } };
      case "template":
        return { success: true, data: { templateSent: true, templateId: config.templateId } };
      case "delay":
        const delayMs = config.delayMinutes ? config.delayMinutes * 60 * 1e3 : config.delayMs || 1e3;
        return {
          success: true,
          waitFor: "delay",
          waitUntil: new Date(Date.now() + delayMs)
        };
      case "condition":
        const conditionMet = evaluateFlowCondition(config.condition, instance.variables);
        return { success: true, data: { conditionMet } };
      case "api_call":
        return { success: true, data: { apiCalled: true, url: config.url } };
      case "add_tag":
        return { success: true, data: { tagAdded: config.tag } };
      case "remove_tag":
        return { success: true, data: { tagRemoved: config.tag } };
      case "update_property":
        return { success: true, data: { propertyUpdated: config.property, value: config.value } };
      case "ai_response":
        return { success: true, data: { aiResponseGenerated: true } };
      case "wait_for_reply":
        return {
          success: true,
          waitFor: "reply",
          waitUntil: new Date(Date.now() + (config.timeoutMinutes || 60) * 60 * 1e3)
        };
      case "end":
        return { success: true, data: { ended: true } };
      default:
        return { success: true, data: { executed: true } };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
function evaluateFlowCondition(condition, variables) {
  if (!condition) return true;
  const { field, operator, value } = condition;
  const fieldValue = variables[field];
  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "contains":
      return String(fieldValue || "").includes(String(value));
    case "greater_than":
      return Number(fieldValue) > Number(value);
    case "less_than":
      return Number(fieldValue) < Number(value);
    case "exists":
      return fieldValue !== void 0 && fieldValue !== null;
    default:
      return true;
  }
}
function getNextNode(currentNode, flow, result) {
  const outgoingEdges = flow.edges.filter((e) => e.source === currentNode.id);
  if (outgoingEdges.length === 0) return null;
  if (currentNode.type === "condition" && result?.conditionMet !== void 0) {
    const matchingEdge = outgoingEdges.find((e) => {
      if (result.conditionMet && e.sourceHandle === "true") return true;
      if (!result.conditionMet && e.sourceHandle === "false") return true;
      return false;
    });
    return matchingEdge?.target || outgoingEdges[0]?.target || null;
  }
  return outgoingEdges[0]?.target || null;
}
async function completeFlowInstance(instance, status, error) {
  instance.status = status;
  instance.completedAt = /* @__PURE__ */ new Date();
  if (error) instance.error = error;
  await instance.save();
  const updateField = status === "completed" ? "completedInstances" : "failedInstances";
  await FlowDefinition.updateOne(
    { _id: instance.flowId },
    { $inc: { activeInstances: -1, [updateField]: 1 } }
  );
}
async function getFlowInstances(userId, flowId, filters) {
  const query = { userId };
  if (flowId) query.flowId = flowId;
  if (filters?.status) query.status = filters.status;
  if (filters?.contactId) query.contactId = filters.contactId;
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;
  const [instances, total] = await Promise.all([
    FlowInstance.find(query).sort({ startedAt: -1 }).skip(skip).limit(limit),
    FlowInstance.countDocuments(query)
  ]);
  return { instances, total };
}
async function cancelFlowInstance(userId, instanceId) {
  const instance = await FlowInstance.findOne({ _id: instanceId, userId, status: { $in: ["running", "waiting", "paused"] } });
  if (!instance) return null;
  instance.status = "cancelled";
  instance.completedAt = /* @__PURE__ */ new Date();
  await instance.save();
  await FlowDefinition.updateOne(
    { _id: instance.flowId },
    { $inc: { activeInstances: -1 } }
  );
  return instance;
}
async function getFlowStats(userId) {
  const [totalFlows, publishedFlows, flows] = await Promise.all([
    FlowDefinition.countDocuments({ userId }),
    FlowDefinition.countDocuments({ userId, status: "published" }),
    FlowDefinition.find({ userId }).select("totalInstances completedInstances activeInstances")
  ]);
  const totalInstances = flows.reduce((sum, f) => sum + f.totalInstances, 0);
  const completedInstances = flows.reduce((sum, f) => sum + f.completedInstances, 0);
  const activeInstances = flows.reduce((sum, f) => sum + f.activeInstances, 0);
  const completionRate = totalInstances > 0 ? completedInstances / totalInstances * 100 : 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const recentInstances = await FlowInstance.countDocuments({
    userId,
    startedAt: { $gte: oneDayAgo }
  });
  return {
    totalFlows,
    publishedFlows,
    activeInstances,
    completionRate: Math.round(completionRate * 100) / 100,
    recentInstances
  };
}
export {
  cancelFlowInstance,
  createFlow,
  deleteFlow,
  duplicateFlow,
  getFlowById,
  getFlowInstances,
  getFlowStats,
  getFlows,
  publishFlow,
  startFlowInstance,
  unpublishFlow,
  updateFlow,
  validateFlow
};
