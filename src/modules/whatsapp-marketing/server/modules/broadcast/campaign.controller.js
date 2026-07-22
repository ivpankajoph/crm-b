import * as campaignService from "./campaign.service.js";
import { getUserId } from "../auth/auth.routes.js";
async function getAllContacts(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await campaignService.getAllContacts(userId);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting contacts:", error);
    res.status(500).json({ error: "Failed to get contacts" });
  }
}
async function getAvailableContacts(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await campaignService.getAvailableContacts(userId);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting available contacts:", error);
    res.status(500).json({ error: "Failed to get available contacts" });
  }
}
async function createCampaign(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { name, description, messageType, templateName, customMessage, agentId, contactIds, scheduledAt } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Campaign name is required" });
    }
    if (!messageType) {
      return res.status(400).json({ error: "Message type is required" });
    }
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "At least one contact must be selected" });
    }
    const campaign = await campaignService.createCampaign(userId, {
      name,
      description,
      messageType,
      templateName,
      customMessage,
      agentId,
      contactIds,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : void 0
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Campaign] Error creating campaign:", error);
    res.status(500).json({ error: error.message || "Failed to create campaign" });
  }
}
async function getCampaigns(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { status, limit, offset } = req.query;
    const result = await campaignService.getCampaigns(userId, {
      status,
      limit: limit ? parseInt(limit, 10) : void 0,
      offset: offset ? parseInt(offset, 10) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Campaign] Error getting campaigns:", error);
    res.status(500).json({ error: "Failed to get campaigns" });
  }
}
async function getCampaignById(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const campaign = await campaignService.getCampaignById(userId, req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  } catch (error) {
    console.error("[Campaign] Error getting campaign:", error);
    res.status(500).json({ error: "Failed to get campaign" });
  }
}
async function executeCampaign(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const campaign = await campaignService.executeCampaign(userId, req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error("[Campaign] Error executing campaign:", error);
    res.status(500).json({ error: error.message || "Failed to execute campaign" });
  }
}
async function getInterestedContacts(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await campaignService.getInterestedContacts(userId, req.params.id);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting interested contacts:", error);
    res.status(500).json({ error: "Failed to get interested contacts" });
  }
}
async function getNotInterestedContacts(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await campaignService.getNotInterestedContacts(userId, req.params.id);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting not interested contacts:", error);
    res.status(500).json({ error: "Failed to get not interested contacts" });
  }
}
async function sendToInterestList(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { interestType, messageType, templateName, agentId, campaignName } = req.body;
    if (!interestType || !["interested", "not_interested"].includes(interestType)) {
      return res.status(400).json({ error: "Valid interest type (interested/not_interested) is required" });
    }
    if (!messageType || !["template", "ai_agent"].includes(messageType)) {
      return res.status(400).json({ error: "Valid message type (template/ai_agent) is required" });
    }
    const campaign = await campaignService.sendToInterestList(userId, req.params.id, interestType, {
      messageType,
      templateName,
      agentId,
      campaignName
    });
    res.json(campaign);
  } catch (error) {
    console.error("[Campaign] Error sending to interest list:", error);
    res.status(500).json({ error: error.message || "Failed to send to interest list" });
  }
}
async function deleteCampaign(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const success = await campaignService.deleteCampaign(userId, req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("[Campaign] Error deleting campaign:", error);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
}
export {
  createCampaign,
  deleteCampaign,
  executeCampaign,
  getAllContacts,
  getAvailableContacts,
  getCampaignById,
  getCampaigns,
  getInterestedContacts,
  getNotInterestedContacts,
  sendToInterestList
};
