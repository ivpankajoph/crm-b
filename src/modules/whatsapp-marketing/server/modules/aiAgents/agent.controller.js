import * as agentService from "./agent.service.js";
import { generateAgentResponse } from "../ai/ai.service.js";
async function listAgents(req, res) {
  try {
    const agents = await agentService.getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error("Error listing agents:", error);
    res.status(500).json({ error: "Failed to list agents" });
  }
}
async function getAgent(req, res) {
  try {
    const { id } = req.params;
    const agent = await agentService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error("Error getting agent:", error);
    res.status(500).json({ error: "Failed to get agent" });
  }
}
async function createAgent(req, res) {
  try {
    const { name, description, systemPrompt, model, temperature, isActive } = req.body;
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: "Name and system prompt are required" });
    }
    const agent = await agentService.createAgent({
      name,
      description: description || "",
      systemPrompt,
      model: model || "gpt-4o",
      temperature: temperature ?? 0.7,
      isActive: isActive ?? true
    });
    res.status(201).json(agent);
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
}
async function updateAgent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const agent = await agentService.updateAgent(id, updates);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
}
async function deleteAgent(req, res) {
  try {
    const { id } = req.params;
    const deleted = await agentService.deleteAgent(id);
    if (!deleted) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json({ success: true, message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Errors deleting agent:", error);
    res.status(500).json({ error: "Failed to delete agent" });
  }
}
async function testAgent(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.headers["x-user-id"] || void 0;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const agent = await agentService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const response = await generateAgentResponse(message, agent, [], userId);
    res.json({ response });
  } catch (error) {
    console.error("Error testing agent:", error);
    res.status(500).json({ error: "Failed to test agent" });
  }
}
async function migrateAllToGemini(req, res) {
  try {
    const result = await agentService.updateAllAgentsToGemini();
    res.json({
      success: true,
      message: `Successfully updated ${result.updated} agents to use gemini-2.0-flash`,
      agents: result.agents
    });
  } catch (error) {
    console.error("Error migrating agents to Gemini:", error);
    res.status(500).json({ error: "Failed to migrate agents to Gemini" });
  }
}
export {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  migrateAllToGemini,
  testAgent,
  updateAgent
};
