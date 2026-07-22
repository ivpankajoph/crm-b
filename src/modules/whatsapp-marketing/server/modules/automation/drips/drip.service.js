import { DripCampaign, DripRun } from "./drip.model.js";
async function createCampaign(userId, data) {
  const campaign = new DripCampaign({
    ...data,
    userId,
    status: "draft"
  });
  return campaign.save();
}
async function getCampaignById(userId, campaignId) {
  return DripCampaign.findOne({ _id: campaignId, userId });
}
async function getCampaigns(userId, filters) {
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
  const [campaigns, total] = await Promise.all([
    DripCampaign.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    DripCampaign.countDocuments(query)
  ]);
  return { campaigns, total };
}
async function updateCampaign(userId, campaignId, data) {
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $set: data },
    { new: true }
  );
}
async function deleteCampaign(userId, campaignId) {
  const result = await DripCampaign.deleteOne({ _id: campaignId, userId });
  if (result.deletedCount > 0) {
    await DripRun.updateMany(
      { campaignId, status: "active" },
      { $set: { status: "exited", exitedAt: /* @__PURE__ */ new Date(), exitReason: "campaign_ended" } }
    );
    return true;
  }
  return false;
}
async function launchCampaign(userId, campaignId) {
  const campaign = await DripCampaign.findOne({ _id: campaignId, userId });
  if (!campaign) return null;
  if (campaign.steps.length === 0) {
    throw new Error("Campaign must have at least one step");
  }
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    {
      $set: {
        status: "active",
        startDate: campaign.startDate || /* @__PURE__ */ new Date()
      }
    },
    { new: true }
  );
}
async function pauseCampaign(userId, campaignId) {
  await DripRun.updateMany(
    { campaignId, status: "active" },
    { $set: { status: "paused" } }
  );
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $set: { status: "paused" } },
    { new: true }
  );
}
async function resumeCampaign(userId, campaignId) {
  await DripRun.updateMany(
    { campaignId, status: "paused" },
    { $set: { status: "active" } }
  );
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $set: { status: "active" } },
    { new: true }
  );
}
async function duplicateCampaign(userId, campaignId) {
  const original = await DripCampaign.findOne({ _id: campaignId, userId });
  if (!original) return null;
  const duplicate = new DripCampaign({
    ...original.toObject(),
    _id: void 0,
    name: `${original.name} (Copy)`,
    status: "draft",
    metrics: {
      totalEnrolled: 0,
      activeContacts: 0,
      completedContacts: 0,
      exitedContacts: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalRead: 0,
      totalReplied: 0,
      totalConverted: 0,
      totalFailed: 0
    },
    startDate: void 0,
    createdAt: void 0,
    updatedAt: void 0
  });
  return duplicate.save();
}
async function addStep(userId, campaignId, step) {
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $push: { steps: step } },
    { new: true }
  );
}
async function updateStep(userId, campaignId, stepId, stepData) {
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId, "steps.id": stepId },
    { $set: { "steps.$": { ...stepData, id: stepId } } },
    { new: true }
  );
}
async function removeStep(userId, campaignId, stepId) {
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $pull: { steps: { id: stepId } } },
    { new: true }
  );
}
async function reorderSteps(userId, campaignId, stepOrder) {
  const campaign = await DripCampaign.findOne({ _id: campaignId, userId });
  if (!campaign) return null;
  const reorderedSteps = stepOrder.map((stepId, index) => {
    const step = campaign.steps.find((s) => s.id === stepId);
    if (step) {
      return { ...step, order: index };
    }
    return null;
  }).filter(Boolean);
  return DripCampaign.findOneAndUpdate(
    { _id: campaignId, userId },
    { $set: { steps: reorderedSteps } },
    { new: true }
  );
}
async function enrollContact(userId, campaignId, contactId, contactPhone, variables) {
  const campaign = await DripCampaign.findOne({ _id: campaignId, userId, status: "active" });
  if (!campaign) {
    throw new Error("Campaign not found or not active");
  }
  const existingRun = await DripRun.findOne({ campaignId, contactId });
  if (existingRun && !campaign.settings.allowReEntry) {
    throw new Error("Contact is already enrolled in this campaign");
  }
  if (existingRun && campaign.settings.allowReEntry) {
    const daysSinceExit = existingRun.exitedAt ? (Date.now() - existingRun.exitedAt.getTime()) / (1e3 * 60 * 60 * 24) : 0;
    if (daysSinceExit < campaign.settings.reEntryDelayDays) {
      throw new Error(`Contact must wait ${campaign.settings.reEntryDelayDays} days before re-entry`);
    }
  }
  const firstStep = campaign.steps.find((s) => s.order === 0) || campaign.steps[0];
  if (!firstStep) {
    throw new Error("Campaign has no steps");
  }
  const nextScheduledAt = calculateNextStepTime(campaign, firstStep, /* @__PURE__ */ new Date());
  const run = new DripRun({
    campaignId: campaign._id,
    userId,
    contactId,
    contactPhone,
    status: "active",
    currentStepIndex: 0,
    stepHistory: [],
    nextStepScheduledAt: nextScheduledAt,
    variables: variables || {}
  });
  await run.save();
  await DripCampaign.updateOne(
    { _id: campaignId },
    { $inc: { "metrics.totalEnrolled": 1, "metrics.activeContacts": 1 } }
  );
  return run;
}
function calculateNextStepTime(campaign, step, baseDate) {
  const result = new Date(baseDate);
  const totalDays = (step.dayOffset || 0) + (step.delayDays || 0);
  const totalHours = step.delayHours || 0;
  const totalMinutes = step.delayMinutes || 0;
  result.setDate(result.getDate() + totalDays);
  result.setHours(result.getHours() + totalHours);
  result.setMinutes(result.getMinutes() + totalMinutes);
  if (step.timeOfDay) {
    const [hours, minutes] = step.timeOfDay.split(":").map(Number);
    result.setHours(hours, minutes, 0, 0);
  } else {
    const [hours, minutes] = campaign.schedule.startTime.split(":").map(Number);
    result.setHours(hours, minutes, 0, 0);
  }
  return result;
}
async function unenrollContact(userId, campaignId, contactId, reason = "manual") {
  const run = await DripRun.findOneAndUpdate(
    { campaignId, contactId, userId, status: "active" },
    {
      $set: {
        status: "exited",
        exitedAt: /* @__PURE__ */ new Date(),
        exitReason: reason
      }
    },
    { new: true }
  );
  if (run) {
    await DripCampaign.updateOne(
      { _id: campaignId },
      { $inc: { "metrics.activeContacts": -1, "metrics.exitedContacts": 1 } }
    );
  }
  return run;
}
async function getCampaignRuns(userId, campaignId, filters) {
  const query = { userId, campaignId };
  if (filters?.status) query.status = filters.status;
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;
  const [runs, total] = await Promise.all([
    DripRun.find(query).sort({ enrolledAt: -1 }).skip(skip).limit(limit),
    DripRun.countDocuments(query)
  ]);
  return { runs, total };
}
async function getDueRuns() {
  const now = /* @__PURE__ */ new Date();
  return DripRun.find({
    status: "active",
    nextStepScheduledAt: { $lte: now }
  }).limit(100);
}
async function processRun(run) {
  const campaign = await DripCampaign.findById(run.campaignId);
  if (!campaign || campaign.status !== "active") {
    await DripRun.updateOne(
      { _id: run._id },
      { $set: { status: "exited", exitedAt: /* @__PURE__ */ new Date(), exitReason: "campaign_ended" } }
    );
    return;
  }
  const currentStep = campaign.steps[run.currentStepIndex];
  if (!currentStep) {
    await DripRun.updateOne(
      { _id: run._id },
      { $set: { status: "completed", completedAt: /* @__PURE__ */ new Date(), exitReason: "completed" } }
    );
    await DripCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { "metrics.activeContacts": -1, "metrics.completedContacts": 1 } }
    );
    return;
  }
  try {
    const messageResult = await sendStepMessage(campaign, currentStep, run);
    run.stepHistory.push({
      stepId: currentStep.id,
      stepOrder: currentStep.order,
      status: "sent",
      messageId: messageResult.messageId,
      scheduledAt: run.nextStepScheduledAt || /* @__PURE__ */ new Date(),
      sentAt: /* @__PURE__ */ new Date()
    });
    await DripCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { "metrics.totalSent": 1 } }
    );
    const nextStepIndex = run.currentStepIndex + 1;
    if (nextStepIndex >= campaign.steps.length) {
      run.status = "completed";
      run.completedAt = /* @__PURE__ */ new Date();
      run.exitReason = "completed";
      run.nextStepScheduledAt = void 0;
      await DripCampaign.updateOne(
        { _id: campaign._id },
        { $inc: { "metrics.activeContacts": -1, "metrics.completedContacts": 1 } }
      );
    } else {
      const nextStep = campaign.steps[nextStepIndex];
      run.currentStepIndex = nextStepIndex;
      run.nextStepScheduledAt = calculateNextStepTime(campaign, nextStep, /* @__PURE__ */ new Date());
    }
    await run.save();
  } catch (error) {
    run.stepHistory.push({
      stepId: currentStep.id,
      stepOrder: currentStep.order,
      status: "failed",
      scheduledAt: run.nextStepScheduledAt || /* @__PURE__ */ new Date(),
      error: error.message
    });
    await DripCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { "metrics.totalFailed": 1 } }
    );
    await run.save();
  }
}
async function sendStepMessage(campaign, step, run) {
  return { messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
}
async function updateRunStatus(runId, status) {
  const run = await DripRun.findById(runId);
  if (!run || run.stepHistory.length === 0) return;
  const lastStep = run.stepHistory[run.stepHistory.length - 1];
  switch (status) {
    case "delivered":
      lastStep.deliveredAt = /* @__PURE__ */ new Date();
      lastStep.status = "delivered";
      await DripCampaign.updateOne(
        { _id: run.campaignId },
        { $inc: { "metrics.totalDelivered": 1 } }
      );
      break;
    case "read":
      lastStep.readAt = /* @__PURE__ */ new Date();
      lastStep.status = "read";
      await DripCampaign.updateOne(
        { _id: run.campaignId },
        { $inc: { "metrics.totalRead": 1 } }
      );
      break;
    case "replied":
      lastStep.repliedAt = /* @__PURE__ */ new Date();
      lastStep.status = "replied";
      await DripCampaign.updateOne(
        { _id: run.campaignId },
        { $inc: { "metrics.totalReplied": 1 } }
      );
      break;
  }
  await run.save();
}
async function markConversion(userId, campaignId, contactId) {
  const run = await DripRun.findOne({ campaignId, contactId, userId });
  if (!run) return;
  await DripCampaign.updateOne(
    { _id: campaignId },
    { $inc: { "metrics.totalConverted": 1 } }
  );
  if (run.status === "active") {
    const campaign = await DripCampaign.findById(campaignId);
    if (campaign?.settings.stopOnConversion) {
      run.status = "exited";
      run.exitedAt = /* @__PURE__ */ new Date();
      run.exitReason = "converted";
      await run.save();
      await DripCampaign.updateOne(
        { _id: campaignId },
        { $inc: { "metrics.activeContacts": -1, "metrics.exitedContacts": 1 } }
      );
    }
  }
}
async function getCampaignStats(userId) {
  const [totalCampaigns, activeCampaigns, campaigns] = await Promise.all([
    DripCampaign.countDocuments({ userId }),
    DripCampaign.countDocuments({ userId, status: "active" }),
    DripCampaign.find({ userId }).select("metrics")
  ]);
  const totals = campaigns.reduce((acc, c) => ({
    enrolled: acc.enrolled + c.metrics.totalEnrolled,
    sent: acc.sent + c.metrics.totalSent,
    delivered: acc.delivered + c.metrics.totalDelivered,
    read: acc.read + c.metrics.totalRead,
    replied: acc.replied + c.metrics.totalReplied,
    converted: acc.converted + c.metrics.totalConverted
  }), { enrolled: 0, sent: 0, delivered: 0, read: 0, replied: 0, converted: 0 });
  return {
    totalCampaigns,
    activeCampaigns,
    totalEnrolled: totals.enrolled,
    overallDeliveryRate: totals.sent > 0 ? Math.round(totals.delivered / totals.sent * 100) : 0,
    overallReadRate: totals.delivered > 0 ? Math.round(totals.read / totals.delivered * 100) : 0,
    overallReplyRate: totals.read > 0 ? Math.round(totals.replied / totals.read * 100) : 0,
    overallConversionRate: totals.enrolled > 0 ? Math.round(totals.converted / totals.enrolled * 100) : 0
  };
}
async function getAutoTriggerCampaigns(userId, triggerSource) {
  return DripCampaign.find({
    userId,
    status: "active",
    "autoTrigger.enabled": true,
    "autoTrigger.sources": triggerSource
  });
}
async function autoEnrollContact(userId, contactId, contactPhone, triggerSource, variables) {
  const campaigns = await getAutoTriggerCampaigns(userId, triggerSource);
  const results = {
    enrolled: [],
    skipped: [],
    errors: []
  };
  for (const campaign of campaigns) {
    try {
      const existingRun = await DripRun.findOne({
        campaignId: campaign._id,
        contactId
      });
      if (existingRun && !campaign.settings.allowReEntry) {
        results.skipped.push(campaign.name);
        continue;
      }
      if (existingRun && campaign.settings.allowReEntry) {
        const daysSinceExit = existingRun.exitedAt ? (Date.now() - existingRun.exitedAt.getTime()) / (1e3 * 60 * 60 * 24) : 0;
        if (daysSinceExit < campaign.settings.reEntryDelayDays) {
          results.skipped.push(campaign.name);
          continue;
        }
      }
      await enrollContact(
        userId,
        campaign._id.toString(),
        contactId,
        contactPhone,
        { ...variables, triggerSource }
      );
      results.enrolled.push(campaign.name);
      console.log(`[Drip] Auto-enrolled contact ${contactPhone} in campaign "${campaign.name}" via ${triggerSource}`);
    } catch (error) {
      console.error(`[Drip] Failed to auto-enroll in "${campaign.name}":`, error.message);
      results.errors.push(`${campaign.name}: ${error.message}`);
    }
  }
  return results;
}
async function getActiveCampaignsForInterest(userId, interestLevel) {
  const triggerSource = `interest_${interestLevel}`;
  return getAutoTriggerCampaigns(userId, triggerSource);
}
async function getCampaignsWithAutoTrigger(userId) {
  return DripCampaign.find({
    userId,
    status: "active",
    "autoTrigger.enabled": true,
    "autoTrigger.sources": { $exists: true, $ne: [] }
  });
}
export {
  addStep,
  autoEnrollContact,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  enrollContact,
  getActiveCampaignsForInterest,
  getAutoTriggerCampaigns,
  getCampaignById,
  getCampaignRuns,
  getCampaignStats,
  getCampaigns,
  getCampaignsWithAutoTrigger,
  getDueRuns,
  launchCampaign,
  markConversion,
  pauseCampaign,
  processRun,
  removeStep,
  reorderSteps,
  resumeCampaign,
  unenrollContact,
  updateCampaign,
  updateRunStatus,
  updateStep
};
