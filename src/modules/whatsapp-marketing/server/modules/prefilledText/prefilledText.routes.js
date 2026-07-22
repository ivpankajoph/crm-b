import { Router } from "express";
import * as prefilledTextService from "./prefilledText.service.js";
const router = Router();
router.get("/", async (req, res) => {
  try {
    const mappings = await prefilledTextService.getAllMappings();
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching prefilled text mappings:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const mapping = await prefilledTextService.getMappingById(req.params.id);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error fetching mapping:", error);
    res.status(500).json({ error: "Failed to fetch mapping" });
  }
});
router.post("/", async (req, res) => {
  try {
    const { prefilledText, agentId, agentName } = req.body;
    if (!prefilledText || !agentId || !agentName) {
      return res.status(400).json({ error: "Missing required fields: prefilledText, agentId, agentName" });
    }
    const mapping = await prefilledTextService.createMapping({
      prefilledText,
      agentId,
      agentName
    });
    res.status(201).json(mapping);
  } catch (error) {
    console.error("Error creating mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
});
router.put("/:id", async (req, res) => {
  try {
    const mapping = await prefilledTextService.updateMapping(req.params.id, req.body);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({ error: "Failed to update mapping" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    await prefilledTextService.deleteMapping(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
var stdin_default = router;
export {
  stdin_default as default
};
