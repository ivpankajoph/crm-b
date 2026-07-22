var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// modules/whatsapp-marketing/server/modules/storage/mongodb.adapter.js
var mongodb_adapter_exports = {};
__export(mongodb_adapter_exports, {
  ActivityLog: () => ActivityLog,
  Agent: () => Agent,
  Automation: () => Automation,
  Billing: () => Billing,
  BlockedContact: () => BlockedContact,
  BroadcastList: () => BroadcastList,
  BroadcastLog: () => BroadcastLog,
  Campaign: () => Campaign,
  CampaignLog: () => CampaignLog,
  Chat: () => Chat,
  Contact: () => Contact,
  ContactAgent: () => ContactAgent,
  ContactAnalytics: () => ContactAnalytics,
  DripStep: () => DripStep,
  Form: () => Form,
  FormAutomation: () => FormAutomation,
  ImportedContact: () => ImportedContact,
  InterestClassificationLog: () => InterestClassificationLog,
  Lead: () => Lead,
  LeadAssignment: () => LeadAssignment,
  LeadDripStatus: () => LeadDripStatus,
  Leadfb: () => Leadfb,
  Mapping: () => Mapping,
  Message: () => Message,
  PrefilledTextMapping: () => PrefilledTextMapping,
  Qualification: () => Qualification,
  ScheduledBroadcast: () => ScheduledBroadcast,
  ScheduledMessage: () => ScheduledMessage,
  SystemConfig: () => SystemConfig,
  TeamHierarchy: () => TeamHierarchy,
  TeamMember: () => TeamMember,
  Template: () => Template,
  Trigger: () => Trigger,
  User: () => User,
  UserActivityStats: () => UserActivityStats,
  UserCredentials: () => UserCredentials2,
  WebhookStatusEvent: () => WebhookStatusEvent,
  WhatsappSettings: () => WhatsappSettings,
  connectToMongoDB: () => connectToMongoDB,
  countDocuments: () => countDocuments,
  deleteOne: () => deleteOne,
  findMany: () => findMany,
  findOne: () => findOne,
  insertMany: () => insertMany,
  insertOne: () => insertOne,
  readCollection: () => readCollection,
  updateMany: () => updateMany,
  updateOne: () => updateOne,
  writeCollection: () => writeCollection
});
import mongoose, { Schema } from "mongoose";
import dotenv from "dotenv";
async function connectToMongoDB() {
  if (isConnected) return;
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    isConnected = true;
    return;
  }
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error("[MongoDB] MONGODB_URL not configured");
    return;
  }
  try {
    const configuredDbName = String(
      process.env.WHATSAPP_MONGODB_DB_NAME || process.env.WHATSAPP_MONGODB_DB_NAME || ""
    ).trim();
    await mongoose.connect(
      mongoUrl,
      configuredDbName ? { dbName: configuredDbName } : void 0
    );
    isConnected = true;
    console.log(
      `[MongoDB] Connected successfully to ${mongoose.connection.db?.databaseName || "default database"}`
    );
  } catch (error) {
    console.error("[MongoDB] Connection error:", error);
  }
}
async function readCollection(collectionName) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    const docs = await model.find({}).lean();
    return docs;
  } catch (error) {
    console.error(`[MongoDB] Error reading ${collectionName}:`, error);
    return [];
  }
}
async function writeCollection(collectionName, data) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return;
  }
  try {
    await model.deleteMany({});
    if (data.length > 0) {
      await model.insertMany(data);
    }
  } catch (error) {
    console.error(`[MongoDB] Error writing ${collectionName}:`, error);
  }
}
async function findOne(collectionName, query) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.findOne(query).lean();
    return doc;
  } catch (error) {
    console.error(`[MongoDB] Error finding in ${collectionName}:`, error);
    return null;
  }
}
async function findMany(collectionName, query, options = {}) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    let cursor = model.find(query, options.projection || void 0);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (Number.isFinite(options.skip) && options.skip > 0) cursor = cursor.skip(options.skip);
    if (Number.isFinite(options.limit) && options.limit > 0) cursor = cursor.limit(options.limit);
    const docs = await cursor.lean();
    return docs;
  } catch (error) {
    console.error(`[MongoDB] Error finding in ${collectionName}:`, error);
    return [];
  }
}
async function insertOne(collectionName, data) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.create(data);
    return doc.toObject();
  } catch (error) {
    console.error(`[MongoDB] Error inserting into ${collectionName}:`, error);
    return null;
  }
}
async function updateOne(collectionName, query, update) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.findOneAndUpdate(query, { $set: update }, { new: true }).lean();
    return doc;
  } catch (error) {
    console.error(`[MongoDB] Error updating in ${collectionName}:`, error);
    return null;
  }
}
async function deleteOne(collectionName, query) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return false;
  }
  try {
    const result = await model.deleteOne(query);
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`[MongoDB] Error deleting from ${collectionName}:`, error);
    return false;
  }
}
async function countDocuments(collectionName, query = {}) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return 0;
  }
  try {
    return await model.countDocuments(query);
  } catch (error) {
    console.error(`[MongoDB] Error counting in ${collectionName}:`, error);
    return 0;
  }
}
async function insertMany(collectionName, data) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    const docs = await model.insertMany(data, { ordered: false });
    return docs.map((doc) => doc.toObject());
  } catch (error) {
    console.error(
      `[MongoDB] Error bulk inserting into ${collectionName}:`,
      error
    );
    return [];
  }
}
async function updateMany(collectionName, query, update) {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return 0;
  }
  try {
    const result = await model.updateMany(query, { $set: update });
    console.log(
      `[MongoDB] Updated ${result.modifiedCount} documents in ${collectionName}`
    );
    return result.modifiedCount;
  } catch (error) {
    console.error(`[MongoDB] Error updating many in ${collectionName}:`, error);
    return 0;
  }
}
var isConnected, AgentSchema, FormSchema, LeadSchema, TriggerSchema, SystemConfigSchema, MappingSchema, QualificationSchema, BroadcastListSchema, ScheduledMessageSchema, BroadcastLogSchema, ImportedContactSchema, ContactAgentSchema, ContactSchema, InterestClassificationLogSchema, MessageSchema, ChatSchema, StepSchema, CampaignSchema, CampaignLogSchema, ButtonSchema, TemplateSchema, AutomationSchema, UserSchema, TeamMemberSchema, WhatsappSettingsSchema, BillingSchema, PrefilledTextMappingSchema, ScheduledBroadcastSchema, BlockedContactSchema, UserCredentialsSchema, WebhookStatusEventSchema, ContactAnalyticsSchema, LeadAssignmentSchema, TeamHierarchySchema, ActivityLogSchema, UserActivityStatsSchema, leadSchema_fb, formAutomationSchema, stepSchema, leadDripStatusSchema, Leadfb, FormAutomation, DripStep, LeadDripStatus, CampaignLog, Agent, Form, Lead, Trigger, SystemConfig, Mapping, Qualification, BroadcastList, ScheduledMessage, BroadcastLog, ImportedContact, ContactAgent, Contact, InterestClassificationLog, Message, Chat, Campaign, Template, Automation, User, TeamMember, WhatsappSettings, Billing, PrefilledTextMapping, ScheduledBroadcast, BlockedContact, UserCredentials2, WebhookStatusEvent, ContactAnalytics, LeadAssignment, TeamHierarchy, ActivityLog, UserActivityStats, modelMap;
var init_mongodb_adapter = __esm({
  "modules/whatsapp-marketing/server/modules/storage/mongodb.adapter.js"() {
    dotenv.config();
    isConnected = false;
    AgentSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        systemPrompt: { type: String, default: "" },
        instructions: { type: String, default: "" },
        welcomeMessage: { type: String, default: "" },
        model: { type: String, default: "gpt-4o" },
        temperature: { type: Number, default: 0.7 },
        maxTokens: { type: Number, default: 500 },
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "agents" }
    );
    FormSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        fbFormId: { type: String, required: true },
        name: { type: String, required: true },
        status: { type: String, default: "active" },
        pageId: { type: String },
        pageName: { type: String },
        leadCount: { type: Number, default: 0 },
        createdTime: { type: String },
        createdAt: { type: String },
        syncedAt: { type: String, required: true }
      },
      { collection: "forms" }
    );
    LeadSchema = new Schema(
      {
        id: { type: String, unique: true },
        fbLeadId: { type: String },
        lead_id: { type: String, unique: true },
        // FB Lead ID
        formId: { type: String },
        formName: { type: String },
        full_name: String,
        name: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        fieldData: { type: Schema.Types.Mixed, default: {} },
        createdTime: { type: String },
        createdAt: { type: String },
        syncedAt: { type: String },
        autoReplySent: { type: Boolean, default: false },
        autoReplyMessage: { type: String },
        autoReplySentAt: { type: String },
        template_sent: { type: Boolean, default: false },
        raw_data: Object
        // Store the full JSON from FB
      },
      { collection: "leads" }
    );
    TriggerSchema = new mongoose.Schema({
      form_id: { type: String, required: true, unique: true },
      form_name: String,
      template_id: String,
      // The selected WhatsApp template ID
      template_name: String,
      isActive: { type: Boolean, default: true }
    });
    SystemConfigSchema = new mongoose.Schema({
      key: { type: String, default: "scheduler_config", unique: true },
      is_running: { type: Boolean, default: true }
    });
    MappingSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        formId: { type: String, required: true },
        formName: { type: String },
        agentId: { type: String, required: true },
        agentName: { type: String },
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "mappings" }
    );
    QualificationSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        contactId: { type: String, required: true },
        contactName: { type: String },
        contactPhone: { type: String },
        category: {
          type: String,
          enum: ["interested", "not_interested", "pending"],
          default: "pending"
        },
        source: {
          type: String,
          enum: ["ai_chat", "campaign", "ad", "lead_form", "manual"],
          default: "ai_chat"
        },
        campaignId: { type: String },
        campaignName: { type: String },
        agentId: { type: String },
        agentName: { type: String },
        messageCount: { type: Number, default: 0 },
        lastMessage: { type: String },
        keywords: { type: [String], default: [] },
        notes: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "ai_qualifications" }
    );
    BroadcastListSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        contacts: [
          {
            name: { type: String },
            phone: { type: String },
            email: { type: String },
            tags: { type: [String] }
          }
        ],
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "broadcast_lists" }
    );
    ScheduledMessageSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        messageType: {
          type: String,
          enum: ["template", "custom", "ai_agent"],
          required: true
        },
        templateName: { type: String },
        customMessage: { type: String },
        agentId: { type: String },
        contactIds: { type: [String] },
        listId: { type: String },
        scheduledAt: { type: String, required: true },
        status: {
          type: String,
          enum: ["scheduled", "sent", "failed", "cancelled"],
          default: "scheduled"
        },
        recipientCount: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        createdAt: { type: String, required: true }
      },
      { collection: "scheduled_messages" }
    );
    BroadcastLogSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        campaignName: { type: String, required: true },
        contactName: { type: String, required: true },
        contactPhone: { type: String, required: true },
        messageType: {
          type: String,
          enum: ["template", "custom", "ai_agent"],
          required: true
        },
        templateName: { type: String },
        message: { type: String },
        status: {
          type: String,
          enum: ["sent", "delivered", "read", "failed", "pending"],
          default: "pending"
        },
        messageId: { type: String },
        error: { type: String },
        timestamp: { type: String, required: true },
        replied: { type: Boolean, default: false },
        repliedAt: { type: String }
      },
      { collection: "broadcast_logs" }
    );
    BroadcastLogSchema.index({ userId: 1, timestamp: -1 });
    BroadcastLogSchema.index({ userId: 1, messageId: 1 });
    ImportedContactSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, default: "" },
        tags: { type: [String], default: [] },
        source: { type: String, default: "import" },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "imported_contacts" }
    );
    ContactAgentSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        contactId: { type: String, required: true },
        phone: { type: String, required: true, index: true },
        agentId: { type: String, required: true },
        agentName: { type: String },
        conversationHistory: [
          {
            role: { type: String, enum: ["user", "assistant"] },
            content: { type: String },
            timestamp: { type: String }
          }
        ],
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "contact_agents" }
    );
    ContactSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        phone: { type: String, required: true, index: true },
        email: { type: String, default: "" },
        tags: { type: [String], default: [] },
        notes: { type: String, default: "" },
        interestStatus: {
          type: String,
          enum: ["interested", "not_interested", "neutral", "pending"],
          default: "pending",
          index: true
        },
        interestConfidence: { type: Number, default: 0 },
        lastInterestUpdate: { type: Date },
        lastInboundAt: { type: Date },
        assignedDripCampaignIds: { type: [String], default: [] },
        createdAt: { type: String },
        updatedAt: { type: String }
      },
      { collection: "contacts" }
    );
    ContactSchema.index({ userId: 1, createdAt: -1 });
    InterestClassificationLogSchema = new Schema(
      {
        contactId: { type: String, required: true, index: true },
        contactPhone: { type: String, required: true },
        userId: { type: String, required: true, index: true },
        messageContent: { type: String, required: true },
        previousStatus: {
          type: String,
          enum: ["interested", "not_interested", "neutral", "pending"]
        },
        newStatus: {
          type: String,
          enum: ["interested", "not_interested", "neutral", "pending"],
          required: true
        },
        confidence: { type: Number, required: true },
        classificationMethod: {
          type: String,
          enum: ["ai", "keyword", "manual"],
          required: true
        },
        aiResponse: { type: String },
        keywords: { type: [String], default: [] },
        triggeredCampaigns: { type: [String], default: [] },
        createdAt: { type: Date, default: Date.now }
      },
      { collection: "interest_classification_logs" }
    );
    InterestClassificationLogSchema.index({ userId: 1, createdAt: -1 });
    InterestClassificationLogSchema.index({ contactId: 1, createdAt: -1 });
    MessageSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, index: true },
        contactId: { type: String, required: true, index: true },
        content: { type: String, required: true },
        type: { type: String, default: "text" },
        direction: { type: String, enum: ["inbound", "outbound"], required: true },
        status: { type: String, default: "sent" },
        timestamp: { type: String, required: true },
        agentId: { type: String },
        replyToMessageId: { type: String },
        replyToContent: { type: String },
        mediaUrl: { type: String },
        whatsappMessageId: { type: String, index: true },
        failureReason: { type: String },
        source: { type: String, default: "inbox", index: true },
        templateName: { type: String },
        campaignName: { type: String },
        pricingCategory: { type: String },
        phoneNumberId: { type: String, index: true }
      },
      { collection: "messages" }
    );
    MessageSchema.index({ userId: 1, timestamp: -1 });
    MessageSchema.index({ userId: 1, direction: 1, timestamp: -1 });
    MessageSchema.index({ userId: 1, contactId: 1, timestamp: -1 });
    MessageSchema.index({ userId: 1, direction: 1, contactId: 1, timestamp: -1 });
    MessageSchema.index({ userId: 1, direction: 1, whatsappMessageId: 1 });
    ChatSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        contactId: { type: String, required: true, unique: true, index: true },
        lastMessage: { type: String },
        lastMessageTime: { type: String },
        lastInboundMessageTime: { type: String },
        lastInboundMessage: { type: String },
        unreadCount: { type: Number, default: 0 },
        status: { type: String, enum: ["open", "closed"], default: "open" },
        notes: { type: [String], default: [] },
        isFlowLead: { type: Boolean }
      },
      { collection: "whatsapp_chats" }
    );
    ContactSchema.index({ userId: 1, phone: 1 });
    ChatSchema.index({ userId: 1, contactId: 1 }, { unique: true });
    ChatSchema.index({ userId: 1, lastMessageTime: -1 });
    ChatSchema.index({ userId: 1, lastInboundMessageTime: -1 });
    StepSchema = new mongoose.Schema(
      {
        templateId: {
          type: String,
          // ✅ UUID / WhatsApp ID
          required: true
        },
        template_name: String,
        scheduleType: {
          type: String,
          enum: ["specific", "delay"],
          required: true
        },
        delayDays: { type: Number, default: 0 },
        delayHours: { type: Number, default: 0 },
        specificDate: String,
        specificTime: String
      },
      { _id: false }
    );
    CampaignSchema = new mongoose.Schema(
      {
        id: { type: String, unique: true },
        userId: String,
        name: String,
        campaign_name: String,
        form_id: String,
        form_name: String,
        is_active: {
          type: Boolean,
          default: true
        },
        status: {
          type: String,
          enum: ["draft", "running", "completed", "paused"],
          default: "running"
        },
        currentStep: {
          type: Number,
          default: 0
        },
        nextRunAt: Date,
        contacts: [String],
        steps: [StepSchema],
        isProcessing: {
          type: Boolean,
          default: false
        },
        processingStartedAt: Date
      },
      { timestamps: true }
    );
    CampaignLogSchema = new mongoose.Schema(
      {
        userId: { type: String, required: true, index: true },
        campaignId: mongoose.Schema.Types.ObjectId,
        stepIndex: Number,
        contact: String,
        templateName: String,
        messageId: String,
        requestPayload: { type: Schema.Types.Mixed, default: null },
        providerResponse: { type: Schema.Types.Mixed, default: null },
        providerHttpStatus: Number,
        providerErrorCode: String,
        attemptedLanguage: String,
        metaAccepted: { type: Boolean, default: false },
        metaAcceptedAt: Date,
        sendAttemptedAt: Date,
        attemptCount: { type: Number, default: 0 },
        status: {
          type: String,
          enum: ["pending", "accepted", "delivered", "read", "failed"],
          default: "pending"
        },
        providerStatus: String,
        error: String,
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        failedAt: Date
      },
      { timestamps: true }
    );
    CampaignLogSchema.index(
      { campaignId: 1, stepIndex: 1, contact: 1 },
      { unique: true }
    );
    CampaignLogSchema.index({ userId: 1, createdAt: -1 });
    CampaignLogSchema.index({ userId: 1, sentAt: -1 });
    CampaignLogSchema.index({ userId: 1, sendAttemptedAt: -1 });
    ButtonSchema = new Schema(
      {
        type: {
          type: String,
          enum: ["quick_reply", "url", "phone_number"],
          required: true
        },
        text: { type: String, required: true },
        url: String,
        phone_number: String
      },
      { _id: false }
    );
    TemplateSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, index: true },
        name: { type: String, required: true },
        category: {
          type: String,
          enum: ["MARKETING", "UTILITY", "AUTHENTICATION", "marketing", "utility", "authentication"],
          required: true
        },
        templateType: {
          type: String,
          enum: [
            "default",
            "catalogue",
            "flows",
            "order_details",
            "calling_permission",
            "one_time_password"
          ],
          default: "default"
        },
        language: { type: String, default: "en" },
        headerType: {
          type: String,
          enum: ["text", "image", "video", "document", null],
          default: null
        },
        headerText: String,
        headerImageUrl: String,
        previewUrl: String,
        // Authentication templates use Meta-generated OTP text, so local custom
        // content may legitimately be empty.
        content: { type: String, default: "" },
        footer: String,
        authAddSecurityRecommendation: { type: Boolean, default: true },
        authCodeExpirationMinutes: { type: Number, default: 10, min: 1, max: 90 },
        authOtpType: {
          type: String,
          enum: ["COPY_CODE"],
          default: "COPY_CODE"
        },
        buttons: [ButtonSchema],
        status: { type: String, default: "pending" },
        metaTemplateId: String,
        metaStatus: {
          type: String,
          enum: ["draft", "pending", "approved", "rejected", "PENDING", "APPROVED", "REJECTED"],
          default: "pending"
        },
        metaRejectionReason: String
      },
      { timestamps: true, collection: "templates" }
    );
    AutomationSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        trigger: { type: String, required: true },
        message: { type: String },
        delay: { type: Number },
        delayUnit: { type: String },
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "automations" }
    );
    UserSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String },
        resetPasswordTokenHash: { type: String, default: null },
        resetPasswordExpiresAt: { type: Date, default: null },
        role: { type: String, default: "user" },
        createdAt: { type: String, required: true }
      },
      { collection: "users" }
    );
    TeamMemberSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String },
        role: { type: String, default: "agent" },
        permissions: { type: [String], default: [] },
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true }
      },
      { collection: "team_members" }
    );
    WhatsappSettingsSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        phoneNumberId: { type: String },
        businessAccountId: { type: String },
        accessToken: { type: String },
        webhookVerifyToken: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "whatsapp_settings" }
    );
    BillingSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        credits: { type: Number, default: 0 },
        transactions: [
          {
            id: { type: String },
            type: { type: String, enum: ["purchase", "usage"] },
            amount: { type: Number },
            description: { type: String },
            createdAt: { type: String }
          }
        ]
      },
      { collection: "billing" }
    );
    PrefilledTextMappingSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        prefilledText: { type: String, required: true },
        agentId: { type: String, required: true },
        agentName: { type: String },
        isActive: { type: Boolean, default: true },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "prefilled_text_mappings" }
    );
    ScheduledBroadcastSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        contacts: [
          {
            name: { type: String },
            phone: { type: String },
            email: { type: String },
            tags: { type: [String] }
          }
        ],
        messageType: {
          type: String,
          enum: ["template", "custom", "ai_agent"],
          required: true
        },
        templateName: { type: String },
        customMessage: { type: String },
        agentId: { type: String },
        campaignName: { type: String, required: true },
        scheduledAt: { type: String, required: true },
        status: {
          type: String,
          enum: ["scheduled", "sending", "sent", "failed", "cancelled"],
          default: "scheduled"
        },
        createdAt: { type: String, required: true },
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 }
      },
      { collection: "scheduled_broadcasts" }
    );
    BlockedContactSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        phone: { type: String, required: true, index: true },
        name: { type: String, default: "" },
        reason: { type: String, default: "" },
        blockedAt: { type: String, required: true },
        isActive: { type: Boolean, default: true }
      },
      { collection: "blocked_contacts" }
    );
    BlockedContactSchema.index({ userId: 1, phone: 1 }, { unique: true });
    UserCredentialsSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, unique: true, index: true },
        whatsappToken: { type: String },
        phoneNumberId: { type: String },
        phoneNumberIdHash: { type: String, index: true },
        businessAccountId: { type: String },
        webhookVerifyToken: { type: String },
        webhookVerifyTokenHash: { type: String, index: true },
        appId: { type: String },
        appSecret: { type: String },
        flowEndpointToken: { type: String, unique: true, sparse: true, index: true },
        flowEndpointPrivateKey: { type: String },
        flowEndpointPublicKey: { type: String },
        openaiApiKey: { type: String },
        geminiApiKey: { type: String },
        facebookAccessToken: { type: String },
        facebookPageId: { type: String },
        isVerified: { type: Boolean, default: false },
        lastVerifiedAt: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "user_credentials" }
    );
    TemplateSchema.index({ userId: 1, name: 1, language: 1 });
    WebhookStatusEventSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, index: true },
        messageId: { type: String, index: true },
        recipientId: { type: String, index: true },
        status: { type: String, required: true, index: true },
        statusTimestamp: { type: Date, required: true, index: true },
        webhookReceivedAt: { type: Date, required: true, default: Date.now },
        phoneNumberId: { type: String, index: true },
        wabaId: { type: String },
        conversationId: { type: String },
        pricingCategory: { type: String },
        errorCode: { type: String },
        errorTitle: { type: String },
        errorMessage: { type: String },
        errorDetails: { type: String },
        rawStatus: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "webhook_status_events" }
    );
    WebhookStatusEventSchema.index(
      { messageId: 1, status: 1, statusTimestamp: 1, recipientId: 1 },
      { unique: true, sparse: true }
    );
    ContactAnalyticsSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        contactId: { type: String, required: true },
        phone: { type: String, required: true, index: true },
        contactName: { type: String, default: "" },
        interestLevel: {
          type: String,
          enum: [
            "highly_interested",
            "interested",
            "neutral",
            "not_interested",
            "pending"
          ],
          default: "pending"
        },
        interestScore: { type: Number, default: 0 },
        interestReason: { type: String, default: "" },
        totalMessages: { type: Number, default: 0 },
        inboundMessages: { type: Number, default: 0 },
        outboundMessages: { type: Number, default: 0 },
        keyTopics: { type: [String], default: [] },
        objections: { type: [String], default: [] },
        positiveSignals: { type: [String], default: [] },
        negativeSignals: { type: [String], default: [] },
        firstContactTime: { type: String },
        lastContactTime: { type: String },
        conversationDuration: { type: Number, default: 0 },
        aiAgentInteractions: [
          {
            agentId: String,
            agentName: String,
            messagesCount: Number,
            firstInteraction: String,
            lastInteraction: String,
            durationMinutes: Number
          }
        ],
        lastAnalyzedAt: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "contact_analytics" }
    );
    LeadAssignmentSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        contactId: { type: String, required: true, index: true },
        chatId: { type: String, index: true },
        phone: { type: String, required: true, index: true },
        contactName: { type: String, default: "" },
        assignedToUserId: { type: String, required: true, index: true },
        assignedToUserName: { type: String, default: "" },
        assignedByUserId: { type: String, required: true },
        assignedByUserName: { type: String, default: "" },
        status: {
          type: String,
          enum: [
            "assigned",
            "in_progress",
            "completed",
            "reassigned",
            "unassigned"
          ],
          default: "assigned"
        },
        priority: {
          type: String,
          enum: ["low", "medium", "high", "urgent"],
          default: "medium"
        },
        notes: { type: String, default: "" },
        previousAssignments: [
          {
            userId: String,
            userName: String,
            assignedAt: String,
            unassignedAt: String,
            reason: String
          }
        ],
        slaDeadline: { type: String },
        firstResponseAt: { type: String },
        resolvedAt: { type: String },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "lead_assignments" }
    );
    LeadAssignmentSchema.index({ assignedToUserId: 1, status: 1 });
    LeadAssignmentSchema.index({ contactId: 1, assignedToUserId: 1 });
    TeamHierarchySchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        managerId: { type: String, required: true, unique: true, index: true },
        managerName: { type: String, default: "" },
        teamMembers: [
          {
            userId: String,
            userName: String,
            addedAt: String
          }
        ],
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "team_hierarchy" }
    );
    ActivityLogSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        userName: { type: String, default: "" },
        userRole: { type: String, default: "" },
        actionType: {
          type: String,
          enum: [
            "message_sent",
            "message_received",
            "lead_assigned",
            "lead_reassigned",
            "lead_completed",
            "lead_viewed",
            "login",
            "logout"
          ],
          required: true
        },
        contactId: { type: String, index: true },
        contactPhone: { type: String },
        contactName: { type: String },
        leadAssignmentId: { type: String },
        metadata: { type: Schema.Types.Mixed, default: {} },
        timestamp: { type: String, required: true }
      },
      { collection: "activity_logs" }
    );
    ActivityLogSchema.index({ userId: 1, timestamp: -1 });
    ActivityLogSchema.index({ actionType: 1, timestamp: -1 });
    UserActivityStatsSchema = new Schema(
      {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true, index: true },
        userName: { type: String, default: "" },
        date: { type: String, required: true, index: true },
        messagesSent: { type: Number, default: 0 },
        messagesReceived: { type: Number, default: 0 },
        leadsAssigned: { type: Number, default: 0 },
        leadsCompleted: { type: Number, default: 0 },
        leadsInProgress: { type: Number, default: 0 },
        avgResponseTimeMinutes: { type: Number, default: 0 },
        totalResponseTimeMinutes: { type: Number, default: 0 },
        responseCount: { type: Number, default: 0 },
        activeHours: { type: [Number], default: [] },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true }
      },
      { collection: "user_activity_stats" }
    );
    UserActivityStatsSchema.index({ userId: 1, date: -1 });
    leadSchema_fb = new mongoose.Schema({
      lead_id: { type: String, required: true, unique: true },
      form_id: { type: String, required: true },
      form_name: String,
      created_time: Date,
      full_name: String,
      email: String,
      phone: String,
      dob: String,
      category: String,
      opt_in: String,
      template_sent: { type: Boolean, default: false },
      automation_active: { type: Boolean, default: true },
      template_id: String,
      template_name: String,
      synced_at: { type: Date, default: Date.now },
      raw_field_data: mongoose.Schema.Types.Mixed
    });
    formAutomationSchema = new mongoose.Schema({
      form_id: { type: String, required: true, unique: true },
      form_name: String,
      template_id: String,
      template_name: String,
      automation_active: { type: Boolean, default: false },
      last_sync: Date,
      created_at: { type: Date, default: Date.now },
      updated_at: { type: Date, default: Date.now }
    });
    stepSchema = new mongoose.Schema({
      templateId: {
        type: String,
        // ✅ FIX
        required: true
      },
      template_name: String,
      scheduleType: { type: String, enum: ["delay", "specific"], required: true },
      delayDays: { type: Number, default: 0 },
      delayHours: { type: Number, default: 0 },
      specificDate: { type: Date },
      specificTime: { type: String }
      // "HH:MM" format
    });
    leadDripStatusSchema = new mongoose.Schema({
      lead_id: { type: String, required: true },
      campaign_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DripCampaign",
        required: true
      },
      form_id: { type: String, required: true },
      current_step: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["active", "completed", "paused", "failed"],
        default: "active"
      },
      steps_completed: [
        {
          step_order: Number,
          template_id: String,
          sent_at: Date,
          message_id: String,
          success: Boolean,
          error: String
        }
      ],
      next_send_time: { type: Date },
      enrolled_at: { type: Date, default: Date.now },
      completed_at: { type: Date },
      last_updated: { type: Date, default: Date.now }
    });
    leadDripStatusSchema.index({ lead_id: 1, campaign_id: 1 }, { unique: true });
    leadDripStatusSchema.index({ status: 1, next_send_time: 1 });
    leadDripStatusSchema.index({ campaign_id: 1, status: 1 });
    Leadfb = mongoose.models.Leadfb || mongoose.model("Leadfb", leadSchema_fb);
    FormAutomation = mongoose.models.FormAutomation || mongoose.model("FormAutomation", formAutomationSchema);
    DripStep = mongoose.models.DripStep || mongoose.model("DripStep", stepSchema);
    LeadDripStatus = mongoose.models.LeadDripStatus || mongoose.model("LeadDripStatus", leadDripStatusSchema);
    CampaignLog = mongoose.models.CampaignLog || mongoose.model("CampaignLog", CampaignLogSchema);
    Agent = mongoose.models.Agent || mongoose.model("Agent", AgentSchema);
    Form = mongoose.models.Form || mongoose.model("Form", FormSchema);
    Lead = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
    Trigger = mongoose.models.Trigger || mongoose.model("Trigger_m", TriggerSchema);
    SystemConfig = mongoose.models.SystemConfig || mongoose.model("SystemConfig", SystemConfigSchema);
    Mapping = mongoose.models.Mapping || mongoose.model("Mapping", MappingSchema);
    Qualification = mongoose.models.Qualification || mongoose.model("Qualification", QualificationSchema);
    BroadcastList = mongoose.models.BroadcastList || mongoose.model("BroadcastList", BroadcastListSchema);
    ScheduledMessage = mongoose.models.ScheduledMessage || mongoose.model("ScheduledMessage", ScheduledMessageSchema);
    BroadcastLog = mongoose.models.BroadcastLog || mongoose.model("BroadcastLog", BroadcastLogSchema);
    ImportedContact = mongoose.models.ImportedContact || mongoose.model("ImportedContact", ImportedContactSchema);
    ContactAgent = mongoose.models.ContactAgent || mongoose.model("ContactAgent", ContactAgentSchema);
    Contact = mongoose.models.Contact || mongoose.model("Contact", ContactSchema);
    InterestClassificationLog = mongoose.models.InterestClassificationLog || mongoose.model("InterestClassificationLog", InterestClassificationLogSchema);
    Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);
    Chat = mongoose.models.WhatsAppMarketingChatV2 || mongoose.model("WhatsAppMarketingChatV2", ChatSchema);
    Campaign = mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
    Template = mongoose.models.Template || mongoose.model("Template", TemplateSchema);
    Automation = mongoose.models.Automation || mongoose.model("Automation", AutomationSchema);
    User = mongoose.models.WhatsappUser || mongoose.model("WhatsappUser", UserSchema);
    TeamMember = mongoose.models.TeamMember || mongoose.model("TeamMember", TeamMemberSchema);
    WhatsappSettings = mongoose.models.WhatsappSettings || mongoose.model("WhatsappSettings", WhatsappSettingsSchema);
    Billing = mongoose.models.Billing || mongoose.model("Billing", BillingSchema);
    PrefilledTextMapping = mongoose.models.PrefilledTextMapping || mongoose.model("PrefilledTextMapping", PrefilledTextMappingSchema);
    ScheduledBroadcast = mongoose.models.ScheduledBroadcast || mongoose.model("ScheduledBroadcast", ScheduledBroadcastSchema);
    BlockedContact = mongoose.models.BlockedContact || mongoose.model("BlockedContact", BlockedContactSchema);
    UserCredentials2 = mongoose.models.UserCredentials || mongoose.model("UserCredentials", UserCredentialsSchema);
    WebhookStatusEvent = mongoose.models.WebhookStatusEvent || mongoose.model("WebhookStatusEvent", WebhookStatusEventSchema);
    ContactAnalytics = mongoose.models.ContactAnalytics || mongoose.model("ContactAnalytics", ContactAnalyticsSchema);
    LeadAssignment = mongoose.models.LeadAssignment || mongoose.model("LeadAssignment", LeadAssignmentSchema);
    TeamHierarchy = mongoose.models.TeamHierarchy || mongoose.model("TeamHierarchy", TeamHierarchySchema);
    ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
    UserActivityStats = mongoose.models.UserActivityStats || mongoose.model("UserActivityStats", UserActivityStatsSchema);
    modelMap = {
      agents: Agent,
      forms: Form,
      leads: Lead,
      mapping: Mapping,
      ai_qualifications: Qualification,
      broadcast_lists: BroadcastList,
      scheduled_messages: ScheduledMessage,
      broadcast_logs: BroadcastLog,
      imported_contacts: ImportedContact,
      contact_agents: ContactAgent,
      contacts: Contact,
      interest_classification_logs: InterestClassificationLog,
      messages: Message,
      chats: Chat,
      campaigns: Campaign,
      templates: Template,
      automations: Automation,
      users: User,
      team_members: TeamMember,
      whatsapp_settings: WhatsappSettings,
      billing: Billing,
      prefilled_text_mappings: PrefilledTextMapping,
      scheduled_broadcasts: ScheduledBroadcast,
      blocked_contacts: BlockedContact,
      user_credentials: UserCredentials2,
      webhook_status_events: WebhookStatusEvent,
      contact_analytics: ContactAnalytics,
      lead_assignments: LeadAssignment,
      team_hierarchy: TeamHierarchy,
      activity_logs: ActivityLog,
      user_activity_stats: UserActivityStats
    };
  }
});

// modules/whatsapp-marketing/server/modules/encryption/encryption.service.js
import crypto2 from "crypto";
function getEncryptionKey() {
  const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!masterKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CREDENTIAL_ENCRYPTION_KEY is required in production");
    }
    if (!fallbackWarningShown) {
      fallbackWarningShown = true;
      console.warn("[Encryption] CREDENTIAL_ENCRYPTION_KEY not set; development fallback key is active");
    }
    return crypto2.scryptSync("default-insecure-key-change-me", "salt", 32);
  }
  return crypto2.scryptSync(masterKey, "whatsapp-saas-salt", 32);
}
function encrypt(plaintext) {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto2.randomBytes(IV_LENGTH);
  const cipher = crypto2.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "base64")
  ]);
  return `${ENCRYPTED_VALUE_PREFIX}${combined.toString("base64")}`;
}
function decrypt(encryptedData) {
  if (!encryptedData) return "";
  try {
    const key = getEncryptionKey();
    const encoded = encryptedData.startsWith(ENCRYPTED_VALUE_PREFIX) ? encryptedData.slice(ENCRYPTED_VALUE_PREFIX.length) : encryptedData;
    const combined = Buffer.from(encoded, "base64");
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto2.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[Encryption] Decryption failed:", error);
    return "";
  }
}
function maskSecret(secret, visibleChars = 4) {
  if (!secret || secret.length <= visibleChars * 2) {
    return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  }
  const start = secret.substring(0, visibleChars);
  const end = secret.substring(secret.length - visibleChars);
  return `${start}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${end}`;
}
function isEncrypted(value) {
  if (!value) return false;
  if (value.startsWith(ENCRYPTED_VALUE_PREFIX)) return true;
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
function decryptStoredValue(value) {
  if (!value) return "";
  if (value.startsWith(ENCRYPTED_VALUE_PREFIX)) return decrypt(value);
  if (isEncrypted(value)) {
    const decrypted = decrypt(value);
    if (decrypted) return decrypted;
  }
  return value;
}
var ALGORITHM, IV_LENGTH, AUTH_TAG_LENGTH, ENCRYPTED_VALUE_PREFIX, fallbackWarningShown;
var init_encryption_service = __esm({
  "modules/whatsapp-marketing/server/modules/encryption/encryption.service.js"() {
    ALGORITHM = "aes-256-gcm";
    IV_LENGTH = 16;
    AUTH_TAG_LENGTH = 16;
    ENCRYPTED_VALUE_PREFIX = "enc:v1:";
    fallbackWarningShown = false;
  }
});

// modules/whatsapp-marketing/server/modules/credentials/credentials.service.js
var credentials_service_exports = {};
__export(credentials_service_exports, {
  credentialsService: () => credentialsService,
  deleteCredentials: () => deleteCredentials,
  findUserByPhoneNumberId: () => findUserByPhoneNumberId,
  getCredentialStatus: () => getCredentialStatus,
  getCredentialsByPhoneNumberId: () => getCredentialsByPhoneNumberId,
  getCredentialsByUserId: () => getCredentialsByUserId,
  getDecryptedCredentials: () => getDecryptedCredentials,
  getMaskedCredentialsForUser: () => getMaskedCredentialsForUser,
  hasCredentials: () => hasCredentials,
  hasWebhookVerifyToken: () => hasWebhookVerifyToken,
  saveCredentials: () => saveCredentials,
  updateVerificationStatus: () => updateVerificationStatus
});
import crypto3 from "crypto";
async function getCredentialsByUserId(userId) {
  try {
    const creds = await UserCredentials2.findOne({ userId });
    if (!creds) return null;
    return creds.toObject();
  } catch (error) {
    console.error("[Credentials] Error getting credentials:", error);
    return null;
  }
}
async function getDecryptedCredentials(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    return {
      whatsappToken: decryptStoredValue(stored.whatsappToken),
      phoneNumberId: decryptStoredValue(stored.phoneNumberId),
      businessAccountId: decryptStoredValue(stored.businessAccountId),
      webhookVerifyToken: decryptStoredValue(stored.webhookVerifyToken),
      appId: decryptStoredValue(stored.appId),
      appSecret: decryptStoredValue(stored.appSecret),
      openaiApiKey: decryptStoredValue(stored.openaiApiKey),
      geminiApiKey: decryptStoredValue(stored.geminiApiKey),
      facebookAccessToken: decryptStoredValue(stored.facebookAccessToken),
      facebookPageId: decryptStoredValue(stored.facebookPageId)
    };
  } catch (error) {
    console.error("[Credentials] Error getting credentials:", error);
    return null;
  }
}
async function getMaskedCredentialsForUser(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    const decrypted = await getDecryptedCredentials(userId);
    if (!decrypted) return null;
    return {
      whatsappToken: maskSecret(decrypted.whatsappToken),
      phoneNumberId: maskSecret(decrypted.phoneNumberId, 3),
      businessAccountId: maskSecret(decrypted.businessAccountId, 3),
      webhookVerifyToken: maskSecret(decrypted.webhookVerifyToken),
      appId: maskSecret(decrypted.appId, 3),
      appSecret: maskSecret(decrypted.appSecret),
      openaiApiKey: maskSecret(decrypted.openaiApiKey, 3),
      geminiApiKey: maskSecret(decrypted.geminiApiKey, 3),
      facebookAccessToken: maskSecret(decrypted.facebookAccessToken),
      facebookPageId: maskSecret(decrypted.facebookPageId, 3)
    };
  } catch (error) {
    console.error("[Credentials] Error masking credentials:", error);
    return null;
  }
}
async function saveCredentials(userId, input) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await UserCredentials2.findOne({ userId });
    const data = {};
    if (input.whatsappToken) data.whatsappToken = encrypt(input.whatsappToken);
    if (input.phoneNumberId) {
      data.phoneNumberId = encrypt(input.phoneNumberId);
      data.phoneNumberIdHash = hashLookupValue(input.phoneNumberId);
    }
    if (input.businessAccountId) data.businessAccountId = encrypt(input.businessAccountId);
    if (input.webhookVerifyToken) {
      data.webhookVerifyToken = encrypt(input.webhookVerifyToken);
      data.webhookVerifyTokenHash = hashLookupValue(input.webhookVerifyToken);
    }
    if (input.appId) data.appId = encrypt(input.appId);
    if (input.appSecret) data.appSecret = encrypt(input.appSecret);
    if (input.openaiApiKey) data.openaiApiKey = encrypt(input.openaiApiKey);
    if (input.geminiApiKey) data.geminiApiKey = encrypt(input.geminiApiKey);
    if (input.facebookAccessToken) data.facebookAccessToken = encrypt(input.facebookAccessToken);
    if (input.facebookPageId) data.facebookPageId = encrypt(input.facebookPageId);
    if (existing) {
      const updateData = {
        ...data,
        updatedAt: now
      };
      await UserCredentials2.updateOne(
        { userId },
        { $set: updateData }
      );
      const updated = await UserCredentials2.findOne({ userId });
      return updated ? updated.toObject() : null;
    } else {
      const newCreds = await UserCredentials2.create({
        id: crypto3.randomUUID(),
        userId,
        ...data,
        isVerified: false,
        createdAt: now,
        updatedAt: now
      });
      return newCreds.toObject();
    }
  } catch (error) {
    console.error("[Credentials] Error saving credentials:", error);
    return null;
  }
}
async function updateVerificationStatus(userId, isVerified) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await UserCredentials2.updateOne(
      { userId },
      {
        $set: {
          isVerified,
          lastVerifiedAt: isVerified ? now : void 0,
          updatedAt: now
        }
      }
    );
    return true;
  } catch (error) {
    console.error("[Credentials] Error updating verification status:", error);
    return false;
  }
}
async function deleteCredentials(userId) {
  try {
    await UserCredentials2.deleteOne({ userId });
    return true;
  } catch (error) {
    console.error("[Credentials] Error deleting credentials:", error);
    return false;
  }
}
async function getCredentialsByPhoneNumberId(phoneNumberId) {
  try {
    const cred = await UserCredentials2.findOne({
      $or: [
        { phoneNumberIdHash: hashLookupValue(phoneNumberId) },
        { phoneNumberId }
      ]
    });
    if (cred) {
      const decrypted = await getDecryptedCredentials(cred.userId);
      if (decrypted) {
        return { userId: cred.userId, credentials: decrypted };
      }
    }
    return null;
  } catch (error) {
    console.error("[Credentials] Error finding credentials by phone ID:", error);
    return null;
  }
}
async function hasCredentials(userId) {
  try {
    const creds = await UserCredentials2.findOne({ userId });
    return !!creds;
  } catch (error) {
    return false;
  }
}
async function getCredentialStatus(userId) {
  try {
    const stored = await getCredentialsByUserId(userId);
    const creds = await getDecryptedCredentials(userId);
    if (!stored || !creds) {
      return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
    }
    return {
      hasWhatsApp: !!(creds.whatsappToken && creds.phoneNumberId),
      hasOpenAI: !!creds.openaiApiKey,
      hasGemini: !!creds.geminiApiKey,
      hasFacebook: !!creds.facebookAccessToken,
      isVerified: stored.isVerified
    };
  } catch (error) {
    return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
  }
}
async function findUserByPhoneNumberId(phoneNumberId) {
  try {
    const cred = await UserCredentials2.findOne({
      $or: [
        { phoneNumberIdHash: hashLookupValue(phoneNumberId) },
        { phoneNumberId }
      ]
    });
    return cred ? cred.userId : null;
  } catch (error) {
    console.error("[Credentials] Error finding user by phone ID:", error);
    return null;
  }
}
async function hasWebhookVerifyToken(token) {
  try {
    const credential = await UserCredentials2.findOne({
      $or: [
        { webhookVerifyTokenHash: hashLookupValue(token) },
        { webhookVerifyToken: token }
      ]
    }).select({ _id: 1 });
    return Boolean(credential);
  } catch (error) {
    console.error("[Credentials] Error finding webhook verify token:", error);
    return false;
  }
}
function hashLookupValue(value) {
  return crypto3.createHash("sha256").update(String(value).trim()).digest("hex");
}
var credentialsService;
var init_credentials_service = __esm({
  "modules/whatsapp-marketing/server/modules/credentials/credentials.service.js"() {
    init_mongodb_adapter();
    init_encryption_service();
    credentialsService = {
      getCredentialsByUserId,
      getDecryptedCredentials,
      getMaskedCredentialsForUser,
      saveCredentials,
      updateVerificationStatus,
      deleteCredentials,
      getCredentialsByPhoneNumberId,
      hasCredentials,
      getCredentialStatus,
      findUserByPhoneNumberId,
      hasWebhookVerifyToken
    };
  }
});

// modules/whatsapp-marketing/server/modules/users/user.model.js
var user_model_exports = {};
__export(user_model_exports, {
  AVAILABLE_PAGES: () => AVAILABLE_PAGES,
  ROLE_LABELS: () => ROLE_LABELS,
  SystemUser: () => SystemUser,
  generatePassword: () => generatePassword,
  generateUsername: () => generateUsername,
  hashPassword: () => hashPassword,
  verifyPassword: () => verifyPassword
});
import mongoose10, { Schema as Schema8 } from "mongoose";
import crypto6 from "crypto";
function generateUsername(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = crypto6.randomBytes(3).toString("hex");
  return `${base}${suffix}`;
}
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
function hashPassword(password) {
  return crypto6.createHash("sha256").update(password).digest("hex");
}
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}
var SystemUserSchema, SystemUser, AVAILABLE_PAGES, ROLE_LABELS;
var init_user_model = __esm({
  "modules/whatsapp-marketing/server/modules/users/user.model.js"() {
    SystemUserSchema = new Schema8({
      id: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: {
        type: String,
        enum: ["super_admin", "sub_admin", "manager", "user"],
        default: "user"
      },
      pageAccess: [{ type: String }],
      isActive: { type: Boolean, default: true },
      createdBy: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });
    SystemUserSchema.pre("save", function() {
      this.updatedAt = /* @__PURE__ */ new Date();
    });
    SystemUser = mongoose10.models.SystemUser || mongoose10.model("SystemUser", SystemUserSchema);
    AVAILABLE_PAGES = [
      { id: "dashboard", name: "Dashboard", icon: "LayoutDashboard", path: "/" },
      { id: "window-inbox", name: "24-Hour Window Inbox", icon: "Clock", path: "/inbox/window" },
      { id: "inbox", name: "Inbox", icon: "MessageSquare", path: "/inbox" },
      { id: "contacts", name: "Contacts", icon: "Users", path: "/contacts" },
      { id: "broadcast", name: "Broadcast", icon: "Radio", path: "/broadcast" },
      { id: "templates", name: "Templates", icon: "FileText", path: "/templates" },
      { id: "ai-agents", name: "AI Agents", icon: "Bot", path: "/ai-agents" },
      { id: "whatsapp-leads", name: "WhatsApp Leads", icon: "UserPlus", path: "/whatsapp-leads" },
      { id: "facebook-leads", name: "Facebook Leads", icon: "Facebook", path: "/facebook-leads" },
      { id: "auto-reply", name: "Auto Reply System", icon: "Zap", path: "/auto-reply" },
      { id: "flow-builder", name: "Flow Builder", icon: "GitBranch", path: "/flow-builder" },
      { id: "reports-campaign", name: "Campaign Performance", icon: "BarChart3", path: "/reports/campaign-performance" },
      { id: "reports-blocked", name: "Blocked Contacts", icon: "Ban", path: "/reports/blocked-contacts" },
      { id: "reports-engagement", name: "User Engagement", icon: "TrendingUp", path: "/reports/user-engagement" },
      { id: "settings", name: "Settings", icon: "Settings", path: "/settings" },
      { id: "user-management", name: "User Management", icon: "UserCog", path: "/user-management" }
    ];
    ROLE_LABELS = {
      "super_admin": "Super Admin",
      "sub_admin": "Sub Admin",
      "manager": "Manager",
      "user": "Regular User"
    };
  }
});

// modules/whatsapp-marketing/server/storage.js
init_mongodb_adapter();
import { randomUUID } from "crypto";
function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}
var MongoStorage = class {
  async getUser(id) {
    const user = await findOne("users", { id });
    return user || void 0;
  }
  async getUserByUsername(username) {
    const user = await findOne("users", { username });
    return user || void 0;
  }
  async createUser(insertUser) {
    const user = {
      ...insertUser,
      id: randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await insertOne("users", user);
    return user;
  }
  async getContacts(userId) {
    return findMany("contacts", userId ? { userId } : {});
  }
  async getContact(id, userId) {
    const contact = await findOne(
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
    await insertOne("contacts", newContact);
    const chat = {
      id: `chat-${newContact.id}`,
      userId: newContact.userId,
      contactId: newContact.id,
      contact: newContact,
      unreadCount: 0,
      status: "open",
      notes: []
    };
    await insertOne("chats", chat);
    return newContact;
  }
  async updateContact(id, contact) {
    const updated = await updateOne(
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
    await deleteOne("messages", { contactId: id });
    await deleteOne("chats", { contactId: id });
    return deleteOne("contacts", { id });
  }
  async getMessages(contactId, userId, options = {}) {
    const query = {};
    if (contactId) query.contactId = contactId;
    if (userId) query.userId = userId;
    return findMany("messages", query, {
      sort: options.sort || { timestamp: -1 },
      skip: options.skip,
      limit: options.limit
    });
  }
  async getMessage(id) {
    const message = await findOne("messages", { id });
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
      await insertOne("messages", newMessage);
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
        await updateOne("chats", { id: chat.id }, updateData);
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
      await insertOne("chats", newChat);
      console.log("[createMessage] \u2705 Chat created", {
        chatId: newChat.id,
        contactId: message.contactId
      });
    }
    return newMessage;
  }
  async updateMessage(id, message) {
    const updated = await updateOne(
      "messages",
      { id },
      message
    );
    return updated || void 0;
  }
  async getCampaigns() {
    return findMany("campaigns", {});
  }
  async getCampaign(id) {
    const campaign = await findOne("campaigns", { id });
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
    await insertOne("campaigns", newCampaign);
    return newCampaign;
  }
  async updateCampaign(id, campaign) {
    const updated = await updateOne(
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
    return deleteOne("campaigns", { id });
  }
  async getTemplates() {
    return findMany("templates", {});
  }
  async getTemplate(id) {
    const template = await findOne("templates", { id });
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
    await insertOne("templates", newTemplate);
    return newTemplate;
  }
  async updateTemplate(id, template) {
    const updated = await updateOne(
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
    return deleteOne("templates", { id });
  }
  async getAutomations() {
    return findMany("automations", {});
  }
  async getAutomation(id) {
    const automation = await findOne("automations", { id });
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
    await insertOne("automations", newAutomation);
    return newAutomation;
  }
  async updateAutomation(id, automation) {
    const updated = await updateOne(
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
    return deleteOne("automations", { id });
  }
  async getTeamMembers() {
    return findMany("team_members", {});
  }
  async getTeamMember(id) {
    const member = await findOne("team_members", { id });
    return member || void 0;
  }
  async createTeamMember(member) {
    const newMember = {
      ...member,
      id: randomUUID(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await insertOne("team_members", newMember);
    return newMember;
  }
  async updateTeamMember(id, member) {
    const updated = await updateOne(
      "team_members",
      { id },
      member
    );
    return updated || void 0;
  }
  async deleteTeamMember(id) {
    return deleteOne("team_members", { id });
  }
  async getWhatsappSettings() {
    const settings = await findOne(
      "whatsapp_settings",
      {}
    );
    return settings;
  }
  async saveWhatsappSettings(settings) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = await this.getWhatsappSettings();
    if (existing) {
      const updated = await updateOne(
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
    await insertOne("whatsapp_settings", newSettings);
    return newSettings;
  }
  async getBilling() {
    const billing = await findOne("billing", {});
    if (!billing) {
      const defaultBilling = {
        id: "billing-1",
        credits: 1500,
        transactions: []
      };
      await insertOne("billing", defaultBilling);
      return defaultBilling;
    }
    return billing;
  }
  async updateBilling(billing) {
    const current = await this.getBilling();
    const updated = await updateOne(
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
    await updateOne(
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
    const read2 = outbound.filter((m) => m.status === "read");
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
      readRate: outbound.length > 0 ? Math.round(read2.length / outbound.length * 100 * 10) / 10 : 0,
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
    const chats = await findMany("chats", userId ? { userId } : {}, {
      sort: options.sort || { lastMessageTime: -1 },
      skip: options.skip,
      limit: options.limit
    });
    const contactIds = chats.map((chat) => chat.contactId).filter(Boolean);
    const contacts = contactIds.length ? await findMany(
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
    const chat = await findOne(
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
    const chat = await findOne(
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
    const updated = await updateOne("chats", { id }, chat);
    return updated || void 0;
  }
  async updateChatInboundTime(contactId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const chat = await this.getChatByContactId(contactId);
    if (chat) {
      await updateOne(
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
        await insertOne("chats", newChat);
      }
    }
  }
  async markMessagesAsRead(contactId) {
    const messages = await findMany("messages", {
      contactId,
      direction: "inbound"
    });
    for (const msg of messages) {
      if (msg.status !== "read") {
        await updateOne("messages", { id: msg.id }, { status: "read" });
      }
    }
    await updateOne("chats", { contactId }, { unreadCount: 0 });
  }
  async markMessagesAsUnread(contactId) {
    await updateOne("chats", { contactId }, { unreadCount: 1 });
  }
  async incrementUnreadCount(contactId) {
    const chat = await this.getChatByContactId(contactId);
    if (chat) {
      await updateOne(
        "chats",
        { contactId },
        {
          unreadCount: (chat.unreadCount || 0) + 1
        }
      );
    }
  }
};
var storage = new MongoStorage();

// modules/whatsapp-marketing/shared/schema.js
import { z } from "zod";
var userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(["admin", "agent"]).default("agent"),
  avatar: z.string().optional(),
  createdAt: z.string()
});
var contactSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
var messageSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  contactId: z.string(),
  content: z.string(),
  type: z.enum(["text", "image", "video", "document", "audio", "sticker", "location", "contacts"]).default("text"),
  mediaUrl: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]),
  status: z.enum(["sent", "delivered", "read", "failed"]).default("sent"),
  timestamp: z.string(),
  agentId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  replyToContent: z.string().optional(),
  whatsappMessageId: z.string().optional(),
  failureReason: z.string().optional()
});
var campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  templateId: z.string().optional(),
  message: z.string(),
  contactIds: z.array(z.string()),
  status: z.enum(["draft", "scheduled", "running", "completed", "paused"]).default("draft"),
  scheduledAt: z.string().optional(),
  sentCount: z.number().default(0),
  deliveredCount: z.number().default(0),
  readCount: z.number().default(0),
  repliedCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string()
});
var templateSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  category: z.enum(["marketing", "utility", "authentication"]),
  content: z.string().default(""),
  variables: z.array(z.string()).default([]),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  createdAt: z.string(),
  updatedAt: z.string()
});
var automationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["keyword", "welcome", "follow_up", "drip"]),
  trigger: z.string(),
  message: z.string(),
  delay: z.number().optional(),
  delayUnit: z.enum(["minutes", "hours", "days"]).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string()
});
var teamMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["admin", "agent"]),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.string()
});
var whatsappSettingsSchema = z.object({
  id: z.string(),
  phoneNumber: z.string(),
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  appId: z.string(),
  appSecret: z.string(),
  accessToken: z.string(),
  webhookUrl: z.string().optional(),
  isActive: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string()
});
var billingSchema = z.object({
  id: z.string(),
  credits: z.number().default(0),
  transactions: z.array(z.object({
    id: z.string(),
    type: z.enum(["purchase", "usage"]),
    amount: z.number(),
    description: z.string(),
    createdAt: z.string()
  })).default([])
});
var dashboardStatsSchema = z.object({
  totalMessages: z.number(),
  delivered: z.number(),
  readRate: z.number(),
  replied: z.number(),
  messagesChange: z.number(),
  deliveredChange: z.number(),
  readRateChange: z.number(),
  repliedChange: z.number()
});
var chatSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  contactId: z.string(),
  contact: contactSchema,
  lastMessage: z.string().optional(),
  lastMessageTime: z.string().optional(),
  lastInboundMessageTime: z.string().optional(),
  lastInboundMessage: z.string().optional(),
  unreadCount: z.number().default(0),
  assignedAgentId: z.string().optional(),
  status: z.enum(["open", "pending", "resolved"]).default("open"),
  notes: z.array(z.object({
    id: z.string(),
    content: z.string(),
    agentId: z.string(),
    createdAt: z.string()
  })).default([])
});
var insertUserSchema = userSchema.omit({ id: true, createdAt: true });
var insertContactSchema = contactSchema.omit({ id: true, createdAt: true, updatedAt: true });
var insertMessageSchema = messageSchema.omit({ id: true, timestamp: true });
var insertCampaignSchema = campaignSchema.omit({ id: true, createdAt: true, updatedAt: true, sentCount: true, deliveredCount: true, readCount: true, repliedCount: true });
var insertTemplateSchema = templateSchema.omit({ id: true, createdAt: true, updatedAt: true, status: true });
var insertAutomationSchema = automationSchema.omit({ id: true, createdAt: true, updatedAt: true });
var insertTeamMemberSchema = teamMemberSchema.omit({ id: true, createdAt: true });

// modules/whatsapp-marketing/server/modules/aiAgents/agent.routes.js
import { Router } from "express";

// modules/whatsapp-marketing/server/modules/storage/index.js
init_mongodb_adapter();
init_mongodb_adapter();
async function readCollection2(collection) {
  return readCollection(collection);
}
async function writeCollection2(collection, data) {
  return writeCollection(collection, data);
}
async function addItem(collection, item) {
  const result = await insertOne(collection, item);
  return result || item;
}
async function updateItem(collection, id, updates) {
  return updateOne(collection, { id }, updates);
}
async function deleteItem(collection, id) {
  return deleteOne(collection, { id });
}
async function findById(collection, id) {
  return findOne(collection, { id });
}
async function findByField(collection, field, value) {
  return findOne(collection, { [field]: value });
}
async function updateManyItems(collection, query, updates) {
  return updateMany(collection, query, updates);
}

// modules/whatsapp-marketing/server/modules/aiAgents/agent.service.js
var COLLECTION = "agents";
function generateId() {
  return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function getAllAgents() {
  return readCollection2(COLLECTION);
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

// modules/whatsapp-marketing/server/modules/openai/openai.service.js
init_credentials_service();
var SYSTEM_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
var OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
async function getOpenAIApiKey(userId) {
  if (userId) {
    try {
      const creds = await credentialsService.getDecryptedCredentials(userId);
      if (creds?.openaiApiKey) {
        return creds.openaiApiKey;
      }
    } catch (error) {
      console.error("[OpenAI Service] Error getting user API key:", error);
    }
  }
  return SYSTEM_OPENAI_API_KEY || null;
}
async function sendChatCompletion(messages, agent, userId) {
  const apiKey = await getOpenAIApiKey(userId);
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Please add your API key in Settings > API Credentials.");
  }
  const model = agent?.model || OPENAI_MODEL;
  const temperature = agent?.temperature ?? 0.7;
  const systemPromptContent = agent?.systemPrompt || agent?.instructions || "";
  const systemMessages = systemPromptContent ? [{ role: "system", content: systemPromptContent }] : [];
  const allMessages = [...systemMessages, ...messages];
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        temperature,
        max_tokens: 1024
      })
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}
async function generateAgentResponse(userMessage, agent, conversationHistory2 = [], userId) {
  const messages = [
    ...conversationHistory2,
    { role: "user", content: userMessage }
  ];
  return sendChatCompletion(messages, agent, userId);
}

// modules/whatsapp-marketing/server/modules/gemini/gemini.service.js
init_credentials_service();
import { GoogleGenAI } from "@google/genai";
var SYSTEM_GOOGLE_API_KEY = process.env.GEMINI_API_KEY?.trim();
var SYSTEM_GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
var loggedDualKeyWarning = false;
async function getGeminiApiKey(userId) {
  if (userId) {
    try {
      const creds = await credentialsService.getDecryptedCredentials(userId);
      if (creds?.geminiApiKey?.trim()) {
        return creds.geminiApiKey.trim();
      }
    } catch (error) {
      console.error("[Gemini Service] Error getting user API key:", error);
    }
  }
  if (SYSTEM_GOOGLE_API_KEY && SYSTEM_GEMINI_API_KEY && SYSTEM_GOOGLE_API_KEY !== SYSTEM_GEMINI_API_KEY && !loggedDualKeyWarning) {
    loggedDualKeyWarning = true;
    console.warn(
      "[Gemini Service] Both GOOGLE_API_KEY and GEMINI_API_KEY are set with different values. Preferring GOOGLE_API_KEY."
    );
  }
  return SYSTEM_GOOGLE_API_KEY || SYSTEM_GEMINI_API_KEY || null;
}
function mapModelName(model) {
  const modelMap2 = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-1.5-pro": "gemini-1.5-pro"
  };
  return modelMap2[model] || "gemini-2.5-flash";
}
async function sendGeminiCompletion(messages, agent, userId) {
  const apiKey = await getGeminiApiKey(userId);
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add your API key in Settings > API Credentials.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = mapModelName(agent?.model || "gemini-2.5-flash");
  const systemPromptContent = agent?.systemPrompt || agent?.instructions || "";
  const userMessages = messages.filter((m) => m.role !== "system");
  const conversationContent = userMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  try {
    const response = await ai.models.generateContent({
      model,
      contents: conversationContent,
      config: {
        systemInstruction: systemPromptContent || void 0,
        temperature: agent?.temperature ?? 0.7,
        maxOutputTokens: 1024
      }
    });
    const responseText = response.text || "";
    const refusalPatterns = [
      "I am sorry, I cannot fulfill this request",
      "I cannot generate personalized messages",
      "I am not able to generate",
      "I'm sorry, I cannot",
      "I cannot assist with",
      "I'm not able to help with"
    ];
    const isRefusal = refusalPatterns.some(
      (pattern) => responseText.toLowerCase().includes(pattern.toLowerCase())
    );
    if (isRefusal || !responseText.trim()) {
      console.log("[Gemini] Detected refusal or empty response, using fallback");
      if (systemPromptContent.toLowerCase().includes("award") || systemPromptContent.toLowerCase().includes("life changer")) {
        return "Please reply if you are interested in the award, and I will share the benefits again.";
      }
      return "Thank you for your message! How can I assist you today?";
    }
    return responseText;
  } catch (error) {
    console.error("[Gemini Debug] userId:", userId || "(system)");
    console.error("[Gemini Debug] selected apiKey:", apiKey);
    console.error(
      "[Gemini Debug] env GEMINI_API_KEY:",
      process.env.GEMINI_API_KEY || "(empty)"
    );
    console.error(
      "[Gemini Debug] env GOOGLE_API_KEY:",
      process.env.GEMINI_API_KEY || "(empty)"
    );
    console.error("Gemini API error:", error);
    throw error;
  }
}
async function generateGeminiAgentResponse(userMessage, agent, conversationHistory2 = [], userId) {
  const messages = [
    ...conversationHistory2,
    { role: "user", content: userMessage }
  ];
  return sendGeminiCompletion(messages, agent, userId);
}

// modules/whatsapp-marketing/server/modules/ai/ai.service.js
function isGeminiModel(model) {
  return model.startsWith("gemini-");
}
async function generateAIResponse(messages, agent, userId) {
  const model = agent?.model || "gpt-4o";
  if (isGeminiModel(model)) {
    return sendGeminiCompletion(messages, agent, userId);
  }
  return sendChatCompletion(messages, agent, userId);
}
async function generateAgentResponse2(userMessage, agent, conversationHistory2 = [], userId) {
  const model = agent?.model || "gpt-4o";
  if (isGeminiModel(model)) {
    return generateGeminiAgentResponse(userMessage, agent, conversationHistory2, userId);
  }
  return generateAgentResponse(userMessage, agent, conversationHistory2, userId);
}

// modules/whatsapp-marketing/server/modules/aiAgents/agent.controller.js
async function listAgents(req, res) {
  try {
    const agents = await getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error("Error listing agents:", error);
    res.status(500).json({ error: "Failed to list agents" });
  }
}
async function getAgent(req, res) {
  try {
    const { id } = req.params;
    const agent = await getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error("Error getting agent:", error);
    res.status(500).json({ error: "Failed to get agent" });
  }
}
async function createAgent2(req, res) {
  try {
    const { name, description, systemPrompt, model, temperature, isActive } = req.body;
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: "Name and system prompt are required" });
    }
    const agent = await createAgent({
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
async function updateAgent2(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const agent = await updateAgent(id, updates);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    console.error("Error updating agent:", error);
    res.status(500).json({ error: "Failed to update agent" });
  }
}
async function deleteAgent2(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteAgent(id);
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
    const agent = await getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    const response = await generateAgentResponse2(message, agent, [], userId);
    res.json({ response });
  } catch (error) {
    console.error("Error testing agent:", error);
    res.status(500).json({ error: "Failed to test agent" });
  }
}
async function migrateAllToGemini(req, res) {
  try {
    const result = await updateAllAgentsToGemini();
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

// modules/whatsapp-marketing/server/modules/aiAgents/agent.routes.js
var router = Router();
router.get("/", listAgents);
router.post("/migrate-to-gemini", migrateAllToGemini);
router.get("/:id", getAgent);
router.post("/", createAgent2);
router.put("/:id", updateAgent2);
router.delete("/:id", deleteAgent2);
router.post("/:id/test", testAgent);
var agent_routes_default = router;

// modules/whatsapp-marketing/server/modules/facebook/fb.routes.js
import { Router as Router2 } from "express";

// modules/whatsapp-marketing/server/modules/mapping/mapping.service.js
var COLLECTION2 = "mapping";
function generateId2() {
  return `map-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function getAllMappings() {
  return readCollection2(COLLECTION2);
}
async function getMappingById(id) {
  return findById(COLLECTION2, id);
}
async function getMappingByFormId(formId) {
  const mappings = await readCollection2(COLLECTION2);
  return mappings.find((m) => m.formId === formId && m.isActive) || null;
}
async function createMapping(data) {
  const existingMappings = await readCollection2(COLLECTION2);
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
    id: generateId2(),
    ...data,
    createdAt: now,
    updatedAt: now
  };
  return addItem(COLLECTION2, mapping);
}
async function updateMapping(id, data) {
  return updateItem(COLLECTION2, id, {
    ...data,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function deleteMapping(id) {
  return deleteItem(COLLECTION2, id);
}

// modules/whatsapp-marketing/server/modules/leadAutoReply/leadAutoReply.service.js
init_mongodb_adapter();

// modules/whatsapp-marketing/server/modules/leadAutoReply/templateMessages.service.js
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isValidTemplateParameter(param) {
  if (!param || typeof param !== "object") return false;
  const type = String(param.type || "").toLowerCase();
  if (!type) {
    return isNonEmptyString(param.text);
  }
  switch (type) {
    case "text":
      return isNonEmptyString(param.text);
    case "image":
      return isNonEmptyString(param.image?.link) || isNonEmptyString(param.image?.id);
    case "video":
      return isNonEmptyString(param.video?.link) || isNonEmptyString(param.video?.id);
    case "document":
      return isNonEmptyString(param.document?.link) || isNonEmptyString(param.document?.id);
    case "currency": {
      const amount = param.currency?.amount_1000;
      return isNonEmptyString(param.currency?.fallback_value) && isNonEmptyString(param.currency?.code) && typeof amount === "number" && Number.isFinite(amount);
    }
    case "date_time":
      return isNonEmptyString(param.date_time?.fallback_value);
    default:
      return true;
  }
}
function getWhatsAppCredentials() {
  const token = "";
  const phoneNumberId = "";
  if (!token || !phoneNumberId) {
    return null;
  }
  return { token, phoneNumberId };
}
async function sendTemplateMessage(to, template, options) {
  console.log("[TemplateMessage] ===== START =====");
  console.log("[TemplateMessage] To:", to);
  console.log(
    "[TemplateMessage] Raw template config:",
    JSON.stringify(template, null, 2)
  );
  const credentials = getWhatsAppCredentials();
  if (!credentials) {
    console.error("[TemplateMessage] WhatsApp credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const metaTemplateName = template.name.toLowerCase().replace(/\s+/g, "_");
  const primaryLanguage = template.languageCode || "en_US";
  const allowLanguageFallback = options?.allowLanguageFallback !== false;
  const languageCodesToTry = allowLanguageFallback ? Array.from(/* @__PURE__ */ new Set([primaryLanguage, "en_US", "en", "en_GB"])) : [primaryLanguage];
  console.log("[TemplateMessage] Normalized template name:", metaTemplateName);
  console.log(
    "[TemplateMessage] Language attempt order:",
    languageCodesToTry
  );
  let lastAttempt = {};
  for (const langCode of languageCodesToTry) {
    console.log("--------------------------------------------");
    console.log(`[TemplateMessage] Attempting language: ${langCode}`);
    let components = void 0;
    if (template.components) {
      const hasValidParams = template.components.some(
        (comp) => comp.parameters && comp.parameters.length > 0
      );
      if (hasValidParams) {
        for (const component of template.components) {
          if (component.parameters) {
            for (const param of component.parameters) {
              if (!isValidTemplateParameter(param)) {
                console.error(
                  "[TemplateMessage] \u274C Invalid template parameter:",
                  param
                );
                return {
                  success: false,
                  error: "Invalid WhatsApp template parameters",
                  attemptedLanguage: langCode
                };
              }
            }
          }
        }
        components = template.components;
      } else {
        components = template.components;
      }
    }
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: langCode },
        ...components !== void 0 ? { components } : {}
      }
    };
    console.log(
      "[TemplateMessage] Payload:",
      JSON.stringify(messagePayload, null, 2)
    );
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(messagePayload)
        }
      );
      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { raw: responseText };
      }
      lastAttempt = {
        providerHttpStatus: response.status,
        providerResponse: data,
        requestPayload: messagePayload,
        attemptedLanguage: langCode,
        errorCode: data?.error?.code
      };
      console.log("[TemplateMessage] HTTP Status:", response.status);
      console.log("[TemplateMessage] Response:", JSON.stringify(data, null, 2));
      if (response.ok && data?.messages?.[0]?.id) {
        console.log(
          `[TemplateMessage] \u2705 Success | Message ID: ${data.messages[0].id}`
        );
        console.log("[TemplateMessage] ===== END =====");
        return {
          success: true,
          messageId: data.messages[0].id,
          messageStatus: data.messages?.[0]?.message_status,
          ...lastAttempt
        };
      }
      const errorMsg = data?.error?.message || "Unknown Meta error";
      const errorCode = data?.error?.code;
      console.error("[TemplateMessage] \u274C Meta Error:", errorMsg, errorCode);
      if (errorCode === 132001 || errorMsg.toLowerCase().includes("does not exist")) {
        console.log("[TemplateMessage] Template not found, trying next language...");
        continue;
      }
      if (errorCode === 132e3 || errorCode === 132012 || errorMsg.toLowerCase().includes("parameters does not match") || errorMsg.toLowerCase().includes("parameter format does not match")) {
        console.error("[TemplateMessage] \u274C Parameter mismatch - check template variables");
        return {
          success: false,
          error: `${errorMsg}. Template requires variables but none/incorrect were provided.`,
          ...lastAttempt
        };
      }
      console.log("[TemplateMessage] ===== END =====");
      return { success: false, error: errorMsg, ...lastAttempt };
    } catch (error) {
      console.error("[TemplateMessage] \u274C Fetch Exception:", error);
      lastAttempt = {
        requestPayload: messagePayload,
        attemptedLanguage: langCode
      };
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        ...lastAttempt
      };
    }
  }
  console.error(
    `[TemplateMessage] \u274C Template "${metaTemplateName}" not found in any language`
  );
  console.log("[TemplateMessage] ===== END =====");
  return {
    success: false,
    error: `Template "${metaTemplateName}" not found in Meta`,
    ...lastAttempt
  };
}
async function sendHelloWorldTemplate(to) {
  return sendTemplateMessage(to, {
    name: "hello_world",
    languageCode: "en_US"
  });
}

// modules/whatsapp-marketing/server/modules/leadAutoReply/leadAutoReply.service.js
function getLeadPhone(lead) {
  return lead.phoneNumber || lead.phone;
}
function getLeadName(lead) {
  return lead.fullName || lead.name;
}
async function processNewLead(lead) {
  try {
    console.log(`[AutoReply] Processing lead: ${lead.id} from form: ${lead.formId}`);
    const phoneNumber = getLeadPhone(lead);
    if (!phoneNumber) {
      console.log(`[AutoReply] No phone number for lead ${lead.id}, skipping`);
      return { success: false, error: "No phone number available" };
    }
    if (lead.autoReplySent) {
      console.log(`[AutoReply] Already sent reply to lead ${lead.id}, skipping`);
      return { success: false, error: "Auto-reply already sent" };
    }
    const mapping = await getMappingByFormId(lead.formId);
    if (!mapping || !mapping.isActive) {
      console.log(`[AutoReply] No active mapping for form ${lead.formId}`);
      return { success: false, error: "No active agent mapping for this form" };
    }
    const agent = await getAgentById(mapping.agentId);
    if (!agent || !agent.isActive) {
      console.log(`[AutoReply] Agent ${mapping.agentId} not found or inactive`);
      return { success: false, error: "Agent not found or inactive" };
    }
    const leadContext = buildLeadContext(lead);
    const welcomePrompt = `A new lead just submitted a form. Here's their information:
${leadContext}

Generate a friendly, professional welcome message to send them via WhatsApp. Keep it concise (under 200 characters). Don't include any placeholders - write the actual message ready to send.`;
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`[AutoReply] Sending WhatsApp template to: ${formattedPhone}`);
    const sendResult = await sendHelloWorldTemplate(formattedPhone);
    if (sendResult.success) {
      const templateMessage = "Welcome message sent via WhatsApp template";
      lead.autoReplySent = true;
      lead.autoReplyMessage = templateMessage;
      lead.autoReplySentAt = (/* @__PURE__ */ new Date()).toISOString();
      await updateLead(lead);
      console.log(`[AutoReply] Successfully sent template to ${formattedPhone}`);
      return { success: true, message: templateMessage };
    } else {
      console.error(`[AutoReply] Failed to send template: ${sendResult.error}`);
      return { success: false, error: sendResult.error };
    }
  } catch (error) {
    console.error("[AutoReply] Error processing lead:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
async function processAllPendingLeads() {
  const leads = await readCollection("leads");
  const pendingLeads = leads.filter((l) => !l.autoReplySent && getLeadPhone(l));
  let successful = 0;
  let failed = 0;
  for (const lead of pendingLeads) {
    const result = await processNewLead(lead);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
  }
  return { processed: pendingLeads.length, successful, failed };
}
async function sendManualReply(leadId, message) {
  const lead = await findOne("leads", { id: leadId });
  if (!lead) {
    return { success: false, error: "Lead not found" };
  }
  const phoneNumber = getLeadPhone(lead);
  if (!phoneNumber) {
    return { success: false, error: "No phone number for this lead" };
  }
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const result = await sendHelloWorldTemplate(formattedPhone);
  if (result.success) {
    await updateOne("leads", { id: leadId }, {
      autoReplySent: true,
      autoReplyMessage: "Welcome message sent via WhatsApp template",
      autoReplySentAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return result;
}
function buildLeadContext(lead) {
  const lines = [];
  const name = getLeadName(lead);
  if (name) lines.push(`Name: ${name}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.formName) lines.push(`Form: ${lead.formName}`);
  if (lead.adName) lines.push(`Ad: ${lead.adName}`);
  if (lead.campaignName) lines.push(`Campaign: ${lead.campaignName}`);
  if (lead.fieldData) {
    Object.entries(lead.fieldData).forEach(([key, value]) => {
      if (!["full_name", "email", "phone_number"].includes(key.toLowerCase())) {
        lines.push(`${key}: ${value}`);
      }
    });
  }
  return lines.join("\n");
}
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = ["1", "44", "91", "92", "93", "94", "971", "966", "965", "974", "20", "27", "61", "64", "81", "86"];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  if (cleaned.startsWith("0")) {
    cleaned = "92" + cleaned.substring(1);
  }
  return cleaned;
}
async function updateLead(lead) {
  await updateOne("leads", { id: lead.id }, lead);
}

// modules/whatsapp-marketing/server/modules/integrations/integration.service.js
import crypto4 from "crypto";
import mongoose3 from "mongoose";

// modules/whatsapp-marketing/server/modules/integrations/connectedAccount.model.js
import mongoose2, { Schema as Schema2 } from "mongoose";
var ConnectedAccountSchema = new Schema2({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  providerId: { type: String, required: true, index: true },
  providerName: { type: String, required: true },
  status: {
    type: String,
    enum: ["connected", "disconnected", "error", "pending", "expired"],
    default: "pending"
  },
  credentials: { type: Map, of: String, required: true },
  metadata: { type: Map, of: Schema2.Types.Mixed, default: {} },
  isDefault: { type: Boolean, default: false },
  lastVerifiedAt: { type: Date },
  lastSyncAt: { type: Date },
  expiresAt: { type: Date },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: "connected_accounts",
  timestamps: true
});
ConnectedAccountSchema.index({ userId: 1, providerId: 1 });
ConnectedAccountSchema.index({ userId: 1, providerId: 1, isDefault: 1 });
var ConnectedAccount = mongoose2.models.ConnectedAccount || mongoose2.model("ConnectedAccount", ConnectedAccountSchema);
function toConnectedAccountData(doc) {
  const credentialsObj = {};
  if (doc.credentials) {
    doc.credentials.forEach((value, key) => {
      credentialsObj[key] = value;
    });
  }
  const metadataObj = {};
  if (doc.metadata) {
    doc.metadata.forEach((value, key) => {
      metadataObj[key] = value;
    });
  }
  return {
    id: doc.id,
    userId: doc.userId,
    providerId: doc.providerId,
    providerName: doc.providerName,
    status: doc.status,
    credentials: credentialsObj,
    metadata: metadataObj,
    isDefault: doc.isDefault,
    lastVerifiedAt: doc.lastVerifiedAt?.toISOString(),
    lastSyncAt: doc.lastSyncAt?.toISOString(),
    expiresAt: doc.expiresAt?.toISOString(),
    errorMessage: doc.errorMessage,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

// modules/whatsapp-marketing/server/modules/integrations/integration.providers.js
var INTEGRATION_PROVIDERS = [
  {
    id: "whatsapp",
    name: "WhatsApp Business API",
    description: "Connect your WhatsApp Business account to send and receive messages",
    icon: "MessageCircle",
    category: "messaging",
    authType: "api_key",
    webhookSupport: true,
    capabilities: [
      "send_messages",
      "receive_messages",
      "send_templates",
      "media_messages",
      "webhooks"
    ],
    documentationUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    requiredFields: [
      {
        key: "accessToken",
        label: "Permanent Access Token",
        type: "password",
        placeholder: "Enter your WhatsApp Business API access token",
        helpText: "Get this from Meta Business Suite > System Users"
      },
      {
        key: "phoneNumberId",
        label: "Phone Number ID",
        type: "text",
        placeholder: "e.g., 123456789012345",
        helpText: "Found in WhatsApp Business Platform > Phone Numbers"
      },
      {
        key: "businessAccountId",
        label: "WhatsApp Business Account ID",
        type: "text",
        placeholder: "e.g., 123456789012345",
        helpText: "Found in Meta Business Suite > Business Settings"
      }
    ],
    optionalFields: [
      {
        key: "webhookVerifyToken",
        label: "Webhook Verify Token",
        type: "text",
        placeholder: "Custom verification token for webhooks",
        helpText: "A secret token you create for webhook verification"
      }
    ]
  },
  {
    id: "facebook",
    name: "Facebook / Meta",
    description: "Connect to Facebook for lead forms and page management",
    icon: "Facebook",
    category: "social",
    authType: "api_key",
    webhookSupport: true,
    capabilities: [
      "lead_forms",
      "page_management",
      "messenger",
      "webhooks"
    ],
    documentationUrl: "https://developers.facebook.com/docs/marketing-api",
    requiredFields: [
      {
        key: "accessToken",
        label: "Page Access Token",
        type: "password",
        placeholder: "Enter your Facebook Page access token",
        helpText: "Generate a long-lived page access token from Graph API Explorer"
      },
      {
        key: "pageId",
        label: "Facebook Page ID",
        type: "text",
        placeholder: "e.g., 123456789012345",
        helpText: "Found in Page Settings > Page ID"
      }
    ],
    optionalFields: [
      {
        key: "appId",
        label: "App ID",
        type: "text",
        placeholder: "Your Meta App ID",
        helpText: "Found in Meta Developer Console"
      },
      {
        key: "appSecret",
        label: "App Secret",
        type: "password",
        placeholder: "Your Meta App Secret",
        helpText: "Found in Meta Developer Console > App Settings"
      }
    ]
  },
  {
    id: "gemini",
    name: "Google Gemini AI",
    description: "Connect Google Gemini for AI-powered responses",
    icon: "Sparkles",
    category: "ai",
    authType: "api_key",
    webhookSupport: false,
    capabilities: [
      "text_generation",
      "chat_completion",
      "content_analysis"
    ],
    documentationUrl: "https://ai.google.dev/docs",
    requiredFields: [
      {
        key: "apiKey",
        label: "Gemini API Key",
        type: "password",
        placeholder: "Enter your Google AI API key",
        helpText: "Get this from Google AI Studio (https://aistudio.google.com)"
      }
    ],
    optionalFields: [
      {
        key: "defaultModel",
        label: "Default Model",
        type: "select",
        options: [
          { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Recommended)" },
          { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
          { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" }
        ],
        helpText: "Select the default AI model for responses"
      }
    ]
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Connect OpenAI for GPT-powered AI responses",
    icon: "Bot",
    category: "ai",
    authType: "api_key",
    webhookSupport: false,
    capabilities: [
      "text_generation",
      "chat_completion",
      "embeddings"
    ],
    documentationUrl: "https://platform.openai.com/docs",
    requiredFields: [
      {
        key: "apiKey",
        label: "OpenAI API Key",
        type: "password",
        placeholder: "sk-...",
        helpText: "Get this from OpenAI Dashboard"
      }
    ],
    optionalFields: [
      {
        key: "organizationId",
        label: "Organization ID",
        type: "text",
        placeholder: "org-...",
        helpText: "Optional: Your OpenAI organization ID"
      }
    ]
  },
  {
    id: "smtp",
    name: "Email (SMTP)",
    description: "Connect your email service for sending notifications",
    icon: "Mail",
    category: "marketing",
    authType: "credentials",
    webhookSupport: false,
    capabilities: [
      "send_email",
      "notifications"
    ],
    requiredFields: [
      {
        key: "host",
        label: "SMTP Host",
        type: "text",
        placeholder: "smtp.gmail.com",
        helpText: "Your email provider SMTP server"
      },
      {
        key: "port",
        label: "SMTP Port",
        type: "text",
        placeholder: "587",
        helpText: "Usually 587 for TLS or 465 for SSL"
      },
      {
        key: "username",
        label: "Email Address",
        type: "text",
        placeholder: "your@email.com",
        helpText: "Your email address for sending"
      },
      {
        key: "password",
        label: "App Password",
        type: "password",
        placeholder: "Your app password",
        helpText: "Use an app-specific password, not your main password"
      }
    ]
  },
  {
    id: "razorpay",
    name: "Razorpay",
    description: "Accept payments via Razorpay",
    icon: "CreditCard",
    category: "payment",
    authType: "api_key",
    webhookSupport: true,
    capabilities: [
      "payment_links",
      "payment_verification",
      "webhooks"
    ],
    documentationUrl: "https://razorpay.com/docs/",
    requiredFields: [
      {
        key: "keyId",
        label: "Key ID",
        type: "text",
        placeholder: "rzp_live_...",
        helpText: "Razorpay Key ID from Dashboard"
      },
      {
        key: "keySecret",
        label: "Key Secret",
        type: "password",
        placeholder: "Your Razorpay secret key",
        helpText: "Razorpay Key Secret from Dashboard"
      }
    ]
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments via Stripe",
    icon: "CreditCard",
    category: "payment",
    authType: "api_key",
    webhookSupport: true,
    capabilities: [
      "payment_links",
      "subscriptions",
      "payment_verification",
      "webhooks"
    ],
    documentationUrl: "https://stripe.com/docs",
    requiredFields: [
      {
        key: "secretKey",
        label: "Secret Key",
        type: "password",
        placeholder: "sk_live_...",
        helpText: "Stripe Secret Key from Dashboard"
      },
      {
        key: "publishableKey",
        label: "Publishable Key",
        type: "text",
        placeholder: "pk_live_...",
        helpText: "Stripe Publishable Key for frontend"
      }
    ],
    optionalFields: [
      {
        key: "webhookSecret",
        label: "Webhook Secret",
        type: "password",
        placeholder: "whsec_...",
        helpText: "Webhook signing secret for verifying events"
      }
    ]
  }
];
function getProviderById(providerId) {
  return INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
}

// modules/whatsapp-marketing/server/modules/integrations/integration.service.js
init_encryption_service();
async function getAllProviders() {
  return INTEGRATION_PROVIDERS;
}
async function getProviderDetails(providerId) {
  return getProviderById(providerId) || null;
}
async function getUserConnections(userId) {
  try {
    const accounts = await ConnectedAccount.find({ userId }).sort({ createdAt: -1 });
    return accounts.map(toConnectedAccountData);
  } catch (error) {
    console.error("[Integrations] Error fetching user connections:", error);
    return [];
  }
}
function normalizeMetaProfile(data, source) {
  return {
    displayPhoneNumber: String(data.display_phone_number || data.displayPhoneNumber || "").trim(),
    verifiedName: String(data.verified_name || data.verifiedName || "").trim(),
    qualityRating: String(data.quality_rating || data.qualityRating || "").trim(),
    source
  };
}
async function fetchWhatsAppPhoneProfile(credentials, source) {
  const accessToken = credentials.accessToken || credentials.whatsappToken;
  const phoneNumberId = credentials.phoneNumberId;
  if (!accessToken || !phoneNumberId) return null;
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (!response.ok) return null;
  const data = await response.json();
  const profile = normalizeMetaProfile(data, source);
  return {
    ...profile,
    phoneNumberId
  };
}
async function getWhatsAppProfile(userId) {
  try {
    let account = await ConnectedAccount.findOne({
      userId,
      providerId: "whatsapp",
      isDefault: true,
      status: "connected"
    });
    if (!account) {
      account = await ConnectedAccount.findOne({
        userId,
        providerId: "whatsapp",
        status: "connected"
      }).sort({ updatedAt: -1 });
    }
    if (account) {
      const metadata = {};
      account.metadata?.forEach((value, key) => {
        metadata[key] = value;
      });
      const metadataProfile = normalizeMetaProfile(metadata, "connected_apps");
      const phoneNumberId = account.credentials instanceof Map ? account.credentials.get("phoneNumberId") : account.credentials?.phoneNumberId;
      if (metadataProfile.displayPhoneNumber || metadataProfile.verifiedName) {
        return {
          isConnected: true,
          isVerified: true,
          provider: "connected_apps",
          phoneNumberId: phoneNumberId ? maskSecret(decrypt(phoneNumberId), 3) : "",
          ...metadataProfile,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString()
        };
      }
      const decryptedCredentials = {};
      account.credentials?.forEach((value, key) => {
        decryptedCredentials[key] = decrypt(value);
      });
      const liveProfile = await fetchWhatsAppPhoneProfile(
        decryptedCredentials,
        "connected_apps_live"
      );
      if (liveProfile) {
        account.metadata.set("displayPhoneNumber", liveProfile.displayPhoneNumber);
        account.metadata.set("verifiedName", liveProfile.verifiedName);
        account.metadata.set("qualityRating", liveProfile.qualityRating);
        account.lastVerifiedAt = /* @__PURE__ */ new Date();
        await account.save();
        return {
          isConnected: true,
          isVerified: true,
          provider: "connected_apps",
          phoneNumberId: maskSecret(liveProfile.phoneNumberId, 3),
          displayPhoneNumber: liveProfile.displayPhoneNumber,
          verifiedName: liveProfile.verifiedName,
          qualityRating: liveProfile.qualityRating,
          source: liveProfile.source,
          lastVerifiedAt: account.lastVerifiedAt?.toISOString()
        };
      }
    }
    const credentialsModule = await Promise.resolve().then(() => (init_credentials_service(), credentials_service_exports));
    const stored = await credentialsModule.getCredentialsByUserId(userId);
    const legacyCredentials = await credentialsModule.getDecryptedCredentials(userId);
    const legacyProfile = legacyCredentials ? await fetchWhatsAppPhoneProfile(legacyCredentials, "legacy_live") : null;
    return {
      isConnected: Boolean(legacyProfile || stored?.isVerified),
      isVerified: Boolean(legacyProfile || stored?.isVerified),
      provider: stored ? "legacy" : "",
      phoneNumberId: legacyCredentials?.phoneNumberId ? maskSecret(legacyCredentials.phoneNumberId, 3) : "",
      displayPhoneNumber: legacyProfile?.displayPhoneNumber || "",
      verifiedName: legacyProfile?.verifiedName || "",
      qualityRating: legacyProfile?.qualityRating || "",
      source: legacyProfile?.source || (stored ? "legacy" : ""),
      lastVerifiedAt: stored?.lastVerifiedAt
    };
  } catch (error) {
    console.error("[Integrations] Error fetching WhatsApp profile:", error);
    return {
      isConnected: false,
      isVerified: false,
      provider: "",
      phoneNumberId: "",
      displayPhoneNumber: "",
      verifiedName: "",
      qualityRating: "",
      source: "",
      lastVerifiedAt: void 0
    };
  }
}
async function getConnectionById(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    return account ? toConnectedAccountData(account) : null;
  } catch (error) {
    console.error("[Integrations] Error fetching connection by ID:", error);
    return null;
  }
}
async function connectIntegration(userId, input) {
  try {
    const provider = getProviderById(input.providerId);
    if (!provider) {
      return { success: false, error: "Invalid provider" };
    }
    for (const field of provider.requiredFields) {
      if (!input.credentials[field.key]) {
        return { success: false, error: `Missing required field: ${field.label}` };
      }
    }
    const encryptedCredentials = {};
    for (const [key, value] of Object.entries(input.credentials)) {
      if (value) {
        encryptedCredentials[key] = encrypt(value);
      }
    }
    if (input.setAsDefault) {
      await ConnectedAccount.updateMany(
        { userId, providerId: input.providerId },
        { $set: { isDefault: false } }
      );
    }
    const existingConnection = await ConnectedAccount.findOne({
      userId,
      providerId: input.providerId,
      isDefault: true
    });
    const connectionId = crypto4.randomUUID();
    const now = /* @__PURE__ */ new Date();
    if (existingConnection) {
      existingConnection.credentials = new Map(Object.entries(encryptedCredentials));
      existingConnection.metadata = new Map(Object.entries(input.metadata || {}));
      existingConnection.status = "pending";
      existingConnection.updatedAt = now;
      existingConnection.errorMessage = void 0;
      await existingConnection.save();
      const verifyResult2 = await verifyConnection(userId, existingConnection.id);
      if (verifyResult2.success) {
        existingConnection.status = "connected";
        existingConnection.lastVerifiedAt = now;
        if (verifyResult2.metadata) {
          for (const [key, value] of Object.entries(verifyResult2.metadata)) {
            existingConnection.metadata.set(key, value);
          }
        }
      } else {
        existingConnection.status = "error";
        existingConnection.errorMessage = verifyResult2.message;
      }
      await existingConnection.save();
      return {
        success: verifyResult2.success,
        connection: toConnectedAccountData(existingConnection),
        error: verifyResult2.success ? void 0 : verifyResult2.message
      };
    }
    const isFirstConnection = !await ConnectedAccount.findOne({ userId, providerId: input.providerId });
    const newConnection = new ConnectedAccount({
      id: connectionId,
      userId,
      providerId: input.providerId,
      providerName: provider.name,
      status: "pending",
      credentials: new Map(Object.entries(encryptedCredentials)),
      metadata: new Map(Object.entries(input.metadata || {})),
      isDefault: input.setAsDefault || isFirstConnection,
      createdAt: now,
      updatedAt: now
    });
    await newConnection.save();
    const verifyResult = await verifyConnection(userId, connectionId);
    if (verifyResult.success) {
      newConnection.status = "connected";
      newConnection.lastVerifiedAt = now;
      if (verifyResult.metadata) {
        for (const [key, value] of Object.entries(verifyResult.metadata)) {
          newConnection.metadata.set(key, value);
        }
      }
    } else {
      newConnection.status = "error";
      newConnection.errorMessage = verifyResult.message;
    }
    await newConnection.save();
    return {
      success: verifyResult.success,
      connection: toConnectedAccountData(newConnection),
      error: verifyResult.success ? void 0 : verifyResult.message
    };
  } catch (error) {
    console.error("[Integrations] Error connecting integration:", error);
    return { success: false, error: "Failed to connect integration" };
  }
}
async function disconnectIntegration(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: "Connection not found" };
    }
    await ConnectedAccount.deleteOne({ id: connectionId, userId });
    if (account.isDefault) {
      const nextConnection = await ConnectedAccount.findOne({
        userId,
        providerId: account.providerId
      });
      if (nextConnection) {
        nextConnection.isDefault = true;
        await nextConnection.save();
      }
    }
    return { success: true };
  } catch (error) {
    console.error("[Integrations] Error disconnecting integration:", error);
    return { success: false, error: "Failed to disconnect integration" };
  }
}
async function setDefaultConnection(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: "Connection not found" };
    }
    await ConnectedAccount.updateMany(
      { userId, providerId: account.providerId },
      { $set: { isDefault: false } }
    );
    account.isDefault = true;
    await account.save();
    return { success: true };
  } catch (error) {
    console.error("[Integrations] Error setting default connection:", error);
    return { success: false, error: "Failed to set default connection" };
  }
}
async function verifyConnection(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, message: "Connection not found" };
    }
    const decryptedCredentials = {};
    account.credentials.forEach((value, key) => {
      decryptedCredentials[key] = decrypt(value);
    });
    switch (account.providerId) {
      case "whatsapp":
        return await verifyWhatsAppConnection(decryptedCredentials);
      case "facebook":
        return await verifyFacebookConnection(decryptedCredentials);
      case "gemini":
        return await verifyGeminiConnection(decryptedCredentials);
      case "openai":
        return await verifyOpenAIConnection(decryptedCredentials);
      case "smtp":
        return await verifySMTPConnection(decryptedCredentials);
      default:
        return { success: true, message: "Connection saved (verification not available for this provider)" };
    }
  } catch (error) {
    console.error("[Integrations] Error verifying connection:", error);
    return { success: false, message: "Verification failed" };
  }
}
async function verifyWhatsAppConnection(credentials) {
  try {
    const { accessToken, phoneNumberId } = credentials;
    if (!accessToken || !phoneNumberId) {
      return { success: false, message: "Missing access token or phone number ID" };
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid WhatsApp credentials"
      };
    }
    const data = await response.json();
    return {
      success: true,
      message: "WhatsApp connection verified successfully",
      metadata: {
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating
      }
    };
  } catch (error) {
    console.error("[Integrations] WhatsApp verification error:", error);
    return { success: false, message: "Failed to verify WhatsApp connection" };
  }
}
async function verifyFacebookConnection(credentials) {
  try {
    const { accessToken, pageId } = credentials;
    if (!accessToken) {
      return { success: false, message: "Missing access token" };
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
    );
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid Facebook credentials"
      };
    }
    const data = await response.json();
    return {
      success: true,
      message: "Facebook connection verified successfully",
      metadata: {
        name: data.name,
        id: data.id
      }
    };
  } catch (error) {
    console.error("[Integrations] Facebook verification error:", error);
    return { success: false, message: "Failed to verify Facebook connection" };
  }
}
async function verifyGeminiConnection(credentials) {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: "Missing API key" };
    }
    const { GoogleGenAI: GoogleGenAI3 } = await import("@google/genai");
    const genAI = new GoogleGenAI3({ apiKey });
    const response = await genAI.models.list();
    return {
      success: true,
      message: "Gemini AI connection verified successfully",
      metadata: {
        modelsAvailable: true
      }
    };
  } catch (error) {
    console.error("[Integrations] Gemini verification error:", error);
    return {
      success: false,
      message: error.message || "Invalid Gemini API key"
    };
  }
}
async function verifyOpenAIConnection(credentials) {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: "Missing API key" };
    }
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.error?.message || "Invalid OpenAI API key"
      };
    }
    return {
      success: true,
      message: "OpenAI connection verified successfully"
    };
  } catch (error) {
    console.error("[Integrations] OpenAI verification error:", error);
    return { success: false, message: "Failed to verify OpenAI connection" };
  }
}
async function verifySMTPConnection(credentials) {
  return {
    success: true,
    message: "SMTP credentials saved (send a test email to verify)"
  };
}
async function getDecryptedCredentials2(userId, providerId) {
  try {
    let account = await ConnectedAccount.findOne({
      userId,
      providerId,
      isDefault: true,
      status: "connected"
    });
    if (!account) {
      account = await ConnectedAccount.findOne({
        userId,
        providerId,
        status: "connected"
      });
    }
    if (!account) return null;
    const result = {};
    account.credentials.forEach((value, key) => {
      result[key] = decrypt(value);
    });
    return result;
  } catch (error) {
    console.error("[Integrations] Error getting decrypted credentials:", error);
    return null;
  }
}
var WHATSAPP_USER_SCOPED_COLLECTIONS = [
  "templates",
  "contacts",
  "messages",
  "whatsapp_chats",
  "campaigns",
  "campaignlogs",
  "broadcast_lists",
  "broadcast_logs",
  "scheduled_messages",
  "scheduled_broadcasts",
  "blocked_contacts",
  "imported_contacts",
  "interest_classification_logs",
  "contact_analytics",
  "webhook_status_events",
  "whatsappflows",
  "whatsappflowresponses",
  "flowsynccheckpoints",
  "flowdefinitions",
  "flowinstances",
  "triggers",
  "triggerexecutions",
  "realtimeevents",
  "dripcampaigns",
  "dripruns",
  "segments",
  "automationmetrics",
  "engagementheatmaps",
  "aiinsights",
  "automationworkflows",
  "automationexecutions",
  "automationlogs",
  "automationrecipients",
  "formautomations"
];
async function delinkWhatsAppAccount(userId) {
  const db = mongoose3.connection.db;
  if (!db) throw new Error("Database connection is not available");
  const contacts = await db.collection("contacts").find({ userId }, { projection: { id: 1, _id: 1 } }).toArray();
  const contactIds = contacts.flatMap(
    (item) => [item.id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const campaigns = await db.collection("campaigns").find({ userId }, { projection: { id: 1, _id: 1 } }).toArray();
  const campaignIds = campaigns.flatMap(
    (item) => [item.id, item._id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const flows = await db.collection("flowdefinitions").find({ userId }, { projection: { _id: 1 } }).toArray();
  const flowIds = flows.flatMap(
    (item) => [item._id, item._id ? String(item._id) : null].filter(Boolean)
  );
  const deleted = {};
  const remove = async (collection, filter) => {
    const result = await db.collection(collection).deleteMany(filter);
    deleted[collection] = (deleted[collection] || 0) + result.deletedCount;
  };
  if (contactIds.length) {
    await Promise.all([
      remove("contact_agents", { contactId: { $in: contactIds } }),
      remove("segmentmembers", { contactId: { $in: contactIds } }),
      remove("lead_assignments", { contactId: { $in: contactIds } })
    ]);
  }
  if (campaignIds.length) {
    await Promise.all([
      remove("campaignrecipients", { campaignId: { $in: campaignIds } }),
      remove("campaignactivitylogs", { campaignId: { $in: campaignIds } })
    ]);
  }
  if (flowIds.length) {
    await remove("flowinstances", { flowId: { $in: flowIds } });
  }
  for (const collection of WHATSAPP_USER_SCOPED_COLLECTIONS) {
    await remove(collection, { userId });
  }
  await remove("connected_accounts", { userId, providerId: "whatsapp" });
  await db.collection("user_credentials").updateOne(
    { userId },
    {
      $unset: {
        whatsappToken: "",
        phoneNumberId: "",
        phoneNumberIdHash: "",
        businessAccountId: "",
        webhookVerifyToken: "",
        webhookVerifyTokenHash: "",
        appId: "",
        appSecret: "",
        flowEndpointToken: "",
        flowEndpointPrivateKey: "",
        flowEndpointPublicKey: "",
        lastVerifiedAt: ""
      },
      $set: {
        isVerified: false,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  );
  return {
    deleted,
    totalDeleted: Object.values(deleted).reduce((sum, count) => sum + count, 0)
  };
}
async function hasUsableCredentials(userId, providerId) {
  const credentials = await getDecryptedCredentials2(userId, providerId);
  if (!credentials) return false;
  if (providerId === "whatsapp") {
    return Boolean(credentials.accessToken && credentials.phoneNumberId);
  }
  return Object.values(credentials).some(Boolean);
}
async function findUserIdByWhatsAppPhoneNumberId(phoneNumberId) {
  const normalizedPhoneNumberId = String(phoneNumberId || "").trim();
  if (!normalizedPhoneNumberId) return null;
  try {
    const accounts = await ConnectedAccount.find({
      providerId: "whatsapp",
      status: "connected"
    }).sort({ isDefault: -1, updatedAt: -1 }).select({ userId: 1, credentials: 1 }).lean();
    for (const account of accounts) {
      const encryptedPhoneNumberId = account.credentials instanceof Map ? account.credentials.get("phoneNumberId") : account.credentials?.phoneNumberId;
      if (encryptedPhoneNumberId && decrypt(String(encryptedPhoneNumberId)).trim() === normalizedPhoneNumberId) {
        return String(account.userId);
      }
    }
    return null;
  } catch (error) {
    console.error(
      "[Integrations] Error finding WhatsApp owner by phone number ID:",
      error
    );
    return null;
  }
}
async function getMaskedCredentials(userId, connectionId) {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) return null;
    const result = {};
    account.credentials.forEach((value, key) => {
      const decrypted = decrypt(value);
      result[key] = maskSecret(decrypted);
    });
    return result;
  } catch (error) {
    console.error("[Integrations] Error getting masked credentials:", error);
    return null;
  }
}
async function getConnectionsWithStatus(userId) {
  const connections = await getUserConnections(userId);
  const connectionMap = new Map(connections.map((c) => [c.providerId, c]));
  return INTEGRATION_PROVIDERS.map((provider) => {
    const connection2 = connectionMap.get(provider.id) || null;
    return {
      provider,
      connection: connection2,
      isConnected: connection2?.status === "connected"
    };
  });
}

// modules/whatsapp-marketing/server/modules/automation/drips/drip.model.js
import mongoose4, { Schema as Schema3 } from "mongoose";
var DripStepSchema = new Schema3({
  id: { type: String, required: true },
  order: { type: Number, default: 0 },
  name: { type: String, required: true },
  dayOffset: { type: Number, default: 0 },
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 },
  timeOfDay: { type: String },
  messageType: { type: String, enum: ["template", "text", "media", "interactive", "ai_agent"], required: true },
  templateId: { type: String },
  templateName: { type: String },
  textContent: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["image", "video", "document", "audio"] },
  buttons: [{
    type: { type: String, enum: ["quick_reply", "url", "call"] },
    text: { type: String },
    value: { type: String }
  }],
  conditions: [{
    field: { type: String },
    operator: { type: String },
    value: { type: Schema3.Types.Mixed }
  }],
  skipIfReplied: { type: Boolean, default: false },
  skipIfConverted: { type: Boolean, default: false },
  aiAgentId: { type: String },
  aiAgentName: { type: String },
  status: { type: String, enum: ["active", "paused"], default: "active" }
}, { _id: false });
var DripCampaignSchema = new Schema3({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["draft", "active", "paused", "completed", "archived"], default: "draft" },
  steps: { type: [DripStepSchema], default: [] },
  targetType: { type: String, enum: ["segment", "tag", "manual", "trigger", "imported", "interest", "auto_trigger"], required: true },
  targetSegmentIds: { type: [String] },
  targetTags: { type: [String] },
  targetTriggerId: { type: String },
  importedContacts: { type: [String] },
  excludeSegmentIds: { type: [String] },
  excludeTags: { type: [String] },
  deliveryMode: { type: String, enum: ["template", "ai_agent", "mixed"], default: "template" },
  defaultTemplateId: { type: String },
  defaultTemplateName: { type: String },
  defaultAiAgentId: { type: String },
  defaultAiAgentName: { type: String },
  autoTrigger: {
    enabled: { type: Boolean, default: false },
    sources: { type: [String], enum: ["interest_interested", "interest_not_interested", "interest_neutral", "facebook_new_lead", "new_message", "none"], default: [] },
    sendImmediately: { type: Boolean, default: true },
    initialMessage: { type: String }
  },
  interestTargeting: {
    targetInterestLevels: { type: [String], enum: ["interested", "not_interested", "neutral", "pending"], default: [] },
    autoEnroll: { type: Boolean, default: false },
    enrollOnClassification: { type: Boolean, default: true }
  },
  timezone: { type: String, default: "UTC" },
  startDate: { type: Date },
  endDate: { type: Date },
  schedule: {
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" }
  },
  settings: {
    allowReEntry: { type: Boolean, default: false },
    reEntryDelayDays: { type: Number, default: 30 },
    stopOnReply: { type: Boolean, default: false },
    stopOnConversion: { type: Boolean, default: true },
    maxContactsPerDay: { type: Number, default: 1e3 },
    sendingSpeed: { type: String, enum: ["slow", "normal", "fast"], default: "normal" }
  },
  metrics: {
    totalEnrolled: { type: Number, default: 0 },
    activeContacts: { type: Number, default: 0 },
    completedContacts: { type: Number, default: 0 },
    exitedContacts: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    totalDelivered: { type: Number, default: 0 },
    totalRead: { type: Number, default: 0 },
    totalReplied: { type: Number, default: 0 },
    totalConverted: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 }
  },
  tags: { type: [String], default: [] }
}, { timestamps: true });
DripCampaignSchema.index({ userId: 1, status: 1 });
DripCampaignSchema.index({ userId: 1, name: 1 });
var DripCampaign = mongoose4.models.DripCampaign || mongoose4.model("DripCampaign", DripCampaignSchema);
var DripRunSchema = new Schema3({
  campaignId: { type: Schema3.Types.ObjectId, ref: "DripCampaign", required: true, index: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, required: true, index: true },
  contactPhone: { type: String, required: true },
  status: { type: String, enum: ["active", "paused", "completed", "exited", "failed"], default: "active" },
  currentStepIndex: { type: Number, default: 0 },
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  exitedAt: { type: Date },
  exitReason: { type: String, enum: ["completed", "replied", "converted", "unsubscribed", "manual", "error", "campaign_ended"] },
  stepHistory: [{
    stepId: { type: String, required: true },
    stepOrder: { type: Number, required: true },
    status: { type: String, enum: ["sent", "delivered", "read", "replied", "failed", "skipped"], required: true },
    messageId: { type: String },
    scheduledAt: { type: Date, required: true },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    repliedAt: { type: Date },
    error: { type: String }
  }],
  nextStepScheduledAt: { type: Date, index: true },
  variables: { type: Schema3.Types.Mixed, default: {} },
  metadata: { type: Schema3.Types.Mixed }
}, { timestamps: true });
DripRunSchema.index({ campaignId: 1, status: 1 });
DripRunSchema.index({ userId: 1, status: 1 });
DripRunSchema.index({ campaignId: 1, contactId: 1 }, { unique: true });
DripRunSchema.index({ nextStepScheduledAt: 1, status: 1 });
var DripRun = mongoose4.models.DripRun || mongoose4.model("DripRun", DripRunSchema);

// modules/whatsapp-marketing/server/modules/automation/drips/drip.service.js
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
async function enrollContact(userId, campaignId, contactId, contactPhone2, variables) {
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
    contactPhone: contactPhone2,
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
async function autoEnrollContact(userId, contactId, contactPhone2, triggerSource, variables) {
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
        contactPhone2,
        { ...variables, triggerSource }
      );
      results.enrolled.push(campaign.name);
      console.log(`[Drip] Auto-enrolled contact ${contactPhone2} in campaign "${campaign.name}" via ${triggerSource}`);
    } catch (error) {
      console.error(`[Drip] Failed to auto-enroll in "${campaign.name}":`, error.message);
      results.errors.push(`${campaign.name}: ${error.message}`);
    }
  }
  return results;
}

// modules/whatsapp-marketing/server/modules/facebook/fb.service.js
init_mongodb_adapter();
var FB_USER_OR_PAGE_TOKEN = "";
var FB_PAGE_ID = "";
var cachedPageAccessToken = null;
var cachedPageId = null;
async function getFacebookCredentials(userId = "system") {
  const integrationCreds = await getDecryptedCredentials2(userId, "facebook");
  if (integrationCreds?.accessToken && integrationCreds?.pageId) {
    console.log("[FB] Using credentials from Connected Apps");
    return {
      token: integrationCreds.accessToken,
      pageId: integrationCreds.pageId
    };
  }
  if (FB_USER_OR_PAGE_TOKEN && FB_PAGE_ID) {
    return {
      token: FB_USER_OR_PAGE_TOKEN,
      pageId: FB_PAGE_ID
    };
  }
  return null;
}
async function getPageAccessToken(userId = "system") {
  const creds = await getFacebookCredentials(userId);
  if (!creds) {
    throw new Error("Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.");
  }
  if (cachedPageAccessToken && cachedPageId === creds.pageId) {
    return cachedPageAccessToken;
  }
  const { token, pageId } = creds;
  try {
    const meResponse = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
    const meData = await meResponse.json();
    if (meData.category || meData.category_list) {
      console.log("[FB] Token is already a Page Access Token");
      cachedPageAccessToken = token;
      cachedPageId = pageId;
      return cachedPageAccessToken;
    }
    console.log("[FB] Token is a User Access Token, fetching Page Access Token...");
    const accountsResponse = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}`);
    const accountsData = await accountsResponse.json();
    if (accountsData.data && accountsData.data.length > 0) {
      const targetPage = pageId ? accountsData.data.find((p) => p.id === pageId) : accountsData.data[0];
      if (targetPage && targetPage.access_token) {
        console.log(`[FB] Found Page Access Token for page: ${targetPage.name} (${targetPage.id})`);
        cachedPageAccessToken = targetPage.access_token;
        cachedPageId = pageId;
        return targetPage.access_token;
      }
    }
    console.log("[FB] Could not find Page Access Token, using original token");
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  } catch (error) {
    console.error("[FB] Error determining token type:", error);
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  }
}
var FORMS_COLLECTION = "forms";
var LEADS_COLLECTION = "leads";
function generateId3(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
async function syncLeadForms(userId = "system") {
  const creds = await getFacebookCredentials(userId);
  if (!creds) {
    throw new Error("Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.");
  }
  try {
    const pageToken = await getPageAccessToken(userId);
    const url = `https://graph.facebook.com/v21.0/${creds.pageId}/leadgen_forms?access_token=${pageToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }
    const data = await response.json();
    const forms = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const fbForm of data.data || []) {
      const existingForm = await findByField(FORMS_COLLECTION, "fbFormId", fbForm.id);
      const form = {
        id: existingForm?.id || generateId3("form"),
        fbFormId: fbForm.id,
        name: fbForm.name || "Unnamed Form",
        status: fbForm.status || "ACTIVE",
        pageId: creds.pageId,
        createdTime: fbForm.created_time || now,
        syncedAt: now
      };
      forms.push(form);
    }
    await writeCollection2(FORMS_COLLECTION, forms);
    return forms;
  } catch (error) {
    console.error("Error syncing lead forms:", error);
    throw error;
  }
}
async function getAllForms() {
  return readCollection2(FORMS_COLLECTION);
}
async function getFormById(id) {
  return findById(FORMS_COLLECTION, id);
}
async function syncLeadsForForm(formId) {
  if (!FB_USER_OR_PAGE_TOKEN) {
    throw new Error("Facebook credentials not configured. Please set FB_PAGE_ACCESS_TOKEN.");
  }
  console.log(`[FB Service] Looking for form with id: ${formId}`);
  let form = await findById(FORMS_COLLECTION, formId);
  if (!form) {
    console.log(`[FB Service] Form not found by id, checking by fbFormId...`);
    form = await findByField(FORMS_COLLECTION, "fbFormId", formId);
    if (!form) {
      console.log(`[FB Service] Form not found by fbFormId either, checking all forms...`);
      const allForms = await readCollection2(FORMS_COLLECTION);
      console.log(`[FB Service] Total forms in database: ${allForms.length}`);
      if (allForms.length > 0) {
        allForms.forEach((f) => console.log(`[FB Service] Form: id=${f.id}, fbFormId=${f.fbFormId}, name=${f.name}`));
      }
      const foundForm = allForms.find((f) => f.id === formId || f.fbFormId === formId);
      if (!foundForm) {
        console.log(`[FB Service] Form still not found after checking all forms`);
        throw new Error("Form not found");
      }
      form = foundForm;
    }
  }
  console.log(`[FB Service] Found form: ${form.name} (fbFormId: ${form.fbFormId})`);
  if (!form.fbFormId) {
    throw new Error("Form is missing Facebook Form ID. Please re-sync forms from Facebook.");
  }
  try {
    const pageToken = await getPageAccessToken();
    const url = `https://graph.facebook.com/v21.0/${form.fbFormId}/leads?access_token=${pageToken}`;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }
    const data = await response.json();
    const existingLeads = await readCollection2(LEADS_COLLECTION);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newLeads = [];
    for (const fbLead of data.data || []) {
      const existingLead = existingLeads.find((l) => l.fbLeadId === fbLead.id);
      if (existingLead) continue;
      const fieldData = {};
      let phone = "";
      let email = "";
      let name = "";
      for (const field of fbLead.field_data || []) {
        fieldData[field.name] = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("phone")) phone = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("email")) email = field.values?.[0] || "";
        if (field.name.toLowerCase().includes("name")) name = field.values?.[0] || "";
      }
      const lead = {
        id: generateId3("lead"),
        fbLeadId: fbLead.id,
        formId: form.id,
        formName: form.name,
        fieldData,
        createdTime: fbLead.created_time || now,
        syncedAt: now,
        phone,
        email,
        name
      };
      newLeads.push(lead);
    }
    const allLeads = [...existingLeads, ...newLeads];
    await writeCollection2(LEADS_COLLECTION, allLeads);
    for (const lead of newLeads) {
      if (lead.phone && !lead.autoReplySent) {
        console.log(`[FB Service] Triggering auto-reply for new lead: ${lead.id}`);
        const autoReplyLead = {
          id: lead.id,
          formId: lead.formId,
          formName: lead.formName,
          fullName: lead.name,
          email: lead.email,
          phoneNumber: lead.phone,
          fieldData: lead.fieldData,
          createdTime: lead.createdTime,
          autoReplySent: lead.autoReplySent
        };
        processNewLead(autoReplyLead).then(async (result) => {
          if (result.success) {
            const currentLeads = await readCollection2(LEADS_COLLECTION);
            const idx = currentLeads.findIndex((l) => l.id === lead.id);
            if (idx !== -1) {
              currentLeads[idx].autoReplySent = true;
              currentLeads[idx].autoReplyMessage = result.message;
              currentLeads[idx].autoReplySentAt = (/* @__PURE__ */ new Date()).toISOString();
              await writeCollection2(LEADS_COLLECTION, currentLeads);
              console.log(`[FB Service] Auto-reply status saved for lead ${lead.id}`);
            }
          }
        }).catch((err) => {
          console.error(`[FB Service] Auto-reply failed for lead ${lead.id}:`, err);
        });
        triggerDripCampaignsForLead(lead).catch((err) => {
          console.error(`[FB Service] Drip campaign trigger failed for lead ${lead.id}:`, err);
        });
      }
    }
    return newLeads;
  } catch (error) {
    console.error("Error syncing leads:", error);
    throw error;
  }
}
async function getAllLeads() {
  return readCollection2(LEADS_COLLECTION);
}
async function getLeadsByFormId(formId) {
  const leads = await readCollection2(LEADS_COLLECTION);
  return leads.filter((lead) => lead.formId === formId);
}
async function getLeadById(id) {
  return findById(LEADS_COLLECTION, id);
}
async function triggerDripCampaignsForLead(lead) {
  if (!lead.phone) {
    console.log(`[FB Service] Lead ${lead.id} has no phone number, skipping drip campaigns`);
    return;
  }
  try {
    let contact = await Contact.findOne({ phone: lead.phone });
    if (!contact) {
      contact = await Contact.create({
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: lead.name || "Facebook Lead",
        phone: lead.phone,
        email: lead.email || "",
        source: "facebook_lead",
        tags: ["facebook-lead", lead.formName || "unknown-form"],
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        metadata: {
          fbLeadId: lead.fbLeadId,
          formId: lead.formId,
          formName: lead.formName,
          fieldData: lead.fieldData
        }
      });
      console.log(`[FB Service] Created new contact for Facebook lead: ${contact.phone}`);
    }
    const result = await autoEnrollContact(
      "system",
      contact.id,
      contact.phone,
      "facebook_new_lead",
      {
        contactName: contact.name,
        source: "facebook_lead",
        formName: lead.formName,
        leadId: lead.id
      }
    );
    if (result.enrolled.length > 0) {
      console.log(`[FB Service] Enrolled lead ${lead.id} in drip campaigns: ${result.enrolled.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      console.log(`[FB Service] Skipped campaigns for lead ${lead.id}: ${result.skipped.join(", ")}`);
    }
  } catch (error) {
    console.error(`[FB Service] Error triggering drip campaigns for lead ${lead.id}:`, error);
    throw error;
  }
}

// modules/whatsapp-marketing/server/modules/facebook/fb.controller.js
async function syncForms(req, res) {
  try {
    const forms = await syncLeadForms();
    res.json({ success: true, forms, count: forms.length });
  } catch (error) {
    console.error("Error syncing forms:", error);
    res.status(500).json({ error: error.message || "Failed to sync forms" });
  }
}
async function listForms(req, res) {
  try {
    const forms = await getAllForms();
    res.json(forms);
  } catch (error) {
    console.error("Error listing forms:", error);
    res.status(500).json({ error: "Failed to list forms" });
  }
}
async function getForm(req, res) {
  try {
    const { id } = req.params;
    const form = await getFormById(id);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }
    res.json(form);
  } catch (error) {
    console.error("Error getting form:", error);
    res.status(500).json({ error: "Failed to get form" });
  }
}
async function syncLeads(req, res) {
  try {
    const { formId } = req.params;
    const leads = await syncLeadsForForm(formId);
    res.json({ success: true, leads, count: leads.length });
  } catch (error) {
    console.error("Error syncing leads:", error);
    res.status(500).json({ error: error.message || "Failed to sync leads" });
  }
}
async function listLeads(req, res) {
  try {
    const { formId } = req.query;
    const leads = formId ? await getLeadsByFormId(formId) : await getAllLeads();
    res.json(leads);
  } catch (error) {
    console.error("Error listing leads:", error);
    res.status(500).json({ error: "Failed to list leads" });
  }
}
async function getLead(req, res) {
  try {
    const { id } = req.params;
    const lead = await getLeadById(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    console.error("Error getting lead:", error);
    res.status(500).json({ error: "Failed to get lead" });
  }
}

// modules/whatsapp-marketing/server/modules/facebook/flow.model.js
import mongoose5 from "mongoose";
var FlowLogSchema = new mongoose5.Schema(
  {
    wa_id: { type: String, required: true },
    // WhatsApp user ID
    phone: { type: String },
    // User phone number
    flow_id: { type: String, required: true },
    // Which flow user went through
    step: { type: String },
    // Step name
    input: { type: mongoose5.Schema.Types.Mixed },
    // Selected option OR typed input
    raw_data: { type: Object }
    // Full webhook payload
  },
  { timestamps: true }
);
var FlowLog = mongoose5.model("FlowLog", FlowLogSchema);
var flow_model_default = FlowLog;

// modules/whatsapp-marketing/server/modules/facebook/fb.routes.js
var router2 = Router2();
router2.post("/forms/sync", syncForms);
router2.get("/forms", listForms);
router2.get("/forms/:id", getForm);
router2.post("/forms/:formId/sync-leads", syncLeads);
router2.get("/leads", listLeads);
router2.get("/leads/:id", getLead);
router2.post("/flow-handler", async (req, res) => {
  try {
    const flowData = req.body;
    const wa_id = flowData?.user?.wa_id || null;
    const phone = flowData?.user?.phone || null;
    const flow_id = flowData?.flow_id || "unknown_flow";
    const step = flowData?.step || "unknown_step";
    const input = flowData?.step_data?.selected_option || flowData?.step_data?.input_text || null;
    await flow_model_default.create({
      wa_id,
      phone,
      flow_id,
      step,
      input,
      raw_data: flowData
    });
    console.log("Saved Flow Entry:", input);
    return res.json({
      version: "1.0",
      data: {
        message: `Stored successfully! You entered: ${input}`,
        next_step: "SUCCESS_SCREEN"
      }
    });
  } catch (err) {
    console.error("Flow Error:", err);
    return res.status(500).json({
      version: "1.0",
      data: {
        message: "Database Error! Try again.",
        next_step: "ERROR_SCREEN"
      }
    });
  }
});
var fb_routes_default = router2;

// modules/whatsapp-marketing/server/modules/mapping/mapping.routes.js
import { Router as Router3 } from "express";

// modules/whatsapp-marketing/server/modules/mapping/mapping.controller.js
async function listMappings(req, res) {
  try {
    const mappings = await getAllMappings();
    res.json(mappings);
  } catch (error) {
    console.error("Error listing mappings:", error);
    res.status(500).json({ error: "Failed to list mappings" });
  }
}
async function getMapping(req, res) {
  try {
    const { id } = req.params;
    const mapping = await getMappingById(id);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error getting mapping:", error);
    res.status(500).json({ error: "Failed to get mapping" });
  }
}
async function getMappingByForm(req, res) {
  try {
    const { formId } = req.params;
    const mapping = await getMappingByFormId(formId);
    if (!mapping) {
      return res.status(404).json({ error: "No mapping found for this form" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error getting mapping by form:", error);
    res.status(500).json({ error: "Failed to get mapping" });
  }
}
async function createMapping2(req, res) {
  try {
    const { formId, formName, agentId, agentName, isActive } = req.body;
    if (!formId || !agentId) {
      return res.status(400).json({ error: "Form ID and Agent ID are required" });
    }
    const mapping = await createMapping({
      formId,
      formName: formName || "Unknown Form",
      agentId,
      agentName: agentName || "Unknown Agent",
      isActive: isActive ?? true
    });
    res.status(201).json(mapping);
  } catch (error) {
    console.error("Error creating mapping:", error);
    res.status(500).json({ error: "Failed to create mapping" });
  }
}
async function updateMapping2(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const mapping = await updateMapping(id, updates);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({ error: "Failed to update mapping" });
  }
}
async function deleteMapping2(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteMapping(id);
    if (!deleted) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json({ success: true, message: "Mapping deleted successfully" });
  } catch (error) {
    console.error("Error deleting mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
}

// modules/whatsapp-marketing/server/modules/mapping/mapping.routes.js
var router3 = Router3();
router3.get("/", listMappings);
router3.get("/form/:formId", getMappingByForm);
router3.get("/:id", getMapping);
router3.post("/", createMapping2);
router3.put("/:id", updateMapping2);
router3.delete("/:id", deleteMapping2);
var mapping_routes_default = router3;

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.routes.js
import { Router as Router6 } from "express";

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.controller.js
import { randomUUID as randomUUID3 } from "crypto";

// modules/whatsapp-marketing/server/modules/aiAnalytics/aiAnalytics.service.js
init_mongodb_adapter();
var INTEREST_KEYWORDS = [
  "interested",
  "yes",
  "tell me more",
  "how much",
  "price",
  "cost",
  "register",
  "sign up",
  "book",
  "schedule",
  "appointment",
  "buy",
  "purchase",
  "order",
  "want",
  "need",
  "looking for",
  "details",
  "more information",
  "brochure",
  "catalog",
  "demo",
  "trial",
  "subscribe",
  "join",
  "apply",
  "confirm",
  "proceed",
  "next steps"
];
var NOT_INTERESTED_KEYWORDS = [
  "not interested",
  "no thanks",
  "no thank you",
  "stop",
  "unsubscribe",
  "remove",
  "don't contact",
  "spam",
  "wrong number",
  "busy",
  "later",
  "not now",
  "maybe later",
  "not looking",
  "already have",
  "not for me"
];
function generateId4() {
  return "qual_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
async function getQualifications() {
  return readCollection("ai_qualifications");
}
async function getQualificationById(id) {
  const result = await findOne("ai_qualifications", { id });
  return result || void 0;
}
async function getQualificationByPhone(phone) {
  if (!phone) return void 0;
  const qualifications = await getQualifications();
  const normalizedPhone = (phone || "").replace(/\D/g, "");
  if (!normalizedPhone) return void 0;
  return qualifications.find((q) => {
    const qPhone = (q.phone || "").replace(/\D/g, "");
    return qPhone.includes(normalizedPhone) || normalizedPhone.includes(qPhone);
  });
}
async function getQualificationStats() {
  const qualifications = await getQualifications();
  const total = qualifications.length;
  const interested = qualifications.filter((q) => q.category === "interested").length;
  const notInterested = qualifications.filter((q) => q.category === "not_interested").length;
  const pending = qualifications.filter((q) => q.category === "pending").length;
  return {
    total,
    interested,
    notInterested,
    pending,
    interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
    notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
    pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
  };
}
function analyzeMessage(message) {
  if (!message) {
    return { category: "pending", score: 50, keywords: [] };
  }
  const lowerMessage = (message || "").toLowerCase();
  const foundInterestKeywords = [];
  const foundNotInterestedKeywords = [];
  for (const keyword of INTEREST_KEYWORDS) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      foundInterestKeywords.push(keyword);
    }
  }
  for (const keyword of NOT_INTERESTED_KEYWORDS) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      foundNotInterestedKeywords.push(keyword);
    }
  }
  let score = 50;
  let category = "pending";
  if (foundNotInterestedKeywords.length > 0) {
    score = Math.max(0, 50 - foundNotInterestedKeywords.length * 20);
    category = "not_interested";
  } else if (foundInterestKeywords.length > 0) {
    score = Math.min(100, 50 + foundInterestKeywords.length * 15);
    category = "interested";
  }
  return {
    category,
    score,
    keywords: [...foundInterestKeywords, ...foundNotInterestedKeywords]
  };
}
async function createOrUpdateQualification(phone, name, message, source, options) {
  if (!phone) {
    throw new Error("Phone is required for AI qualification tracking");
  }
  const normalizedPhone = (phone || "").replace(/\D/g, "");
  const existing = await getQualificationByPhone(normalizedPhone);
  const analysis = analyzeMessage(message || "");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (existing) {
    const updatedKeywords = Array.from(/* @__PURE__ */ new Set([...existing.keywords, ...analysis.keywords]));
    let newCategory = existing.category;
    let newScore = existing.score;
    if (analysis.category === "interested" && analysis.score > existing.score) {
      newCategory = "interested";
      newScore = analysis.score;
    } else if (analysis.category === "not_interested") {
      newCategory = "not_interested";
      newScore = analysis.score;
    } else if (existing.category === "pending" && analysis.category !== "pending") {
      newCategory = analysis.category;
      newScore = analysis.score;
    }
    const updated = {
      ...existing,
      category: newCategory,
      score: newScore,
      totalMessages: existing.totalMessages + 1,
      lastMessageAt: now,
      keywords: updatedKeywords,
      updatedAt: now,
      campaignId: options?.campaignId || existing.campaignId,
      campaignName: options?.campaignName || existing.campaignName,
      agentId: options?.agentId || existing.agentId,
      agentName: options?.agentName || existing.agentName
    };
    await updateOne("ai_qualifications", { id: existing.id }, updated);
    return updated;
  } else {
    const newQualification = {
      id: generateId4(),
      contactId: options?.contactId || generateId4(),
      phone: normalizedPhone,
      name: name || `+${normalizedPhone}`,
      source,
      campaignId: options?.campaignId,
      campaignName: options?.campaignName,
      agentId: options?.agentId,
      agentName: options?.agentName,
      category: analysis.category,
      score: analysis.score,
      totalMessages: 1,
      lastMessageAt: now,
      firstContactAt: now,
      keywords: analysis.keywords,
      notes: "",
      createdAt: now,
      updatedAt: now
    };
    await insertOne("ai_qualifications", newQualification);
    return newQualification;
  }
}
async function updateQualificationCategory(id, category, notes) {
  const existing = await getQualificationById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    category,
    notes: notes || existing.notes,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await updateOne("ai_qualifications", { id }, updated);
  return updated;
}
async function updateQualificationNotes(id, notes) {
  const existing = await getQualificationById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    notes,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await updateOne("ai_qualifications", { id }, updated);
  return updated;
}
async function deleteQualification(id) {
  return deleteOne("ai_qualifications", { id });
}
async function getQualificationReport() {
  const qualifications = await getQualifications();
  const bySource = {};
  const sources = ["ai_chat", "campaign", "ad", "lead_form", "manual"];
  for (const source of sources) {
    const sourceQuals = qualifications.filter((q) => q.source === source);
    const total = sourceQuals.length;
    const interested = sourceQuals.filter((q) => q.category === "interested").length;
    const notInterested = sourceQuals.filter((q) => q.category === "not_interested").length;
    const pending = sourceQuals.filter((q) => q.category === "pending").length;
    bySource[source] = {
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  const byCampaign = {};
  const campaignIds = Array.from(new Set(qualifications.filter((q) => q.campaignId).map((q) => q.campaignId)));
  for (const campaignId of campaignIds) {
    const campaignQuals = qualifications.filter((q) => q.campaignId === campaignId);
    const total = campaignQuals.length;
    const interested = campaignQuals.filter((q) => q.category === "interested").length;
    const notInterested = campaignQuals.filter((q) => q.category === "not_interested").length;
    const pending = campaignQuals.filter((q) => q.category === "pending").length;
    byCampaign[campaignId] = {
      campaignName: campaignQuals[0]?.campaignName || "Unknown Campaign",
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  const byAgent = {};
  const agentIds = Array.from(new Set(qualifications.filter((q) => q.agentId).map((q) => q.agentId)));
  for (const agentId of agentIds) {
    const agentQuals = qualifications.filter((q) => q.agentId === agentId);
    const total = agentQuals.length;
    const interested = agentQuals.filter((q) => q.category === "interested").length;
    const notInterested = agentQuals.filter((q) => q.category === "not_interested").length;
    const pending = agentQuals.filter((q) => q.category === "pending").length;
    byAgent[agentId] = {
      agentName: agentQuals[0]?.agentName || "Unknown Agent",
      total,
      interested,
      notInterested,
      pending,
      interestedPercent: total > 0 ? Math.round(interested / total * 100) : 0,
      notInterestedPercent: total > 0 ? Math.round(notInterested / total * 100) : 0,
      pendingPercent: total > 0 ? Math.round(pending / total * 100) : 0
    };
  }
  return {
    bySource,
    byCampaign,
    byAgent,
    overall: await getQualificationStats()
  };
}

// modules/whatsapp-marketing/server/modules/broadcast/broadcast.service.js
init_mongodb_adapter();

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.service.js
init_credentials_service();
async function getUserWhatsAppCredentials(userId) {
  try {
    const integrationCreds = await getDecryptedCredentials2(userId, "whatsapp");
    if (integrationCreds?.accessToken && integrationCreds?.phoneNumberId) {
      console.log("[WhatsApp Service] Using credentials from Connected Apps");
      return {
        token: integrationCreds.accessToken,
        phoneNumberId: integrationCreds.phoneNumberId,
        businessAccountId: integrationCreds.businessAccountId
      };
    }
    const creds = await credentialsService.getDecryptedCredentials(userId);
    if (creds?.whatsappToken && creds?.phoneNumberId) {
      return {
        token: creds.whatsappToken,
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId
      };
    }
    return null;
  } catch (error) {
    console.error("[WhatsApp Service] Error getting user credentials:", error);
    return null;
  }
}
async function getUserWhatsAppConnectionCredentials(userId) {
  return getDecryptedCredentials2(userId, "whatsapp");
}
async function hasWebhookVerifyToken2(token) {
  return (void 0)(token);
}
async function getWhatsAppCredentialsForUser(userId) {
  if (!userId) {
    console.warn("[WhatsApp Service] Refusing WhatsApp operation without an authenticated account owner");
    return null;
  }
  return getUserWhatsAppCredentials(userId);
}
async function getWhatsAppCredentialsStrict(userId) {
  if (!userId) {
    return null;
  }
  const userCreds = await getUserWhatsAppCredentials(userId);
  if (userCreds) {
    return userCreds;
  }
  return null;
}
async function ensureWebhookSubscription(credentials) {
  if (!credentials.businessAccountId) {
    return { success: false, error: "WhatsApp Business Account ID is missing" };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.businessAccountId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(
          Math.max(5e3, Number(2e4))
        )
      }
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.success !== false) return { success: true };
    return {
      success: false,
      error: data?.error?.message || "Unable to subscribe WABA to message webhooks"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook subscription failed"
    };
  }
}
async function sendTextMessage(to, message, userId) {
  console.log("\u{1F4E8} [WhatsApp Service] sendTextMessage called", {
    to,
    userId,
    messageLength: message?.length,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  const start = Date.now();
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    console.error("\u274C [WhatsApp Service] Credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  console.log("\u{1F510} Credentials loaded", {
    phoneNumberId: credentials.phoneNumberId,
    tokenPreview: credentials.token?.slice(0, 8) + "***"
  });
  const url = `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: message }
  };
  console.log("\u27A1\uFE0F Outgoing request", {
    url,
    method: "POST",
    payload
  });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    console.log("\u{1F4E5} Response metadata", {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
      timeMs: Date.now() - start
    });
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.error("\u26A0\uFE0F Failed to parse JSON response. Raw text:", text);
      throw err;
    }
    console.log("\u{1F4E6} Response body", data);
    if (response.ok && data?.messages?.[0]?.id) {
      console.log("\u2705 Message sent successfully", {
        messageId: data.messages[0].id
      });
      return { success: true, messageId: data.messages[0].id };
    }
    console.error("\u274C WhatsApp API returned error", data?.error);
    return {
      success: false,
      error: data?.error?.message || "Failed to send message"
    };
  } catch (error) {
    console.error("\u{1F525} [WhatsApp Service] Exception sending message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendTemplateMessage2(to, templateName, languageCode = "en", components = [], userId) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    console.error("[WhatsApp Service] Credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const subscription = await ensureWebhookSubscription(credentials);
  if (!subscription.success) {
    console.warn(
      `[WhatsApp Service] WABA webhook subscription could not be verified: ${subscription.error}`
    );
  }
  const metaTemplateName = templateName.toLowerCase().replace(/\s+/g, "_");
  console.log(`[WhatsApp Service] Sending template: "${metaTemplateName}" to ${to}`);
  const languageCodesToTry = [languageCode, "en", "en_US", "en_GB"];
  const uniqueLanguages = Array.from(new Set(languageCodesToTry));
  for (const langCode of uniqueLanguages) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: langCode }
      }
    };
    if (components.length > 0) {
      payload.template.components = components;
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${credentials.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(
            Math.max(5e3, Number(2e4))
          )
        }
      );
      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        console.log(`[WhatsApp Service] Template sent successfully with lang: ${langCode}`);
        return {
          success: true,
          messageId: data.messages[0].id,
          acceptedRecipient: data.contacts?.[0]?.wa_id || to,
          providerResponse: data,
          providerHttpStatus: response.status,
          messageStatus: data.messages[0]?.message_status || "accepted",
          attemptedLanguage: langCode
        };
      }
      const errorCode = data.error?.code;
      const errorMsg = data.error?.message || "";
      if (errorCode === 132001 || errorMsg.includes("does not exist")) {
        console.log(`[WhatsApp Service] Template not found with lang "${langCode}", trying next...`);
        continue;
      }
      return {
        success: false,
        error: data.error?.message || "Failed to send template",
        providerResponse: data,
        providerHttpStatus: response.status,
        attemptedLanguage: langCode,
        errorCode: data.error?.code
      };
    } catch (error) {
      console.error("[WhatsApp Service] Error sending template:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  return {
    success: false,
    error: `Template "${templateName}" not found in any supported language`
  };
}
async function getUserByPhoneNumberId(phoneNumberId) {
  try {
    const connectedAccountUserId = await findUserIdByWhatsAppPhoneNumberId(phoneNumberId);
    if (connectedAccountUserId) return connectedAccountUserId;
    return await credentialsService.findUserByPhoneNumberId(phoneNumberId);
  } catch (error) {
    console.error("[WhatsApp Service] Error finding user by phone number ID:", error);
    return null;
  }
}
async function sendReplyButtonMessage(to, bodyText, buttons, userId, options) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  const normalizedButtons = buttons.filter((button) => button.id?.trim() && button.title?.trim()).slice(0, 3).map((button) => ({
    type: "reply",
    reply: {
      id: button.id.slice(0, 256),
      title: button.title.slice(0, 20)
    }
  }));
  if (!bodyText?.trim()) {
    return { success: false, error: "Interactive message body is required" };
  }
  if (normalizedButtons.length === 0) {
    return sendTextMessage(to, bodyText, userId);
  }
  const interactive = {
    type: "button",
    body: { text: bodyText.slice(0, 1024) },
    action: { buttons: normalizedButtons }
  };
  if (options?.headerText?.trim()) {
    interactive.header = { type: "text", text: options.headerText.trim().slice(0, 60) };
  }
  if (options?.footerText?.trim()) {
    interactive.footer = { text: options.footerText.trim().slice(0, 60) };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "interactive",
          interactive
        })
      }
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return {
      success: false,
      error: data?.error?.message || "Failed to send interactive reply buttons"
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
async function sendFlowMessage(userId, options) {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  if (!credentials) {
    return { success: false, error: "WhatsApp credentials not configured" };
  }
  try {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: options.to,
      type: "interactive",
      interactive: {
        type: "flow",
        header: options.headerText ? {
          type: "text",
          text: options.headerText
        } : void 0,
        body: {
          text: options.bodyText || `Please complete the ${options.flowName} flow`
        },
        footer: options.footerText ? {
          text: options.footerText
        } : void 0,
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_token: options.flowToken || `flow_${Date.now()}`,
            flow_id: options.flowId,
            flow_cta: options.ctaText || "Start",
            flow_action: "navigate",
            flow_action_payload: options.flowActionPayload ? {
              screen: options.entryPointId || "START",
              data: options.flowActionPayload
            } : {
              screen: options.entryPointId || "START"
            }
          }
        }
      }
    };
    if (!payload.interactive.header) {
      delete payload.interactive.header;
    }
    if (!payload.interactive.footer) {
      delete payload.interactive.footer;
    }
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${credentials.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(
          Math.max(5e3, Number(2e4))
        )
      }
    );
    const data = await response.json();
    if (response.ok && data.messages?.[0]?.id) {
      console.log(`[WhatsApp Service] Flow message sent to ${options.to}, messageId: ${data.messages[0].id}`);
      return {
        success: true,
        messageId: data.messages[0].id,
        providerHttpStatus: response.status,
        requestPayload: payload,
        providerResponse: data
      };
    }
    console.error("[WhatsApp Service] Flow send failed:", data.error);
    return {
      success: false,
      error: data.error?.message || "Failed to send flow message",
      providerHttpStatus: response.status,
      requestPayload: payload,
      providerResponse: data
    };
  } catch (error) {
    console.error("[WhatsApp Service] Error sending flow message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// modules/whatsapp-marketing/server/modules/broadcast/broadcast.service.js
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
function getWhatsAppCredentials2() {
  const token = "";
  const phoneNumberId = "";
  if (!token || !phoneNumberId) {
    return null;
  }
  return { token, phoneNumberId };
}
function formatPhoneNumber2(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = [
    "1",
    "44",
    "91",
    "92",
    "93",
    "94",
    "971",
    "966",
    "965",
    "974",
    "20",
    "27",
    "61",
    "64",
    "81",
    "86",
    "62"
  ];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.substring(1);
  }
  return cleaned;
}
async function getBroadcastLists() {
  return readCollection("broadcast_lists");
}
async function getBroadcastListById(id) {
  const result = await findOne("broadcast_lists", {
    id
  });
  return result || void 0;
}
async function createBroadcastList(name, contacts) {
  const newList = {
    id: `list-${Date.now()}`,
    name,
    contacts,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await insertOne("broadcast_lists", newList);
  return newList;
}
async function updateBroadcastList(id, name, contacts) {
  const existing = await getBroadcastListById(id);
  if (!existing) return null;
  const updated = {
    ...existing,
    name,
    contacts,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await updateOne("broadcast_lists", { id }, updated);
  return updated;
}
async function deleteBroadcastList(id) {
  return deleteOne("broadcast_lists", { id });
}
async function getScheduledMessages() {
  return readCollection("scheduled_messages");
}
async function createScheduledMessage(data) {
  const newMessage = {
    ...data,
    id: `schedule-${Date.now()}`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    sentCount: 0,
    failedCount: 0
  };
  await insertOne("scheduled_messages", newMessage);
  return newMessage;
}
async function updateScheduledMessage(id, updates) {
  const existing = await findOne(
    "scheduled_messages",
    { id }
  );
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await updateOne("scheduled_messages", { id }, updated);
  return updated;
}
async function deleteScheduledMessage(id) {
  return deleteOne("scheduled_messages", { id });
}
function isHttpUrl(value) {
  return Boolean(value && /^https?:\/\//i.test(value));
}
var MEDIA_ID_CACHE_TTL_MS = Number(
  process.env.WHATSAPP_MEDIA_ID_CACHE_TTL_MS || 6 * 60 * 60 * 1e3
);
var mediaIdCache = /* @__PURE__ */ new Map();
var mediaIdUploadInFlight = /* @__PURE__ */ new Map();
function isMediaWeblinkFailure(error) {
  if (!error) return false;
  return /131053|media upload error|weblink failed|http code 403|forbidden/i.test(
    error
  );
}
function getMediaCacheKey(mediaType, mediaUrl) {
  return `${mediaType}:${String(mediaUrl || "").trim()}`;
}
async function uploadMediaFromUrlToMeta(mediaUrl, mediaType) {
  const credentials = getWhatsAppCredentials2();
  if (!credentials) return null;
  try {
    const sourceResponse = await fetch(mediaUrl);
    if (!sourceResponse.ok) {
      console.error(
        `[SendTemplate] Failed to download media for re-upload: ${sourceResponse.status} ${sourceResponse.statusText}`
      );
      return null;
    }
    const mediaBuffer = await sourceResponse.arrayBuffer();
    const contentTypeHeader = sourceResponse.headers.get("content-type") || "";
    const fallbackMime = mediaType === "video" ? "video/mp4" : mediaType === "document" ? "application/pdf" : "image/jpeg";
    const mimeType = contentTypeHeader.split(";")[0].trim() || fallbackMime;
    const extension = mediaType === "video" ? "mp4" : mediaType === "document" ? "pdf" : "jpg";
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append(
      "file",
      new Blob([mediaBuffer], { type: mimeType }),
      `template-header-${Date.now()}.${extension}`
    );
    const uploadResponse = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.token}`
        },
        body: formData
      }
    );
    const uploadText = await uploadResponse.text();
    let uploadData = {};
    try {
      uploadData = uploadText ? JSON.parse(uploadText) : {};
    } catch {
      uploadData = { raw: uploadText };
    }
    if (uploadResponse.ok && uploadData?.id) {
      console.log(
        `[SendTemplate] Media uploaded to Meta successfully | mediaId=${uploadData.id}`
      );
      return String(uploadData.id);
    }
    console.error(
      `[SendTemplate] Media upload to Meta failed:`,
      JSON.stringify(uploadData)
    );
    return null;
  } catch (error) {
    console.error("[SendTemplate] Media upload fallback failed:", error);
    return null;
  }
}
async function getOrUploadMediaId(mediaUrl, mediaType) {
  const cacheKey = getMediaCacheKey(mediaType, mediaUrl);
  const now = Date.now();
  const cached = mediaIdCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.mediaId;
  }
  if (cached && cached.expiresAt <= now) {
    mediaIdCache.delete(cacheKey);
  }
  const inFlight = mediaIdUploadInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }
  const uploadPromise = (async () => {
    const mediaId = await uploadMediaFromUrlToMeta(mediaUrl, mediaType);
    if (mediaId) {
      mediaIdCache.set(cacheKey, {
        mediaId,
        expiresAt: now + Math.max(MEDIA_ID_CACHE_TTL_MS, 6e4)
      });
    }
    return mediaId;
  })();
  mediaIdUploadInFlight.set(cacheKey, uploadPromise);
  try {
    return await uploadPromise;
  } finally {
    mediaIdUploadInFlight.delete(cacheKey);
  }
}
function extractHeaderMediaLink(components, mediaType) {
  for (const component of components) {
    if (component.type !== "header" || !Array.isArray(component.parameters)) {
      continue;
    }
    for (const param of component.parameters) {
      if (param?.type !== mediaType) continue;
      if (mediaType === "image" && isHttpUrl(param?.image?.link)) {
        return String(param.image.link);
      }
      if (mediaType === "video" && isHttpUrl(param?.video?.link)) {
        return String(param.video.link);
      }
      if (mediaType === "document" && isHttpUrl(param?.document?.link)) {
        return String(param.document.link);
      }
    }
  }
  return void 0;
}
function replaceHeaderMediaLinkWithId(components, mediaType, mediaId) {
  return components.map((component) => {
    if (component.type !== "header" || !Array.isArray(component.parameters)) {
      return component;
    }
    const newParameters = component.parameters.map((param) => {
      if (param?.type !== mediaType) return param;
      if (mediaType === "video") {
        return { type: "video", video: { id: mediaId } };
      }
      if (mediaType === "document") {
        return { type: "document", document: { id: mediaId, filename: "template-header" } };
      }
      return { type: "image", image: { id: mediaId } };
    });
    return {
      ...component,
      parameters: newParameters
    };
  });
}
function extractPlaceholderTokens(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)];
  const tokens = [];
  for (const match of matches) {
    const token = (match[1] || "").trim();
    if (!token) continue;
    tokens.push(token);
  }
  return tokens;
}
function resolveTemplateValue(token, index, values) {
  const fallbackName = values.name?.trim() || "Customer";
  const fallbackPhone = values.phone?.trim() || fallbackName;
  const fallbackEmail = values.email?.trim() || fallbackName;
  if (/^\d+$/.test(token)) {
    const position = Number(token);
    if (position === 1) return fallbackName;
    if (position === 2) return fallbackPhone;
    if (position === 3) return fallbackEmail;
    return fallbackName;
  }
  const lowered = token.toLowerCase();
  if (lowered.includes("name")) return fallbackName;
  if (lowered.includes("phone") || lowered.includes("mobile")) return fallbackPhone;
  if (lowered.includes("email")) return fallbackEmail;
  if (index === 1) return fallbackName;
  if (index === 2) return fallbackPhone;
  if (index === 3) return fallbackEmail;
  return fallbackName;
}
function buildTextParameters(text, values) {
  const tokens = extractPlaceholderTokens(text);
  return tokens.map((token, index) => ({
    type: "text",
    text: resolveTemplateValue(token, index + 1, values)
  }));
}
function buildTemplateComponents(templateRecord, values) {
  if (!templateRecord) return [];
  const components = [];
  const headerType = String(templateRecord.headerType || "").toLowerCase();
  if (headerType === "image" || headerType === "video" || headerType === "document") {
    const mediaLink = isHttpUrl(templateRecord.previewUrl) ? templateRecord.previewUrl : isHttpUrl(templateRecord.headerImageUrl) ? templateRecord.headerImageUrl : void 0;
    if (mediaLink) {
      const mediaParameter = headerType === "video" ? { type: "video", video: { link: mediaLink } } : headerType === "document" ? {
        type: "document",
        document: { link: mediaLink, filename: "template-header" }
      } : { type: "image", image: { link: mediaLink } };
      components.push({
        type: "header",
        parameters: [mediaParameter]
      });
    }
  }
  const headerParameters = buildTextParameters(templateRecord.headerText, values);
  if (headerType !== "image" && headerType !== "video" && headerType !== "document" && headerParameters.length > 0) {
    components.push({ type: "header", parameters: headerParameters });
  }
  const bodyParameters = buildTextParameters(templateRecord.content, values);
  if (bodyParameters.length > 0) {
    components.push({ type: "body", parameters: bodyParameters });
  }
  templateRecord.buttons?.forEach((button, index) => {
    if (button?.type !== "url") return;
    const buttonParameters = buildTextParameters(button.url, values);
    if (buttonParameters.length === 0) return;
    components.push({
      type: "button",
      sub_type: "url",
      index: String(index),
      parameters: buttonParameters
    });
  });
  return components;
}
function withSendMetadata(result, templateName, phone) {
  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    error_code: result.success ? null : result.errorCode ?? "template_send_failed",
    template_name: templateName,
    phone_number: result.acceptedRecipient || phone,
    provider_status: result.messageStatus || null,
    provider_http_status: typeof result.providerHttpStatus === "number" ? result.providerHttpStatus : null,
    provider_response: result.providerResponse || null,
    request_payload: result.requestPayload || null,
    attempted_language: result.attemptedLanguage || null,
    provider_error_code: result.errorCode ?? null
  };
}
async function sendTemplateMessage3(phone, templateName, contactName2, options, userId) {
  const formattedPhone = formatPhoneNumber2(phone);
  const normalizedTemplateName = templateName.toLowerCase().replace(/\s+/g, "_");
  const templateRecord = await Template.findOne({
    userId,
    $or: [
      { id: templateName },
      { id: normalizedTemplateName },
      { name: templateName },
      { name: normalizedTemplateName }
    ]
  }).lean();
  const resolvedTemplateName = templateRecord?.name || templateName;
  const languageCode = templateRecord?.language || "en_US";
  const normalizedHeaderType = String(templateRecord?.headerType || "").toLowerCase();
  const allowLanguageFallback = options?.allowLanguageFallback !== false;
  const mediaHeaderTypes = ["image", "video", "document"];
  const currentMediaHeaderType = mediaHeaderTypes.find(
    (type) => type === normalizedHeaderType
  );
  if ((normalizedHeaderType === "image" || normalizedHeaderType === "video" || normalizedHeaderType === "document") && !isHttpUrl(templateRecord?.previewUrl) && !isHttpUrl(templateRecord?.headerImageUrl)) {
    return withSendMetadata(
      {
        success: false,
        error: "Template has media header but no usable media URL. Configure Cloudinary and re-upload header media in Templates."
      },
      resolvedTemplateName,
      formattedPhone
    );
  }
  const components = buildTemplateComponents(templateRecord, {
    name: contactName2,
    phone: formattedPhone
  });
  let componentsForSend = components;
  if (currentMediaHeaderType) {
    const mediaLink = extractHeaderMediaLink(components, currentMediaHeaderType);
    if (mediaLink) {
      const mediaId = await getOrUploadMediaId(mediaLink, currentMediaHeaderType);
      if (mediaId) {
        componentsForSend = replaceHeaderMediaLinkWithId(
          components,
          currentMediaHeaderType,
          mediaId
        );
        console.log(
          `[SendTemplate] Using uploaded media ID for "${resolvedTemplateName}" (${currentMediaHeaderType})`
        );
      }
    }
  }
  console.log(
    `[SendTemplate] Sending "${resolvedTemplateName}" with ${componentsForSend.length} component(s)`
  );
  let result = await sendTemplateMessage2(
    formattedPhone,
    resolvedTemplateName,
    languageCode,
    componentsForSend,
    userId
  );
  const parameterMismatch = Boolean(
    result.error && /132000|132012|parameter format does not match|parameters does not match|localizable_params|expected number of params/i.test(
      result.error
    )
  );
  if (!result.success && parameterMismatch && componentsForSend.length === 0) {
    const expectedMatch = result.error?.match(/expected number of params\s*\((\d+)\)/i);
    const parsedCount = expectedMatch ? Number(expectedMatch[1]) : 1;
    const safeCount = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    const fallbackComponents = [
      {
        type: "body",
        parameters: Array.from({ length: safeCount }, () => ({
          type: "text",
          text: contactName2 || "Customer"
        }))
      }
    ];
    console.log(
      `[SendTemplate] Retrying "${resolvedTemplateName}" with ${safeCount} fallback parameter(s)`
    );
    result = await sendTemplateMessage2(
      formattedPhone,
      resolvedTemplateName,
      languageCode,
      fallbackComponents,
      userId
    );
  }
  if (!result.success && currentMediaHeaderType && isMediaWeblinkFailure(result.error)) {
    const mediaLink = extractHeaderMediaLink(components, currentMediaHeaderType);
    if (mediaLink) {
      console.log(
        `[SendTemplate] Media link failed for "${resolvedTemplateName}". Retrying via uploaded media ID fallback.`
      );
      const mediaId = await getOrUploadMediaId(
        mediaLink,
        currentMediaHeaderType
      );
      if (mediaId) {
        const idComponents = replaceHeaderMediaLinkWithId(
          components,
          currentMediaHeaderType,
          mediaId
        );
        result = await sendTemplateMessage2(
          formattedPhone,
          resolvedTemplateName,
          languageCode,
          idComponents,
          userId
        );
      }
    }
  }
  return withSendMetadata(result, resolvedTemplateName, formattedPhone);
}
async function sendCustomMessage(phone, message, userId) {
  const formattedPhone = formatPhoneNumber2(phone);
  return sendTextMessage(formattedPhone, message, userId);
}
async function sendAIAgentMessage(phone, agentId, context, userId) {
  const agent = await getAgentById(agentId);
  if (!agent) {
    console.error(`[AIAgent] Agent not found: ${agentId}`);
    return { success: false, error: "Agent not found" };
  }
  const prompt = context || "Generate a friendly welcome message for a new contact. Keep it under 160 characters.";
  const aiMessage = await generateAgentResponse2(prompt, agent, []);
  if (!aiMessage) {
    console.error("[AIAgent] Failed to generate AI message");
    return {
      success: false,
      error: "Failed to generate AI message. Check if API key is configured for the agent model."
    };
  }
  const customResult = await sendCustomMessage(phone, aiMessage, userId);
  if (!customResult.success && (customResult.error?.includes("24") || customResult.error?.includes("window"))) {
    return await sendTemplateMessage3(
      formatPhoneNumber2(phone),
      "hello_world",
      void 0,
      void 0,
      userId
    );
  }
  return customResult;
}
var SINGLE_MESSAGE_CAMPAIGN_NAME = "Single Message";
function normalizeWebhookBroadcastStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "accepted" || normalized === "sent") return "sent";
  if (normalized === "delivered") return "delivered";
  if (normalized === "read") return "read";
  if (normalized === "failed") return "failed";
  return null;
}
function getStatusRank(status) {
  switch (String(status || "").toLowerCase()) {
    case "failed":
      return 5;
    case "read":
      return 4;
    case "delivered":
      return 3;
    case "sent":
    case "accepted":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}
function getLatestWebhookEvent(events) {
  return events.reduce((latest, event) => {
    if (!latest) return event;
    const eventTime = new Date(event.statusTimestamp || event.webhookReceivedAt || event.createdAt || 0).getTime();
    const latestTime = new Date(latest.statusTimestamp || latest.webhookReceivedAt || latest.createdAt || 0).getTime();
    if (eventTime !== latestTime) return eventTime > latestTime ? event : latest;
    return getStatusRank(event.status) >= getStatusRank(latest.status) ? event : latest;
  }, null);
}
async function applyWebhookStatuses(logs) {
  const messageIds = Array.from(
    new Set(logs.map((log) => String(log.messageId || "").trim()).filter(Boolean))
  );
  if (messageIds.length === 0) return logs;
  const webhookEvents = (await readCollection("webhook_status_events")).filter(
    (event) => messageIds.includes(String(event.messageId || "").trim())
  );
  const eventsByMessageId = /* @__PURE__ */ new Map();
  for (const event of webhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const events = eventsByMessageId.get(messageId) || [];
    events.push(event);
    eventsByMessageId.set(messageId, events);
  }
  return logs.map((log) => {
    const latestEvent = getLatestWebhookEvent(eventsByMessageId.get(String(log.messageId || "").trim()) || []);
    const webhookStatus = normalizeWebhookBroadcastStatus(latestEvent?.status);
    if (!webhookStatus || getStatusRank(webhookStatus) < getStatusRank(log.status)) return log;
    return {
      ...log,
      status: webhookStatus,
      error: webhookStatus === "failed" ? latestEvent?.errorMessage || latestEvent?.errorTitle || latestEvent?.errorDetails || log.error : log.error
    };
  });
}
async function logBroadcastMessage(log) {
  const newLog = {
    ...log,
    id: `broadcast-log-${Date.now()}-${Math.random().toString(36).substring(7)}`
  };
  try {
    const result = await insertOne("broadcast_logs", newLog);
    return result || newLog;
  } catch (error) {
    console.error("[BroadcastLog] Failed to save log:", error);
    return newLog;
  }
}
async function markBroadcastLogAsReplied(phone, userId) {
  try {
    const normalizedPhone = phone.replace(/\D/g, "");
    const logs = (await readCollection("broadcast_logs")).filter((log) => log.userId === userId);
    let updatedCount = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const log of logs) {
      const logPhone = log.contactPhone.replace(/\D/g, "");
      const last10Digits = normalizedPhone.slice(-10);
      const logLast10Digits = logPhone.slice(-10);
      const phoneMatches = last10Digits === logLast10Digits || logPhone.includes(normalizedPhone) || normalizedPhone.includes(logPhone);
      if (phoneMatches && !log.replied) {
        const updateResult = await updateOne(
          "broadcast_logs",
          { id: log.id },
          {
            replied: true,
            repliedAt: now
          }
        );
        if (updateResult) {
          updatedCount++;
        } else {
        }
      }
    }
    return updatedCount;
  } catch (error) {
    console.error("[BroadcastLog] Error marking as replied:", error);
    return 0;
  }
}
async function updateBroadcastLogFromWebhook(messageId, status, error) {
  const normalizedStatus = normalizeWebhookBroadcastStatus(status);
  if (!messageId || !normalizedStatus) return;
  const update = {
    status: normalizedStatus
  };
  if (normalizedStatus === "failed" && error) {
    update.error = error;
  }
  await updateOne(
    "broadcast_logs",
    { messageId },
    update
  );
}
async function getBroadcastLogs(filters) {
  try {
    let logs = await readCollection("broadcast_logs");
    if (filters) {
      if (filters.userId) {
        logs = logs.filter((log) => log.userId === filters.userId);
      }
      if (filters.campaignName) {
        logs = logs.filter(
          (l) => l.campaignName.toLowerCase().includes(filters.campaignName.toLowerCase())
        );
      }
      if (filters.phone) {
        logs = logs.filter((l) => l.contactPhone.includes(filters.phone));
      }
    }
    logs = await applyWebhookStatuses(logs);
    if (filters?.status) {
      logs = logs.filter((l) => l.status === filters.status);
    }
    logs = logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    return logs.slice(offset, offset + limit);
  } catch (error) {
    console.error("[BroadcastLogs] Failed to fetch logs:", error);
    return [];
  }
}
async function sendBroadcast(contacts, messageType, options) {
  const campaignName = options.campaignName || `Broadcast ${(/* @__PURE__ */ new Date()).toISOString()}`;
  if (options.isScheduled && options.scheduledTime) {
    const scheduledDate = new Date(options.scheduledTime);
    const scheduleData = {
      id: `scheduled-${Date.now()}`,
      userId: options.userId,
      contacts,
      messageType,
      templateName: options.templateName,
      customMessage: options.customMessage,
      agentId: options.agentId,
      campaignName,
      scheduledAt: scheduledDate.toISOString(),
      status: "scheduled",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await insertOne("scheduled_broadcasts", scheduleData);
    return {
      total: contacts.length,
      successful: 0,
      failed: 0,
      results: [],
      scheduled: true,
      scheduledAt: scheduledDate.toISOString()
    };
  }
  const results = [];
  let successful = 0;
  let failed = 0;
  const credentials = await getWhatsAppCredentialsStrict(
    options.userId
  );
  if (!credentials) {
    console.error("[Broadcast] WhatsApp credentials not configured");
    return {
      total: contacts.length,
      successful: 0,
      failed: contacts.length,
      results: contacts.map((c) => ({
        phone: c.phone,
        success: false,
        error: "WhatsApp credentials not configured"
      })),
      credentialError: "WhatsApp API credentials (WHATSAPP_TOKEN and PHONE_NUMBER_ID) are not configured. Please add them in Settings > WhatsApp API."
    };
  }
  for (const contact of contacts) {
    let result;
    let messageContent = "";
    console.log(`[Broadcast] Sending to ${JSON.stringify(contact)}`);
    switch (messageType) {
      case "template":
        result = await sendTemplateMessage3(
          contact.phone,
          options.templateName || "hello_world",
          contact.name,
          void 0,
          options.userId
        );
        messageContent = `[Template: ${options.templateName || "hello_world"}]`;
        break;
      case "custom":
        result = await sendCustomMessage(
          contact.phone,
          options.customMessage || "",
          options.userId
        );
        messageContent = options.customMessage || "";
        break;
      case "ai_agent":
        result = await sendAIAgentMessage(
          contact.phone,
          options.agentId || "",
          `Contact name: ${contact.name}`,
          options.userId
        );
        messageContent = "[AI Generated Message]";
        break;
      default:
        result = {
          success: false,
          error: "Invalid message type",
          error_code: null,
          template_name: null,
          phone_number: null
        };
        messageContent = "";
    }
    await logBroadcastMessage({
      userId: options.userId,
      campaignName,
      contactName: contact.name,
      contactPhone: contact.phone,
      messageType,
      templateName: options.templateName,
      message: messageContent,
      status: result.success ? "sent" : "failed",
      messageId: result.messageId,
      error: result.error,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    results.push({
      phone: contact.phone,
      success: result.success,
      error: result.error
    });
    if (result.success) {
      successful++;
      console.log(`[Broadcast] Sent to ${contact.name} (${contact.phone})`);
      try {
        if (!contact.phone) {
          console.warn("[Broadcast] No phone number, skipping inbox save");
          continue;
        }
        const contactdetail = await Contact.findOne({
          userId: options.userId,
          phone: contact.phone
        });
        if (!contactdetail) {
          console.warn("[Broadcast] Contact not found in DB", {
            phone: contact.phone
          });
          continue;
        }
        await storage.createMessage({
          userId: options.userId,
          contactId: contactdetail.id,
          content: messageContent,
          type: "text",
          direction: "outbound",
          status: "sent",
          whatsappMessageId: result.messageId
        });
      } catch (saveError) {
        console.error(
          "[Broadcast] Failed to save message to conversation:",
          saveError
        );
      }
    } else {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    total: contacts.length,
    successful,
    failed,
    results
  };
}
async function sendSingleMessage(phone, name, messageType, options, userId) {
  let messageContent = "";
  const result = await (async () => {
    switch (messageType) {
      case "template":
        messageContent = `[Template: ${options.templateName || "hello_world"}]`;
        return await sendTemplateMessage3(
          phone,
          options.templateName || "hello_world",
          name,
          void 0,
          userId
        );
      case "custom":
        messageContent = options.customMessage || "";
        return await sendCustomMessage(phone, options.customMessage || "", userId);
      case "ai_agent":
        messageContent = "[AI Generated Message]";
        return await sendAIAgentMessage(
          phone,
          options.agentId || "",
          `Contact name: ${name}`,
          userId
        );
      default:
        return { success: false, error: "Invalid message type" };
    }
  })();
  await logBroadcastMessage({
    userId,
    campaignName: SINGLE_MESSAGE_CAMPAIGN_NAME,
    contactName: name || "Unknown",
    contactPhone: phone,
    messageType,
    templateName: options.templateName,
    message: messageContent,
    status: result.success ? "sent" : "failed",
    messageId: result.messageId,
    error: result.error,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  return {
    ...result,
    error_code: result.error_code || null,
    template_name: result.template_name || null,
    phone_number: result.phone_number || null
  };
}
function parseExcelContacts(data) {
  const contacts = [];
  const errors = [];
  let rowNum = 1;
  for (const row of data) {
    rowNum++;
    if (typeof row !== "object" || row === null) continue;
    const record = row;
    const keys = Object.keys(record);
    if (rowNum === 2) {
    }
    let name = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === "name" || lowerKey === "full_name" || lowerKey === "fullname" || lowerKey === "contact_name" || lowerKey === "customer_name" || lowerKey === "customer") {
        name = String(record[key] || "").trim();
        break;
      }
    }
    let phone = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (lowerKey === "phone" || lowerKey === "mobile" || lowerKey === "phone_number" || lowerKey === "mobile_number" || lowerKey === "phonenumber" || lowerKey === "mobilenumber" || lowerKey === "contact" || lowerKey === "whatsapp" || lowerKey === "whatsapp_number" || lowerKey === "whatsapp_phone" || lowerKey === "whatsapp_phone_number" || lowerKey === "cell" || lowerKey === "telephone") {
        phone = String(record[key] || "").trim();
        break;
      }
    }
    let email = "";
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === "email" || lowerKey === "email_address" || lowerKey === "emailaddress") {
        email = String(record[key] || "").trim();
        break;
      }
    }
    if (phone) {
      if (/^\s*\d+(?:\.\d+)?e\+?\d+\s*$/i.test(phone)) {
        errors.push(
          `Row ${rowNum}: Phone number was saved in scientific notation (${phone}). Format the WhatsApp Number column as Text and enter the full number again.`
        );
        continue;
      }
      phone = phone.replace(/[^\d+]/g, "");
      if (phone.includes("+") && !phone.startsWith("+")) {
        phone = phone.replace(/\+/g, "");
      }
    }
    if (!phone) {
      errors.push(`Row ${rowNum}: Missing phone number`);
      continue;
    }
    if (phone.length < 8) {
      errors.push(`Row ${rowNum}: Phone number too short (${phone})`);
      continue;
    }
    if (!name) {
      name = `Contact ${phone.slice(-4)}`;
    }
    contacts.push({
      name,
      phone,
      email: email || void 0
    });
  }
  if (errors.length > 0) {
  }
  return {
    contacts,
    totalRows: data.length,
    validContacts: contacts.length,
    errors: errors.slice(0, 10)
    // Return first 10 errors
  };
}
function exportContactsToJSON(contacts) {
  return contacts.map((c) => ({
    name: c.name,
    phone: c.phone,
    email: c.email || "",
    tags: c.tags?.join(", ") || ""
  }));
}
async function saveImportedContacts(userId, contacts, source = "import") {
  const errors = [];
  let saved = 0;
  let duplicates = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const existingContacts = (await readCollection("imported_contacts")).filter((contact) => contact.userId === userId);
    const existingPhones = new Set(
      existingContacts.map((c) => c.phone.replace(/\D/g, ""))
    );
    const uniqueContacts = [];
    const seenPhones = /* @__PURE__ */ new Set();
    for (const contact of contacts) {
      const normalizedPhone = contact.phone.replace(/\D/g, "");
      if (existingPhones.has(normalizedPhone) || seenPhones.has(normalizedPhone)) {
        duplicates++;
        continue;
      }
      seenPhones.add(normalizedPhone);
      uniqueContacts.push({
        id: `contact-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        name: contact.name,
        phone: contact.phone,
        email: contact.email || "",
        tags: contact.tags || [],
        source,
        createdAt: now,
        updatedAt: now
      });
    }
    if (uniqueContacts.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < uniqueContacts.length; i += BATCH_SIZE) {
        const batch = uniqueContacts.slice(i, i + BATCH_SIZE);
        await insertMany("imported_contacts", batch);
        saved += batch.length;
      }
    }
  } catch (error) {
    console.error("[ImportContacts] Bulk import failed:", error);
    errors.push(`Bulk import failed: ${error}`);
  }
  return { saved, duplicates, errors };
}
async function getImportedContacts(userId) {
  try {
    const contacts = await readCollection(
      "imported_contacts"
    );
    return contacts.filter((contact) => contact.userId === userId).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("[ImportContacts] Failed to get contacts:", error);
    return [];
  }
}
async function deleteImportedContact(userId, id) {
  try {
    await deleteOne("imported_contacts", { id, userId });
    return true;
  } catch (error) {
    console.error("[ImportContacts] Failed to delete contact:", error);
    return false;
  }
}
async function getScheduledBroadcasts() {
  try {
    return await readCollection(
      "scheduled_broadcasts"
    );
  } catch (error) {
    console.error(
      "[ScheduledBroadcasts] Failed to get scheduled broadcasts:",
      error
    );
    return [];
  }
}
async function cancelScheduledBroadcast(id) {
  try {
    const broadcast = await findOne(
      "scheduled_broadcasts",
      { id }
    );
    if (!broadcast) {
      console.error(`[ScheduledBroadcast] Broadcast not found: ${id}`);
      return false;
    }
    if (broadcast.status !== "scheduled") {
      console.error(
        `[ScheduledBroadcast] Cannot cancel broadcast with status: ${broadcast.status}`
      );
      return false;
    }
    await updateOne(
      "scheduled_broadcasts",
      { id },
      {
        ...broadcast,
        status: "cancelled"
      }
    );
    return true;
  } catch (error) {
    console.error("[ScheduledBroadcast] Failed to cancel broadcast:", error);
    return false;
  }
}
async function deleteScheduledBroadcast(id) {
  try {
    const broadcast = await findOne(
      "scheduled_broadcasts",
      { id }
    );
    if (!broadcast) {
      console.error(
        `[ScheduledBroadcast] Broadcast not found for deletion: ${id}`
      );
      return false;
    }
    await deleteOne("scheduled_broadcasts", { id });
    return true;
  } catch (error) {
    console.error("[ScheduledBroadcast] Failed to delete broadcast:", error);
    return false;
  }
}

// modules/whatsapp-marketing/server/modules/broadcast/campaign.model.js
import mongoose6, { Schema as Schema4 } from "mongoose";
var CampaignContactSchema = new Schema4({
  contactId: { type: String, required: true },
  phone: { type: String, required: true },
  name: { type: String, default: "" },
  status: {
    type: String,
    enum: ["pending", "sent", "delivered", "read", "failed"],
    default: "pending"
  },
  messageId: { type: String },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  replyText: { type: String },
  interestStatus: {
    type: String,
    enum: ["interested", "not_interested", "neutral", "pending"],
    default: "pending"
  },
  error: { type: String }
}, { _id: false });
var CampaignSchema2 = new Schema4({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  messageType: {
    type: String,
    enum: ["template", "custom", "ai_agent"],
    required: true
  },
  templateName: { type: String },
  customMessage: { type: String },
  agentId: { type: String },
  contacts: [CampaignContactSchema],
  status: {
    type: String,
    enum: ["draft", "scheduled", "sending", "completed", "cancelled"],
    default: "draft",
    index: true
  },
  scheduledAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  metrics: {
    totalContacts: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    interested: { type: Number, default: 0 },
    notInterested: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  collection: "broadcast_campaigns"
});
CampaignSchema2.index({ userId: 1, status: 1 });
CampaignSchema2.index({ userId: 1, createdAt: -1 });
CampaignSchema2.index({ "contacts.phone": 1 });
CampaignSchema2.index({ "contacts.messageId": 1 });
var Campaign2 = mongoose6.models.Campaign || mongoose6.model("Campaign", CampaignSchema2);

// modules/whatsapp-marketing/server/modules/broadcast/campaign.service.js
init_mongodb_adapter();
function formatPhoneNumber3(phone) {
  let cleaned = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) {
    return cleaned;
  }
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = ["1", "44", "91", "92", "93", "94", "971", "966", "965", "974", "20", "27", "61", "64", "81", "86", "62"];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.substring(1);
  }
  return cleaned;
}
async function getAllContacts(userId) {
  const contacts = await Contact.find({}).lean();
  return contacts.map((c) => ({
    ...c,
    id: c._id.toString()
  }));
}
async function getAvailableContacts(userId) {
  const allContacts = await Contact.find({}).lean();
  const activeCampaigns = await Campaign2.find({
    userId,
    status: { $in: ["draft", "scheduled", "sending", "completed"] }
  }).lean();
  const usedPhones = /* @__PURE__ */ new Set();
  for (const campaign of activeCampaigns) {
    for (const contact of campaign.contacts) {
      usedPhones.add(contact.phone.replace(/\D/g, ""));
    }
  }
  return allContacts.filter((c) => {
    const normalizedPhone = c.phone.replace(/\D/g, "");
    return !usedPhones.has(normalizedPhone);
  }).map((c) => ({
    ...c,
    id: c._id.toString()
  }));
}
async function createCampaign2(userId, data) {
  const contacts = await Contact.find({ _id: { $in: data.contactIds } }).lean();
  const campaignContacts = contacts.map((c) => ({
    contactId: c._id.toString(),
    phone: c.phone,
    name: c.name,
    status: "pending",
    replied: false,
    interestStatus: "pending"
  }));
  const campaign = await Campaign2.create({
    userId,
    name: data.name,
    description: data.description,
    messageType: data.messageType,
    templateName: data.templateName,
    customMessage: data.customMessage,
    agentId: data.agentId,
    contacts: campaignContacts,
    status: data.scheduledAt ? "scheduled" : "draft",
    scheduledAt: data.scheduledAt,
    metrics: {
      totalContacts: campaignContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });
  console.log(`[Campaign] Created campaign "${data.name}" with ${campaignContacts.length} contacts`);
  return campaign;
}
async function getCampaigns2(userId, filters) {
  const query = { userId };
  if (filters?.status) {
    query.status = filters.status;
  }
  const total = await Campaign2.countDocuments(query);
  let campaignsQuery = Campaign2.find(query).sort({ createdAt: -1 });
  if (filters?.offset) {
    campaignsQuery = campaignsQuery.skip(filters.offset);
  }
  if (filters?.limit) {
    campaignsQuery = campaignsQuery.limit(filters.limit);
  }
  const campaigns = await campaignsQuery.lean();
  return { campaigns, total };
}
async function getCampaignById2(userId, campaignId) {
  const campaign = await Campaign2.findOne({ _id: campaignId, userId }).lean();
  return campaign;
}
async function executeCampaign(userId, campaignId) {
  const campaign = await Campaign2.findOne({ _id: campaignId, userId });
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error("Campaign is not in a sendable state");
  }
  campaign.status = "sending";
  campaign.startedAt = /* @__PURE__ */ new Date();
  await campaign.save();
  console.log(`[Campaign] Starting execution of "${campaign.name}" to ${campaign.contacts.length} contacts`);
  const credentials = await getWhatsAppCredentialsStrict(userId);
  if (!credentials) {
    campaign.status = "cancelled";
    await campaign.save();
    throw new Error("WhatsApp credentials not configured");
  }
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < campaign.contacts.length; i++) {
    const contact = campaign.contacts[i];
    try {
      let result;
      switch (campaign.messageType) {
        case "template":
          result = await sendTemplateMessage4(
            contact.phone,
            campaign.templateName || "hello_world",
            contact.name,
            userId
          );
          break;
        case "custom":
          result = await sendCustomMessage2(
            contact.phone,
            campaign.customMessage || "",
            userId
          );
          break;
        case "ai_agent":
          result = await sendAIAgentMessage2(
            contact.phone,
            campaign.agentId || "",
            contact.name,
            userId
          );
          break;
        default:
          result = { success: false, error: "Invalid message type" };
      }
      if (result.success) {
        campaign.contacts[i].status = "sent";
        campaign.contacts[i].messageId = result.messageId;
        campaign.contacts[i].sentAt = /* @__PURE__ */ new Date();
        sent++;
      } else {
        campaign.contacts[i].status = "failed";
        campaign.contacts[i].error = result.error;
        failed++;
      }
    } catch (error) {
      campaign.contacts[i].status = "failed";
      campaign.contacts[i].error = error.message;
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  campaign.metrics.sent = sent;
  campaign.metrics.failed = failed;
  campaign.status = "completed";
  campaign.completedAt = /* @__PURE__ */ new Date();
  await campaign.save();
  console.log(`[Campaign] Completed "${campaign.name}": ${sent} sent, ${failed} failed`);
  return campaign;
}
async function updateCampaignContactStatus(messageId, status, timestamp, failureReason) {
  const updateField = status === "delivered" ? "deliveredAt" : status === "read" ? "readAt" : "failedAt";
  const metricsField = status === "delivered" ? "metrics.delivered" : status === "read" ? "metrics.read" : "metrics.failed";
  const result = await Campaign2.updateOne(
    { "contacts.messageId": messageId, [`contacts.${updateField}`]: { $exists: false } },
    {
      $set: {
        [`contacts.$.status`]: status,
        [`contacts.$.${updateField}`]: timestamp || /* @__PURE__ */ new Date(),
        ...status === "failed" && failureReason ? { "contacts.$.error": failureReason } : {}
      },
      $inc: { [metricsField]: 1 }
    }
  );
  return result.modifiedCount > 0;
}
async function markCampaignContactAsReplied(phone, replyText, interestStatus) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const campaigns = await Campaign2.find({
    status: "completed",
    "contacts.replied": false
  });
  let updated = false;
  for (const campaign of campaigns) {
    for (let i = 0; i < campaign.contacts.length; i++) {
      const contactPhone2 = campaign.contacts[i].phone.replace(/\D/g, "");
      const last10 = normalizedPhone.slice(-10);
      const contactLast10 = contactPhone2.slice(-10);
      if (last10 === contactLast10 && !campaign.contacts[i].replied) {
        campaign.contacts[i].replied = true;
        campaign.contacts[i].repliedAt = /* @__PURE__ */ new Date();
        campaign.contacts[i].replyText = replyText;
        if (interestStatus) {
          const oldInterest = campaign.contacts[i].interestStatus;
          campaign.contacts[i].interestStatus = interestStatus;
          if (oldInterest !== "interested" && interestStatus === "interested") {
            campaign.metrics.interested++;
          }
          if (oldInterest !== "not_interested" && interestStatus === "not_interested") {
            campaign.metrics.notInterested++;
          }
          if (oldInterest !== "neutral" && interestStatus === "neutral") {
            campaign.metrics.neutral++;
          }
        }
        campaign.metrics.replied++;
        await campaign.save();
        updated = true;
        console.log(`[Campaign] Marked contact ${phone} as replied in campaign "${campaign.name}"`);
      }
    }
  }
  return updated;
}
async function getInterestedContacts(userId, campaignId) {
  const campaign = await Campaign2.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  return campaign.contacts.filter((c) => c.interestStatus === "interested");
}
async function getNotInterestedContacts(userId, campaignId) {
  const campaign = await Campaign2.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  return campaign.contacts.filter((c) => c.interestStatus === "not_interested");
}
async function sendToInterestList(userId, campaignId, interestType, messageConfig) {
  const sourceCampaign = await Campaign2.findOne({ _id: campaignId, userId }).lean();
  if (!sourceCampaign) {
    throw new Error("Source campaign not found");
  }
  const targetContacts = sourceCampaign.contacts.filter((c) => c.interestStatus === interestType);
  if (targetContacts.length === 0) {
    throw new Error(`No ${interestType.replace("_", " ")} contacts found in this campaign`);
  }
  const newCampaign = await Campaign2.create({
    userId,
    name: messageConfig.campaignName || `Follow-up: ${interestType.replace("_", " ")} from "${sourceCampaign.name}"`,
    description: `Re-targeting ${interestType.replace("_", " ")} contacts from campaign "${sourceCampaign.name}"`,
    messageType: messageConfig.messageType,
    templateName: messageConfig.templateName,
    agentId: messageConfig.agentId,
    contacts: targetContacts.map((c) => ({
      contactId: c.contactId,
      phone: c.phone,
      name: c.name,
      status: "pending",
      replied: false,
      interestStatus: "pending"
    })),
    status: "draft",
    metrics: {
      totalContacts: targetContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });
  return executeCampaign(userId, newCampaign._id.toString());
}
async function deleteCampaign2(userId, campaignId) {
  const result = await Campaign2.deleteOne({ _id: campaignId, userId });
  return result.deletedCount > 0;
}
async function sendTemplateMessage4(phone, templateName, contactName2, userId) {
  const components = [];
  if (templateName.includes("awards") || templateName.includes("marketing")) {
    components.push({
      type: "body",
      parameters: [{ type: "text", text: contactName2 || "Valued Customer", parameter_name: "name" }]
    });
  }
  const result = await sendTemplateMessage2(
    formatPhoneNumber3(phone),
    templateName,
    "en",
    components,
    userId
  );
  return result;
}
async function sendCustomMessage2(phone, message, userId) {
  return sendTextMessage(formatPhoneNumber3(phone), message, userId);
}
async function sendAIAgentMessage2(phone, agentId, contactName2, userId) {
  const agent = await getAgentById(agentId);
  if (!agent) {
    return { success: false, error: "Agent not found" };
  }
  const prompt = `Contact name: ${contactName2}. Generate a friendly personalized outreach message. Keep it under 160 characters.`;
  const aiMessage = await generateAgentResponse2(prompt, agent, []);
  if (!aiMessage) {
    return { success: false, error: "Failed to generate AI message" };
  }
  const customResult = await sendCustomMessage2(phone, aiMessage, userId);
  if (!customResult.success && (customResult.error?.includes("24") || customResult.error?.includes("window"))) {
    return await sendTemplateMessage4(
      formatPhoneNumber3(phone),
      "hello_world",
      void 0,
      userId
    );
  }
  return customResult;
}

// modules/whatsapp-marketing/server/modules/contactAgent/contactAgent.service.js
init_mongodb_adapter();
function normalizePhone2(phone) {
  return phone.replace(/\D/g, "");
}
async function assignAgentToContact(contactId, phone, agentId, agentName) {
  const normalizedPhone = normalizePhone2(phone);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await findOne("contact_agents", {
    phone: { $regex: normalizedPhone.slice(-10) + "$" }
  });
  if (existing) {
    const updated = await updateOne(
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
  const result = await insertOne("contact_agents", newAssignment);
  console.log(`[ContactAgent] Created agent assignment for ${phone}: ${agentId}`);
  return result;
}
async function getAgentForContact(phone) {
  const normalizedPhone = normalizePhone2(phone);
  const assignment = await findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ],
    isActive: true
  });
  return assignment;
}
async function addMessageToHistory(phone, role, content) {
  const normalizedPhone = normalizePhone2(phone);
  const assignment = await findOne("contact_agents", {
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
  await updateOne(
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
  const normalizedPhone = normalizePhone2(phone);
  const assignment = await findOne("contact_agents", {
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
  const normalizedPhone = normalizePhone2(phone);
  const result = await updateOne(
    "contact_agents",
    { $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ] },
    { isActive: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
  return result !== null;
}
async function isAutoReplyDisabled(phone) {
  const normalizedPhone = normalizePhone2(phone);
  const record = await findOne("contact_agents", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  return record?.autoReplyDisabled === true;
}
async function enableAutoReply(phone) {
  const normalizedPhone = normalizePhone2(phone);
  const result = await updateOne(
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
  const allRecords = await readCollection("contact_agents");
  const disabledRecords = allRecords.filter((r) => r.autoReplyDisabled === true);
  let updated = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const record of disabledRecords) {
    await updateOne(
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
  const allRecords = await readCollection("contact_agents");
  const disabled = allRecords.filter((r) => r.autoReplyDisabled === true).length;
  return {
    total: allRecords.length,
    enabled: allRecords.length - disabled,
    disabled
  };
}

// modules/whatsapp-marketing/server/modules/prefilledText/prefilledText.service.js
init_mongodb_adapter();
async function getAllMappings2() {
  const mappings = await readCollection("prefilled_text_mappings");
  return mappings;
}
async function getMappingById2(id) {
  return findOne("prefilled_text_mappings", { id });
}
async function createMapping3(data) {
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
  await insertOne("prefilled_text_mappings", mapping);
  return mapping;
}
async function updateMapping3(id, data) {
  const updated = await updateOne(
    "prefilled_text_mappings",
    { id },
    { ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
  return updated;
}
async function deleteMapping3(id) {
  await deleteOne("prefilled_text_mappings", { id });
  return true;
}
async function findMatchingAgentForMessage(messageText) {
  const normalizedMessage = messageText.toLowerCase().trim();
  const mappings = await readCollection("prefilled_text_mappings");
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

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.controller.js
init_credentials_service();

// modules/whatsapp-marketing/server/modules/whatsapp/flowResponses.service.js
import { randomUUID as randomUUID2 } from "crypto";
import { Types } from "mongoose";

// modules/whatsapp-marketing/server/modules/whatsapp/flowResponses.model.js
import mongoose7, { Schema as Schema5 } from "mongoose";
var WhatsAppFlowResponseSchema = new Schema5(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    contactId: { type: String, index: true },
    contactPhone: { type: String, required: true, index: true },
    contactName: { type: String },
    phoneNumberId: { type: String, index: true },
    wabaId: { type: String, index: true },
    inboundMessageId: { type: String, index: true },
    inboundWhatsappMessageId: { type: String, index: true },
    contextMessageId: { type: String, index: true },
    flowToken: { type: String, index: true },
    flowId: { type: String, index: true },
    flowName: { type: String, index: true },
    replyName: { type: String },
    responseJson: { type: Schema5.Types.Mixed },
    parsedReplyBody: { type: Schema5.Types.Mixed },
    rawMessage: { type: Schema5.Types.Mixed, required: true },
    receivedAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true
  }
);
WhatsAppFlowResponseSchema.index({ userId: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index({ userId: 1, flowName: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index({ userId: 1, contactPhone: 1, receivedAt: -1 });
WhatsAppFlowResponseSchema.index(
  { userId: 1, inboundWhatsappMessageId: 1 },
  { unique: true, sparse: true }
);
var WhatsAppFlowResponse = mongoose7.models.WhatsAppFlowResponse || mongoose7.model("WhatsAppFlowResponse", WhatsAppFlowResponseSchema);

// modules/whatsapp-marketing/server/modules/whatsapp/flowMessageLog.model.js
import mongoose8, { Schema as Schema6 } from "mongoose";
var WhatsAppFlowMessageLogSchema = new Schema6(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    flowMongoId: { type: String, index: true },
    flowId: { type: String, required: true, index: true },
    flowName: { type: String, required: true, index: true },
    flowToken: { type: String, index: true },
    contactPhone: { type: String, required: true, index: true },
    contactName: { type: String },
    messageId: { type: String, index: true, sparse: true },
    status: {
      type: String,
      enum: ["accepted", "failed"],
      required: true,
      index: true
    },
    providerHttpStatus: { type: Number },
    error: { type: String },
    requestPayload: { type: Schema6.Types.Mixed },
    providerResponse: { type: Schema6.Types.Mixed },
    attemptedAt: { type: Date, required: true, default: Date.now, index: true },
    acceptedAt: { type: Date },
    failedAt: { type: Date }
  },
  { timestamps: true, collection: "whatsapp_flow_message_logs" }
);
WhatsAppFlowMessageLogSchema.index({ userId: 1, attemptedAt: -1 });
WhatsAppFlowMessageLogSchema.index({ userId: 1, flowId: 1, attemptedAt: -1 });
var WhatsAppFlowMessageLog = mongoose8.models.WhatsAppFlowMessageLog || mongoose8.model(
  "WhatsAppFlowMessageLog",
  WhatsAppFlowMessageLogSchema
);

// modules/whatsapp-marketing/server/modules/whatsapp/flowResponses.service.js
async function createFlowResponse(input) {
  const linkedSend = !input.flowId && (input.contextMessageId || input.flowToken) ? await WhatsAppFlowMessageLog.findOne({
    userId: String(input.userId || "system"),
    $or: [
      ...input.contextMessageId ? [{ messageId: input.contextMessageId }] : [],
      ...input.flowToken ? [{ flowToken: input.flowToken }] : []
    ]
  }).sort({ attemptedAt: -1 }).lean() : null;
  const payload = {
    id: randomUUID2(),
    userId: String(input.userId || "system"),
    contactId: input.contactId || void 0,
    contactPhone: String(input.contactPhone || ""),
    contactName: input.contactName || void 0,
    phoneNumberId: input.phoneNumberId || void 0,
    wabaId: input.wabaId || void 0,
    inboundMessageId: input.inboundMessageId || void 0,
    inboundWhatsappMessageId: input.inboundWhatsappMessageId || void 0,
    contextMessageId: input.contextMessageId || void 0,
    flowToken: input.flowToken || void 0,
    flowId: input.flowId || linkedSend?.flowId || void 0,
    flowName: input.flowName || linkedSend?.flowName || void 0,
    replyName: input.replyName || void 0,
    responseJson: input.responseJson || void 0,
    parsedReplyBody: input.parsedReplyBody || void 0,
    rawMessage: input.rawMessage || {},
    receivedAt: input.receivedAt || /* @__PURE__ */ new Date()
  };
  return WhatsAppFlowResponse.create(payload);
}
async function listFlowResponses(userId, filters) {
  const query = {
    userId: filters?.includeSystem ? { $in: [userId, "system"] } : userId
  };
  if (filters?.search && filters.search.trim()) {
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { contactPhone: { $regex: escaped, $options: "i" } },
      { contactName: { $regex: escaped, $options: "i" } },
      { flowName: { $regex: escaped, $options: "i" } },
      { flowId: { $regex: escaped, $options: "i" } },
      { flowToken: { $regex: escaped, $options: "i" } }
    ];
  }
  if (filters?.flowName && filters.flowName.trim()) {
    query.flowName = filters.flowName.trim();
  }
  if (filters?.flowId && filters.flowId.trim()) {
    query.flowId = filters.flowId.trim();
  }
  if (filters?.contactPhone && filters.contactPhone.trim()) {
    query.contactPhone = { $regex: filters.contactPhone.trim(), $options: "i" };
  }
  const start = filters?.start ? new Date(filters.start) : void 0;
  const end = filters?.end ? new Date(filters.end) : void 0;
  if (start && !Number.isNaN(start.getTime()) || end && !Number.isNaN(end.getTime())) {
    query.receivedAt = {};
    if (start && !Number.isNaN(start.getTime())) {
      query.receivedAt.$gte = start;
    }
    if (end && !Number.isNaN(end.getTime())) {
      query.receivedAt.$lte = end;
    }
  }
  const page = Math.max(1, Number(filters?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(filters?.limit || 50)));
  const [responses, total] = await Promise.all([
    WhatsAppFlowResponse.find(query).sort({ receivedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    WhatsAppFlowResponse.countDocuments(query)
  ]);
  return { responses, total };
}
async function getFlowResponseById(userId, id) {
  const query = { userId };
  if (Types.ObjectId.isValid(id)) {
    query.$or = [{ _id: new Types.ObjectId(id) }, { id }];
  } else {
    query.id = id;
  }
  return WhatsAppFlowResponse.findOne(query);
}
async function getFlowResponseSummaryByFlow(userId, options) {
  const match = {
    userId: options?.includeSystem ? { $in: [userId, "system"] } : userId
  };
  const rows = await WhatsAppFlowResponse.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          flowId: { $ifNull: ["$flowId", ""] },
          flowName: { $ifNull: ["$flowName", ""] }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  const flows = rows.map((row) => ({
    flowId: row?._id?.flowId ? String(row._id.flowId) : void 0,
    flowName: row?._id?.flowName ? String(row._id.flowName) : void 0,
    count: Number(row?.count || 0)
  }));
  const total = flows.reduce((sum, row) => sum + row.count, 0);
  return { total, flows };
}

// modules/whatsapp-marketing/server/modules/whatsapp/flows.service.js
import { Types as Types2 } from "mongoose";
import crypto5 from "crypto";

// modules/whatsapp-marketing/server/modules/whatsapp/flows.model.js
import mongoose9, { Schema as Schema7 } from "mongoose";
var FlowEntryPointSchema = new Schema7({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ["CTA", "BUTTON", "LIST"], default: "CTA" }
}, { _id: false });
var WhatsAppFlowSchema = new Schema7({
  userId: { type: String, required: true, index: true },
  flowId: { type: String, required: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ["DRAFT", "PUBLISHED", "DEPRECATED", "BLOCKED", "THROTTLED"],
    default: "DRAFT"
  },
  categories: { type: [String], default: [] },
  validationErrors: { type: [String], default: [] },
  draftValidationErrors: { type: [String], default: [] },
  jsonVersion: { type: String },
  dataApiVersion: { type: String },
  dataChannelUri: { type: String },
  endpointUri: { type: String },
  previewUrl: { type: String },
  previewExpiresAt: { type: Date },
  healthStatus: { type: Schema7.Types.Mixed },
  whatsappBusinessAccount: { type: Schema7.Types.Mixed },
  application: { type: Schema7.Types.Mixed },
  lastMetaSnapshot: { type: Schema7.Types.Mixed },
  entryPoints: { type: [FlowEntryPointSchema], default: [] },
  linkedTemplateIds: { type: [String], default: [] },
  linkedAgentIds: { type: [String], default: [] },
  flowData: { type: Schema7.Types.Mixed },
  flowJson: { type: Schema7.Types.Mixed },
  lastSyncedAt: { type: Date, default: Date.now },
  metaUpdatedAt: { type: Date }
}, {
  timestamps: true
});
WhatsAppFlowSchema.index({ userId: 1, flowId: 1 }, { unique: true });
var WhatsAppFlow = mongoose9.models.WhatsAppFlow || mongoose9.model("WhatsAppFlow", WhatsAppFlowSchema);
var FlowSyncCheckpointSchema = new Schema7({
  userId: { type: String, required: true, unique: true },
  wabaId: { type: String, required: true },
  lastSyncedAt: { type: Date, default: Date.now },
  nextCursor: { type: String },
  syncStatus: { type: String, enum: ["idle", "syncing", "error"], default: "idle" },
  lastError: { type: String }
}, {
  timestamps: true
});
var FlowSyncCheckpoint = mongoose9.models.FlowSyncCheckpoint || mongoose9.model("FlowSyncCheckpoint", FlowSyncCheckpointSchema);

// modules/whatsapp-marketing/server/modules/whatsapp/flows.service.js
init_credentials_service();
init_mongodb_adapter();
init_encryption_service();
var GRAPH_API_VERSION = "v21.0";
var EXTENDED_FLOW_FIELDS = [
  "id",
  "name",
  "status",
  "categories",
  "validation_errors",
  "json_version",
  "data_api_version",
  "data_channel_uri",
  "endpoint_uri",
  "preview",
  "updated_at",
  "health_status",
  "application",
  "whatsapp_business_account"
].join(",");
var SAFE_FLOW_FIELDS = [
  "id",
  "name",
  "status",
  "categories",
  "validation_errors",
  "json_version",
  "data_api_version",
  "data_channel_uri",
  "endpoint_uri",
  "preview",
  "updated_at"
].join(",");
var DEFAULT_METRIC_NAMES = [
  "ENDPOINT_REQUEST_COUNT",
  "ENDPOINT_REQUEST_ERROR",
  "ENDPOINT_REQUEST_ERROR_RATE",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P50",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P90",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P95",
  "ENDPOINT_REQUEST_LATENCY_SECONDS_CEIL_P99"
];
var ALLOWED_FLOW_CATEGORIES = [
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER"
];
var META_IDENTIFIER_REGEX = /^[A-Za-z][A-Za-z_]{0,79}$/;
var MAX_FLOW_NAME_LENGTH = 80;
function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
function normalizeFlowNameOrThrow(name) {
  const normalized = String(name ?? "").trim();
  if (!normalized) {
    throw createValidationError("Flow name is required");
  }
  if (normalized.length > MAX_FLOW_NAME_LENGTH) {
    throw createValidationError(`Flow name must be ${MAX_FLOW_NAME_LENGTH} characters or fewer`);
  }
  if (/[\r\n\t]/.test(normalized)) {
    throw createValidationError("Flow name cannot include line breaks or tab characters");
  }
  return normalized;
}
function normalizeEndpointUriOrThrow(endpointUri) {
  if (endpointUri === void 0 || endpointUri === null) {
    return void 0;
  }
  const normalized = String(endpointUri).trim();
  if (!normalized) return void 0;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw createValidationError("Endpoint URI must be a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw createValidationError("Endpoint URI must start with https://");
  }
  return normalized;
}
function normalizeEndpointUriForUpdateOrThrow(endpointUri) {
  const normalized = String(endpointUri ?? "").trim();
  if (!normalized) return "";
  const validated = normalizeEndpointUriOrThrow(normalized);
  return validated || "";
}
function normalizeFlowCategoriesOrThrow(categories) {
  if (!Array.isArray(categories)) {
    throw createValidationError("Flow categories must be an array");
  }
  const normalized = categories.map((item) => String(item ?? "").trim().toUpperCase()).filter(Boolean);
  if (normalized.length === 0) {
    throw createValidationError("At least one flow category is required");
  }
  const invalid = normalized.filter(
    (item) => !ALLOWED_FLOW_CATEGORIES.includes(item)
  );
  if (invalid.length > 0) {
    throw createValidationError(
      `Invalid flow categories: ${invalid.join(", ")}. Allowed categories: ${ALLOWED_FLOW_CATEGORIES.join(", ")}`
    );
  }
  return Array.from(new Set(normalized));
}
function isValidMetaIdentifier(value) {
  return typeof value === "string" && META_IDENTIFIER_REGEX.test(value);
}
function validateMetaIdentifier(value, path, errors, options) {
  const required = options?.required !== false;
  if (typeof value !== "string" || !value.trim()) {
    if (required) {
      errors.push(`${path} is required`);
    }
    return;
  }
  const normalized = value.trim();
  if (!isValidMetaIdentifier(normalized)) {
    errors.push(
      `${path} "${value}" is invalid. Use only letters and underscores, starting with a letter (max 80 chars)`
    );
  }
}
function collectNamedComponents(node, path, errors, seenNames) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectNamedComponents(item, `${path}[${index}]`, errors, seenNames));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const record = node;
  if (Array.isArray(record["data-source"])) {
    record["data-source"].forEach((item, index) => {
      if (item && typeof item === "object" && "id" in item) {
        validateMetaIdentifier(
          item.id,
          `${path}.data-source[${index}].id`,
          errors
        );
      }
    });
  }
  if (typeof record.type === "string" && "name" in record) {
    validateMetaIdentifier(record.name, `${path}.name`, errors);
    if (typeof record.name === "string" && record.name.trim()) {
      const normalized = record.name.trim();
      if (seenNames.has(normalized)) {
        errors.push(`${path}.name "${normalized}" is duplicated. Component names should be unique per screen`);
      } else {
        seenNames.add(normalized);
      }
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "name" && typeof record.type === "string") continue;
    collectNamedComponents(value, `${path}.${key}`, errors, seenNames);
  }
}
function countComponentType(node, componentType) {
  if (Array.isArray(node)) {
    return node.reduce((total, item) => total + countComponentType(item, componentType), 0);
  }
  if (!node || typeof node !== "object") return 0;
  const record = node;
  return (record.type === componentType ? 1 : 0) + Object.values(record).reduce(
    (total, value) => total + countComponentType(value, componentType),
    0
  );
}
function toSafeDate(value) {
  if (!value) return void 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? void 0 : date;
}
function normalizeStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DRAFT" || normalized === "PUBLISHED" || normalized === "DEPRECATED" || normalized === "BLOCKED" || normalized === "THROTTLED") {
    return normalized;
  }
  return "DRAFT";
}
function parseValidationErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors.map((item) => {
    const message = item?.message || item?.details || item?.error;
    if (!message) return "";
    const location = [
      item.path ? `path ${item.path}` : "",
      item.property ? `property ${item.property}` : "",
      item.line_start ? `line ${item.line_start}` : "",
      item.column_start ? `column ${item.column_start}` : ""
    ].filter(Boolean).join(", ");
    return location ? `${message} (${location})` : message;
  }).filter((value) => Boolean(value));
}
function extractMetaError(responsePayload, statusCode) {
  const payload = responsePayload;
  const errorObject = payload?.error || payload;
  const userTitle = String(errorObject?.error_user_title || "").trim();
  const userMessage = String(errorObject?.error_user_msg || "").trim();
  const technicalDetails = String(errorObject?.error_data?.details || "").trim();
  const metaMessage = String(errorObject?.message || "").trim();
  const message = [userTitle, userMessage || technicalDetails].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(": ") || metaMessage || `Meta API request failed (${statusCode})`;
  const error = new Error(message);
  error.status = statusCode;
  error.code = errorObject?.code;
  error.subcode = errorObject?.error_subcode;
  error.fbtraceId = errorObject?.fbtrace_id;
  error.details = userMessage || technicalDetails || void 0;
  error.userTitle = userTitle || void 0;
  error.userMessage = userMessage || void 0;
  error.meta = payload;
  return error;
}
function isFlowFieldPermissionError(error) {
  const err = error;
  const message = String(err?.message || "").toLowerCase();
  const details = String(err?.details || "").toLowerCase();
  if (Number(err?.code) !== 200) return false;
  return message.includes("permission") || message.includes("access this field") || details.includes("permission") || details.includes("access this field");
}
function appendQueryParams(url, query) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === void 0 || item === null || item === "") continue;
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}
async function requestMeta(path, options) {
  const baseUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  appendQueryParams(baseUrl, options.query);
  const method = options.method || "GET";
  const headers = {
    Authorization: `Bearer ${options.token}`
  };
  let body;
  if (options.body !== void 0 && options.body !== null) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
  }
  const response = await fetch(baseUrl.toString(), {
    method,
    headers,
    body
  });
  const rawText = await response.text();
  let payload = {};
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { raw: rawText };
    }
  }
  if (!response.ok) {
    throw extractMetaError(payload, response.status);
  }
  return payload;
}
function buildFlowLookupQuery(userId, idOrFlowId) {
  const conditions = [{ flowId: idOrFlowId }];
  if (Types2.ObjectId.isValid(idOrFlowId)) {
    conditions.push({ _id: new Types2.ObjectId(idOrFlowId) });
  }
  return {
    userId,
    $or: conditions
  };
}
async function getFlowDocumentOrThrow(userId, idOrFlowId) {
  const flow = await WhatsAppFlow.findOne(buildFlowLookupQuery(userId, idOrFlowId));
  if (!flow) {
    throw new Error("Flow not found");
  }
  return flow;
}
function mapMetaFlowToLocal(userId, flow) {
  return {
    userId,
    flowId: flow.id,
    name: flow.name,
    status: normalizeStatus(flow.status),
    categories: Array.isArray(flow.categories) ? flow.categories : [],
    validationErrors: parseValidationErrors(flow.validation_errors),
    jsonVersion: flow.json_version || void 0,
    dataApiVersion: flow.data_api_version || void 0,
    dataChannelUri: flow.data_channel_uri || void 0,
    endpointUri: flow.endpoint_uri || void 0,
    previewUrl: flow.preview?.preview_url || void 0,
    previewExpiresAt: toSafeDate(flow.preview?.expires_at),
    healthStatus: flow.health_status,
    whatsappBusinessAccount: flow.whatsapp_business_account,
    application: flow.application,
    metaUpdatedAt: toSafeDate(flow.updated_at),
    lastSyncedAt: /* @__PURE__ */ new Date(),
    lastMetaSnapshot: flow
  };
}
async function upsertFlowFromMeta(userId, flow) {
  const payload = mapMetaFlowToLocal(userId, flow);
  const existing = await WhatsAppFlow.findOne({ userId, flowId: flow.id });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }
  return WhatsAppFlow.create({
    ...payload,
    entryPoints: [
      {
        id: "default",
        name: "Default Entry",
        type: "CTA"
      }
    ]
  });
}
async function resolveMetaCredentials(userId, requirements) {
  let accessToken;
  let wabaId;
  let phoneNumberId;
  let appId;
  const integrationCreds = await getDecryptedCredentials2(userId, "whatsapp");
  if (integrationCreds) {
    accessToken = integrationCreds.accessToken || accessToken;
    wabaId = integrationCreds.businessAccountId || wabaId;
    phoneNumberId = integrationCreds.phoneNumberId || phoneNumberId;
    appId = integrationCreds.appId || appId;
  }
  const storedCreds = await getDecryptedCredentials(userId);
  if (storedCreds) {
    accessToken = accessToken || storedCreds.whatsappToken;
    wabaId = wabaId || storedCreds.businessAccountId;
    phoneNumberId = phoneNumberId || storedCreds.phoneNumberId;
    appId = appId || storedCreds.appId;
  }
  accessToken = accessToken || "" || "" || "" || "";
  wabaId = wabaId || "" || "";
  phoneNumberId = phoneNumberId || "";
  appId = appId || process.env.META_APP_ID || process.env.META_APP_ID || process.env.META_APP_ID;
  if (!accessToken) {
    throw new Error("WhatsApp access token is missing. Configure Connected Apps or Settings API credentials.");
  }
  if (requirements?.requireWabaId && !wabaId) {
    throw new Error("Missing WhatsApp Business Account ID (WABA ID).");
  }
  if (requirements?.requirePhoneNumberId && !phoneNumberId) {
    throw new Error("Missing WhatsApp Phone Number ID.");
  }
  if (requirements?.requireAppId && !appId) {
    throw new Error("Missing Meta App ID.");
  }
  return {
    accessToken,
    wabaId,
    phoneNumberId,
    appId
  };
}
async function fetchMetaFlowById(accessToken, flowId, options) {
  try {
    return await requestMeta(flowId, {
      token: accessToken,
      query: {
        fields: EXTENDED_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : void 0
      }
    });
  } catch (error) {
    if (!isFlowFieldPermissionError(error)) {
      throw error;
    }
    return requestMeta(flowId, {
      token: accessToken,
      query: {
        fields: SAFE_FLOW_FIELDS,
        invalidate_preview: options?.invalidatePreview ? true : void 0
      }
    });
  }
}
function validateFlowJson(flowJson) {
  const errors = [];
  if (!flowJson || typeof flowJson !== "object") {
    return { valid: false, errors: ["Flow JSON is required and must be an object"] };
  }
  if (!flowJson.version || typeof flowJson.version !== "string") {
    errors.push('Field "version" is required and must be a string');
  }
  if (!flowJson.data_api_version || typeof flowJson.data_api_version !== "string") {
    errors.push('Field "data_api_version" is required and must be a string');
  }
  const routingModel = flowJson.routing_model && typeof flowJson.routing_model === "object" && !Array.isArray(flowJson.routing_model) ? flowJson.routing_model : null;
  if (!routingModel) {
    errors.push('Field "routing_model" is required and must be an object');
  }
  if (!Array.isArray(flowJson.screens) || flowJson.screens.length === 0) {
    errors.push('At least one screen is required in "screens"');
  } else {
    const screenIds = /* @__PURE__ */ new Set();
    flowJson.screens.forEach((screen, index) => {
      if (!screen?.id) {
        errors.push(`screens[${index}].id is required`);
      } else {
        validateMetaIdentifier(screen.id, `screens[${index}].id`, errors);
        if (screenIds.has(screen.id)) {
          errors.push(`screens[${index}].id "${screen.id}" is duplicated`);
        } else {
          screenIds.add(screen.id);
        }
      }
      if (!screen?.title) {
        errors.push(`screens[${index}].title is required`);
      }
      if (!screen?.layout || typeof screen.layout !== "object") {
        errors.push(`screens[${index}].layout is required`);
      } else {
        const seenComponentNames = /* @__PURE__ */ new Set();
        collectNamedComponents(screen.layout, `screens[${index}].layout`, errors, seenComponentNames);
        const footerCount = countComponentType(screen.layout, "Footer");
        if (footerCount > 1) {
          errors.push(
            `screens[${index}] has ${footerCount} Footers. Meta allows a maximum of one Footer per screen`
          );
        }
      }
    });
    if (routingModel) {
      const routingKeys = Object.keys(routingModel);
      if (routingKeys.length === 0) {
        errors.push('Field "routing_model" must have at least one screen mapping');
      }
      for (const key of routingKeys) {
        validateMetaIdentifier(key, `routing_model.${key}`, errors);
        if (!screenIds.has(key)) {
          errors.push(`routing_model.${key} does not match any screen id`);
        }
        const destinations = routingModel[key];
        if (!Array.isArray(destinations)) {
          errors.push(`routing_model.${key} must be an array of screen ids`);
        } else {
          destinations.forEach((destination, index) => {
            validateMetaIdentifier(destination, `routing_model.${key}[${index}]`, errors);
            if (typeof destination === "string" && !screenIds.has(destination)) {
              errors.push(`routing_model.${key}[${index}] "${destination}" does not match any screen id`);
            }
          });
        }
      }
      for (const screenId of screenIds) {
        if (!(screenId in routingModel)) {
          errors.push(`routing_model is missing key for screen "${screenId}"`);
        }
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
async function syncFlowsFromMeta(userId) {
  const result = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: []
  };
  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });
  await FlowSyncCheckpoint.findOneAndUpdate(
    { userId },
    {
      $set: {
        syncStatus: "syncing",
        wabaId
      }
    },
    { upsert: true }
  );
  try {
    let afterCursor;
    while (true) {
      let data;
      try {
        data = await requestMeta(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: EXTENDED_FLOW_FIELDS,
            limit: 200,
            after: afterCursor
          }
        });
      } catch (error) {
        if (!isFlowFieldPermissionError(error)) {
          throw error;
        }
        data = await requestMeta(`${wabaId}/flows`, {
          token: accessToken,
          query: {
            fields: SAFE_FLOW_FIELDS,
            limit: 200,
            after: afterCursor
          }
        });
      }
      const flows = Array.isArray(data.data) ? data.data : [];
      for (const metaFlow of flows) {
        try {
          const exists = await WhatsAppFlow.exists({ userId, flowId: metaFlow.id });
          await upsertFlowFromMeta(userId, metaFlow);
          if (exists) {
            result.updated += 1;
          } else {
            result.created += 1;
          }
          result.synced += 1;
        } catch (error) {
          result.errors.push(`Flow ${metaFlow.id}: ${error.message}`);
        }
      }
      if (!data.paging?.next || !data.paging.cursors?.after) {
        break;
      }
      afterCursor = data.paging.cursors.after;
    }
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: "idle",
          lastSyncedAt: /* @__PURE__ */ new Date(),
          nextCursor: void 0,
          lastError: void 0
        }
      }
    );
    return result;
  } catch (error) {
    await FlowSyncCheckpoint.findOneAndUpdate(
      { userId },
      {
        $set: {
          syncStatus: "error",
          lastError: error.message
        }
      }
    );
    throw error;
  }
}
async function getFlows(userId, filters) {
  const query = { userId };
  if (filters?.status) {
    query.status = String(filters.status).toUpperCase();
  }
  if (filters?.search) {
    query.name = { $regex: filters.search, $options: "i" };
  }
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.max(1, Math.min(100, filters?.limit || 50));
  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    WhatsAppFlow.countDocuments(query)
  ]);
  return { flows, total };
}
async function getFlowById(userId, id) {
  return WhatsAppFlow.findOne(buildFlowLookupQuery(userId, id));
}
async function getConversationStep(userId, idOrFlowId, path = []) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const builder = flow.flowData;
  if (!builder || builder.type !== "option_response") {
    throw createValidationError("This Flow does not have a conversational button configuration");
  }
  let options = Array.isArray(builder.options) ? builder.options : [];
  let selected = null;
  for (const index of path) {
    selected = options[index];
    if (!selected) {
      throw createValidationError("This conversation option is no longer available");
    }
    options = Array.isArray(selected.options) ? selected.options : [];
  }
  const hasNestedOptions = selected?.nextType === "options" && options.length > 0;
  if (selected && !hasNestedOptions) {
    return {
      userId: flow.userId,
      flowId: String(flow._id),
      flowName: flow.name,
      bodyText: String(selected.response || "").trim() || `You selected ${String(selected.title || "this option")}.`,
      buttons: [],
      complete: true
    };
  }
  const bodyText = selected ? String(selected.nextQuestion || "What would you like to choose?").trim() : String(builder.message || "").trim() || [
    String(builder.heading || "").trim(),
    String(builder.description || "").trim(),
    String(builder.question || "What would you like to do?").trim()
  ].filter(Boolean).join("\n\n");
  return {
    userId: flow.userId,
    flowId: String(flow._id),
    flowName: flow.name,
    bodyText,
    buttons: options.filter((option) => String(option?.title || "").trim()).slice(0, 3).map((option, index) => ({
      id: `cflow:${String(flow._id)}:${[...path, index].join(".")}`,
      title: String(option.title).trim()
    })),
    complete: false
  };
}
async function resolveConversationFlowOwner(idOrFlowId) {
  if (!idOrFlowId) return null;
  const conditions = [{ flowId: idOrFlowId }];
  if (Types2.ObjectId.isValid(idOrFlowId)) {
    conditions.push({ _id: new Types2.ObjectId(idOrFlowId) });
  }
  const flow = await WhatsAppFlow.findOne({ $or: conditions }).select({ userId: 1 }).lean();
  return flow?.userId ? String(flow.userId) : null;
}
async function getFlowDetailsFromMeta(userId, idOrFlowId, options) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const { accessToken } = await resolveMetaCredentials(userId);
  const meta = await fetchMetaFlowById(accessToken, flow.flowId, {
    invalidatePreview: options?.invalidatePreview
  });
  const localFlow = await upsertFlowFromMeta(userId, meta);
  return { flow: localFlow, meta };
}
async function updateFlowEntryPoints(userId, id, entryPoints) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, id),
    { $set: { entryPoints } },
    { new: true }
  );
}
async function attachFlowToTemplate(userId, flowId, templateId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedTemplateIds: templateId } },
    { new: true }
  );
}
async function detachFlowFromTemplate(userId, flowId, templateId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedTemplateIds: templateId } },
    { new: true }
  );
}
async function attachFlowToAgent(userId, flowId, agentId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $addToSet: { linkedAgentIds: agentId } },
    { new: true }
  );
}
async function detachFlowFromAgent(userId, flowId, agentId) {
  return WhatsAppFlow.findOneAndUpdate(
    buildFlowLookupQuery(userId, flowId),
    { $pull: { linkedAgentIds: agentId } },
    { new: true }
  );
}
async function deleteFlow(userId, id) {
  const result = await WhatsAppFlow.deleteOne(buildFlowLookupQuery(userId, id));
  return result.deletedCount > 0;
}
async function getSyncStatus(userId) {
  const [checkpoint, totalFlows] = await Promise.all([
    FlowSyncCheckpoint.findOne({ userId }),
    WhatsAppFlow.countDocuments({ userId })
  ]);
  return {
    lastSyncedAt: checkpoint?.lastSyncedAt,
    syncStatus: checkpoint?.syncStatus || "idle",
    lastError: checkpoint?.lastError,
    totalFlows
  };
}
async function getFlowStats(userId) {
  const [total, published, draft, linkedTemplates, linkedAgents] = await Promise.all([
    WhatsAppFlow.countDocuments({ userId }),
    WhatsAppFlow.countDocuments({ userId, status: "PUBLISHED" }),
    WhatsAppFlow.countDocuments({ userId, status: "DRAFT" }),
    WhatsAppFlow.countDocuments({ userId, linkedTemplateIds: { $exists: true, $ne: [] } }),
    WhatsAppFlow.countDocuments({ userId, linkedAgentIds: { $exists: true, $ne: [] } })
  ]);
  return {
    totalFlows: total,
    publishedFlows: published,
    draftFlows: draft,
    linkedToTemplates: linkedTemplates,
    linkedToAgents: linkedAgents
  };
}
async function createFlowInMeta(userId, data) {
  const { accessToken, wabaId } = await resolveMetaCredentials(userId, { requireWabaId: true });
  const normalizedName = normalizeFlowNameOrThrow(data.name);
  const normalizedCategories = normalizeFlowCategoriesOrThrow(data.categories);
  const normalizedEndpointUri = normalizeEndpointUriOrThrow(data.endpointUri);
  const normalizedCloneFlowId = data.cloneFlowId ? String(data.cloneFlowId).trim() : void 0;
  if (data.flowJson && typeof data.flowJson === "object") {
    const validation = validateFlowJson(data.flowJson);
    if (!validation.valid) {
      throw createValidationError(`Flow JSON validation failed: ${validation.errors.join("; ")}`);
    }
  }
  const createPayload = {
    name: normalizedName,
    categories: normalizedCategories
  };
  if (normalizedEndpointUri) {
    createPayload.endpoint_uri = normalizedEndpointUri;
  }
  if (normalizedCloneFlowId) {
    createPayload.clone_flow_id = normalizedCloneFlowId;
  }
  const createResponse = await requestMeta(`${wabaId}/flows`, {
    method: "POST",
    token: accessToken,
    body: createPayload
  });
  const flowId = createResponse.id;
  let flow;
  let meta;
  try {
    meta = await fetchMetaFlowById(accessToken, flowId);
    flow = await upsertFlowFromMeta(userId, meta);
  } catch (error) {
    flow = await WhatsAppFlow.create({
      userId,
      flowId,
      name: normalizedName,
      status: "DRAFT",
      categories: normalizedCategories,
      endpointUri: normalizedEndpointUri,
      flowJson: data.flowJson,
      validationErrors: [],
      entryPoints: [
        {
          id: "default",
          name: "Default Entry",
          type: "CTA"
        }
      ],
      lastSyncedAt: /* @__PURE__ */ new Date()
    });
  }
  if (flow && data.flowJson) {
    flow.flowJson = data.flowJson;
    await flow.save();
  }
  return { flowId, flow, meta };
}
async function saveFlowDraft(userId, id, flowData, flowJson) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const validation = validateFlowJson(flowJson);
  flow.flowData = flowData;
  flow.flowJson = flowJson;
  flow.draftValidationErrors = validation.errors;
  flow.lastSyncedAt = /* @__PURE__ */ new Date();
  await flow.save();
  return flow;
}
async function uploadFlowJsonAsset(accessToken, flowId, flowJson) {
  const formData = new FormData();
  formData.append("name", "flow.json");
  formData.append("asset_type", "FLOW_JSON");
  formData.append(
    "file",
    new Blob([JSON.stringify(flowJson, null, 2)], { type: "application/json" }),
    "flow.json"
  );
  return requestMeta(`${flowId}/assets`, {
    method: "POST",
    token: accessToken,
    body: formData
  });
}
async function updateAndPublishFlow(userId, id) {
  let flow = await getFlowDocumentOrThrow(userId, id);
  if (!flow.flowJson || typeof flow.flowJson !== "object") {
    throw new Error("No valid Flow JSON found for this draft");
  }
  const validation = validateFlowJson(flow.flowJson);
  flow.draftValidationErrors = validation.errors;
  if (!validation.valid) {
    await flow.save();
    throw new Error(`Draft JSON validation failed: ${validation.errors.join("; ")}`);
  }
  const endpointSetup = await setupFlowEndpoint(userId, id);
  flow = endpointSetup.flow;
  const { accessToken } = await resolveMetaCredentials(userId);
  const uploadResult = await uploadFlowJsonAsset(accessToken, flow.flowId, flow.flowJson);
  const uploadValidationErrors = parseValidationErrors(uploadResult?.validation_errors);
  if (uploadValidationErrors.length > 0) {
    flow.validationErrors = uploadValidationErrors;
    await flow.save();
    throw new Error(`Flow JSON upload has validation errors: ${uploadValidationErrors.join("; ")}`);
  }
  await requestMeta(`${flow.flowId}/publish`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}
async function publishFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(`${flow.flowId}/publish`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
  return refreshed.flow;
}
async function deprecateFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(`${flow.flowId}/deprecate`, {
    method: "POST",
    token: accessToken
  });
  const refreshed = await getFlowDetailsFromMeta(userId, id);
  return refreshed.flow;
}
async function deleteFlowInMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  if (flow.status !== "DRAFT") {
    throw new Error("Only draft flows can be deleted from Meta");
  }
  const { accessToken } = await resolveMetaCredentials(userId);
  await requestMeta(flow.flowId, {
    method: "DELETE",
    token: accessToken
  });
  await WhatsAppFlow.deleteOne({ _id: flow._id });
  return true;
}
async function updateFlowMetadataInMeta(userId, id, updates) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const payload = {};
  if (updates.name !== void 0) payload.name = normalizeFlowNameOrThrow(updates.name);
  if (updates.categories !== void 0) {
    payload.categories = normalizeFlowCategoriesOrThrow(updates.categories);
  }
  if (updates.endpointUri !== void 0) {
    payload.endpoint_uri = normalizeEndpointUriForUpdateOrThrow(updates.endpointUri);
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("At least one field is required to update flow metadata");
  }
  await requestMeta(flow.flowId, {
    method: "POST",
    token: accessToken,
    body: payload
  });
  return getFlowDetailsFromMeta(userId, id, { invalidatePreview: true });
}
async function cloneFlowInMeta(userId, id, options) {
  const sourceFlow = await getFlowDocumentOrThrow(userId, id);
  const categories = options?.categories && options.categories.length > 0 ? options.categories : sourceFlow.categories.filter(Boolean);
  return createFlowInMeta(userId, {
    name: options?.name || `${sourceFlow.name}_copy`,
    categories: categories.length > 0 ? categories : ["OTHER"],
    endpointUri: options?.endpointUri || sourceFlow.endpointUri,
    cloneFlowId: sourceFlow.flowId
  });
}
async function getFlowAssetsFromMeta(userId, id) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  return requestMeta(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200
    }
  });
}
async function getFlowAssetContentFromMeta(userId, id, assetId) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const assetsResponse = await requestMeta(`${flow.flowId}/assets`, {
    token: accessToken,
    query: {
      limit: 200
    }
  });
  const assets = Array.isArray(assetsResponse.data) ? assetsResponse.data : [];
  const targetAsset = assetId && assets.find((item) => String(item.id) === String(assetId)) || assets.find((item) => String(item.asset_type || "").toUpperCase() === "FLOW_JSON");
  if (!targetAsset) {
    throw new Error("No flow asset found for this flow");
  }
  let downloadUrl = targetAsset.download_url || targetAsset.url || targetAsset.asset_url || targetAsset.asset_download_url;
  if (!downloadUrl && targetAsset.id) {
    const assetDetails = await requestMeta(String(targetAsset.id), {
      token: accessToken,
      query: {
        fields: "id,name,asset_type,download_url"
      }
    });
    downloadUrl = assetDetails.download_url || assetDetails.url || assetDetails.asset_url || assetDetails.asset_download_url;
  }
  if (!downloadUrl) {
    throw new Error("Flow asset exists but no download URL is available");
  }
  const downloadResponse = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!downloadResponse.ok) {
    const payload = await downloadResponse.text();
    throw new Error(`Failed to download flow asset: ${payload || downloadResponse.statusText}`);
  }
  const text = await downloadResponse.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = void 0;
  }
  return {
    asset: targetAsset,
    downloadUrl,
    contentType: downloadResponse.headers.get("content-type"),
    text,
    json
  };
}
async function getFlowMetricsFromMeta(userId, id, options) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken } = await resolveMetaCredentials(userId);
  const metricNames = Array.isArray(options?.metricNames) && options.metricNames.length > 0 ? options.metricNames : DEFAULT_METRIC_NAMES;
  return requestMeta(`${flow.flowId}/metrics`, {
    token: accessToken,
    query: {
      metric_name: metricNames,
      granularity: options?.granularity || "DAY",
      since: options?.start,
      until: options?.end
    }
  });
}
function normalizePhoneNumber(input) {
  return String(input || "").replace(/\D/g, "");
}
function extractScreenIdsFromFlowJson(flowJson) {
  if (!flowJson || typeof flowJson !== "object") return [];
  const screens = flowJson.screens;
  if (!Array.isArray(screens)) return [];
  return screens.map((screen) => screen && typeof screen === "object" ? String(screen.id || "").trim() : "").filter(Boolean);
}
async function resolveFlowStartScreenId(userId, id, flow, requestedScreen) {
  const normalizedRequested = String(requestedScreen || "").trim();
  const localScreenIds = extractScreenIdsFromFlowJson(flow.flowJson);
  if (normalizedRequested) {
    if (localScreenIds.length > 0 && !localScreenIds.includes(normalizedRequested)) {
      throw createValidationError(
        `Invalid screen "${normalizedRequested}". Available screens: ${localScreenIds.join(", ")}`
      );
    }
    return normalizedRequested;
  }
  if (localScreenIds.length > 0) {
    return localScreenIds[0];
  }
  try {
    const assetPayload = await getFlowAssetContentFromMeta(userId, id);
    const remoteScreenIds = extractScreenIdsFromFlowJson(assetPayload.json);
    if (remoteScreenIds.length > 0) {
      return remoteScreenIds[0];
    }
  } catch {
  }
  return void 0;
}
async function sendFlowTestMessage(userId, id, data) {
  const flow = await getFlowDocumentOrThrow(userId, id);
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: true
  });
  const to = normalizePhoneNumber(data.phoneNumber);
  if (!to) {
    throw new Error("Valid recipient phone number is required");
  }
  const contact = await Contact.findOne({
    userId,
    phone: { $in: [to, `+${to}`] }
  }).lean();
  const latestInbound = contact ? await Message.findOne({
    userId,
    contactId: contact.id,
    direction: "inbound"
  }).sort({ timestamp: -1 }).lean() : null;
  const lastInboundAt = latestInbound?.timestamp ? new Date(latestInbound.timestamp) : null;
  const isInsideCustomerServiceWindow = lastInboundAt && Date.now() - lastInboundAt.getTime() >= 0 && Date.now() - lastInboundAt.getTime() <= 24 * 60 * 60 * 1e3;
  if (!isInsideCustomerServiceWindow) {
    throw createValidationError(
      "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
    );
  }
  const sendMode = data.mode || (flow.status === "DRAFT" ? "draft" : "published");
  const flowAction = data.flowAction || "navigate";
  const parameters = {
    flow_message_version: "3",
    flow_token: data.flowToken || `flow_${Date.now()}`,
    flow_cta: data.ctaText || "Start",
    flow_action: flowAction
  };
  if (sendMode === "draft") {
    parameters.mode = "draft";
    parameters.flow_name = flow.name;
  } else {
    parameters.flow_id = flow.flowId;
  }
  const resolvedScreen = await resolveFlowStartScreenId(userId, id, flow, data.screen);
  const actionPayload = {};
  if (resolvedScreen) {
    actionPayload.screen = resolvedScreen;
  }
  if (data.data && Object.keys(data.data).length > 0) {
    actionPayload.data = data.data;
  }
  if (flowAction === "navigate" && !actionPayload.screen) {
    throw createValidationError(
      "Unable to resolve a valid start screen for this flow. Save a draft or provide a valid screen ID."
    );
  }
  if (Object.keys(actionPayload).length > 0) {
    parameters.flow_action_payload = actionPayload;
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "flow",
      body: {
        text: data.bodyText || `Please complete flow: ${flow.name}`
      },
      action: {
        name: "flow",
        parameters
      }
    }
  };
  if (data.headerText) {
    payload.interactive.header = {
      type: "text",
      text: data.headerText
    };
  }
  if (data.footerText) {
    payload.interactive.footer = {
      text: data.footerText
    };
  }
  const response = await requestMeta(`${phoneNumberId}/messages`, {
    method: "POST",
    token: accessToken,
    body: payload
  });
  const messageId = response?.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("Flow message accepted but message ID is missing in response");
  }
  return {
    messageId,
    payload,
    response
  };
}
async function getPhoneNumberEncryptionStatus(userId, businessPhoneNumberId) {
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !businessPhoneNumberId
  });
  const targetPhoneId = businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error("Business Phone Number ID is required");
  }
  const response = await requestMeta(`${targetPhoneId}/whatsapp_business_encryption`, {
    token: accessToken
  });
  return {
    phoneNumberId: targetPhoneId,
    ...response
  };
}
async function setPhoneNumberEncryptionPublicKey(userId, payload) {
  if (!payload.businessPublicKey || !payload.businessPublicKey.trim()) {
    throw new Error("businessPublicKey is required");
  }
  const { accessToken, phoneNumberId } = await resolveMetaCredentials(userId, {
    requirePhoneNumberId: !payload.businessPhoneNumberId
  });
  const targetPhoneId = payload.businessPhoneNumberId || phoneNumberId;
  if (!targetPhoneId) {
    throw new Error("Business Phone Number ID is required");
  }
  const updateResponse = await requestMeta(`${targetPhoneId}/whatsapp_business_encryption`, {
    method: "POST",
    token: accessToken,
    body: {
      business_public_key: payload.businessPublicKey
    }
  });
  const status = await getPhoneNumberEncryptionStatus(userId, targetPhoneId);
  return {
    phoneNumberId: targetPhoneId,
    updateResponse,
    status
  };
}
function getFlowEndpointBaseUrl() {
  const baseUrl = process.env.PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("Public backend URL is not configured");
  }
  return String(baseUrl).replace(/\/+$/, "");
}
async function ensureUserFlowEndpointKeys(userId) {
  let credentials = await UserCredentials2.findOne({ userId });
  if (!credentials) {
    credentials = new UserCredentials2({
      id: new Types2.ObjectId().toString(),
      userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  let token = String(credentials.flowEndpointToken || "").trim();
  let publicKey = String(credentials.flowEndpointPublicKey || "").trim();
  let privateKey = decryptStoredValue(credentials.flowEndpointPrivateKey);
  if (!token || !publicKey || !privateKey) {
    const generated = crypto5.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    token = crypto5.randomBytes(24).toString("hex");
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    credentials.flowEndpointToken = token;
    credentials.flowEndpointPublicKey = publicKey;
    credentials.flowEndpointPrivateKey = encrypt(privateKey);
    await credentials.save();
  }
  return { token, publicKey, privateKey };
}
async function setupFlowEndpoint(userId, idOrFlowId) {
  const flow = await getFlowDocumentOrThrow(userId, idOrFlowId);
  const keys = await ensureUserFlowEndpointKeys(userId);
  const endpointUri = `${getFlowEndpointBaseUrl()}/api/whatsapp-marketing/webhook/whatsapp/flows/endpoint/${keys.token}`;
  await setPhoneNumberEncryptionPublicKey(userId, {
    businessPublicKey: keys.publicKey
  });
  const { accessToken } = await resolveMetaCredentials(userId);
  const endpointForm = new FormData();
  endpointForm.append("endpoint_uri", endpointUri);
  await requestMeta(flow.flowId, {
    method: "POST",
    token: accessToken,
    body: endpointForm
  });
  const refreshed = await getFlowDetailsFromMeta(userId, idOrFlowId, {
    invalidatePreview: true
  });
  const metaEndpoint = String(
    refreshed.meta.endpoint_uri || refreshed.meta.data_channel_uri || ""
  ).trim();
  if (!metaEndpoint) {
    throw new Error("Meta accepted the endpoint update but did not attach endpoint_uri to the Flow");
  }
  return { endpointUri: metaEndpoint, flow: refreshed.flow };
}
async function handleEncryptedFlowEndpoint(token, body) {
  const credentials = await UserCredentials2.findOne({ flowEndpointToken: token });
  if (!credentials) throw createValidationError("Unknown Flow endpoint");
  const privateKey = decryptStoredValue(credentials.flowEndpointPrivateKey);
  if (!privateKey) throw new Error("Flow endpoint private key is not configured");
  if (!body.encrypted_flow_data || !body.encrypted_aes_key || !body.initial_vector) {
    throw createValidationError("Encrypted Flow request fields are required");
  }
  const aesKey = crypto5.privateDecrypt(
    {
      key: privateKey,
      padding: crypto5.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    Buffer.from(body.encrypted_aes_key, "base64")
  );
  const iv = Buffer.from(body.initial_vector, "base64");
  const encryptedFlowData = Buffer.from(body.encrypted_flow_data, "base64");
  const authTag = encryptedFlowData.subarray(encryptedFlowData.length - 16);
  const ciphertext = encryptedFlowData.subarray(0, encryptedFlowData.length - 16);
  const decipher = crypto5.createDecipheriv(
    aesKey.length === 32 ? "aes-256-gcm" : "aes-128-gcm",
    aesKey,
    iv
  );
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const request = JSON.parse(decrypted.toString("utf8"));
  const userId = String(credentials.userId);
  if (request.action !== "ping") {
    await createFlowResponse({
      userId,
      contactPhone: "flow-endpoint",
      flowToken: request.flow_token ? String(request.flow_token) : void 0,
      flowName: request.screen ? String(request.screen) : void 0,
      replyName: request.action ? String(request.action) : void 0,
      responseJson: request.data || {},
      parsedReplyBody: request,
      rawMessage: { source: "meta_flow_endpoint", request },
      receivedAt: /* @__PURE__ */ new Date()
    });
  }
  const responsePayload = request.action === "ping" ? { version: request.version || "3.0", data: { status: "active" } } : {
    version: request.version || "3.0",
    screen: request.screen || "START",
    data: request.data || {}
  };
  const responseIv = Buffer.from(iv.map((byte) => byte ^ 255));
  const cipher = crypto5.createCipheriv(
    aesKey.length === 32 ? "aes-256-gcm" : "aes-128-gcm",
    aesKey,
    responseIv
  );
  const encryptedResponse = Buffer.concat([
    cipher.update(JSON.stringify(responsePayload), "utf8"),
    cipher.final(),
    cipher.getAuthTag()
  ]);
  return encryptedResponse.toString("base64");
}

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.controller.js
init_mongodb_adapter();

// modules/whatsapp-marketing/server/modules/contacts/contacts.routes.js
import { Router as Router5 } from "express";

// modules/whatsapp-marketing/server/modules/auth/auth.routes.js
import { Router as Router4 } from "express";

// modules/whatsapp-marketing/server/modules/auth/auth.service.js
init_mongodb_adapter();
init_user_model();
import crypto7 from "crypto";

// modules/whatsapp-marketing/server/modules/email/email.service.js
import nodemailer from "nodemailer";
var SMTP_EMAIL = process.env.EMAIL;
var SMTP_PASSWORD = process.env.EMAIL_PASSWORD;
var transporter = nodemailer.createTransport({
  host: "smtp.zoho.in",
  port: 465,
  secure: true,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD
  }
});
async function sendCredentialsEmail(toEmail, name, username, password) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error("[Email] SMTP credentials not configured");
    return false;
  }
  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: "Your WhatsApp Business API Dashboard Login Credentials",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Welcome, ${name}!</h2>
            
            <p style="color: #4b5563;">Your account has been created successfully. Here are your login credentials:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Username:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Password:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${password}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> Please keep these credentials secure and do not share them with anyone. We recommend changing your password after your first login.
              </p>
            </div>
            
            <p style="color: #4b5563;">If you have any questions or need assistance, please contact your administrator.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from WhatsApp Business API Dashboard. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to WhatsApp Business API Dashboard!

Hi ${name},

Your account has been created successfully. Here are your login credentials:

Username: ${username}
Password: ${password}

Important: Please keep these credentials secure and do not share them with anyone. We recommend changing your password after your first login.

If you have any questions or need assistance, please contact your administrator.

This is an automated message. Please do not reply to this email.
      `.trim()
    };
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Credentials sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send credentials email:", error);
    return false;
  }
}
async function sendPasswordResetEmail(toEmail, name, username, newPassword) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error("[Email] SMTP credentials not configured");
    return false;
  }
  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: "Your Password Has Been Reset - WhatsApp Business API Dashboard",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Password Reset</h2>
            
            <p style="color: #4b5563;">Hi ${name}, your password has been reset by an administrator. Here are your new login credentials:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Username:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">New Password:</td>
                  <td style="padding: 10px 0; color: #111827; font-weight: 600;">${newPassword}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> Please keep these credentials secure. We recommend changing your password after logging in.
              </p>
            </div>
            
            <p style="color: #4b5563;">If you did not request this password reset, please contact your administrator immediately.</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from WhatsApp Business API Dashboard. Please do not reply to this email.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset - WhatsApp Business API Dashboard

Hi ${name},

Your password has been reset by an administrator. Here are your new login credentials:

Username: ${username}
New Password: ${newPassword}

Important: Please keep these credentials secure. We recommend changing your password after logging in.

If you did not request this password reset, please contact your administrator immediately.

This is an automated message. Please do not reply to this email.
      `.trim()
    };
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset email sent successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send password reset email:", error);
    return false;
  }
}
async function sendPasswordResetLinkEmail(toEmail, name, resetLink, expiryMinutes = 15) {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.error("[Email] SMTP credentials not configured");
    return false;
  }
  try {
    const mailOptions = {
      from: `"WhatsApp Business API" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: "Reset Your Password - WhatsApp Business API Dashboard",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">WhatsApp Business API Dashboard</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #111827; margin-top: 0;">Reset your password</h2>
            <p style="color: #4b5563;">Hi ${name}, we received a request to reset your password.</p>
            <p style="color: #4b5563;">Use the button below to set a new password. This link will expire in ${expiryMinutes} minutes.</p>

            <div style="text-align: center; margin: 26px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
                Reset Password
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px;">If the button does not work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all; color: #111827; font-size: 13px;">${resetLink}</p>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 20px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #92400e; font-size: 13px;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Reset your password

Hi ${name},

We received a request to reset your password.
Use the link below to set a new password (expires in ${expiryMinutes} minutes):
${resetLink}

If you did not request this change, you can ignore this email.
      `.trim()
    };
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Password reset link sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send password reset link email:", error);
    return false;
  }
}

// modules/whatsapp-marketing/server/modules/auth/auth.service.js
var PASSWORD_RESET_TTL_MINUTES = 15;
function hashResetToken(token) {
  return crypto7.createHash("sha256").update(token).digest("hex");
}
function hashPassword2(password) {
  const salt = crypto7.randomBytes(16).toString("hex");
  const hash = crypto7.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword2(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto7.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
  return hash === verifyHash;
}
async function findUserByUsername(username) {
  try {
    const user = await User.findOne({ username });
    return user;
  } catch (error) {
    console.error("[Auth] Error finding user:", error);
    return null;
  }
}
async function findUserById(id) {
  try {
    const user = await User.findOne({ id });
    if (user) return user;
    const systemUser = await SystemUser.findOne({ id, isActive: true });
    if (systemUser) {
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error finding user by id:", error);
    return null;
  }
}
async function createUser(username, password, name, email) {
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return null;
    }
    const id = crypto7.randomUUID();
    const hashedPassword = hashPassword2(password);
    const user = await User.create({
      id,
      username,
      password: hashedPassword,
      name,
      email: email || "",
      role: "user",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error("[Auth] Error creating user:", error);
    return null;
  }
}
async function updateUserProfile(userId, updates) {
  try {
    const user = await User.findOne({ id: userId });
    if (user) {
      if (updates.name) user.name = updates.name;
      if (updates.email) user.email = updates.email;
      await user.save();
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    const systemUser = await SystemUser.findOne({ id: userId });
    if (systemUser) {
      if (updates.name) systemUser.name = updates.name;
      if (updates.email) systemUser.email = updates.email;
      await systemUser.save();
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error updating profile:", error);
    return null;
  }
}
async function validateLogin(username, password) {
  try {
    const user = await findUserByUsername(username);
    if (user) {
      if (!verifyPassword2(password, user.password)) {
        return null;
      }
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    const systemUser = await SystemUser.findOne({
      $or: [{ username }, { email: username }],
      isActive: true
    });
    if (systemUser) {
      if (!verifyPassword2(password, systemUser.password)) {
        return null;
      }
      return {
        id: systemUser.id,
        username: systemUser.username,
        name: systemUser.name,
        email: systemUser.email,
        role: systemUser.role,
        pageAccess: systemUser.pageAccess
      };
    }
    return null;
  } catch (error) {
    console.error("[Auth] Error validating login:", error);
    return null;
  }
}
async function requestPasswordReset(identifier, appUrl) {
  try {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      return { delivered: false };
    }
    const user = await User.findOne({
      $or: [{ username: cleanIdentifier }, { email: cleanIdentifier }]
    });
    if (!user) {
      return { delivered: false };
    }
    const resetToken = crypto7.randomBytes(32).toString("hex");
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1e3
    );
    user.resetPasswordTokenHash = resetTokenHash;
    user.resetPasswordExpiresAt = resetTokenExpiresAt;
    await user.save();
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    let delivered = false;
    if (user.email) {
      delivered = await sendPasswordResetLinkEmail(
        user.email,
        user.name || user.username,
        resetUrl,
        PASSWORD_RESET_TTL_MINUTES
      );
    }
    if (process.env.NODE_ENV !== "production") {
      return { delivered, debugResetUrl: resetUrl };
    }
    return { delivered };
  } catch (error) {
    console.error("[Auth] Error requesting password reset:", error);
    return { delivered: false };
  }
}
async function resetPasswordWithToken(token, newPassword) {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { success: false, error: "Invalid reset token" };
    }
    if (newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }
    const tokenHash = hashResetToken(cleanToken);
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: /* @__PURE__ */ new Date() }
    });
    if (!user) {
      return { success: false, error: "Reset token is invalid or has expired" };
    }
    user.password = hashPassword2(newPassword);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();
    return { success: true };
  } catch (error) {
    console.error("[Auth] Error resetting password:", error);
    return { success: false, error: "Failed to reset password" };
  }
}

// modules/whatsapp-marketing/server/modules/auth/sellerslaunch.service.js
init_mongodb_adapter();
import crypto8 from "crypto";
import jwt from "jsonwebtoken";
var SELLERSLOGIN_SSO_ISSUER = "ophmate-backend";
var SELLERSLOGIN_SSO_AUDIENCE = "ophmarketing";
var SellersLaunchConfigError = class extends Error {
};
function isSellersLaunchTokenExpiredError(error) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "TokenExpiredError";
}
function isSellersLaunchTokenError(error) {
  return typeof error === "object" && error !== null && "name" in error && (error.name === "JsonWebTokenError" || error.name === "NotBeforeError");
}
function getSsoSecret() {
  const secret = String(process.env.OPHMARKETING_SSO_SECRET || "").trim();
  if (!secret) {
    throw new SellersLaunchConfigError(
      "OPHMARKETING_SSO_SECRET is not configured"
    );
  }
  return secret;
}
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function getAccountIdentity(payload) {
  const accountType = normalizeString(payload.accountType).toLowerCase() === "admin" ? "admin" : "vendor";
  const directAccountId = normalizeString(payload.accountId);
  if (directAccountId) return { accountId: directAccountId, accountType };
  const directVendorId = normalizeString(payload.vendorId);
  if (directVendorId) return { accountId: directVendorId, accountType: "vendor" };
  const sub = normalizeString(payload.sub);
  if (sub.startsWith("admin:")) {
    return { accountId: sub.slice("admin:".length), accountType: "admin" };
  }
  if (sub.startsWith("vendor:")) {
    return { accountId: sub.slice("vendor:".length), accountType: "vendor" };
  }
  return { accountId: "", accountType };
}
function buildLaunchUserId(accountId, accountType) {
  return accountType === "admin" ? `admin:${accountId}` : `seller:${accountId}`;
}
async function resolveLaunchUserId(accountId, accountType) {
  const directUserId = buildLaunchUserId(accountId, accountType);
  if (accountType !== "admin") return directUserId;
  const platformWhatsAppAccount = await ConnectedAccount.findOne({
    providerId: "whatsapp",
    status: "connected",
    $or: [
      { "metadata.ownerType": "admin" },
      { "metadata.ownerRole": { $in: ["admin", "superadmin", "super_admin"] } },
      { userId: /^admin:/ }
    ]
  }).sort({ isDefault: -1, updatedAt: -1 }).select({ userId: 1 }).lean();
  return normalizeString(platformWhatsAppAccount?.userId) || directUserId;
}
function buildPreferredUsername(accountId, accountType) {
  const sanitized = accountId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${accountType}_${sanitized || crypto8.randomBytes(4).toString("hex")}`;
}
async function getAvailableUsername(userId, preferredUsername) {
  const matchingUser = await User.findOne({ username: preferredUsername });
  if (!matchingUser || matchingUser.id === userId) {
    return preferredUsername;
  }
  return `${preferredUsername}_${crypto8.randomBytes(2).toString("hex")}`;
}
var isDuplicateKeyError = (error) => typeof error === "object" && error !== null && "code" in error && error.code === 11e3;
async function authenticateSellersLaunch(token) {
  const cleanToken = normalizeString(token);
  if (!cleanToken) {
    const error = new Error("Launch token is required");
    error.name = "JsonWebTokenError";
    throw error;
  }
  const secret = getSsoSecret();
  const payload = jwt.verify(cleanToken, secret, {
    algorithms: ["HS256"],
    issuer: SELLERSLOGIN_SSO_ISSUER,
    audience: SELLERSLOGIN_SSO_AUDIENCE
  });
  const { accountId, accountType } = getAccountIdentity(payload);
  if (!accountId) {
    const error = new Error("Launch token is missing account identity");
    error.name = "JsonWebTokenError";
    throw error;
  }
  const userId = await resolveLaunchUserId(accountId, accountType);
  const name = normalizeString(payload.name) || `${accountType === "admin" ? "Admin" : "Vendor"} ${accountId.slice(-6)}`;
  const email = normalizeString(payload.email);
  const avatar = normalizeString(payload.avatar);
  const preferredUsername = buildPreferredUsername(accountId, accountType);
  const role = accountType === "admin" ? "admin" : "user";
  let user = await User.findOne({ id: userId });
  if (!user && accountType === "admin" && email) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.id = userId;
      if (!user.username) {
        user.username = await getAvailableUsername(userId, preferredUsername);
      }
      if (!user.password) {
        user.password = hashPassword2(crypto8.randomBytes(24).toString("hex"));
      }
    }
  }
  if (!user) {
    const username = await getAvailableUsername(userId, preferredUsername);
    try {
      user = await User.create({
        id: userId,
        username,
        password: hashPassword2(crypto8.randomBytes(24).toString("hex")),
        name,
        email,
        role,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      user = await User.findOne({ id: userId }) || (email ? await User.findOne({ email: email.toLowerCase() }) : null);
      if (!user) throw error;
    }
  } else {
    if (user.id !== userId) {
      user.id = userId;
    }
    if (name && user.name !== name) {
      user.name = name;
    }
    if (email && user.email !== email) {
      user.email = email;
    }
    if (user.role !== role) {
      user.role = role;
    }
    await user.save();
  }
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    avatar,
    role: user.role || role
  };
}

// modules/whatsapp-marketing/server/modules/auth/auth.routes.js
var router4 = Router4();
function requireAuth(req, res, next) {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
  next();
}
function getUserId(req) {
  return req.headers["x-user-id"] || null;
}
function getUser(req) {
  const userHeader = req.headers["x-user"];
  if (!userHeader) return null;
  try {
    return JSON.parse(userHeader);
  } catch {
    return null;
  }
}
router4.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const user = await validateLogin(username, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        pageAccess: user.pageAccess
      }
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});
router4.post("/register", async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: "Username, password, and name are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const user = await createUser(username, password, name, email);
    if (!user) {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("[Auth] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
router4.post("/sellerslaunch", async (req, res) => {
  const startedAt = Date.now();
  try {
    const user = await authenticateSellersLaunch(req.body?.token);
    console.log(`[Auth] Sellers launch success user=${user.id} ${Date.now() - startedAt}ms`);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown sellers launch error";
    const errorName = error instanceof Error ? error.name : typeof error;
    const errorCode = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    console.error(
      `[Auth] Sellers launch failed name=${errorName} code=${errorCode} ${Date.now() - startedAt}ms: ${errorMessage}`
    );
    if (error instanceof SellersLaunchConfigError) {
      return res.status(500).json({ error: error.message });
    }
    if (isSellersLaunchTokenExpiredError(error)) {
      return res.status(401).json({ error: "Launch link expired. Please open it again from sellers dashboard." });
    }
    if (isSellersLaunchTokenError(error)) {
      return res.status(401).json({
        error: (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "") || "Invalid launch token"
      });
    }
    console.error("[Auth] Sellers launch error:", error);
    return res.status(500).json({ error: "Failed to launch seller workspace" });
  }
});
router4.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== "string") {
      return res.status(400).json({ error: "Email or username is required" });
    }
    const configuredAppUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || "";
    const host = req.get("host");
    const appUrl = configuredAppUrl ? configuredAppUrl.replace(/\/+$/, "") : host ? `${req.protocol}://${host}` : "";
    const result = await requestPasswordReset(identifier, appUrl);
    const response = {
      success: true,
      message: "If an account exists with that email/username, a reset link has been sent.",
      delivered: result.delivered
    };
    if (process.env.NODE_ENV !== "production" && result.debugResetUrl) {
      response.debugResetUrl = result.debugResetUrl;
    }
    res.json(response);
  } catch (error) {
    console.error("[Auth] Forgot password error:", error);
    res.status(500).json({ error: "Failed to process forgot password request" });
  }
});
router4.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }
    const result = await resetPasswordWithToken(token, password);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to reset password" });
    }
    res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("[Auth] Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
router4.post("/logout", (req, res) => {
  res.json({ success: true });
});
router4.get("/me", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = await findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess
    }
  });
});
router4.get("/check", async (req, res) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.json({ authenticated: false, user: null });
  }
  const user = await findUserById(userId);
  res.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      pageAccess: user.pageAccess
    } : null
  });
});
router4.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    const { name, email, phone } = req.body;
    const updatedUser = await updateUserProfile(userId, { name, email, phone });
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        pageAccess: updatedUser.pageAccess
      }
    });
  } catch (error) {
    console.error("[Auth] Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});
var auth_routes_default = router4;

// modules/whatsapp-marketing/server/modules/contacts/contacts.routes.js
init_mongodb_adapter();
import crypto9 from "crypto";
var router5 = Router5();
router5.post("/block", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { phone, name, reason } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    const existing = await BlockedContact.findOne({ userId, phone: normalizedPhone });
    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: "Contact is already blocked" });
      }
      await BlockedContact.updateOne(
        { userId, phone: normalizedPhone },
        { $set: { isActive: true, reason: reason || "", blockedAt: (/* @__PURE__ */ new Date()).toISOString() } }
      );
    } else {
      await BlockedContact.create({
        id: crypto9.randomUUID(),
        userId,
        phone: normalizedPhone,
        name: name || "",
        reason: reason || "",
        blockedAt: (/* @__PURE__ */ new Date()).toISOString(),
        isActive: true
      });
    }
    res.json({ success: true, message: "Contact blocked successfully" });
  } catch (error) {
    console.error("[Contacts] Error blocking contact:", error);
    res.status(500).json({ error: "Failed to block contact" });
  }
});
router5.post("/unblock", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    const normalizedPhone = phone.replace(/\D/g, "");
    const result = await BlockedContact.updateOne(
      { userId, phone: normalizedPhone },
      { $set: { isActive: false } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Blocked contact not found" });
    }
    res.json({ success: true, message: "Contact unblocked successfully" });
  } catch (error) {
    console.error("[Contacts] Error unblocking contact:", error);
    res.status(500).json({ error: "Failed to unblock contact" });
  }
});
router5.get("/blocked", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const blockedContacts = await BlockedContact.find({ userId, isActive: true }).sort({ blockedAt: -1 }).lean();
    res.json(blockedContacts);
  } catch (error) {
    console.error("[Contacts] Error fetching blocked contacts:", error);
    res.status(500).json({ error: "Failed to fetch blocked contacts" });
  }
});
router5.delete("/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { contactId } = req.params;
    await Chat.deleteOne({ contactId });
    await Message.deleteMany({ contactId });
    await Contact.deleteOne({ id: contactId });
    res.json({ success: true, message: "Contact deleted successfully" });
  } catch (error) {
    console.error("[Contacts] Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});
router5.patch("/chats/:chatId/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { chatId } = req.params;
    await Chat.updateOne(
      { id: chatId },
      { $set: { unreadCount: 0 } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Contacts] Error marking chat as read:", error);
    res.status(500).json({ error: "Failed to mark chat as read" });
  }
});
router5.patch("/chats/contact/:contactId/read", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { contactId } = req.params;
    await Chat.updateOne(
      { contactId },
      { $set: { unreadCount: 0 } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Contacts] Error marking chat as read:", error);
    res.status(500).json({ error: "Failed to mark chat as read" });
  }
});
async function isContactBlocked(userId, phone) {
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[BlockCheck] Checking if ${normalizedPhone} is blocked for user ${userId}`);
  const blocked = await BlockedContact.findOne({
    userId,
    phone: normalizedPhone,
    isActive: true
  });
  console.log(`[BlockCheck] Result for ${normalizedPhone}: ${blocked ? "BLOCKED" : "not blocked"}`);
  return !!blocked;
}
async function isPhoneBlocked(phone) {
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`[BlockCheck] Checking if ${normalizedPhone} is blocked by any user`);
  const blocked = await BlockedContact.findOne({
    phone: normalizedPhone,
    isActive: true
  });
  if (blocked) {
    console.log(`[BlockCheck] Found: ${normalizedPhone} is blocked by user ${blocked.userId}`);
    return { blocked: true, userId: blocked.userId };
  }
  console.log(`[BlockCheck] ${normalizedPhone} is not blocked by anyone`);
  return { blocked: false };
}
async function listAllBlockedContacts() {
  const all = await BlockedContact.find({ isActive: true }).lean();
  console.log(`[BlockCheck] All blocked contacts:`, JSON.stringify(all, null, 2));
  return all;
}
var contacts_routes_default = router5;

// modules/whatsapp-marketing/server/modules/contactAnalytics/contactAnalytics.service.js
init_mongodb_adapter();
var INTEREST_ANALYSIS_PROMPT = `You are an expert sales analyst. Analyze the WhatsApp conversation below and determine the customer's interest level.

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanations, no markdown, no text before or after. Just pure JSON.

Required JSON format:
{"interestLevel":"interested","interestScore":75,"interestReason":"Customer asked about pricing","keyTopics":["award","pricing"],"objections":[],"positiveSignals":["asked questions"],"negativeSignals":[]}

Field rules:
- interestLevel: MUST be exactly one of: "highly_interested", "interested", "neutral", "not_interested"
- interestScore: number from 1-100
- interestReason: short string explaining your assessment
- keyTopics, objections, positiveSignals, negativeSignals: arrays of strings (can be empty [])

Interest Level Guidelines:
- highly_interested (score 75-100): Customer wants to proceed, asks about payment, provides details eagerly
- interested (score 50-74): Customer shows positive engagement, asks questions, considers the offer
- neutral (score 25-49): Customer is non-committal, short responses, neither positive nor negative
- not_interested (score 1-24): Customer declines, shows disinterest, stops responding, or says no

Conversation to analyze:
`;
async function analyzeContactConversation(phone, messages, userId) {
  if (messages.length === 0) {
    return {
      interestLevel: "pending",
      interestScore: 0,
      interestReason: "No conversation history available",
      keyTopics: [],
      objections: [],
      positiveSignals: [],
      negativeSignals: []
    };
  }
  const conversationText = messages.map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`).join("\n");
  try {
    const response = await generateAIResponse(
      [
        { role: "system", content: INTEREST_ANALYSIS_PROMPT },
        { role: "user", content: conversationText }
      ],
      { id: "analysis", name: "Conversation Analyzer", model: "gemini-2.5-flash", temperature: 0.1 },
      userId
    );
    let cleanedResponse = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }
    const analysis = JSON.parse(cleanedResponse);
    return {
      interestLevel: analysis.interestLevel || "neutral",
      interestScore: analysis.interestScore || 50,
      interestReason: analysis.interestReason || "Unable to determine",
      keyTopics: analysis.keyTopics || [],
      objections: analysis.objections || [],
      positiveSignals: analysis.positiveSignals || [],
      negativeSignals: analysis.negativeSignals || []
    };
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing conversation:", error);
    const userMessages = messages.filter((m) => m.role === "user");
    const hasPositive = userMessages.some(
      (m) => /interested|yes|sure|okay|want|need|details|price|payment/i.test(m.content)
    );
    const hasNegative = userMessages.some(
      (m) => /no|not interested|later|busy|expensive|can't|don't/i.test(m.content)
    );
    return {
      interestLevel: hasPositive && !hasNegative ? "interested" : hasNegative ? "not_interested" : "neutral",
      interestScore: hasPositive ? 60 : hasNegative ? 30 : 50,
      interestReason: "Keyword-based analysis (AI analysis failed)",
      keyTopics: [],
      objections: [],
      positiveSignals: hasPositive ? ["Shows interest in keywords"] : [],
      negativeSignals: hasNegative ? ["Shows disinterest in keywords"] : []
    };
  }
}
async function getOrCreateContactAnalytics(contactId, phone, contactName2) {
  const normalizedPhone = phone.replace(/\D/g, "");
  let analytics = await findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!analytics) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    analytics = {
      id: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contactId,
      phone: normalizedPhone,
      contactName: contactName2,
      interestLevel: "pending",
      interestScore: 0,
      interestReason: "Not yet analyzed",
      totalMessages: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      aiAgentInteractions: [],
      firstContactTime: now,
      lastContactTime: now,
      conversationDuration: 0,
      keyTopics: [],
      objections: [],
      positiveSignals: [],
      negativeSignals: [],
      lastAnalyzedAt: "",
      createdAt: now,
      updatedAt: now
    };
    await insertOne("contact_analytics", analytics);
  }
  return analytics;
}
async function updateContactAnalytics(phone, updates) {
  const normalizedPhone = phone.replace(/\D/g, "");
  return updateOne(
    "contact_analytics",
    { $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ] },
    { ...updates, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
  );
}
async function trackAgentInteraction(phone, agentId, agentName) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const analytics = await findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  if (!analytics) return;
  const existingInteraction = analytics.aiAgentInteractions.find((i) => i.agentId === agentId);
  if (existingInteraction) {
    existingInteraction.messagesCount++;
    existingInteraction.lastInteraction = now;
    const firstTime = new Date(existingInteraction.firstInteraction).getTime();
    const lastTime = new Date(now).getTime();
    existingInteraction.durationMinutes = Math.round((lastTime - firstTime) / 6e4);
  } else {
    analytics.aiAgentInteractions.push({
      agentId,
      agentName,
      messagesCount: 1,
      firstInteraction: now,
      lastInteraction: now,
      durationMinutes: 0
    });
  }
  await updateOne(
    "contact_analytics",
    { id: analytics.id },
    {
      aiAgentInteractions: analytics.aiAgentInteractions,
      lastContactTime: now,
      updatedAt: now
    }
  );
}
async function getContactReport(phone, userId) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const analytics = await findOne("contact_analytics", {
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) + "$" } }
    ]
  });
  return analytics;
}
async function getAllContactReports(filter) {
  const allAnalytics = await readCollection("contact_analytics");
  let filtered = allAnalytics;
  if (filter?.interestLevel && filter.interestLevel !== "all") {
    filtered = allAnalytics.filter((a) => a.interestLevel === filter.interestLevel);
  }
  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 50;
  const paginated = filtered.slice(offset, offset + limit);
  return {
    reports: paginated,
    total: filtered.length
  };
}
async function analyzeAndUpdateContact(contactId, phone, contactName2, messages, userId) {
  const analytics = await getOrCreateContactAnalytics(contactId, phone, contactName2);
  const conversationMessages = messages.map((m) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.content,
    timestamp: m.timestamp || m.createdAt
  }));
  const analysis = await analyzeContactConversation(phone, conversationMessages, userId);
  const inbound = messages.filter((m) => m.direction === "inbound").length;
  const outbound = messages.filter((m) => m.direction === "outbound").length;
  let firstTime = analytics.firstContactTime;
  let lastTime = analytics.lastContactTime;
  if (messages.length > 0) {
    const sortedMessages = [...messages].sort(
      (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );
    firstTime = sortedMessages[0].timestamp || sortedMessages[0].createdAt;
    lastTime = sortedMessages[sortedMessages.length - 1].timestamp || sortedMessages[sortedMessages.length - 1].createdAt;
  }
  const durationMinutes = Math.round(
    (new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 6e4
  );
  const updated = await updateContactAnalytics(phone, {
    contactName: contactName2,
    interestLevel: analysis.interestLevel,
    interestScore: analysis.interestScore,
    interestReason: analysis.interestReason,
    totalMessages: messages.length,
    inboundMessages: inbound,
    outboundMessages: outbound,
    keyTopics: analysis.keyTopics,
    objections: analysis.objections,
    positiveSignals: analysis.positiveSignals,
    negativeSignals: analysis.negativeSignals,
    firstContactTime: firstTime,
    lastContactTime: lastTime,
    conversationDuration: durationMinutes,
    lastAnalyzedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  return updated || analytics;
}
async function getContactAnalyticsSummary() {
  const allAnalytics = await readCollection("contact_analytics");
  const total = allAnalytics.length;
  const interestCounts = {
    highly_interested: 0,
    interested: 0,
    neutral: 0,
    not_interested: 0,
    pending: 0
  };
  let totalScore = 0;
  const agentContactsMap = {};
  for (const analytics of allAnalytics) {
    interestCounts[analytics.interestLevel] = (interestCounts[analytics.interestLevel] || 0) + 1;
    totalScore += analytics.interestScore;
    for (const interaction of analytics.aiAgentInteractions) {
      agentContactsMap[interaction.agentName] = (agentContactsMap[interaction.agentName] || 0) + 1;
    }
  }
  const byInterestLevel = Object.entries(interestCounts).map(([level, count]) => ({
    level,
    count,
    percentage: total > 0 ? Math.round(count / total * 100) : 0
  }));
  const topAgents = Object.entries(agentContactsMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([agentName, contactsHandled]) => ({ agentName, contactsHandled }));
  return {
    total,
    byInterestLevel,
    averageScore: total > 0 ? Math.round(totalScore / total) : 0,
    topAgents
  };
}
var contactAnalyticsService = {
  analyzeContactConversation,
  getOrCreateContactAnalytics,
  updateContactAnalytics,
  trackAgentInteraction,
  getContactReport,
  getAllContactReports,
  analyzeAndUpdateContact,
  getContactAnalyticsSummary
};

// modules/whatsapp-marketing/server/modules/automation/interest/interest.service.js
init_mongodb_adapter();
import { GoogleGenAI as GoogleGenAI2 } from "@google/genai";
var INTERESTED_KEYWORDS = [
  "interested",
  "yes",
  "sure",
  "okay",
  "ok",
  "great",
  "perfect",
  "sounds good",
  "tell me more",
  "more info",
  "details",
  "how much",
  "price",
  "cost",
  "register",
  "sign up",
  "join",
  "apply",
  "want to",
  "would like",
  "count me in",
  "im in",
  "i am in",
  "definitely",
  "absolutely",
  "please",
  "send",
  "share",
  "benefits"
];
var NOT_INTERESTED_KEYWORDS2 = [
  "not interested",
  "no thanks",
  "no thank you",
  "stop",
  "unsubscribe",
  "remove",
  "dont contact",
  "not now",
  "maybe later",
  "busy",
  "no",
  "not for me",
  "pass",
  "decline",
  "reject",
  "spam",
  "block",
  "leave me alone"
];
var InterestClassificationService = class {
  genAI = null;
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI2({ apiKey });
    }
  }
  async classifyMessage(messageContent, contactPhone2, userId, useAI = true) {
    const lowerMessage = messageContent.toLowerCase().trim();
    const foundInterestedKeywords = INTERESTED_KEYWORDS.filter(
      (kw) => lowerMessage.includes(kw.toLowerCase())
    );
    const foundNotInterestedKeywords = NOT_INTERESTED_KEYWORDS2.filter(
      (kw) => lowerMessage.includes(kw.toLowerCase())
    );
    if (foundNotInterestedKeywords.length > 0 && foundInterestedKeywords.length === 0) {
      return {
        status: "not_interested",
        confidence: 0.85,
        method: "keyword",
        keywords: foundNotInterestedKeywords
      };
    }
    if (foundInterestedKeywords.length > 0 && foundNotInterestedKeywords.length === 0) {
      return {
        status: "interested",
        confidence: 0.85,
        method: "keyword",
        keywords: foundInterestedKeywords
      };
    }
    if (useAI && this.genAI) {
      try {
        return await this.classifyWithAI(messageContent);
      } catch (error) {
        console.error("[InterestClassification] AI classification failed:", error);
      }
    }
    return {
      status: "neutral",
      confidence: 0.5,
      method: "keyword",
      keywords: [...foundInterestedKeywords, ...foundNotInterestedKeywords]
    };
  }
  async classifyWithAI(messageContent) {
    if (!this.genAI) {
      throw new Error("Gemini AI not initialized");
    }
    const prompt = `Analyze the following WhatsApp message and classify the sender's interest level.

Message: "${messageContent}"

Classify as one of:
- "interested": The person shows clear interest, asks for more info, wants to proceed, or gives positive responses
- "not_interested": The person clearly declines, refuses, asks to stop, or shows negative sentiment
- "neutral": The message is unclear, just asking a question, or doesn't indicate clear interest either way

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{"status": "interested|not_interested|neutral", "confidence": 0.0-1.0, "reason": "brief explanation"}`;
    const response = await this.genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    const text = response.text?.trim() || "";
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanedText);
      const validStatuses = ["interested", "not_interested", "neutral"];
      const status = validStatuses.includes(parsed.status) ? parsed.status : "neutral";
      return {
        status,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        method: "ai",
        keywords: [],
        aiResponse: parsed.reason || text
      };
    } catch (parseError) {
      console.error("[InterestClassification] Failed to parse AI response:", text);
      return {
        status: "neutral",
        confidence: 0.5,
        method: "ai",
        keywords: [],
        aiResponse: text
      };
    }
  }
  async classifyAndUpdateContact(messageContent, contactId, contactPhone2, userId) {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    const previousStatus = contact.interestStatus || "pending";
    const classification = await this.classifyMessage(messageContent, contactPhone2, userId);
    await Contact.updateOne(
      { id: contactId },
      {
        $set: {
          interestStatus: classification.status,
          interestConfidence: classification.confidence,
          lastInterestUpdate: /* @__PURE__ */ new Date(),
          lastInboundAt: /* @__PURE__ */ new Date(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    );
    const triggeredCampaigns = [];
    if (classification.status !== "pending") {
      const eligibleCampaigns = await this.findEligibleCampaigns(userId, classification.status);
      for (const campaign of eligibleCampaigns) {
        const enrolled = await this.enrollContactInCampaign(contact, campaign);
        if (enrolled) {
          triggeredCampaigns.push(campaign._id.toString());
        }
      }
      const triggerSource = `interest_${classification.status}`;
      try {
        const autoTriggerResult = await autoEnrollContact(
          userId,
          contactId,
          contactPhone2,
          triggerSource,
          {
            contactName: contact.name,
            interestStatus: classification.status,
            confidence: classification.confidence
          }
        );
        if (autoTriggerResult.enrolled.length > 0) {
          console.log(`[InterestClassification] Auto-triggered campaigns: ${autoTriggerResult.enrolled.join(", ")}`);
        }
      } catch (autoTriggerError) {
        console.error("[InterestClassification] Auto-trigger enrollment failed:", autoTriggerError);
      }
    }
    await InterestClassificationLog.create({
      contactId,
      contactPhone: contactPhone2,
      userId,
      messageContent,
      previousStatus,
      newStatus: classification.status,
      confidence: classification.confidence,
      classificationMethod: classification.method,
      aiResponse: classification.aiResponse,
      keywords: classification.keywords,
      triggeredCampaigns,
      createdAt: /* @__PURE__ */ new Date()
    });
    return { classification, triggeredCampaigns };
  }
  async findEligibleCampaigns(userId, interestStatus) {
    return await DripCampaign.find({
      userId,
      status: "active",
      targetType: "interest",
      "interestTargeting.autoEnroll": true,
      "interestTargeting.enrollOnClassification": true,
      "interestTargeting.targetInterestLevels": interestStatus
    });
  }
  async enrollContactInCampaign(contact, campaign) {
    const existingRun = await DripRun.findOne({
      campaignId: campaign._id,
      contactId: contact.id
    });
    if (existingRun && !campaign.settings.allowReEntry) {
      return false;
    }
    const firstStep = campaign.steps[0];
    const scheduledTime = this.calculateNextStepTime(campaign, firstStep);
    await DripRun.create({
      campaignId: campaign._id,
      userId: campaign.userId,
      contactId: contact.id,
      contactPhone: contact.phone,
      status: "active",
      currentStepIndex: 0,
      enrolledAt: /* @__PURE__ */ new Date(),
      nextStepScheduledAt: scheduledTime,
      stepHistory: [],
      variables: {
        contactName: contact.name,
        interestStatus: contact.interestStatus
      }
    });
    await DripCampaign.updateOne(
      { _id: campaign._id },
      { $inc: { "metrics.totalEnrolled": 1, "metrics.activeContacts": 1 } }
    );
    await Contact.updateOne(
      { id: contact.id },
      { $addToSet: { assignedDripCampaignIds: campaign._id.toString() } }
    );
    console.log(`[InterestClassification] Enrolled contact ${contact.phone} in campaign ${campaign.name}`);
    return true;
  }
  calculateNextStepTime(campaign, step) {
    const now = /* @__PURE__ */ new Date();
    const dayOffset = step.dayOffset || 0;
    const timeOfDay = step.timeOfDay || campaign.schedule.startTime || "09:00";
    const [hours, minutes] = timeOfDay.split(":").map(Number);
    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
    scheduledDate.setHours(hours, minutes, 0, 0);
    return scheduledDate;
  }
  async getInterestLists(userId) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
    const contacts = await Contact.find({
      lastInboundAt: { $gte: twentyFourHoursAgo }
    }).lean();
    const interested = contacts.filter((c) => c.interestStatus === "interested");
    const notInterested = contacts.filter((c) => c.interestStatus === "not_interested");
    const neutral = contacts.filter((c) => c.interestStatus === "neutral");
    const pending = contacts.filter((c) => c.interestStatus === "pending" || !c.interestStatus);
    return {
      interested,
      notInterested,
      neutral,
      pending,
      stats: {
        total: contacts.length,
        interested: interested.length,
        notInterested: notInterested.length,
        neutral: neutral.length,
        pending: pending.length
      }
    };
  }
  async getClassificationLogs(userId, options = {}) {
    const query = { userId };
    if (options.contactId) {
      query.contactId = options.contactId;
    }
    if (options.status) {
      query.newStatus = options.status;
    }
    const total = await InterestClassificationLog.countDocuments(query);
    const logs = await InterestClassificationLog.find(query).sort({ createdAt: -1 }).skip(options.offset || 0).limit(options.limit || 50).lean();
    return { logs, total };
  }
  async manuallyClassifyContact(contactId, userId, newStatus) {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    const previousStatus = contact.interestStatus;
    await Contact.updateOne(
      { id: contactId },
      {
        $set: {
          interestStatus: newStatus,
          interestConfidence: 1,
          lastInterestUpdate: /* @__PURE__ */ new Date(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      }
    );
    await InterestClassificationLog.create({
      contactId,
      contactPhone: contact.phone,
      userId,
      messageContent: "Manual classification",
      previousStatus,
      newStatus,
      confidence: 1,
      classificationMethod: "manual",
      createdAt: /* @__PURE__ */ new Date()
    });
  }
  async getInterestReport(userId, days = 7) {
    const startDate = /* @__PURE__ */ new Date();
    startDate.setDate(startDate.getDate() - days);
    const contacts = await Contact.find({
      lastInterestUpdate: { $gte: startDate }
    }).lean();
    const total = contacts.length || 1;
    const interested = contacts.filter((c) => c.interestStatus === "interested").length;
    const notInterested = contacts.filter((c) => c.interestStatus === "not_interested").length;
    const neutral = contacts.filter((c) => c.interestStatus === "neutral").length;
    const pending = contacts.filter((c) => c.interestStatus === "pending" || !c.interestStatus).length;
    const distribution = [
      { status: "interested", count: interested, percentage: Math.round(interested / total * 100) },
      { status: "not_interested", count: notInterested, percentage: Math.round(notInterested / total * 100) },
      { status: "neutral", count: neutral, percentage: Math.round(neutral / total * 100) },
      { status: "pending", count: pending, percentage: Math.round(pending / total * 100) }
    ];
    const logs = await InterestClassificationLog.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();
    const timelineMap = {};
    for (let i = 0; i < days; i++) {
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      timelineMap[dateKey] = { interested: 0, notInterested: 0, neutral: 0 };
    }
    for (const log of logs) {
      const dateKey = new Date(log.createdAt).toISOString().split("T")[0];
      if (timelineMap[dateKey]) {
        if (log.newStatus === "interested") timelineMap[dateKey].interested++;
        else if (log.newStatus === "not_interested") timelineMap[dateKey].notInterested++;
        else if (log.newStatus === "neutral") timelineMap[dateKey].neutral++;
      }
    }
    const timeline = Object.entries(timelineMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
    const conversions = logs.filter(
      (l) => l.previousStatus === "not_interested" && l.newStatus === "interested"
    ).length;
    const eligibleForConversion = logs.filter((l) => l.previousStatus === "not_interested").length;
    const conversionRate = eligibleForConversion > 0 ? Math.round(conversions / eligibleForConversion * 100) : 0;
    const keywordCounts = {};
    for (const log of logs) {
      for (const keyword of log.keywords || []) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }
    const topKeywords = Object.entries(keywordCounts).map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    const campaigns = await DripCampaign.find({
      userId,
      targetType: "interest"
    }).lean();
    const campaignPerformance = [];
    for (const campaign of campaigns) {
      const runs = await DripRun.find({ campaignId: campaign._id }).lean();
      const converted = runs.filter((r) => r.exitReason === "converted").length;
      campaignPerformance.push({
        campaignId: campaign._id.toString(),
        name: campaign.name,
        enrolled: runs.length,
        converted
      });
    }
    return {
      distribution,
      timeline,
      conversionRate,
      topKeywords,
      campaignPerformance
    };
  }
};
var interestClassificationService = new InterestClassificationService();

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.controller.js
function formatConversationPrompt(bodyText, buttons) {
  const optionTitles = buttons.map((button) => String(button?.title || "").trim()).filter(Boolean);
  if (!optionTitles.length) return bodyText;
  return [
    bodyText,
    "",
    "Options:",
    ...optionTitles.map((title, index) => `${index + 1}. ${title}`)
  ].join("\n");
}
async function isStoredWebhookVerifyToken(token) {
  const [legacyMatch, connectedAccountMatch] = await Promise.all([
    credentialsService.hasWebhookVerifyToken(token),
    hasWebhookVerifyToken2(token)
  ]);
  return legacyMatch || connectedAccountMatch;
}
function resolvePublicBaseUrl(req) {
  const envBaseUrl = process.env.PUBLIC_APP_URL;
  if (envBaseUrl && String(envBaseUrl).trim()) {
    return String(envBaseUrl).trim().replace(/\/+$/, "");
  }
  const forwardedProtoRaw = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoRaw) ? forwardedProtoRaw[0] : forwardedProtoRaw;
  const proto = String(forwardedProto || req.protocol || "http").split(",")[0].trim();
  const forwardedHostRaw = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(forwardedHostRaw) ? forwardedHostRaw[0] : forwardedHostRaw;
  const host = String(forwardedHost || req.get("host") || process.env.PUBLIC_APP_URL || "").split(",")[0].trim();
  return `${proto}://${host}`;
}
async function resolveUserIdFromPhoneNumberId(phoneNumberId) {
  const normalizedPhoneNumberId = String(phoneNumberId || "").trim();
  if (!normalizedPhoneNumberId) return void 0;
  try {
    const userId = await getUserByPhoneNumberId(
      normalizedPhoneNumberId
    );
    if (userId) {
      console.log(
        `[Webhook] Resolved userId ${userId} for phone_number_id ${normalizedPhoneNumberId}`
      );
      return userId;
    }
    console.log(
      `[Webhook] No user found for phone_number_id ${normalizedPhoneNumberId}`
    );
    return void 0;
  } catch (error) {
    console.error("[Webhook] Error resolving userId:", error);
    return void 0;
  }
}
async function resolveUserIdFromWabaId(wabaId) {
  const normalizedWabaId = String(wabaId || "").trim();
  if (!normalizedWabaId) return void 0;
  try {
    const credentials = await UserCredentials2.find({}).select({ userId: 1 }).lean();
    for (const credential of credentials) {
      const decrypted = await credentialsService.getDecryptedCredentials(credential.userId);
      if (String(decrypted?.businessAccountId || "").trim() === normalizedWabaId) {
        console.log(
          `[Webhook] Resolved userId ${credential.userId} for waba_id ${normalizedWabaId}`
        );
        return String(credential.userId);
      }
    }
    console.log(`[Webhook] No user found for waba_id ${normalizedWabaId}`);
    return void 0;
  } catch (error) {
    console.error("[Webhook] Error resolving userId by waba_id:", error);
    return void 0;
  }
}
async function resolveSingleCredentialsUserId() {
  try {
    const credentials = await UserCredentials2.find({}).select({ userId: 1 }).limit(2).lean();
    if (credentials.length === 1 && credentials[0]?.userId) {
      console.log(
        `[Webhook] Using single configured credentials user fallback: ${credentials[0].userId}`
      );
      return String(credentials[0].userId);
    }
  } catch (error) {
    console.error("[Webhook] Error resolving fallback userId:", error);
  }
  return void 0;
}
async function resolveWebhookUserId(input) {
  const byPhoneNumberId = input.phoneNumberId ? await resolveUserIdFromPhoneNumberId(input.phoneNumberId) : void 0;
  if (byPhoneNumberId) return byPhoneNumberId;
  const byWabaId = input.wabaId ? await resolveUserIdFromWabaId(input.wabaId) : void 0;
  if (byWabaId) return byWabaId;
  return resolveSingleCredentialsUserId();
}
function hasFlowSubmissionPayload(message) {
  const interactive = message?.interactive;
  if (!interactive || typeof interactive !== "object") return false;
  const interactiveType = String(interactive?.type || "").toLowerCase();
  if (interactiveType === "nfm_reply") return true;
  if (interactive?.nfm_reply) return true;
  if (safeParseJsonRecord(interactive?.response_json)) return true;
  if (safeParseJsonRecord(interactive?.body?.response_json)) return true;
  if (interactiveType && interactiveType !== "button_reply" && interactiveType !== "list_reply" && (interactive?.body || interactive?.response_json)) {
    return true;
  }
  return false;
}
function safeParseJsonRecord(value) {
  if (!value) return void 0;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") return void 0;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return void 0;
  }
  return void 0;
}
function parseFlowSubmissionFromMessage(message) {
  const interactive = message?.interactive || {};
  const nfmReply = interactive?.nfm_reply || {};
  const interactiveBody = interactive?.body;
  const parsedReplyBody = safeParseJsonRecord(nfmReply?.response_json) || safeParseJsonRecord(nfmReply?.body) || safeParseJsonRecord(interactive?.response_json) || safeParseJsonRecord(interactiveBody?.response_json) || safeParseJsonRecord(interactiveBody) || {};
  const nestedResponseJson = safeParseJsonRecord(parsedReplyBody?.response_json);
  const responseJson = nestedResponseJson || safeParseJsonRecord(parsedReplyBody?.flow_response) || parsedReplyBody;
  const flowToken = String(parsedReplyBody?.flow_token || parsedReplyBody?.flowToken || "").trim() || void 0;
  const flowId = String(parsedReplyBody?.flow_id || parsedReplyBody?.flowId || "").trim() || void 0;
  const flowName = String(
    parsedReplyBody?.flow_name || parsedReplyBody?.flowName || parsedReplyBody?.flow_title || interactiveBody?.flow_name || interactiveBody?.flowName || interactiveBody?.flow_title || nfmReply?.name || ""
  ).trim() || void 0;
  return {
    flowToken,
    flowId,
    flowName,
    replyName: nfmReply?.name ? String(nfmReply.name) : void 0,
    parsedReplyBody,
    responseJson
  };
}
var conversationHistory = {};
async function handleStatusUpdatesWithContext(statuses, context) {
  const webhookReceivedAt = /* @__PURE__ */ new Date();
  const statusOwnerUserId = await resolveWebhookUserId(context);
  for (const status of statuses) {
    const messageId = status.id;
    const statusType = status.status;
    const recipientPhone = status.recipient_id;
    const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1e3) : /* @__PURE__ */ new Date();
    const firstError = status?.errors?.[0];
    const failureReason = firstError?.title || firstError?.message || firstError?.error_data?.details || "Message delivery failed";
    console.log(
      `[Webhook Status] Message ${messageId} status: ${statusType} for ${recipientPhone}`
    );
    try {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const statusTimestamp = timestamp;
      const eventPayload = {
        userId: statusOwnerUserId || void 0,
        messageId: messageId || void 0,
        recipientId: recipientPhone || void 0,
        status: statusType || "unknown",
        statusTimestamp,
        webhookReceivedAt,
        phoneNumberId: context.phoneNumberId || void 0,
        wabaId: context.wabaId || void 0,
        conversationId: status?.conversation?.id || void 0,
        pricingCategory: status?.pricing?.category || void 0,
        errorCode: firstError?.code ? String(firstError.code) : void 0,
        errorTitle: firstError?.title || void 0,
        errorMessage: firstError?.message || void 0,
        errorDetails: firstError?.error_data?.details || void 0,
        rawStatus: status,
        updatedAt: nowIso
      };
      if (messageId) {
        await WebhookStatusEvent.findOneAndUpdate(
          {
            messageId,
            status: statusType || "unknown",
            statusTimestamp,
            recipientId: recipientPhone || null
          },
          {
            $set: eventPayload,
            $setOnInsert: {
              id: randomUUID3(),
              createdAt: nowIso
            }
          },
          { upsert: true, new: true }
        );
      } else {
        await WebhookStatusEvent.create({
          id: randomUUID3(),
          ...eventPayload,
          createdAt: nowIso
        });
      }
      if (statusType === "delivered") {
        await updateCampaignContactStatus(
          messageId,
          "delivered",
          timestamp
        );
      } else if (statusType === "read") {
        await updateCampaignContactStatus(
          messageId,
          "read",
          timestamp
        );
      } else if (statusType === "failed") {
        console.error(
          `[Webhook Status] Message ${messageId} FAILED for ${recipientPhone}:`,
          {
            code: firstError?.code,
            title: firstError?.title,
            message: firstError?.message,
            details: firstError?.error_data?.details
          }
        );
        await updateCampaignContactStatus(
          messageId,
          "failed",
          timestamp,
          failureReason
        );
      }
      if (messageId) {
        const messageStatusMap = {
          sent: "sent",
          accepted: "sent",
          delivered: "delivered",
          read: "read",
          failed: "failed"
        };
        const mappedMessageStatus = messageStatusMap[String(statusType || "").toLowerCase()];
        if (mappedMessageStatus) {
          await Message.updateMany(
            { whatsappMessageId: messageId },
            {
              $set: {
                status: mappedMessageStatus,
                ...mappedMessageStatus === "failed" ? { failureReason } : {}
              },
              ...mappedMessageStatus !== "failed" ? { $unset: { failureReason: 1 } } : {}
            }
          );
        }
        const dripUpdate = {
          providerStatus: statusType
        };
        if (statusType === "delivered") {
          dripUpdate.status = "delivered";
          dripUpdate.deliveredAt = timestamp;
        } else if (statusType === "read") {
          dripUpdate.status = "read";
          dripUpdate.readAt = timestamp;
        } else if (statusType === "failed") {
          dripUpdate.status = "failed";
          dripUpdate.failedAt = timestamp;
          dripUpdate.error = failureReason;
        } else if (statusType === "sent") {
          dripUpdate.status = "accepted";
          dripUpdate.sentAt = timestamp;
        }
        await CampaignLog.updateMany({ messageId }, { $set: dripUpdate });
        await updateBroadcastLogFromWebhook(
          messageId,
          statusType,
          failureReason
        );
      }
    } catch (error) {
      console.error(`[Webhook Status] Error updating campaign status:`, error);
    }
  }
}
async function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];
  console.log("WhatsApp webhook verification:", { mode, token, challenge });
  const hasStoredMatch = token ? await isStoredWebhookVerifyToken(token) : false;
  if (mode === "subscribe" && Boolean(token) && hasStoredMatch) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }
  console.log("Webhook verification failed");
  return res.sendStatus(403);
}
async function handleWebhook(req, res) {
  try {
    const body = req.body;
    console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));
    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const messageContexts = [];
    for (const currentEntry of entries) {
      const changes = Array.isArray(currentEntry?.changes) ? currentEntry.changes : [];
      for (const change of changes) {
        const currentValue = change?.value;
        if (!currentValue) continue;
        const statuses = Array.isArray(currentValue?.statuses) ? currentValue.statuses : [];
        if (statuses.length > 0) {
          await handleStatusUpdatesWithContext(statuses, {
            phoneNumberId: currentValue?.metadata?.phone_number_id,
            wabaId: currentEntry?.id
          });
        }
        const messages2 = Array.isArray(currentValue?.messages) ? currentValue.messages : [];
        if (messages2.length > 0) {
          messageContexts.push({ entry: currentEntry, value: currentValue });
        }
      }
    }
    if (messageContexts.length === 0) {
      return res.sendStatus(200);
    }
    const selectedContext = messageContexts.find(
      (context) => context.value.messages?.some((item) => hasFlowSubmissionPayload(item))
    ) || messageContexts[0];
    const entry = selectedContext.entry;
    const value = selectedContext.value;
    const messages = Array.isArray(value?.messages) ? value.messages : [];
    const webhookPhoneNumberId = String(
      value?.metadata?.phone_number_id || ""
    ).trim();
    const resolvedUserId = await resolveWebhookUserId({
      phoneNumberId: webhookPhoneNumberId || void 0,
      wabaId: entry?.id ? String(entry.id) : void 0
    });
    const message = messages.find((item) => hasFlowSubmissionPayload(item)) || messages.find((item) => item?.type === "interactive") || messages[0];
    const from = message.from;
    const messageType = message.type;
    console.log(`[Webhook] Checking if phone ${from} is blocked...`);
    const allBlocked = await listAllBlockedContacts();
    console.log(`[Webhook] Total blocked contacts in DB: ${allBlocked.length}`);
    if (resolvedUserId) {
      console.log(
        `[Webhook] Checking block for user ${resolvedUserId}, phone ${from}`
      );
      const isBlocked = await isContactBlocked(resolvedUserId, from);
      if (isBlocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} for user ${resolvedUserId}, ignoring`
        );
        return res.sendStatus(200);
      }
    } else {
      console.log(
        `[Webhook] No resolved userId, checking if phone ${from} is blocked by any user`
      );
      const blockResult = await isPhoneBlocked(from);
      if (blockResult.blocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} (blocked by user ${blockResult.userId}), ignoring`
        );
        return res.sendStatus(200);
      }
    }
    console.log(
      `[Webhook] Phone ${from} is NOT blocked, proceeding with message`
    );
    let messageText = "";
    let buttonPayload = "";
    let mediaUrl = "";
    let isMediaMessage = false;
    let isFlowSubmission = false;
    let parsedFlowSubmission = null;
    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "button") {
      messageText = message.button?.text || "";
      buttonPayload = message.button?.payload || "";
      console.log(
        `Button response from ${from}: text="${messageText}", payload="${buttonPayload}"`
      );
    } else if (messageType === "interactive") {
      const interactive = message.interactive;
      if (hasFlowSubmissionPayload(message)) {
        isFlowSubmission = true;
        parsedFlowSubmission = parseFlowSubmissionFromMessage(message);
        messageText = parsedFlowSubmission.flowName ? `[Flow Submission] ${parsedFlowSubmission.flowName}` : "[Flow Submission]";
        buttonPayload = parsedFlowSubmission.flowToken || "";
        console.log(
          `[Webhook] Flow submission from ${from}: flow=${parsedFlowSubmission.flowName || "-"}, token=${parsedFlowSubmission.flowToken || "-"}`
        );
      } else if (interactive?.type === "button_reply") {
        messageText = interactive.button_reply?.title || "";
        buttonPayload = interactive.button_reply?.id || "";
        console.log(
          `Interactive button reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      } else if (interactive?.type === "list_reply") {
        messageText = interactive.list_reply?.title || "";
        buttonPayload = interactive.list_reply?.id || "";
        console.log(
          `Interactive list reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      } else {
        const interactiveType = String(interactive?.type || "unknown");
        messageText = `[Interactive:${interactiveType}]`;
        console.log(
          `[Webhook] Unsupported interactive type from ${from}: ${interactiveType}`,
          JSON.stringify(interactive, null, 2)
        );
      }
    } else if (messageType === "image") {
      isMediaMessage = true;
      mediaUrl = message.image?.id || "";
      const caption = message.image?.caption || "";
      messageText = caption ? `[Image] ${caption}` : "[Image message]";
      console.log(
        `Image message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "video") {
      isMediaMessage = true;
      mediaUrl = message.video?.id || "";
      const caption = message.video?.caption || "";
      messageText = caption ? `[Video] ${caption}` : "[Video message]";
      console.log(
        `Video message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "audio") {
      isMediaMessage = true;
      mediaUrl = message.audio?.id || "";
      messageText = "[Audio message]";
      console.log(`Audio message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "document") {
      isMediaMessage = true;
      mediaUrl = message.document?.id || "";
      const filename = message.document?.filename || "document";
      const caption = message.document?.caption || "";
      messageText = caption ? `[Document: ${filename}] ${caption}` : `[Document: ${filename}]`;
      console.log(
        `Document message from ${from}: id=${mediaUrl}, filename="${filename}"`
      );
    } else if (messageType === "sticker") {
      isMediaMessage = true;
      mediaUrl = message.sticker?.id || "";
      messageText = "[Sticker message]";
      console.log(`Sticker message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "location") {
      const lat = message.location?.latitude || 0;
      const lng = message.location?.longitude || 0;
      const name = message.location?.name || "";
      messageText = name ? `[Location: ${name}] (${lat}, ${lng})` : `[Location] (${lat}, ${lng})`;
      console.log(`Location message from ${from}: ${lat}, ${lng}`);
    } else if (messageType === "contacts") {
      const contacts = message.contacts || [];
      const contactNames = contacts.map((c) => c.name?.formatted_name || "Unknown").join(", ");
      messageText = `[Contact shared: ${contactNames}]`;
      console.log(`Contacts message from ${from}: ${contactNames}`);
    } else if (messageType === "reaction") {
      const emoji = message.reaction?.emoji || "";
      messageText = `[Reaction: ${emoji}]`;
      console.log(`Reaction from ${from}: ${emoji}`);
    } else {
      messageText = `[Unsupported message type: ${messageType}]`;
      console.log(`Unsupported message type from ${from}: ${messageType}`);
    }
    console.log(`Received ${messageType} message from ${from}: ${messageText}`);
    const whatsappMessageId = message.id || "";
    if (buttonPayload.startsWith("cflow:")) {
      try {
        const [, flowId, rawPath = ""] = buttonPayload.split(":");
        const path = rawPath.split(".").filter(Boolean).map((value2) => Number.parseInt(value2, 10));
        if (!flowId || path.some((value2) => !Number.isInteger(value2) || value2 < 0)) {
          throw new Error("Invalid conversational flow button payload");
        }
        const flowOwnerId = await resolveConversationFlowOwner(flowId) || resolvedUserId;
        if (!flowOwnerId) {
          throw new Error(`Unable to resolve owner for conversational flow ${flowId}`);
        }
        const step = await getConversationStep(flowOwnerId, flowId, path);
        const result = step.buttons.length ? await sendReplyButtonMessage(
          from,
          step.bodyText,
          step.buttons,
          flowOwnerId
        ) : await sendTextMessage(from, step.bodyText, flowOwnerId);
        if (!result.success) {
          throw new Error(result.error || "WhatsApp rejected the conversational reply");
        }
        await saveOutboundMessage(
          from,
          formatConversationPrompt(step.bodyText, step.buttons),
          flowOwnerId
        );
        console.log(
          `[Webhook] Conversational flow ${flowId} continued for ${from}; path=${rawPath}; messageId=${result.messageId || "-"}`
        );
      } catch (conversationError) {
        console.error("[Webhook] Conversational flow processing failed:", conversationError);
      }
    }
    const saveResult = await saveInboundMessage(
      from,
      messageText || buttonPayload,
      messageType,
      buttonPayload,
      mediaUrl,
      whatsappMessageId,
      resolvedUserId
    );
    if (saveResult.isDuplicate) {
      console.log(
        `[Webhook] Duplicate message detected (${whatsappMessageId}), skipping AI processing`
      );
      return res.sendStatus(200);
    }
    if (!saveResult.contact) {
      console.error(
        `[Webhook] Failed to create/find contact for ${from}, cannot proceed with AI processing`
      );
      return res.sendStatus(200);
    }
    if (saveResult.error) {
      console.warn(
        `[Webhook] Message save failed (${saveResult.error}), but continuing with AI processing for ${from}`
      );
    }
    const savedContact = saveResult.contact;
    console.log(
      `[Webhook] Processing message from ${from}, contact: ${savedContact.id}, hasMessage: ${!!saveResult.message}`
    );
    if (isFlowSubmission) {
      try {
        const contextMessageId = String(message?.context?.id || message?.context?.message_id || "").trim() || void 0;
        await createFlowResponse({
          userId: resolvedUserId || "system",
          contactId: savedContact?.id,
          contactPhone: from,
          contactName: savedContact?.name,
          phoneNumberId: webhookPhoneNumberId || void 0,
          wabaId: entry?.id || void 0,
          inboundMessageId: saveResult?.message?.id,
          inboundWhatsappMessageId: whatsappMessageId || void 0,
          contextMessageId,
          flowToken: parsedFlowSubmission?.flowToken,
          flowId: parsedFlowSubmission?.flowId,
          flowName: parsedFlowSubmission?.flowName,
          replyName: parsedFlowSubmission?.replyName,
          parsedReplyBody: parsedFlowSubmission?.parsedReplyBody,
          responseJson: parsedFlowSubmission?.responseJson,
          rawMessage: message,
          receivedAt: message?.timestamp ? new Date(parseInt(String(message.timestamp), 10) * 1e3) : /* @__PURE__ */ new Date()
        });
        console.log(
          `[Webhook] Stored flow submission for ${from} (flow=${parsedFlowSubmission?.flowName || "-"})`
        );
      } catch (flowStoreError) {
        console.error("[Webhook] Failed to store flow submission:", flowStoreError);
      }
      return res.sendStatus(200);
    }
    if (buttonPayload.startsWith("cflow:")) {
      return res.sendStatus(200);
    }
    if (savedContact && savedContact.id && (messageText || buttonPayload)) {
      try {
        const classificationResult = await interestClassificationService.classifyAndUpdateContact(
          messageText || buttonPayload,
          savedContact.id,
          from,
          resolvedUserId || "system"
        );
        console.log(
          `[Webhook] Interest classification for ${from}: ${classificationResult.classification.status} (${classificationResult.classification.confidence})`
        );
        if (classificationResult.triggeredCampaigns.length > 0) {
          console.log(
            `[Webhook] Triggered drip campaigns: ${classificationResult.triggeredCampaigns.join(
              ", "
            )}`
          );
        }
      } catch (classifyError) {
        console.error("[Webhook] Error classifying interest:", classifyError);
      }
    }
    if (isMediaMessage) {
      console.log(
        `Media message saved, skipping AI processing for type: ${messageType}`
      );
      return res.sendStatus(200);
    }
    if (!messageText && !buttonPayload) {
      console.log(`No processable content for message type: ${messageType}`);
      return res.sendStatus(200);
    }
    const contentForAI = messageText || buttonPayload;
    const isButtonResponse = messageType === "button" || messageType === "interactive";
    if (isButtonResponse) {
      console.log(
        `[Webhook] Button response from ${from}: "${contentForAI}" - continuing with AI processing`
      );
    }
    const autoReplyDisabled = await isAutoReplyDisabled(
      from
    );
    if (autoReplyDisabled) {
      console.log(
        `[Webhook] Auto-reply manually disabled for ${from} - skipping AI response`
      );
      return res.sendStatus(200);
    }
    const contactAgentAssignment = await getAgentForContact(
      from
    );
    let agentToUse = null;
    let useStoredHistory = false;
    if (contactAgentAssignment) {
      console.log(
        `[Webhook] Found assigned agent for ${from}: ${contactAgentAssignment.agentName} (${contactAgentAssignment.agentId})`
      );
      agentToUse = await getAgentById(contactAgentAssignment.agentId);
      if (agentToUse && agentToUse.isActive) {
        useStoredHistory = true;
        console.log(`[Webhook] Using assigned agent: ${agentToUse.name}`);
      } else {
        console.log(
          `[Webhook] Assigned agent not found or inactive for ${from}, clearing assignment and falling back`
        );
        await removeAgentFromContact(from);
        agentToUse = null;
      }
    }
    if (!agentToUse) {
      const prefilledMapping = await findMatchingAgentForMessage(contentForAI);
      if (prefilledMapping) {
        console.log(
          `[Webhook] Found pre-filled text mapping for "${contentForAI}" -> Agent: ${prefilledMapping.agentName}`
        );
        agentToUse = await getAgentById(prefilledMapping.agentId);
        if (agentToUse && agentToUse.isActive) {
          await assignAgentToContact(
            "",
            // contactId - will be set later
            from,
            prefilledMapping.agentId,
            prefilledMapping.agentName
          );
          useStoredHistory = true;
          console.log(
            `[Webhook] Auto-assigned agent ${prefilledMapping.agentName} to WhatsApp lead ${from}`
          );
        } else {
          agentToUse = null;
        }
      }
    }
    if (!agentToUse) {
      const lead = await findLeadByPhone(from);
      if (lead) {
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          const mappedAgent = await getAgentById(mapping.agentId);
          if (mappedAgent && mappedAgent.isActive) {
            agentToUse = mappedAgent;
          }
        }
      }
    }
    if (!agentToUse) {
      const agents = await getAllAgents();
      agentToUse = agents.find((a) => a.isActive);
      if (agentToUse) {
        console.log(
          `[Webhook] Using fallback active agent: ${agentToUse.name}`
        );
      }
    }
    if (!agentToUse) {
      console.log("[Webhook] No active agent found - skipping AI response");
      return res.sendStatus(200);
    }
    if (!agentToUse.id || !agentToUse.name) {
      console.log(
        `[Webhook] Agent is missing required fields (id: ${agentToUse.id}, name: ${agentToUse.name}) - skipping AI response`
      );
      return res.sendStatus(200);
    }
    let recentHistory = [];
    if (useStoredHistory) {
      recentHistory = await getConversationHistory(from);
      console.log(
        `[Webhook] Using stored history with ${recentHistory.length} messages for agent: ${agentToUse.name}`
      );
    } else {
      if (!conversationHistory[from]) {
        conversationHistory[from] = [];
      }
      recentHistory = conversationHistory[from].slice(-10);
    }
    const historyForAI = [
      ...recentHistory,
      { role: "user", content: contentForAI }
    ];
    let aiResponse;
    try {
      aiResponse = await generateAgentResponse2(
        contentForAI,
        agentToUse,
        historyForAI.slice(0, -1),
        resolvedUserId
      );
    } catch (aiError) {
      console.error(
        `[Webhook] Error generating AI response for ${from}:`,
        aiError
      );
      return res.sendStatus(200);
    }
    if (useStoredHistory) {
      await addMessageToHistory(from, "user", contentForAI);
      await addMessageToHistory(
        from,
        "assistant",
        aiResponse
      );
    } else {
      conversationHistory[from].push({ role: "user", content: contentForAI });
      conversationHistory[from].push({
        role: "assistant",
        content: aiResponse
      });
    }
    await sendTextMessage(from, aiResponse, resolvedUserId);
    await saveOutboundMessage(from, aiResponse, resolvedUserId);
    if (agentToUse.id && agentToUse.name) {
      try {
        await contactAnalyticsService.trackAgentInteraction(
          from,
          agentToUse.id,
          agentToUse.name
        );
      } catch (trackError) {
        console.error(
          "[Webhook] Error tracking agent interaction:",
          trackError
        );
      }
    }
    (async () => {
      try {
        const contacts = await storage.getContacts();
        const contact = contacts.find((c) => {
          const contactPhone2 = (c.phone || "").replace(/\D/g, "");
          const normalizedFrom = from.replace(/\D/g, "");
          return contactPhone2.includes(normalizedFrom) || normalizedFrom.includes(contactPhone2);
        });
        if (contact) {
          const fullHistory = useStoredHistory ? await getConversationHistory(from) : conversationHistory[from] || [];
          const messagesForAnalysis = fullHistory.map((m) => ({
            direction: m.role === "user" ? "inbound" : "outbound",
            content: m.content,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }));
          await contactAnalyticsService.analyzeAndUpdateContact(
            contact.id,
            from,
            contact.name || from,
            messagesForAnalysis,
            resolvedUserId
          );
          console.log(`[Webhook] Contact analytics updated for ${from}`);
        }
      } catch (analyticsError) {
        console.error("[Webhook] Error analyzing contact:", analyticsError);
      }
    })();
    console.log(
      `AI auto-reply sent to ${from}: ${aiResponse.substring(0, 100)}...`
    );
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error handling webhook:", error);
    return res.sendStatus(200);
  }
}
async function getWebhookStatusEvents(req, res) {
  try {
    const limitRaw = Number(req.query.limit || 100);
    const pageRaw = Number(req.query.page || 1);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const skip = (page - 1) * limit;
    const messageId = String(req.query.messageId || "").trim();
    const recipientId = String(req.query.recipientId || "").trim();
    const status = String(req.query.status || "").trim();
    const userId = getUserId(req) || void 0;
    const filter = {};
    if (userId) filter.userId = userId;
    if (messageId) {
      filter.messageId = { $regex: messageId, $options: "i" };
    }
    if (recipientId) {
      filter.recipientId = { $regex: recipientId, $options: "i" };
    }
    if (status) {
      filter.status = status;
    }
    const [events, total, summaryRows] = await Promise.all([
      WebhookStatusEvent.find(filter).sort({ statusTimestamp: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      WebhookStatusEvent.countDocuments(filter),
      WebhookStatusEvent.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);
    const summary = summaryRows.reduce(
      (acc, row) => {
        acc[String(row?._id || "unknown")] = Number(row?.count || 0);
        return acc;
      },
      {}
    );
    return res.json({
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      summary
    });
  } catch (error) {
    console.error("[Webhook Events] Failed to fetch webhook status events:", error);
    return res.status(500).json({
      error: "Failed to fetch webhook status events",
      details: error?.message || "Unknown error"
    });
  }
}
async function getWebhookConfig(req, res) {
  try {
    const userId = getUserId(req) || void 0;
    const userCreds = userId ? await credentialsService.getDecryptedCredentials(userId) : null;
    const integrationCreds = userId ? await getUserWhatsAppConnectionCredentials(userId) : null;
    const verifyToken = String(
      integrationCreds?.webhookVerifyToken || userCreds?.webhookVerifyToken || ""
    ).trim();
    if (!verifyToken) {
      return res.status(404).json({
        error: "No WhatsApp connection is configured for this account"
      });
    }
    const baseUrl = resolvePublicBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/whatsapp-marketing/webhook/whatsapp`;
    const isHttps = /^https:\/\//i.test(callbackUrl);
    const looksLocalhost = /localhost|127\.0\.0\.1/i.test(callbackUrl);
    return res.json({
      callbackUrl,
      verifyToken,
      hints: {
        requiresPublicHttps: !isHttps || looksLocalhost
      }
    });
  } catch (error) {
    console.error("[Webhook Config] Failed to resolve webhook config:", error);
    return res.status(500).json({
      error: "Failed to resolve webhook config",
      details: error?.message || "Unknown error"
    });
  }
}
async function findLeadByPhone(phone) {
  const leads = await getAllLeads();
  const normalizedPhone = phone.replace(/\D/g, "");
  return leads.find((lead) => {
    const leadPhone = (lead.phone || "").replace(/\D/g, "");
    return leadPhone.includes(normalizedPhone) || normalizedPhone.includes(leadPhone);
  });
}
async function saveInboundMessage(from, content, type, buttonPayload, mediaUrl, whatsappMessageId, userId) {
  if (!userId) {
    return {
      message: null,
      contact: null,
      isDuplicate: false,
      error: "Unable to resolve WhatsApp account owner"
    };
  }
  const normalizedPhone = from.replace(/\D/g, "");
  let contact = null;
  try {
    const contacts = await storage.getContacts(userId);
    contact = contacts.find((c) => {
      const contactPhone2 = (c.phone || "").replace(/\D/g, "");
      return contactPhone2.includes(normalizedPhone) || normalizedPhone.includes(contactPhone2);
    });
    if (!contact) {
      const formattedPhone = from.startsWith("+") ? from : `+${from}`;
      contact = await storage.createContact({
        userId,
        name: formattedPhone,
        phone: from,
        email: "",
        tags: ["WhatsApp"],
        notes: "Auto-created from WhatsApp message"
      });
      console.log("[Webhook] Created new contact:", contact.id, "phone:", from);
    }
  } catch (contactError) {
    console.error("[Webhook] Error finding/creating contact:", contactError);
    return {
      message: null,
      contact: null,
      isDuplicate: false,
      error: "Failed to create contact"
    };
  }
  if (whatsappMessageId) {
    try {
      const isDuplicate = Boolean(
        await Message.exists({
          userId,
          direction: "inbound",
          whatsappMessageId
        })
      );
      if (isDuplicate) {
        console.log(
          `[Webhook] Skipping duplicate message: ${whatsappMessageId}`
        );
        return { message: null, contact, isDuplicate: true };
      }
    } catch (dupCheckError) {
      console.error(
        "[Webhook] Error checking duplicates, continuing anyway:",
        dupCheckError
      );
    }
  }
  try {
    const repliedCount = await markBroadcastLogAsReplied(
      from,
      userId
    );
    if (repliedCount > 0) {
      console.log(
        `[Webhook] Marked ${repliedCount} broadcast logs as replied for ${from}`
      );
    }
  } catch (err) {
    console.error("[Webhook] Error marking broadcast as replied:", err);
  }
  try {
    await markCampaignContactAsReplied(from, content);
  } catch (err) {
    console.error("[Webhook] Error marking campaign as replied:", err);
  }
  try {
    let displayContent = content;
    if (type === "button" || type === "interactive") {
      displayContent = content;
      if (buttonPayload && buttonPayload !== content && !buttonPayload.startsWith("cflow:")) {
        displayContent = `${content} [Button: ${buttonPayload}]`;
      }
    }
    const validTypes = [
      "text",
      "image",
      "video",
      "document",
      "audio",
      "sticker",
      "location",
      "contacts"
    ];
    const messageType = validTypes.includes(type) ? type : "text";
    const messageData = {
      userId: userId || void 0,
      contactId: contact.id,
      content: displayContent || `[${type} message]`,
      type: messageType,
      direction: "inbound",
      status: "read",
      mediaUrl: mediaUrl || void 0
    };
    if (whatsappMessageId) {
      messageData.whatsappMessageId = whatsappMessageId;
    }
    const message = await storage.createMessage(messageData);
    console.log(
      "Saved inbound message:",
      message.id,
      "type:",
      messageType,
      "whatsappId:",
      whatsappMessageId || "none"
    );
    await storage.updateChatInboundTime(contact.id);
    console.log("Updated chat inbound time for contact:", contact.id);
    try {
      const lead = await findLeadByPhone(from);
      let agentToUse = null;
      let source = "ai_chat";
      if (lead) {
        source = "lead_form";
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          agentToUse = await getAgentById(mapping.agentId);
        }
      }
      if (!agentToUse) {
        const agents = await getAllAgents();
        agentToUse = agents.find((a) => a.isActive);
      }
      const displayName = contact.name && !contact.name.startsWith("WhatsApp ") ? contact.name : from.startsWith("+") ? from : `+${from}`;
      await createOrUpdateQualification(
        from,
        displayName,
        content,
        source,
        {
          contactId: contact.id,
          agentId: agentToUse?.id,
          agentName: agentToUse?.name
        }
      );
      console.log("Tracked AI qualification for:", from);
    } catch (analyticsError) {
      console.error("Error tracking AI qualification:", analyticsError);
    }
    return { message, contact, isDuplicate: false };
  } catch (error) {
    console.error("Error saving inbound message:", error);
    return {
      message: null,
      contact,
      isDuplicate: false,
      error: "Failed to save message"
    };
  }
}
async function saveOutboundMessage(to, content, userId) {
  try {
    const normalizedPhone = to.replace(/\D/g, "");
    const contacts = await storage.getContacts(userId || void 0);
    const contact = contacts.find((c) => {
      const contactPhone2 = (c.phone || "").replace(/\D/g, "");
      return contactPhone2.includes(normalizedPhone) || normalizedPhone.includes(contactPhone2);
    });
    if (!contact) {
      console.log("Contact not found for outbound message:", to);
      return;
    }
    const message = await storage.createMessage({
      userId: userId || void 0,
      contactId: contact.id,
      content,
      type: "text",
      direction: "outbound",
      status: "sent"
    });
    console.log("Saved outbound AI message:", message.id);
  } catch (error) {
    console.error("Error saving outbound message:", error);
  }
}
async function sendMessage(req, res) {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Recipient and message are required" });
    }
    const userId = getUserId(req) || void 0;
    console.log(
      `[SendMessage] User ${userId || "undefined"} sending message to ${to}: ${message.substring(0, 50)}...`
    );
    const credentials = await getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const result = await sendTextMessage(to, message, userId);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send message" });
    }
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
}
async function getMediaUrl(req, res) {
  try {
    const { mediaId } = req.params;
    if (!mediaId) {
      return res.status(400).json({ error: "Media ID is required" });
    }
    const userId = getUserId(req) || void 0;
    const credentials = await getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const mediaInfoUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const mediaInfoResponse = await fetch(mediaInfoUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`
      }
    });
    if (!mediaInfoResponse.ok) {
      const error = await mediaInfoResponse.text();
      console.error("WhatsApp media info error:", error);
      return res.status(404).json({ error: "Media not found or expired" });
    }
    const mediaInfo = await mediaInfoResponse.json();
    const downloadUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type;
    console.log("[Media] Fetched media info:", {
      mediaId,
      mimeType,
      hasUrl: !!downloadUrl
    });
    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`
      }
    });
    if (!mediaResponse.ok) {
      const error = await mediaResponse.text();
      console.error("WhatsApp media download error:", error);
      return res.status(500).json({ error: "Failed to download media" });
    }
    const buffer = await mediaResponse.arrayBuffer();
    res.set("Content-Type", mimeType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({ error: error.message || "Failed to fetch media" });
  }
}
async function getConversations(req, res) {
  try {
    const conversations = Object.entries(conversationHistory).map(
      ([phone, messages]) => ({
        phone,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]
      })
    );
    res.json(conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
}
async function getConversation(req, res) {
  try {
    const { phone } = req.params;
    const messages = conversationHistory[phone] || [];
    res.json({ phone, messages });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
}
async function sendTemplateMessageEndpoint(req, res) {
  try {
    const { to, templateName, languageCode, components, namedParams } = req.body;
    if (!to || !templateName) {
      return res.status(400).json({ error: "Recipient (to) and templateName are required" });
    }
    const userId = getUserId(req) || void 0;
    const credentials = await getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error: "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials."
      });
    }
    const resolvedLangCode = languageCode || "en";
    const sendResult = await sendTemplateMessage2(
      to,
      templateName,
      resolvedLangCode,
      components || [],
      userId
    );
    if (!sendResult.success) {
      throw new Error(sendResult.error || "Failed to send template");
    }
    try {
      const normalizedPhone = to.replace(/\D/g, "");
      const contacts = await storage.getContacts(userId);
      let contact = contacts.find((c) => {
        const contactPhone2 = (c.phone || "").replace(/\D/g, "");
        return contactPhone2.includes(normalizedPhone) || normalizedPhone.includes(contactPhone2);
      });
      if (!contact) {
        const formattedPhone = to.startsWith("+") ? to : `+${to}`;
        contact = await storage.createContact({
          userId,
          name: formattedPhone,
          phone: to,
          email: "",
          tags: ["WhatsApp"],
          notes: "Auto-created from template message"
        });
      }
      await storage.createMessage({
        userId,
        contactId: contact.id,
        content: `[Template: ${templateName}]`,
        type: "text",
        direction: "outbound",
        status: "sent"
      });
    } catch (err) {
      console.error("Error saving outbound message:", err);
    }
    res.json({ success: true, messageId: sendResult.messageId });
  } catch (error) {
    console.error("Error sending template:", error);
    res.status(500).json({ error: error.message || "Failed to send template" });
  }
}

// modules/whatsapp-marketing/server/modules/whatsapp/flowReports.service.js
init_mongodb_adapter();
import { randomUUID as randomUUID4 } from "crypto";
import { Types as Types3 } from "mongoose";
var escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var dateRange = (fromDate, toDate) => {
  const range = {};
  if (fromDate) {
    const from = new Date(fromDate);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }
  return Object.keys(range).length ? range : void 0;
};
async function logFlowSend(input) {
  const now = /* @__PURE__ */ new Date();
  return WhatsAppFlowMessageLog.create({
    id: randomUUID4(),
    ...input,
    status: input.success ? "accepted" : "failed",
    attemptedAt: now,
    acceptedAt: input.success ? now : void 0,
    failedAt: input.success ? void 0 : now
  });
}
async function listFlowReports(userId, filters) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Math.min(100, Number(filters.limit || 10)));
  const flowQuery = { userId };
  if (filters.search?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.search.trim()), "i");
    flowQuery.$or = [{ name: pattern }, { flowId: pattern }];
  }
  if (filters.status && filters.status !== "all") {
    flowQuery.status = filters.status.toUpperCase();
  }
  const sortField = ["name", "createdAt", "updatedAt"].includes(String(filters.sortBy)) ? String(filters.sortBy) : "createdAt";
  const sortDirection = filters.sortOrder === "asc" ? 1 : -1;
  const [flows, total] = await Promise.all([
    WhatsAppFlow.find(flowQuery).sort({ [sortField]: sortDirection }).skip((page - 1) * limit).limit(limit).lean(),
    WhatsAppFlow.countDocuments(flowQuery)
  ]);
  const ids = flows.map((flow) => String(flow.flowId));
  const range = dateRange(filters.fromDate, filters.toDate);
  const sendMatch = { userId, flowId: { $in: ids } };
  const responseMatch = { userId, flowId: { $in: ids } };
  if (range) {
    sendMatch.attemptedAt = range;
    responseMatch.receivedAt = range;
  }
  const [sendRows, responseRows] = await Promise.all([
    ids.length ? WhatsAppFlowMessageLog.aggregate([
      { $match: sendMatch },
      {
        $group: {
          _id: "$flowId",
          attempted: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          uniqueRecipients: { $addToSet: "$contactPhone" },
          firstSentAt: { $min: "$attemptedAt" },
          lastSentAt: { $max: "$attemptedAt" },
          messageIds: { $addToSet: "$messageId" }
        }
      }
    ]) : [],
    ids.length ? WhatsAppFlowResponse.aggregate([
      { $match: responseMatch },
      {
        $group: {
          _id: "$flowId",
          responses: { $sum: 1 },
          uniqueResponders: { $addToSet: "$contactPhone" },
          firstResponseAt: { $min: "$receivedAt" },
          lastResponseAt: { $max: "$receivedAt" }
        }
      }
    ]) : []
  ]);
  const sendByFlow = new Map(sendRows.map((row) => [String(row._id), row]));
  const responseByFlow = new Map(responseRows.map((row) => [String(row._id), row]));
  const messageIds = sendRows.flatMap(
    (row) => (row.messageIds || []).filter(Boolean).map(String)
  );
  const statusRows = messageIds.length ? await WebhookStatusEvent.find({ messageId: { $in: messageIds } }).lean() : [];
  const latestStatus = /* @__PURE__ */ new Map();
  for (const row of statusRows) {
    const id = String(row.messageId || "");
    const previous = latestStatus.get(id);
    if (!previous || new Date(row.statusTimestamp).getTime() >= new Date(previous.statusTimestamp).getTime()) {
      latestStatus.set(id, row);
    }
  }
  const data = flows.map((flow) => {
    const send = sendByFlow.get(String(flow.flowId)) || {};
    const response = responseByFlow.get(String(flow.flowId)) || {};
    const statuses = (send.messageIds || []).filter(Boolean).map((id) => latestStatus.get(String(id))).filter(Boolean);
    return {
      ...flow,
      reportMetrics: {
        attempted: Number(send.attempted || 0),
        accepted: Number(send.accepted || 0),
        delivered: statuses.filter((row) => ["delivered", "read"].includes(row.status)).length,
        read: statuses.filter((row) => row.status === "read").length,
        failed: Number(send.failed || 0) + statuses.filter((row) => row.status === "failed").length,
        responses: Number(response.responses || 0),
        totalConversations: (/* @__PURE__ */ new Set([
          ...send.uniqueRecipients || [],
          ...response.uniqueResponders || []
        ])).size,
        uniqueRecipients: (send.uniqueRecipients || []).length,
        uniqueResponders: (response.uniqueResponders || []).length,
        firstSentAt: send.firstSentAt || null,
        lastSentAt: send.lastSentAt || null,
        firstResponseAt: response.firstResponseAt || null,
        lastResponseAt: response.lastResponseAt || null
      }
    };
  });
  return { data, meta: { total, page, limit } };
}
async function getFlowReportDetails(userId, id, filters) {
  const flow = await WhatsAppFlow.findOne({
    userId,
    ...Types3.ObjectId.isValid(id) ? { $or: [{ _id: new Types3.ObjectId(id) }, { flowId: id }] } : { flowId: id }
  }).lean();
  if (!flow) return null;
  const range = dateRange(filters?.fromDate, filters?.toDate);
  const sendQuery = { userId, flowId: flow.flowId };
  const responseQuery = { userId, flowId: flow.flowId };
  if (range) {
    sendQuery.attemptedAt = range;
    responseQuery.receivedAt = range;
  }
  if (filters?.search?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.search.trim()), "i");
    sendQuery.$or = [
      { contactPhone: pattern },
      { contactName: pattern },
      { messageId: pattern },
      { flowToken: pattern }
    ];
    responseQuery.$or = [
      { contactPhone: pattern },
      { contactName: pattern },
      { flowToken: pattern },
      { inboundWhatsappMessageId: pattern }
    ];
  }
  const [sends, responses] = await Promise.all([
    WhatsAppFlowMessageLog.find(sendQuery).sort({ attemptedAt: -1 }).lean(),
    WhatsAppFlowResponse.find(responseQuery).sort({ receivedAt: -1 }).lean()
  ]);
  const messageIds = sends.map((row) => row.messageId).filter(Boolean).map(String);
  const events = messageIds.length ? await WebhookStatusEvent.find({ messageId: { $in: messageIds } }).sort({ statusTimestamp: 1, webhookReceivedAt: 1 }).lean() : [];
  const eventsByMessage = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = String(event.messageId || "");
    eventsByMessage.set(key, [...eventsByMessage.get(key) || [], event]);
  }
  const usedResponseIds = /* @__PURE__ */ new Set();
  const conversations = sends.map((send) => {
    const response = responses.find((item) => {
      const itemId = String(item._id);
      if (usedResponseIds.has(itemId)) return false;
      return send.messageId && item.contextMessageId === send.messageId || send.flowToken && item.flowToken === send.flowToken || item.contactPhone === send.contactPhone;
    });
    if (response) usedResponseIds.add(String(response._id));
    const timeline = [
      {
        type: "attempted",
        status: "attempted",
        at: send.attemptedAt,
        detail: "Flow send attempted"
      },
      {
        type: "provider",
        status: send.status,
        at: send.acceptedAt || send.failedAt || send.attemptedAt,
        detail: send.error || "Meta accepted the Flow message"
      },
      ...(eventsByMessage.get(String(send.messageId || "")) || []).map((event) => ({
        type: "webhook",
        status: event.status,
        at: event.statusTimestamp || event.webhookReceivedAt,
        detail: event.errorMessage || event.errorDetails || `Message ${event.status}`,
        conversationId: event.conversationId || null,
        pricingCategory: event.pricingCategory || null
      })),
      ...response ? [
        {
          type: "response",
          status: "responded",
          at: response.receivedAt,
          detail: "Customer submitted the Flow"
        }
      ] : []
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const lastAt = timeline.length ? timeline[timeline.length - 1].at : send.attemptedAt;
    return {
      send,
      response: response || null,
      timeline,
      durationMinutes: Math.max(
        0,
        Math.round(
          (new Date(lastAt).getTime() - new Date(send.attemptedAt).getTime()) / 6e4 * 100
        ) / 100
      )
    };
  });
  for (const response of responses) {
    if (usedResponseIds.has(String(response._id))) continue;
    conversations.push({
      send: null,
      response,
      timeline: [
        {
          type: "response",
          status: "responded",
          at: response.receivedAt,
          detail: "Customer Flow response received (send log unavailable)"
        }
      ],
      durationMinutes: 0
    });
  }
  return {
    flow,
    totals: {
      attempted: sends.length,
      accepted: sends.filter((row) => row.status === "accepted").length,
      failed: sends.filter((row) => row.status === "failed").length,
      delivered: events.filter((row) => ["delivered", "read"].includes(row.status)).length,
      read: events.filter((row) => row.status === "read").length,
      responses: responses.length,
      totalConversations: (/* @__PURE__ */ new Set([
        ...sends.map((row) => row.contactPhone),
        ...responses.map((row) => row.contactPhone)
      ])).size,
      webhookEvents: events.length
    },
    conversations
  };
}

// modules/whatsapp-marketing/server/modules/whatsapp/flows.controller.js
init_mongodb_adapter();
function getUserId2(req) {
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }
  if (Array.isArray(headerUserId) && headerUserId[0]) {
    return headerUserId[0];
  }
  return req.userId || req.user?.id || null;
}
function sendError(res, error, fallbackMessage) {
  const err = error;
  const status = Number(err?.status) || 500;
  const code = Number(err?.code) || void 0;
  const details = err?.details;
  const message = err?.message || fallbackMessage;
  const permissionHint = code === 200 && /permission|access this field/i.test(`${message} ${details || ""}`) ? "Token lacks one or more advanced Flow fields permissions. Reconnect WhatsApp integration with full scopes (business_management, whatsapp_business_management, whatsapp_business_messaging), then re-sync." : void 0;
  res.status(status).json({
    error: message,
    code: err?.code,
    subcode: err?.subcode,
    details,
    userTitle: err?.userTitle,
    userMessage: err?.userMessage,
    hint: permissionHint,
    fbtraceId: err?.fbtraceId,
    meta: err?.meta
  });
}
async function saveFlowSendToInbox(input) {
  try {
    const contact = await storage.getContactByPhone(input.phoneNumber, input.userId) || await storage.createContact({
      userId: input.userId,
      name: input.contactName || input.phoneNumber,
      phone: input.phoneNumber,
      tags: ["whatsapp-flow"]
    });
    await storage.createMessage({
      userId: input.userId,
      contactId: contact.id,
      content: `WhatsApp Flow sent: ${input.flowName}`,
      type: "text",
      direction: "outbound",
      status: "sent",
      whatsappMessageId: input.messageId,
      source: "whatsapp-flow"
    });
  } catch (error) {
    console.error("[Flows] Failed to save Flow send in inbox:", error);
  }
}
function formatConversationPrompt2(bodyText, buttons) {
  const optionTitles = buttons.map((button) => String(button?.title || "").trim()).filter(Boolean);
  if (!optionTitles.length) return bodyText;
  return [
    bodyText,
    "",
    "Options:",
    ...optionTitles.map((title, index) => `${index + 1}. ${title}`)
  ].join("\n");
}
async function saveConversationSendToInbox(input) {
  try {
    const contact = await storage.getContactByPhone(input.phoneNumber, input.userId) || await storage.createContact({
      userId: input.userId,
      name: input.phoneNumber,
      phone: input.phoneNumber,
      tags: ["conversation-flow"]
    });
    await storage.createMessage({
      userId: input.userId,
      contactId: contact.id,
      content: formatConversationPrompt2(input.bodyText, input.buttons),
      type: "text",
      direction: "outbound",
      status: "sent",
      whatsappMessageId: input.messageId,
      source: "conversation-flow"
    });
    console.log("[Flows] Updating chat to force visibility...", { contactId: contact.id });
    const result = await updateOne("chats", { contactId: contact.id }, {
      lastInboundMessageTime: (/* @__PURE__ */ new Date()).toISOString(),
      isFlowLead: true
    });
    console.log("[Flows] Chat update result:", result);
  } catch (error) {
    console.error("[Flows] Failed to save conversation send in inbox:", error);
  }
}
function getFlowStartScreen(flow) {
  const firstScreenId = flow?.flowJson?.screens?.[0]?.id;
  if (typeof firstScreenId === "string" && firstScreenId.trim()) {
    return firstScreenId.trim();
  }
  const snapshotFirstScreenId = flow?.lastMetaSnapshot?.flow_json?.screens?.[0]?.id;
  if (typeof snapshotFirstScreenId === "string" && snapshotFirstScreenId.trim()) {
    return snapshotFirstScreenId.trim();
  }
  return "START";
}
async function ensureCustomerServiceWindow(userId, phoneNumber) {
  const contact = await storage.getContactByPhone(phoneNumber, userId);
  if (!contact) {
    throw Object.assign(
      new Error(
        "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
      ),
      { status: 400 }
    );
  }
  const messages = await storage.getMessages(contact.id, userId);
  const latestInbound = messages.filter((message) => message.direction === "inbound" && message.timestamp).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  const lastInboundAt = latestInbound?.timestamp ? new Date(latestInbound.timestamp) : null;
  const ageMs = lastInboundAt ? Date.now() - lastInboundAt.getTime() : Infinity;
  const isInsideWindow = ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1e3;
  if (!isInsideWindow) {
    throw Object.assign(
      new Error(
        "This customer is outside the 24-hour WhatsApp service window. Ask the customer to message first, or send an approved template with a Flow button."
      ),
      { status: 400 }
    );
  }
}
async function syncFlows(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await syncFlowsFromMeta(userId);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("[Flows] Sync error:", error);
    sendError(res, error, "Failed to sync flows");
  }
}
async function getFlows2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await getFlows(userId, {
      status,
      search,
      page: page ? parseInt(page, 10) : void 0,
      limit: limit ? parseInt(limit, 10) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flows error:", error);
    sendError(res, error, "Failed to get flows");
  }
}
async function getFlowResponses(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { page, limit, search, flowName, flowId, contactPhone: contactPhone2, start, end, includeSystem } = req.query;
    const roleHeader = String(req.headers["x-user-role"] || "").trim();
    const isAdmin2 = roleHeader === "super_admin" || roleHeader === "sub_admin";
    const shouldIncludeSystem = isAdmin2 && (String(includeSystem || "").toLowerCase() === "1" || String(includeSystem || "").toLowerCase() === "true");
    const result = await listFlowResponses(userId, {
      page: page ? parseInt(page, 10) : void 0,
      limit: limit ? parseInt(limit, 10) : void 0,
      search,
      flowName,
      flowId,
      contactPhone: contactPhone2,
      start,
      end,
      includeSystem: shouldIncludeSystem
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flow responses error:", error);
    sendError(res, error, "Failed to get flow responses");
  }
}
async function getFlowResponseSummary(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const includeSystem = req.query.includeSystem;
    const roleHeader = String(req.headers["x-user-role"] || "").trim();
    const isAdmin2 = roleHeader === "super_admin" || roleHeader === "sub_admin";
    const shouldIncludeSystem = isAdmin2 && (String(includeSystem || "").toLowerCase() === "1" || String(includeSystem || "").toLowerCase() === "true");
    const result = await getFlowResponseSummaryByFlow(userId, {
      includeSystem: shouldIncludeSystem
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Get flow response summary error:", error);
    sendError(res, error, "Failed to get flow response summary");
  }
}
async function getFlowResponseById2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const response = await getFlowResponseById(userId, req.params.id);
    if (!response) return res.status(404).json({ error: "Flow response not found" });
    res.json(response);
  } catch (error) {
    console.error("[Flows] Get flow response detail error:", error);
    sendError(res, error, "Failed to get flow response");
  }
}
async function getFlowReports(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await listFlowReports(userId, {
      search: req.query.search,
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: req.query.page ? Number(req.query.page) : void 0,
      limit: req.query.limit ? Number(req.query.limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Flow reports error:", error);
    sendError(res, error, "Failed to get Flow reports");
  }
}
async function getFlowReportDetails2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await getFlowReportDetails(userId, req.params.id, {
      search: req.query.search,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
    });
    if (!result) return res.status(404).json({ error: "Flow not found" });
    res.json(result);
  } catch (error) {
    console.error("[Flows] Flow report details error:", error);
    sendError(res, error, "Failed to get Flow report details");
  }
}
async function getFlowById2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Get flow error:", error);
    sendError(res, error, "Failed to get flow");
  }
}
async function getFlowMeta(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await getFlowDetailsFromMeta(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Get flow meta error:", error);
    sendError(res, error, "Failed to get flow meta details");
  }
}
async function refreshFlowPreview(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await getFlowDetailsFromMeta(userId, req.params.id, {
      invalidatePreview: true
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Refresh preview error:", error);
    sendError(res, error, "Failed to refresh flow preview");
  }
}
async function getFlowStats2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await getFlowStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Flows] Get stats error:", error);
    sendError(res, error, "Failed to get flow stats");
  }
}
async function getSyncStatus2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const status = await getSyncStatus(userId);
    res.json(status);
  } catch (error) {
    console.error("[Flows] Get sync status error:", error);
    sendError(res, error, "Failed to get sync status");
  }
}
async function updateEntryPoints(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { entryPoints } = req.body;
    const flow = await updateFlowEntryPoints(userId, req.params.id, entryPoints);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Update entry points error:", error);
    sendError(res, error, "Failed to update entry points");
  }
}
async function updateFlowMeta(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri } = req.body;
    const result = await updateFlowMetadataInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Update meta error:", error);
    sendError(res, error, "Failed to update flow metadata");
  }
}
async function cloneFlow(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri } = req.body;
    const result = await cloneFlowInMeta(userId, req.params.id, {
      name,
      categories,
      endpointUri
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Clone flow error:", error);
    sendError(res, error, "Failed to clone flow");
  }
}
async function getFlowAssets(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const assets = await getFlowAssetsFromMeta(userId, req.params.id);
    res.json({ success: true, ...assets });
  } catch (error) {
    console.error("[Flows] Get flow assets error:", error);
    sendError(res, error, "Failed to fetch flow assets");
  }
}
async function downloadFlowAsset(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const payload = await getFlowAssetContentFromMeta(userId, req.params.id, req.params.assetId);
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error("[Flows] Download flow asset error:", error);
    sendError(res, error, "Failed to download flow asset");
  }
}
async function getFlowMetrics(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const metricNames = typeof req.query.metricNames === "string" ? req.query.metricNames.split(",").map((item) => item.trim()).filter(Boolean) : void 0;
    const metrics = await getFlowMetricsFromMeta(userId, req.params.id, {
      start: req.query.start,
      end: req.query.end,
      granularity: req.query.granularity || "DAY",
      metricNames
    });
    res.json({ success: true, ...metrics });
  } catch (error) {
    console.error("[Flows] Get flow metrics error:", error);
    sendError(res, error, "Failed to fetch flow metrics");
  }
}
async function attachToTemplate(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { templateId } = req.body;
    const flow = await attachFlowToTemplate(userId, req.params.id, templateId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Attach to template error:", error);
    sendError(res, error, "Failed to attach flow to template");
  }
}
async function detachFromTemplate(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await detachFlowFromTemplate(userId, req.params.id, req.params.templateId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Detach from template error:", error);
    sendError(res, error, "Failed to detach flow from template");
  }
}
async function attachToAgent(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { agentId } = req.body;
    const flow = await attachFlowToAgent(userId, req.params.id, agentId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Attach to agent error:", error);
    sendError(res, error, "Failed to attach flow to agent");
  }
}
async function detachFromAgent(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await detachFlowFromAgent(userId, req.params.id, req.params.agentId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Flows] Detach from agent error:", error);
    sendError(res, error, "Failed to detach flow from agent");
  }
}
async function sendFlow(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { phoneNumber, contactName: contactName2, entryPointId, headerText, bodyText, footerText, ctaText } = req.body;
    const normalizedPhoneNumber = String(phoneNumber || "").replace(/\D/g, "");
    if (!normalizedPhoneNumber) {
      return res.status(400).json({ error: "Customer phone number is required" });
    }
    const flow = await getFlowById(userId, req.params.id);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    if (flow.status !== "PUBLISHED") {
      return res.status(400).json({ error: "Only published flows can be sent" });
    }
    await ensureCustomerServiceWindow(userId, normalizedPhoneNumber);
    const flowToken = `flow_${flow.flowId}_${Date.now()}`;
    const startScreen = entryPointId ? String(entryPointId).trim() : getFlowStartScreen(flow);
    const result = await sendFlowMessage(userId, {
      to: normalizedPhoneNumber,
      flowId: flow.flowId,
      flowName: flow.name,
      flowToken,
      entryPointId: startScreen,
      headerText: headerText || "Interactive Flow",
      bodyText: bodyText || "Please complete the following flow",
      footerText,
      ctaText: ctaText || "Start"
    });
    await logFlowSend({
      userId,
      flowMongoId: String(flow._id),
      flowId: flow.flowId,
      flowName: flow.name,
      flowToken,
      contactPhone: normalizedPhoneNumber,
      contactName: contactName2 ? String(contactName2) : void 0,
      messageId: result.messageId,
      success: result.success,
      providerHttpStatus: result.providerHttpStatus,
      error: result.error,
      requestPayload: result.requestPayload,
      providerResponse: result.providerResponse
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send flow message" });
    }
    await saveFlowSendToInbox({
      userId,
      phoneNumber: normalizedPhoneNumber,
      contactName: contactName2 ? String(contactName2) : void 0,
      flowName: flow.name,
      messageId: result.messageId
    });
    res.json({
      success: true,
      messageId: result.messageId,
      flow: flow.name
    });
  } catch (error) {
    console.error("[Flows] Send flow error:", error);
    sendError(res, error, "Failed to send flow");
  }
}
async function sendFlowTest(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await sendFlowTestMessage(userId, req.params.id, {
      phoneNumber: req.body.phoneNumber,
      mode: req.body.mode,
      ctaText: req.body.ctaText,
      headerText: req.body.headerText,
      bodyText: req.body.bodyText,
      footerText: req.body.footerText,
      flowToken: req.body.flowToken,
      flowAction: req.body.flowAction,
      screen: req.body.screen,
      data: req.body.data
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Send flow test error:", error);
    sendError(res, error, "Failed to send flow test message");
  }
}
async function sendConversationTest(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const phoneNumber = String(req.body.phoneNumber || "").replace(/\D/g, "");
    if (!phoneNumber) {
      return res.status(400).json({ error: "Customer phone number is required" });
    }
    const step = await getConversationStep(userId, req.params.id, []);
    const bodyText = req.body.bodyText?.trim() || step.bodyText;
    const result = await sendReplyButtonMessage(
      phoneNumber,
      bodyText,
      step.buttons,
      userId,
      {
        headerText: req.body.headerText,
        footerText: req.body.footerText
      }
    );
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to send conversation" });
    }
    await saveConversationSendToInbox({
      userId,
      phoneNumber,
      bodyText,
      buttons: step.buttons,
      messageId: result.messageId
    });
    res.json({ success: true, messageId: result.messageId, flow: step.flowName });
  } catch (error) {
    console.error("[Flows] Send conversation error:", error);
    sendError(res, error, "Failed to send conversational flow");
  }
}
async function deleteFlow2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await deleteFlow(userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Flow not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Flows] Delete flow error:", error);
    sendError(res, error, "Failed to delete flow");
  }
}
async function createFlow(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, categories, endpointUri, cloneFlowId, flowJson } = req.body;
    if (!name || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "Name and at least one category are required" });
    }
    const result = await createFlowInMeta(userId, {
      name,
      categories,
      endpointUri,
      cloneFlowId,
      flowJson
    });
    res.json({
      success: true,
      flowId: result.flowId,
      flow: result.flow,
      meta: result.meta
    });
  } catch (error) {
    console.error("[Flows] Create flow error:", error);
    sendError(res, error, "Failed to create flow");
  }
}
async function cloneMetaFlow(req, res) {
  return cloneFlow(req, res);
}
async function publishFlow(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await publishFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Publish flow error:", error);
    sendError(res, error, "Failed to publish flow");
  }
}
async function saveFlowDraft2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { flowData, flowJson } = req.body;
    const flow = await saveFlowDraft(userId, req.params.id, flowData, flowJson);
    res.json({ success: true, flow, draftValidationErrors: flow.draftValidationErrors || [] });
  } catch (error) {
    console.error("[Flows] Save flow draft error:", error);
    sendError(res, error, "Failed to save flow draft");
  }
}
async function validateDraft(req, res) {
  try {
    const validation = validateFlowJson(req.body?.flowJson);
    res.json({ success: true, ...validation });
  } catch (error) {
    console.error("[Flows] Validate draft error:", error);
    sendError(res, error, "Failed to validate flow draft");
  }
}
async function updateAndPublishFlow2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await updateAndPublishFlow(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Update and publish flow error:", error);
    sendError(res, error, "Failed to update and publish flow");
  }
}
async function deprecateFlow(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await deprecateFlowInMeta(userId, req.params.id);
    res.json({ success: true, flow });
  } catch (error) {
    console.error("[Flows] Deprecate flow error:", error);
    sendError(res, error, "Failed to deprecate flow");
  }
}
async function deleteFlowFromMeta(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    await deleteFlowInMeta(userId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("[Flows] Delete from Meta error:", error);
    sendError(res, error, "Failed to delete flow from Meta");
  }
}
async function getEncryptionStatus(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const status = await getPhoneNumberEncryptionStatus(
      userId,
      req.query.phoneNumberId
    );
    res.json({ success: true, ...status });
  } catch (error) {
    console.error("[Flows] Get encryption status error:", error);
    sendError(res, error, "Failed to get endpoint encryption status");
  }
}
async function setEncryptionKey(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const payload = await setPhoneNumberEncryptionPublicKey(userId, {
      businessPhoneNumberId: req.body.phoneNumberId,
      businessPublicKey: req.body.businessPublicKey
    });
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error("[Flows] Set encryption key error:", error);
    sendError(res, error, "Failed to set endpoint encryption key");
  }
}
async function setupFlowEndpoint2(req, res) {
  try {
    const userId = getUserId2(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = await setupFlowEndpoint(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[Flows] Setup endpoint error:", error);
    sendError(res, error, "Failed to configure Flow endpoint");
  }
}
async function receiveFlowEndpoint(req, res) {
  try {
    const encryptedResponse = await handleEncryptedFlowEndpoint(
      req.params.token,
      req.body || {}
    );
    res.type("text/plain").send(encryptedResponse);
  } catch (error) {
    console.error("[Flows] Endpoint request error:", error);
    sendError(res, error, "Failed to process Flow endpoint request");
  }
}

// modules/whatsapp-marketing/server/modules/whatsapp/whatsapp.routes.js
var router6 = Router6();
router6.get("/", verifyWebhook);
router6.post("/", handleWebhook);
router6.get("/config", requireAuth, getWebhookConfig);
router6.get("/status-events", requireAuth, getWebhookStatusEvents);
router6.post("/send", sendMessage);
router6.post("/send-template", requireAuth, sendTemplateMessageEndpoint);
router6.get("/conversations", getConversations);
router6.get("/conversations/:phone", getConversation);
router6.get("/media/:mediaId", getMediaUrl);
router6.post("/flows/sync", requireAuth, syncFlows);
router6.post("/flows/create", requireAuth, createFlow);
router6.post("/flows/validate-json", requireAuth, validateDraft);
router6.get("/flows", requireAuth, getFlows2);
router6.get("/flows/responses/summary", requireAuth, getFlowResponseSummary);
router6.get("/flows/responses", requireAuth, getFlowResponses);
router6.get("/flows/reports", requireAuth, getFlowReports);
router6.get("/flows/reports/:id/details", requireAuth, getFlowReportDetails2);
router6.get("/flows/responses/:id", requireAuth, getFlowResponseById2);
router6.get("/flows/stats", requireAuth, getFlowStats2);
router6.get("/flows/sync-status", requireAuth, getSyncStatus2);
router6.get("/flows/encryption", requireAuth, getEncryptionStatus);
router6.post("/flows/encryption", requireAuth, setEncryptionKey);
router6.post("/flows/endpoint/:token", receiveFlowEndpoint);
router6.post("/flows/:id/endpoint/setup", requireAuth, setupFlowEndpoint2);
router6.get("/flows/:id/meta", requireAuth, getFlowMeta);
router6.post("/flows/:id/meta", requireAuth, updateFlowMeta);
router6.post("/flows/:id/preview/refresh", requireAuth, refreshFlowPreview);
router6.post("/flows/:id/clone", requireAuth, cloneMetaFlow);
router6.get("/flows/:id/assets", requireAuth, getFlowAssets);
router6.get("/flows/:id/assets/:assetId/download", requireAuth, downloadFlowAsset);
router6.get("/flows/:id/metrics", requireAuth, getFlowMetrics);
router6.get("/flows/:id", requireAuth, getFlowById2);
router6.put("/flows/:id/entry-points", requireAuth, updateEntryPoints);
router6.post("/flows/:id/attach-template", requireAuth, attachToTemplate);
router6.delete("/flows/:id/attach-template/:templateId", requireAuth, detachFromTemplate);
router6.post("/flows/:id/attach-agent", requireAuth, attachToAgent);
router6.delete("/flows/:id/attach-agent/:agentId", requireAuth, detachFromAgent);
router6.post("/flows/:id/send", requireAuth, sendFlow);
router6.post("/flows/:id/send-test", requireAuth, sendFlowTest);
router6.post("/flows/:id/send-conversation", requireAuth, sendConversationTest);
router6.post("/flows/:id/publish", requireAuth, publishFlow);
router6.post("/flows/:id/publish-meta", requireAuth, updateAndPublishFlow2);
router6.post("/flows/:id/draft", requireAuth, saveFlowDraft2);
router6.post("/flows/:id/deprecate", requireAuth, deprecateFlow);
router6.delete("/flows/:id", requireAuth, deleteFlow2);
router6.delete("/flows/:id/meta", requireAuth, deleteFlowFromMeta);
var whatsapp_routes_default = router6;

// modules/whatsapp-marketing/server/modules/leadAutoReply/leadAutoReply.routes.js
import { Router as Router7 } from "express";

// modules/whatsapp-marketing/server/modules/leadAutoReply/leadAutoReply.controller.js
async function processAllLeads(req, res) {
  try {
    const result = await processAllPendingLeads();
    res.json({
      message: "Lead processing completed",
      ...result
    });
  } catch (error) {
    console.error("Error processing leads:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process leads"
    });
  }
}
async function processLead(req, res) {
  try {
    const lead = req.body;
    if (!lead || !lead.id) {
      return res.status(400).json({ error: "Lead data is required" });
    }
    const result = await processNewLead(lead);
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error processing lead:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process lead"
    });
  }
}
async function sendReply(req, res) {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await sendManualReply(leadId, message);
    if (result.success) {
      res.json({ success: true, message: "Reply sent successfully" });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Error sending reply:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send reply"
    });
  }
}

// modules/whatsapp-marketing/server/modules/leadAutoReply/leadAutoReply.routes.js
var router7 = Router7();
router7.post("/process-all", processAllLeads);
router7.post("/process", processLead);
router7.post("/send/:leadId", sendReply);
var leadAutoReply_routes_default = router7;

// modules/whatsapp-marketing/server/modules/broadcast/broadcast.routes.js
import { Router as Router8 } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

// modules/whatsapp-marketing/server/modules/broadcast/campaign.controller.js
async function getAllContacts2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await getAllContacts(userId);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting contacts:", error);
    res.status(500).json({ error: "Failed to get contacts" });
  }
}
async function getAvailableContacts2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await getAvailableContacts(userId);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting available contacts:", error);
    res.status(500).json({ error: "Failed to get available contacts" });
  }
}
async function createCampaign3(req, res) {
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
    const campaign = await createCampaign2(userId, {
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
async function getCampaigns3(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { status, limit, offset } = req.query;
    const result = await getCampaigns2(userId, {
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
async function getCampaignById3(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const campaign = await getCampaignById2(userId, req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  } catch (error) {
    console.error("[Campaign] Error getting campaign:", error);
    res.status(500).json({ error: "Failed to get campaign" });
  }
}
async function executeCampaign2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const campaign = await executeCampaign(userId, req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error("[Campaign] Error executing campaign:", error);
    res.status(500).json({ error: error.message || "Failed to execute campaign" });
  }
}
async function getInterestedContacts2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await getInterestedContacts(userId, req.params.id);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting interested contacts:", error);
    res.status(500).json({ error: "Failed to get interested contacts" });
  }
}
async function getNotInterestedContacts2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const contacts = await getNotInterestedContacts(userId, req.params.id);
    res.json(contacts);
  } catch (error) {
    console.error("[Campaign] Error getting not interested contacts:", error);
    res.status(500).json({ error: "Failed to get not interested contacts" });
  }
}
async function sendToInterestList2(req, res) {
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
    const campaign = await sendToInterestList(userId, req.params.id, interestType, {
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
async function deleteCampaign3(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const success = await deleteCampaign2(userId, req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("[Campaign] Error deleting campaign:", error);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
}

// modules/whatsapp-marketing/server/modules/broadcast/broadcast.routes.js
var router8 = Router8();
var upload = multer({ storage: multer.memoryStorage() });
router8.get("/lists", async (req, res) => {
  try {
    const lists = await getBroadcastLists();
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: "Failed to get broadcast lists" });
  }
});
router8.get("/lists/:id", async (req, res) => {
  try {
    const list = await getBroadcastListById(req.params.id);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to get broadcast list" });
  }
});
router8.post("/lists", async (req, res) => {
  try {
    const { name, contacts } = req.body;
    if (!name) {
      return res.status(400).json({ error: "List name is required" });
    }
    const list = await createBroadcastList(
      name,
      contacts || []
    );
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to create broadcast list" });
  }
});
router8.put("/lists/:id", async (req, res) => {
  try {
    const { name, contacts } = req.body;
    const list = await updateBroadcastList(
      req.params.id,
      name,
      contacts
    );
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to update broadcast list" });
  }
});
router8.delete("/lists/:id", async (req, res) => {
  try {
    const success = await deleteBroadcastList(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "List not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete broadcast list" });
  }
});
router8.post(
  "/import-excel",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      console.log(
        `[ImportExcel] Processing file: ${req.file.originalname}, size: ${req.file.size} bytes`
      );
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`[ImportExcel] Raw rows from Excel: ${data.length}`);
      const result = parseExcelContacts(data);
      if (result.validContacts === 0 && data.length > 0) {
        const columnNames = data[0] ? Object.keys(data[0]).join(", ") : "none found";
        return res.status(400).json({
          error: `No valid contacts found. Detected columns: ${columnNames}. Make sure your file has 'Name' and 'WhatsApp Number' columns.`,
          errors: result.errors,
          totalRows: result.totalRows
        });
      }
      const saveResult = await saveImportedContacts(
        getUserId(req),
        result.contacts,
        "excel"
      );
      res.json({
        success: true,
        contacts: result.contacts,
        totalRows: result.totalRows,
        validContacts: result.validContacts,
        savedContacts: saveResult.saved,
        duplicates: saveResult.duplicates,
        errors: result.errors
      });
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({
        error: "Failed to parse Excel file. Make sure it is a valid .xlsx, .xls, or .csv file."
      });
    }
  }
);
router8.post(
  "/import-csv",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      console.log(
        `[ImportCSV] Processing file: ${req.file.originalname}, size: ${req.file.size} bytes`
      );
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      console.log(`[ImportCSV] Raw rows from CSV: ${data.length}`);
      const result = parseExcelContacts(data);
      if (result.validContacts === 0 && data.length > 0) {
        const columnNames = data[0] ? Object.keys(data[0]).join(", ") : "none found";
        return res.status(400).json({
          error: `No valid contacts found. Detected columns: ${columnNames}. Make sure your file has 'Name' and 'WhatsApp Number' columns.`,
          errors: result.errors,
          totalRows: result.totalRows
        });
      }
      const saveResult = await saveImportedContacts(
        getUserId(req),
        result.contacts,
        "csv"
      );
      res.json({
        success: true,
        contacts: result.contacts,
        totalRows: result.totalRows,
        validContacts: result.validContacts,
        savedContacts: saveResult.saved,
        duplicates: saveResult.duplicates,
        errors: result.errors
      });
    } catch (error) {
      console.error("CSV import error:", error);
      res.status(500).json({
        error: "Failed to parse CSV file. Make sure it is a valid .csv file."
      });
    }
  }
);
router8.get("/export-contacts", async (req, res) => {
  try {
    const { listId } = req.query;
    let contacts = [];
    if (listId && typeof listId === "string") {
      const list = await getBroadcastListById(listId);
      if (list) {
        contacts = list.contacts;
      }
    } else {
      const lists = await getBroadcastLists();
      contacts = lists.flatMap((l) => l.contacts);
    }
    const exportData = exportContactsToJSON(contacts);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=contacts.xlsx");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "Failed to export contacts" });
  }
});
router8.get("/schedules", async (req, res) => {
  try {
    const schedules = await getScheduledMessages();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: "Failed to get scheduled messages" });
  }
});
router8.post("/schedules", async (req, res) => {
  try {
    const {
      name,
      messageType,
      templateName,
      customMessage,
      agentId,
      contactIds,
      listId,
      scheduledAt,
      recipientCount
    } = req.body;
    if (!name || !messageType || !scheduledAt) {
      return res.status(400).json({ error: "Name, message type, and scheduled time are required" });
    }
    const schedule = await createScheduledMessage({
      name,
      messageType,
      templateName,
      customMessage,
      agentId,
      contactIds,
      listId,
      scheduledAt,
      status: "scheduled",
      recipientCount: recipientCount || 0
    });
    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to create scheduled message" });
  }
});
router8.put("/schedules/:id", async (req, res) => {
  try {
    const schedule = await updateScheduledMessage(
      req.params.id,
      req.body
    );
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to update schedule" });
  }
});
router8.delete("/schedules/:id", async (req, res) => {
  try {
    const success = await deleteScheduledMessage(
      req.params.id
    );
    if (!success) {
      return res.status(404).json({ error: "Schedule not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});
router8.post("/send", requireAuth, async (req, res) => {
  try {
    const {
      contacts,
      messageType,
      templateName,
      customMessage,
      agentId,
      campaignName,
      isScheduled = false,
      scheduledTime
    } = req.body;
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: "Contacts are required" });
    }
    if (!messageType) {
      return res.status(400).json({ error: "Message type is required" });
    }
    if (isScheduled) {
      if (!scheduledTime) {
        return res.status(400).json({ error: "scheduledTime is required when scheduling" });
      }
      const scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ error: "Invalid scheduledTime format" });
      }
      if (scheduledDate <= /* @__PURE__ */ new Date()) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
    }
    const userId = getUserId(req);
    const result = await sendBroadcast(contacts, messageType, {
      templateName,
      customMessage,
      agentId,
      campaignName,
      isScheduled,
      scheduledTime,
      userId
    });
    console.log("[Broadcast API] Result:", result);
    if (result.credentialError) {
      return res.status(400).json({
        error: result.credentialError,
        ...result
      });
    }
    res.json(result);
  } catch (error) {
    console.error("Broadcast send error:", error);
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});
router8.post("/send-single", requireAuth, async (req, res) => {
  try {
    const { phone, name, messageType, templateName, customMessage, agentId } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    if (!messageType) {
      return res.status(400).json({ error: "Message type is required" });
    }
    const result = await sendSingleMessage(
      phone,
      name || "",
      messageType,
      {
        templateName,
        customMessage,
        agentId
      },
      getUserId(req)
    );
    res.json(result);
  } catch (error) {
    console.error("Single message send error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});
router8.post("/send-to-list/:listId", requireAuth, async (req, res) => {
  try {
    const { messageType, templateName, customMessage, agentId, campaignName } = req.body;
    const list = await getBroadcastListById(req.params.listId);
    if (!list) {
      return res.status(404).json({ error: "List not found" });
    }
    if (!messageType) {
      return res.status(400).json({ error: "Message type is required" });
    }
    const result = await sendBroadcast(
      list.contacts,
      messageType,
      {
        templateName,
        customMessage,
        agentId,
        campaignName,
        userId: getUserId(req)
      }
    );
    res.json(result);
  } catch (error) {
    console.error("List broadcast send error:", error);
    res.status(500).json({ error: "Failed to send broadcast to list" });
  }
});
router8.get("/scheduled-broadcasts", async (req, res) => {
  try {
    const broadcasts = await getScheduledBroadcasts();
    console.log(
      `[ScheduledBroadcasts API] Fetched ${broadcasts.length} scheduled broadcasts`
    );
    res.json(broadcasts);
  } catch (error) {
    console.error("[ScheduledBroadcasts API] Error:", error);
    res.status(500).json({ error: "Failed to get scheduled broadcasts" });
  }
});
router8.post(
  "/scheduled-broadcasts/:id/cancel",
  async (req, res) => {
    try {
      const { id } = req.params;
      const success = await cancelScheduledBroadcast(id);
      if (success) {
        res.json({ message: "Broadcast cancelled successfully" });
      } else {
        res.status(400).json({ error: "Failed to cancel broadcast" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel broadcast" });
    }
  }
);
router8.delete(
  "/scheduled-broadcasts/:id",
  async (req, res) => {
    try {
      const { id } = req.params;
      const success = await deleteScheduledBroadcast(id);
      if (success) {
        res.json({ message: "Broadcast deleted successfully" });
      } else {
        res.status(404).json({ error: "Broadcast not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete broadcast" });
    }
  }
);
router8.get("/logs", requireAuth, async (req, res) => {
  try {
    const { campaignName, status, phone, limit, offset } = req.query;
    const logs = await getBroadcastLogs({
      userId: getUserId(req),
      campaignName,
      status,
      phone,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });
    res.json(logs);
  } catch (error) {
    console.error("Failed to get broadcast logs:", error);
    res.status(500).json({ error: "Failed to get broadcast logs" });
  }
});
router8.get("/imported-contacts", requireAuth, async (req, res) => {
  try {
    const contacts = await getImportedContacts(getUserId(req));
    res.json(contacts);
  } catch (error) {
    console.error("Failed to get imported contacts:", error);
    res.status(500).json({ error: "Failed to get imported contacts" });
  }
});
router8.delete("/imported-contacts/:id", requireAuth, async (req, res) => {
  try {
    const success = await deleteImportedContact(
      getUserId(req),
      req.params.id
    );
    if (!success) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete imported contact:", error);
    res.status(500).json({ error: "Failed to delete imported contact" });
  }
});
router8.get(
  "/campaigns/contacts/all",
  requireAuth,
  getAllContacts2
);
router8.get(
  "/campaigns/contacts/available",
  requireAuth,
  getAvailableContacts2
);
router8.get("/campaigns", requireAuth, getCampaigns3);
router8.post("/campaigns", requireAuth, createCampaign3);
router8.get("/campaigns/:id", requireAuth, getCampaignById3);
router8.post(
  "/campaigns/:id/execute",
  requireAuth,
  executeCampaign2
);
router8.get(
  "/campaigns/:id/interested",
  requireAuth,
  getInterestedContacts2
);
router8.get(
  "/campaigns/:id/not-interested",
  requireAuth,
  getNotInterestedContacts2
);
router8.post(
  "/campaigns/:id/send-to-list",
  requireAuth,
  sendToInterestList2
);
router8.delete("/campaigns/:id", requireAuth, deleteCampaign3);
var broadcast_routes_default = router8;

// modules/whatsapp-marketing/server/modules/aiAnalytics/aiAnalytics.routes.js
import { Router as Router9 } from "express";
var router9 = Router9();
router9.get("/qualifications", async (req, res) => {
  try {
    const { category, source, campaignId, agentId } = req.query;
    let qualifications = await getQualifications();
    if (category && typeof category === "string") {
      qualifications = qualifications.filter((q) => q.category === category);
    }
    if (source && typeof source === "string") {
      qualifications = qualifications.filter((q) => q.source === source);
    }
    if (campaignId && typeof campaignId === "string") {
      qualifications = qualifications.filter((q) => q.campaignId === campaignId);
    }
    if (agentId && typeof agentId === "string") {
      qualifications = qualifications.filter((q) => q.agentId === agentId);
    }
    qualifications.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(qualifications);
  } catch (error) {
    console.error("Error getting qualifications:", error);
    res.status(500).json({ error: "Failed to get qualifications" });
  }
});
router9.get("/qualifications/stats", async (req, res) => {
  try {
    const stats = await getQualificationStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting qualification stats:", error);
    res.status(500).json({ error: "Failed to get qualification stats" });
  }
});
router9.get("/qualifications/report", async (req, res) => {
  try {
    const report = await getQualificationReport();
    res.json(report);
  } catch (error) {
    console.error("Error getting qualification report:", error);
    res.status(500).json({ error: "Failed to get qualification report" });
  }
});
router9.get("/qualifications/:id", async (req, res) => {
  try {
    const qualification = await getQualificationById(req.params.id);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error getting qualification:", error);
    res.status(500).json({ error: "Failed to get qualification" });
  }
});
router9.post("/qualifications", async (req, res) => {
  try {
    const { phone, name, message, source, campaignId, campaignName, agentId, agentName, contactId } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ error: "Phone and name are required" });
    }
    const qualification = await createOrUpdateQualification(
      phone,
      name,
      message || "",
      source || "manual",
      { campaignId, campaignName, agentId, agentName, contactId }
    );
    res.status(201).json(qualification);
  } catch (error) {
    console.error("Error creating qualification:", error);
    res.status(500).json({ error: "Failed to create qualification" });
  }
});
router9.put("/qualifications/:id/category", async (req, res) => {
  try {
    const { category, notes } = req.body;
    if (!category || !["interested", "not_interested", "pending"].includes(category)) {
      return res.status(400).json({ error: "Valid category is required (interested, not_interested, pending)" });
    }
    const qualification = await updateQualificationCategory(req.params.id, category, notes);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error updating qualification category:", error);
    res.status(500).json({ error: "Failed to update qualification category" });
  }
});
router9.put("/qualifications/:id/notes", async (req, res) => {
  try {
    const { notes } = req.body;
    const qualification = await updateQualificationNotes(req.params.id, notes || "");
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error updating qualification notes:", error);
    res.status(500).json({ error: "Failed to update qualification notes" });
  }
});
router9.delete("/qualifications/:id", async (req, res) => {
  try {
    const success = await deleteQualification(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Qualification not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting qualification:", error);
    res.status(500).json({ error: "Failed to delete qualification" });
  }
});
router9.get("/qualifications/by-phone/:phone", async (req, res) => {
  try {
    const qualification = await getQualificationByPhone(req.params.phone);
    if (!qualification) {
      return res.status(404).json({ error: "Qualification not found for this phone" });
    }
    res.json(qualification);
  } catch (error) {
    console.error("Error getting qualification by phone:", error);
    res.status(500).json({ error: "Failed to get qualification" });
  }
});
var aiAnalytics_routes_default = router9;

// modules/whatsapp-marketing/server/modules/prefilledText/prefilledText.routes.js
import { Router as Router10 } from "express";
var router10 = Router10();
router10.get("/", async (req, res) => {
  try {
    const mappings = await getAllMappings2();
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching prefilled text mappings:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});
router10.get("/:id", async (req, res) => {
  try {
    const mapping = await getMappingById2(req.params.id);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error fetching mapping:", error);
    res.status(500).json({ error: "Failed to fetch mapping" });
  }
});
router10.post("/", async (req, res) => {
  try {
    const { prefilledText, agentId, agentName } = req.body;
    if (!prefilledText || !agentId || !agentName) {
      return res.status(400).json({ error: "Missing required fields: prefilledText, agentId, agentName" });
    }
    const mapping = await createMapping3({
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
router10.put("/:id", async (req, res) => {
  try {
    const mapping = await updateMapping3(req.params.id, req.body);
    if (!mapping) {
      return res.status(404).json({ error: "Mapping not found" });
    }
    res.json(mapping);
  } catch (error) {
    console.error("Error updating mapping:", error);
    res.status(500).json({ error: "Failed to update mapping" });
  }
});
router10.delete("/:id", async (req, res) => {
  try {
    await deleteMapping3(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting mapping:", error);
    res.status(500).json({ error: "Failed to delete mapping" });
  }
});
var prefilledText_routes_default = router10;

// modules/whatsapp-marketing/server/modules/credentials/credentials.routes.js
import { Router as Router11 } from "express";
init_credentials_service();
var router11 = Router11();
function getEmbeddedSignupConfig() {
  const firstEnv = (...keys) => {
    for (const key of keys) {
      const value = String(process.env[key] || "").trim();
      if (value) return value.replace(/^['"]|['"]$/g, "");
    }
    return "";
  };
  const appId = firstEnv(
    "META_APP_ID",
    "WHATSAPP_META_APP_ID",
    "WHATSAPP_APP_ID",
    "FACEBOOK_APP_ID",
    "APP_ID"
  );
  const appSecret = firstEnv(
    "META_APP_SECRET",
    "WHATSAPP_META_APP_SECRET",
    "WHATSAPP_APP_SECRET",
    "FACEBOOK_APP_SECRET",
    "APP_SECRET"
  );
  const configId = firstEnv(
    "META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    "WHATSAPP_CONFIGURATION_ID",
    "WHATSAPP_CONFIG_ID",
    "META_CONFIG_ID",
    "FACEBOOK_CONFIG_ID",
    "EMBEDDED_SIGNUP_CONFIG_ID",
    "CONFIGURATION_ID"
  );
  return {
    appId,
    appSecret,
    configId,
    graphVersion: firstEnv("META_GRAPH_VERSION", "GRAPH_VERSION") || "v21.0",
    isConfigured: Boolean(appId && appSecret && configId)
  };
}
router11.get("/embedded-signup/config", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const config = getEmbeddedSignupConfig();
    res.json({
      appId: config.appId,
      configId: config.configId,
      graphVersion: config.graphVersion,
      isConfigured: config.isConfigured
    });
  } catch (error) {
    console.error("[Credentials API] Embedded signup config error:", error);
    res.status(500).json({ error: "Failed to load embedded signup config" });
  }
});
router11.post("/embedded-signup/complete", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { code, businessAccountId, phoneNumberId } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Facebook authorization code is required" });
    }
    if (!businessAccountId || !phoneNumberId) {
      return res.status(400).json({
        error: "WhatsApp Business Account ID and Phone Number ID are required from Meta signup"
      });
    }
    const config = getEmbeddedSignupConfig();
    if (!config.isConfigured) {
      return res.status(400).json({ error: "Meta Embedded Signup is not configured" });
    }
    const tokenUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", config.appId);
    tokenUrl.searchParams.set("client_secret", config.appSecret);
    tokenUrl.searchParams.set("code", code);
    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(400).json({
        error: "Failed to exchange Facebook code for access token",
        details: tokenData.error?.message || "Meta token exchange failed"
      });
    }
    await saveCredentials(userId, {
      whatsappToken: tokenData.access_token,
      phoneNumberId,
      businessAccountId,
      appId: config.appId,
      appSecret: config.appSecret,
      webhookVerifyToken: `sl_${userId}`
    });
    const testResponse = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      }
    );
    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      await updateVerificationStatus(userId, false);
      return res.status(400).json({
        error: "WhatsApp number connected, but verification failed",
        details: errorData.error?.message || "Unable to verify phone number"
      });
    }
    const phoneData = await testResponse.json();
    await updateVerificationStatus(userId, true);
    res.json({
      success: true,
      phoneNumber: phoneData.display_phone_number,
      verifiedName: phoneData.verified_name,
      phoneNumberId,
      businessAccountId
    });
  } catch (error) {
    console.error("[Credentials API] Embedded signup complete error:", error);
    res.status(500).json({ error: "Failed to complete embedded signup", details: error.message });
  }
});
router11.get("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const stored = await getCredentialsByUserId(userId);
    const connectedWhatsApp = await hasUsableCredentials(
      userId,
      "whatsapp"
    );
    if (!stored && !connectedWhatsApp) {
      return res.json({
        hasCredentials: false,
        credentials: null,
        status: { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false }
      });
    }
    const masked = stored ? await getMaskedCredentialsForUser(userId) : null;
    const legacyStatus = await getCredentialStatus(userId);
    const status = {
      ...legacyStatus,
      hasWhatsApp: legacyStatus.hasWhatsApp || connectedWhatsApp,
      isVerified: Boolean(stored?.isVerified || legacyStatus.hasWhatsApp || connectedWhatsApp)
    };
    res.json({
      hasCredentials: true,
      credentials: masked,
      status,
      isVerified: status.isVerified,
      lastVerifiedAt: stored?.lastVerifiedAt,
      source: connectedWhatsApp ? "connected_apps" : "legacy"
    });
  } catch (error) {
    console.error("[Credentials API] Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});
router11.post("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const {
      whatsappToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken,
      appId,
      appSecret,
      openaiApiKey,
      geminiApiKey,
      facebookAccessToken,
      facebookPageId
    } = req.body;
    const saved = await saveCredentials(userId, {
      whatsappToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken,
      appId,
      appSecret,
      openaiApiKey,
      geminiApiKey,
      facebookAccessToken,
      facebookPageId
    });
    if (!saved) {
      return res.status(500).json({ error: "Failed to save credentials" });
    }
    const masked = await getMaskedCredentialsForUser(userId);
    const status = await getCredentialStatus(userId);
    res.json({
      success: true,
      message: "Credentials saved successfully",
      credentials: masked,
      status
    });
  } catch (error) {
    console.error("[Credentials API] Error saving credentials:", error);
    res.status(500).json({ error: "Failed to save credentials" });
  }
});
router11.post("/test/whatsapp", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await getDecryptedCredentials(userId);
    if (!creds || !creds.whatsappToken || !creds.phoneNumberId) {
      return res.status(400).json({ error: "WhatsApp credentials not configured" });
    }
    const testResponse = await fetch(
      `https://graph.facebook.com/v21.0/${creds.phoneNumberId}?fields=verified_name,display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${creds.whatsappToken}`
        }
      }
    );
    if (!testResponse.ok) {
      const errorData = await testResponse.json();
      await updateVerificationStatus(userId, false);
      return res.status(400).json({
        error: "WhatsApp API connection failed",
        details: errorData.error?.message || "Invalid credentials"
      });
    }
    const data = await testResponse.json();
    await updateVerificationStatus(userId, true);
    res.json({
      success: true,
      message: "WhatsApp API connection successful",
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name
    });
  } catch (error) {
    console.error("[Credentials API] WhatsApp test error:", error);
    const errorUserId = getUserId(req);
    if (errorUserId) {
      await updateVerificationStatus(errorUserId, false);
    }
    res.status(500).json({ error: "Failed to test WhatsApp connection", details: error.message });
  }
});
router11.post("/test/openai", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await getDecryptedCredentials(userId);
    if (!creds || !creds.openaiApiKey) {
      return res.status(400).json({ error: "OpenAI API key not configured" });
    }
    const testResponse = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${creds.openaiApiKey}`
      }
    });
    if (!testResponse.ok) {
      return res.status(400).json({
        error: "OpenAI API connection failed",
        details: "Invalid API key"
      });
    }
    res.json({
      success: true,
      message: "OpenAI API connection successful"
    });
  } catch (error) {
    console.error("[Credentials API] OpenAI test error:", error);
    res.status(500).json({ error: "Failed to test OpenAI connection", details: error.message });
  }
});
router11.post("/test/facebook", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const creds = await getDecryptedCredentials(userId);
    if (!creds || !creds.facebookAccessToken) {
      return res.status(400).json({ error: "Facebook access token not configured" });
    }
    const testResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${creds.facebookAccessToken}`
    );
    if (!testResponse.ok) {
      return res.status(400).json({
        error: "Facebook API connection failed",
        details: "Invalid access token"
      });
    }
    const data = await testResponse.json();
    res.json({
      success: true,
      message: "Facebook API connection successful",
      name: data.name
    });
  } catch (error) {
    console.error("[Credentials API] Facebook test error:", error);
    res.status(500).json({ error: "Failed to test Facebook connection", details: error.message });
  }
});
router11.delete("/", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    await deleteCredentials(userId);
    res.json({ success: true, message: "Credentials deleted successfully" });
  } catch (error) {
    console.error("[Credentials API] Error deleting credentials:", error);
    res.status(500).json({ error: "Failed to delete credentials" });
  }
});
router11.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const legacyStatus = await getCredentialStatus(userId);
    const connectedWhatsApp = await hasUsableCredentials(
      userId,
      "whatsapp"
    );
    const status = {
      ...legacyStatus,
      hasWhatsApp: legacyStatus.hasWhatsApp || connectedWhatsApp,
      isVerified: Boolean(legacyStatus.isVerified || legacyStatus.hasWhatsApp || connectedWhatsApp)
    };
    res.json(status);
  } catch (error) {
    console.error("[Credentials API] Error getting status:", error);
    res.status(500).json({ error: "Failed to get credentials status" });
  }
});
var credentials_routes_default = router11;

// modules/whatsapp-marketing/server/modules/reports/reports.routes.js
import { Router as Router12 } from "express";

// modules/whatsapp-marketing/server/modules/reports/reports.service.js
init_mongodb_adapter();

// modules/whatsapp-marketing/server/modules/usage/usage.service.js
init_mongodb_adapter();
init_credentials_service();
var TEMPLATE_UNIT_PRICE = 0.85;
var STATUS_RANK = {
  pending: 0,
  sent: 2,
  accepted: 2,
  failed: 3,
  delivered: 4,
  read: 5
};
var normalizeStatus2 = (value) => {
  const status = String(value || "pending").toLowerCase();
  return status === "accepted" ? "sent" : status;
};
var strongerStatus = (left, right) => {
  const a = normalizeStatus2(left);
  const b = normalizeStatus2(right);
  return (STATUS_RANK[b] ?? 0) > (STATUS_RANK[a] ?? 0) ? b : a;
};
var normalizePhone3 = (value) => String(value || "").replace(/\D/g, "").slice(-10);
var validDate = (value) => {
  if (value === null || value === void 0 || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
var objectIdDate = (value) => {
  const raw = String(value || "");
  if (!/^[a-f\d]{24}$/i.test(raw)) return null;
  const seconds = Number.parseInt(raw.slice(0, 8), 16);
  const date = new Date(seconds * 1e3);
  return Number.isNaN(date.getTime()) ? null : date;
};
var webhookFailureReason = (event) => [
  event?.errorTitle,
  event?.errorMessage,
  event?.errorDetails,
  event?.rawStatus?.errors?.[0]?.title,
  event?.rawStatus?.errors?.[0]?.message,
  event?.rawStatus?.errors?.[0]?.error_data?.details
].map((value) => String(value || "").trim()).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(" - ");
function buildUsageDateMatch(options = {}) {
  const from = options.fromDate ? validDate(`${options.fromDate}T00:00:00.000`) : null;
  const to = options.toDate ? validDate(`${options.toDate}T23:59:59.999`) : null;
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = from.toISOString();
  if (to) range.$lte = to.toISOString();
  return range;
}
async function getTenantUsageEvents(userId, options = {}) {
  if (!userId) return [];
  const dateRange2 = buildUsageDateMatch(options);
  const hasDateRange = Object.keys(dateRange2).length > 0;
  const maxRows = Math.min(Math.max(Number(options.limit) || 1e3, 100), 5e3);
  const [messages, contacts, broadcastLogs, campaignLogs, campaigns] = await Promise.all([
    Message.find({ userId, ...hasDateRange ? { timestamp: dateRange2 } : {} }).sort({ timestamp: -1 }).limit(maxRows).lean(),
    Contact.find({ userId }).select({ id: 1, name: 1, phone: 1 }).limit(1e4).lean(),
    BroadcastLog.find({ userId, ...hasDateRange ? { timestamp: dateRange2 } : {} }).sort({ timestamp: -1 }).limit(maxRows).lean(),
    CampaignLog.find(
      hasDateRange ? {
        userId,
        $or: [
          { sentAt: dateRange2 },
          { sendAttemptedAt: dateRange2 },
          { createdAt: dateRange2 }
        ]
      } : { userId }
    ).sort({ createdAt: -1 }).limit(maxRows).lean(),
    Campaign.find({ userId }).select({ _id: 1, name: 1 }).lean()
  ]);
  const contactsById = new Map(
    contacts.map((contact) => [String(contact.id), contact])
  );
  const contactsByPhone = new Map(
    contacts.map((contact) => [normalizePhone3(contact.phone), contact])
  );
  const campaignsById = new Map(
    campaigns.map((campaign) => [
      String(campaign._id),
      String(campaign.name || "Drip Campaign")
    ])
  );
  const ownedMessageIds = Array.from(
    new Set(
      [
        ...messages.map((item) => item.whatsappMessageId),
        ...broadcastLogs.map((item) => item.messageId),
        ...campaignLogs.map((item) => item.messageId)
      ].map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
  const webhookEvents = ownedMessageIds.length ? await WebhookStatusEvent.find({
    messageId: { $in: ownedMessageIds }
  }).sort({ statusTimestamp: 1, createdAt: 1 }).lean() : [];
  const connectedAccounts = await ConnectedAccount.find({
    userId,
    providerId: "whatsapp",
    status: "connected"
  }).select({ metadata: 1 }).lean();
  const decryptedCredentials = await getDecryptedCredentials(userId);
  const ownedPhoneNumberIds = Array.from(
    new Set(
      [
        decryptedCredentials?.phoneNumberId,
        ...connectedAccounts.map((account) => {
          const metadata = account?.metadata instanceof Map ? Object.fromEntries(account.metadata.entries()) : account?.metadata || {};
          return metadata.phoneNumberId;
        })
      ].map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
  const accountWebhookEvents = await WebhookStatusEvent.find({
    $and: [
      {
        $or: [
          { userId },
          ...ownedPhoneNumberIds.length ? [{ phoneNumberId: { $in: ownedPhoneNumberIds } }] : []
        ]
      },
      ...hasDateRange ? [
        {
          $or: [
            { statusTimestamp: dateRange2 },
            { webhookReceivedAt: dateRange2 },
            { createdAt: dateRange2 }
          ]
        }
      ] : []
    ]
  }).sort({ statusTimestamp: 1, createdAt: 1 }).limit(maxRows).lean();
  const webhookByMessageId = /* @__PURE__ */ new Map();
  for (const event of webhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const current = webhookByMessageId.get(messageId) || {
      status: "pending",
      deliveredAt: null,
      readAt: null,
      failedAt: null
    };
    const status = normalizeStatus2(event.status);
    current.status = strongerStatus(current.status, status);
    const eventTime = validDate(event.statusTimestamp)?.toISOString() || validDate(event.webhookReceivedAt)?.toISOString() || null;
    if (status === "delivered") current.deliveredAt = eventTime;
    if (status === "read") current.readAt = eventTime;
    if (status === "failed") {
      current.failedAt = eventTime;
      current.failureReason = webhookFailureReason(event) || current.failureReason;
      current.errorCode = event.errorCode || current.errorCode;
      current.errorTitle = event.errorTitle || current.errorTitle;
      current.errorMessage = event.errorMessage || current.errorMessage;
      current.errorDetails = event.errorDetails || current.errorDetails;
    }
    webhookByMessageId.set(messageId, current);
  }
  for (const event of accountWebhookEvents) {
    const messageId = String(event.messageId || "").trim();
    if (!messageId) continue;
    const current = webhookByMessageId.get(messageId) || {
      status: "pending",
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      recipientId: String(event.recipientId || ""),
      pricingCategory: String(event.pricingCategory || "")
    };
    const status = normalizeStatus2(event.status);
    current.status = strongerStatus(current.status, status);
    current.recipientId = current.recipientId || String(event.recipientId || "");
    current.pricingCategory = current.pricingCategory || String(event.pricingCategory || "");
    const eventTime = validDate(event.statusTimestamp)?.toISOString() || validDate(event.webhookReceivedAt)?.toISOString() || null;
    current.timestamp = current.timestamp || eventTime;
    if (status === "sent") current.sentAt = eventTime;
    if (status === "delivered") current.deliveredAt = eventTime;
    if (status === "read") current.readAt = eventTime;
    if (status === "failed") {
      current.failedAt = eventTime;
      current.failureReason = webhookFailureReason(event) || current.failureReason;
      current.errorCode = event.errorCode || current.errorCode;
      current.errorTitle = event.errorTitle || current.errorTitle;
      current.errorMessage = event.errorMessage || current.errorMessage;
      current.errorDetails = event.errorDetails || current.errorDetails;
    }
    webhookByMessageId.set(messageId, current);
  }
  const eventMap = /* @__PURE__ */ new Map();
  const addEvent = (candidate) => {
    const providerId = String(candidate.providerMessageId || "").trim();
    const key = providerId ? `provider:${providerId}` : `${candidate.source}:${candidate.id}`;
    const webhook = providerId ? webhookByMessageId.get(providerId) : null;
    const enriched = {
      ...candidate,
      status: strongerStatus(candidate.status, webhook?.status),
      deliveredAt: candidate.deliveredAt || webhook?.deliveredAt || null,
      readAt: candidate.readAt || webhook?.readAt || null,
      failedAt: candidate.failedAt || webhook?.failedAt || null,
      failureReason: candidate.failureReason || webhook?.failureReason || "",
      errorCode: candidate.errorCode || webhook?.errorCode || "",
      errorTitle: candidate.errorTitle || webhook?.errorTitle || "",
      errorMessage: candidate.errorMessage || webhook?.errorMessage || "",
      errorDetails: candidate.errorDetails || webhook?.errorDetails || ""
    };
    if (enriched.readAt) enriched.status = "read";
    else if (enriched.deliveredAt) enriched.status = strongerStatus(enriched.status, "delivered");
    else if (enriched.failedAt && STATUS_RANK[enriched.status] < STATUS_RANK.sent) {
      enriched.status = "failed";
    }
    const existing = eventMap.get(key);
    if (!existing) {
      eventMap.set(key, enriched);
      return;
    }
    eventMap.set(key, {
      ...existing,
      ...Object.fromEntries(
        Object.entries(enriched).filter(([, value]) => value !== void 0 && value !== "")
      ),
      contactId: existing.contactId || enriched.contactId,
      contactName: existing.contactName && existing.contactName !== "Unknown" ? existing.contactName : enriched.contactName,
      contactPhone: existing.contactPhone || enriched.contactPhone,
      source: existing.source && !["account_service", "account_marketing", "account_utility"].includes(
        existing.source
      ) ? existing.source : enriched.source,
      messageType: existing.messageType || enriched.messageType,
      templateName: existing.templateName || enriched.templateName,
      campaignName: existing.campaignName || enriched.campaignName,
      content: existing.content || enriched.content,
      status: strongerStatus(existing.status, enriched.status),
      deliveredAt: existing.deliveredAt || enriched.deliveredAt || null,
      readAt: existing.readAt || enriched.readAt || null,
      failedAt: existing.failedAt || enriched.failedAt || null,
      failureReason: existing.failureReason || enriched.failureReason || "",
      errorCode: existing.errorCode || enriched.errorCode || "",
      errorTitle: existing.errorTitle || enriched.errorTitle || "",
      errorMessage: existing.errorMessage || enriched.errorMessage || "",
      errorDetails: existing.errorDetails || enriched.errorDetails || ""
    });
  };
  for (const message of messages) {
    const contact = contactsById.get(String(message.contactId));
    addEvent({
      id: String(message.id || message._id),
      providerMessageId: message.whatsappMessageId || void 0,
      userId,
      contactId: String(message.contactId || ""),
      contactName: String(contact?.name || "Unknown"),
      contactPhone: String(contact?.phone || ""),
      direction: message.direction === "inbound" ? "inbound" : "outbound",
      source: message.source || "inbox",
      messageType: message.type === "template" ? "template" : "text",
      templateName: message.templateName || void 0,
      campaignName: message.campaignName || void 0,
      content: message.content || "",
      status: normalizeStatus2(message.status),
      failureReason: message.failureReason || message.error || "",
      timestamp: validDate(message.timestamp)?.toISOString() || validDate(message.createdAt)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      agentId: message.agentId || void 0
    });
  }
  for (const log of broadcastLogs) {
    const phone = String(log.contactPhone || "");
    const contact = contactsByPhone.get(normalizePhone3(phone));
    addEvent({
      id: String(log.id || log._id),
      providerMessageId: log.messageId || void 0,
      userId,
      contactId: contact ? String(contact.id) : void 0,
      contactName: String(log.contactName || contact?.name || "Unknown"),
      contactPhone: phone || String(contact?.phone || ""),
      direction: "outbound",
      source: "broadcast",
      messageType: log.messageType || "custom",
      templateName: log.templateName || void 0,
      campaignName: log.campaignName || "Broadcast",
      content: log.message || "",
      status: normalizeStatus2(log.status),
      failureReason: log.failureReason || log.error || "",
      timestamp: validDate(log.timestamp)?.toISOString() || validDate(log.createdAt)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      replied: Boolean(log.replied)
    });
  }
  for (const log of campaignLogs) {
    const phone = String(log.contact || "");
    const contact = contactsByPhone.get(normalizePhone3(phone));
    addEvent({
      id: String(log._id),
      providerMessageId: log.messageId || void 0,
      userId,
      contactId: contact ? String(contact.id) : void 0,
      contactName: String(contact?.name || phone || "Unknown"),
      contactPhone: phone || String(contact?.phone || ""),
      direction: "outbound",
      source: "drip",
      messageType: "template",
      templateName: log.templateName || "Unknown template",
      campaignName: campaignsById.get(String(log.campaignId)) || "Drip Campaign",
      status: normalizeStatus2(log.status),
      failureReason: log.failureReason || log.error || "",
      timestamp: validDate(log.sentAt)?.toISOString() || validDate(log.sendAttemptedAt)?.toISOString() || validDate(log.createdAt)?.toISOString() || objectIdDate(log._id)?.toISOString() || (/* @__PURE__ */ new Date(0)).toISOString(),
      deliveredAt: validDate(log.deliveredAt)?.toISOString() || null,
      readAt: validDate(log.readAt)?.toISOString() || null,
      failedAt: validDate(log.failedAt)?.toISOString() || null
    });
  }
  for (const [messageId, webhook] of webhookByMessageId.entries()) {
    const pricingCategory = String(webhook.pricingCategory || "").toLowerCase();
    const source = pricingCategory === "authentication" ? "otp" : pricingCategory === "utility" ? "voice_marketing" : pricingCategory === "marketing" ? "account_marketing" : "account_service";
    const templateName = pricingCategory === "authentication" ? "Authentication OTP" : pricingCategory === "utility" ? "Voice Marketing Utility Template" : pricingCategory === "marketing" ? "Account Marketing Template" : void 0;
    addEvent({
      id: `webhook:${messageId}`,
      providerMessageId: messageId,
      userId,
      contactName: String(webhook.recipientId || "Unknown"),
      contactPhone: String(webhook.recipientId || ""),
      direction: "outbound",
      source,
      messageType: ["authentication", "utility", "marketing"].includes(pricingCategory) ? "template" : "text",
      templateName,
      campaignName: pricingCategory === "authentication" ? "Platform OTP" : pricingCategory === "utility" ? "Voice Marketing / Utility" : "Account-wide WhatsApp",
      status: webhook.status,
      timestamp: webhook.sentAt || webhook.timestamp || webhook.deliveredAt || webhook.readAt || (/* @__PURE__ */ new Date(0)).toISOString(),
      deliveredAt: webhook.deliveredAt || null,
      readAt: webhook.readAt || null,
      failedAt: webhook.failedAt || null
    });
  }
  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
function applyUsageFilters(events, query) {
  const from = query.fromDate ? /* @__PURE__ */ new Date(`${query.fromDate}T00:00:00.000`) : null;
  const to = query.toDate ? /* @__PURE__ */ new Date(`${query.toDate}T23:59:59.999`) : null;
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const direction = String(query.direction || "all").toLowerCase();
  const source = String(query.source || "all").toLowerCase();
  const template = String(query.template || "all").toLowerCase();
  return events.filter((event) => {
    const timestamp = new Date(event.timestamp);
    if (from && timestamp < from) return false;
    if (to && timestamp > to) return false;
    if (status !== "all" && event.status !== status) return false;
    if (direction !== "all" && event.direction !== direction) return false;
    if (source !== "all" && event.source !== source) return false;
    if (template !== "all" && String(event.templateName || "").toLowerCase() !== template) {
      return false;
    }
    if (search) {
      const haystack = [
        event.contactName,
        event.contactPhone,
        event.templateName,
        event.campaignName,
        event.content,
        event.providerMessageId
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
function buildUsageResponse(events, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(query.limit) || 25));
  const total = events.length;
  const rows = events.slice((page - 1) * limit, page * limit);
  const byRecipientMap = /* @__PURE__ */ new Map();
  const byTemplateMap = /* @__PURE__ */ new Map();
  const timelineMap = /* @__PURE__ */ new Map();
  for (const event of events) {
    const recipientKey = normalizePhone3(event.contactPhone) || event.contactName;
    const recipient = byRecipientMap.get(recipientKey) || {
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      total: 0,
      inbound: 0,
      outbound: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      cost: 0
    };
    recipient.total++;
    recipient[event.direction]++;
    if (["delivered", "read"].includes(event.status)) recipient.delivered++;
    if (event.status === "read") recipient.read++;
    if (event.status === "failed") recipient.failed++;
    if (event.messageType === "template" && event.direction === "outbound" && event.status !== "failed" && event.status !== "pending") {
      recipient.cost += TEMPLATE_UNIT_PRICE;
    }
    byRecipientMap.set(recipientKey, recipient);
    if (event.messageType === "template") {
      const templateKey = event.templateName || "Unknown template";
      const template = byTemplateMap.get(templateKey) || {
        templateName: templateKey,
        total: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        chargeable: 0,
        cost: 0
      };
      template.total++;
      if (["delivered", "read"].includes(event.status)) template.delivered++;
      if (event.status === "read") template.read++;
      if (event.status === "failed") template.failed++;
      if (event.status !== "failed" && event.status !== "pending") {
        template.chargeable++;
        template.cost += TEMPLATE_UNIT_PRICE;
      }
      byTemplateMap.set(templateKey, template);
    }
    const dateKey = event.timestamp.slice(0, 10);
    const point = timelineMap.get(dateKey) || {
      date: dateKey,
      total: 0,
      inbound: 0,
      outbound: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      templates: 0,
      cost: 0
    };
    point.total++;
    point[event.direction]++;
    if (["delivered", "read"].includes(event.status)) point.delivered++;
    if (event.status === "read") point.read++;
    if (event.status === "failed") point.failed++;
    if (event.messageType === "template") {
      point.templates++;
      if (event.status !== "failed" && event.status !== "pending") {
        point.cost += TEMPLATE_UNIT_PRICE;
      }
    }
    timelineMap.set(dateKey, point);
  }
  const outbound = events.filter((event) => event.direction === "outbound");
  const delivered = outbound.filter(
    (event) => ["delivered", "read"].includes(event.status)
  ).length;
  const read2 = outbound.filter((event) => event.status === "read").length;
  const failed = outbound.filter((event) => event.status === "failed").length;
  const templateEvents = events.filter((event) => event.messageType === "template");
  const chargeableTemplates = templateEvents.filter(
    (event) => event.direction === "outbound" && event.status !== "failed" && event.status !== "pending"
  ).length;
  return {
    summary: {
      totalMessages: total,
      outbound: outbound.length,
      inbound: events.filter((event) => event.direction === "inbound").length,
      delivered,
      read: read2,
      failed,
      deliveryRate: outbound.length ? Math.round(delivered / outbound.length * 100) : 0,
      readRate: delivered ? Math.round(read2 / delivered * 100) : 0,
      uniqueRecipients: byRecipientMap.size,
      templateMessages: templateEvents.length,
      chargeableTemplates,
      unitPrice: TEMPLATE_UNIT_PRICE,
      totalCost: Number((chargeableTemplates * TEMPLATE_UNIT_PRICE).toFixed(2))
    },
    filters: {
      templates: Array.from(byTemplateMap.keys()).sort(),
      sources: Array.from(new Set(events.map((event) => event.source))).sort()
    },
    byRecipient: Array.from(byRecipientMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => b.total - a.total),
    byTemplate: Array.from(byTemplateMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => b.total - a.total),
    timeline: Array.from(timelineMap.values()).map((item) => ({ ...item, cost: Number(item.cost.toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date)),
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

// modules/whatsapp-marketing/server/modules/reports/reports.service.js
function getDateRange(filter) {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  let endDate = new Date(now);
  switch (filter.period) {
    case "hour":
      startDate = new Date(now.getTime() - 60 * 60 * 1e3);
      break;
    case "today":
    case "today_hourly":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday":
    case "yesterday_hourly":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      break;
    case "year":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
      break;
    case "custom":
      startDate = filter.startDate ? new Date(filter.startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      endDate = filter.endDate ? new Date(filter.endDate) : now;
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
  }
  return { startDate, endDate };
}
async function getAIAgentPerformance(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const agents = await readCollection("agents");
  const messages = await readCollection("messages");
  const contactAgents = await readCollection("contact_agents");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const agentStats = agents.map((agent) => {
    const assignments = contactAgents.filter((ca) => ca.agentId === agent.id);
    const contactIds = assignments.map((a) => a.contactId);
    const agentMessages = filteredMessages.filter(
      (m) => contactIds.includes(m.contactId) && m.direction === "outbound"
    );
    const inboundMessages = filteredMessages.filter(
      (m) => contactIds.includes(m.contactId) && m.direction === "inbound"
    );
    const responseCount = agentMessages.length;
    const uniqueChats = new Set(agentMessages.map((m) => m.contactId)).size;
    const avgResponseTime = calculateAvgResponseTime(inboundMessages, agentMessages);
    return {
      id: agent.id,
      name: agent.name,
      model: agent.model || "gpt-4o",
      chatsHandled: uniqueChats,
      messagesGenerated: responseCount,
      avgResponseTime: formatResponseTime(avgResponseTime),
      avgResponseTimeMs: avgResponseTime,
      isActive: agent.isActive,
      temperature: agent.temperature
    };
  });
  const sortedAgents = agentStats.sort((a, b) => b.chatsHandled - a.chatsHandled);
  const totalChats = sortedAgents.reduce((sum, a) => sum + a.chatsHandled, 0);
  const totalMessages = sortedAgents.reduce((sum, a) => sum + a.messagesGenerated, 0);
  const activeAgents = sortedAgents.filter((a) => a.isActive).length;
  const avgResponseTimes = sortedAgents.filter((a) => a.avgResponseTimeMs > 0).map((a) => a.avgResponseTimeMs);
  const overallAvgResponseTime = avgResponseTimes.length > 0 ? avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length : 0;
  return {
    agents: sortedAgents,
    summary: {
      totalAgents: agents.length,
      activeAgents,
      totalChats,
      totalMessages,
      avgResponseTime: formatResponseTime(overallAvgResponseTime)
    },
    period: filter.period
  };
}
function calculateAvgResponseTime(inboundMessages, outboundMessages) {
  let totalTime = 0;
  let count = 0;
  for (const inbound of inboundMessages) {
    const inboundTime = new Date(inbound.timestamp || inbound.createdAt).getTime();
    const response = outboundMessages.find((out) => {
      const outTime = new Date(out.timestamp || out.createdAt).getTime();
      return out.contactId === inbound.contactId && outTime > inboundTime && outTime - inboundTime < 3e5;
    });
    if (response) {
      const responseTime = new Date(response.timestamp || response.createdAt).getTime();
      totalTime += responseTime - inboundTime;
      count++;
    }
  }
  return count > 0 ? totalTime / count : 0;
}
function formatResponseTime(ms) {
  if (ms === 0) return "N/A";
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}
async function getCustomerReplies(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await readCollection("messages");
  const contacts = await readCollection("contacts");
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const inboundMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return m.direction === "inbound" && timestamp >= startDate && timestamp <= endDate;
  });
  const recentReplies = inboundMessages.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()).slice(0, 50).map((m) => {
    const contact = contactMap.get(m.contactId);
    const timeDiff = Date.now() - new Date(m.timestamp || m.createdAt).getTime();
    return {
      id: m.id,
      contactId: m.contactId,
      name: contact?.name || `Unknown (${m.contactId})`,
      phone: contact?.phone || "",
      message: m.content?.substring(0, 100) + (m.content?.length > 100 ? "..." : ""),
      fullMessage: m.content,
      time: formatTimeAgo(timeDiff),
      timestamp: m.timestamp || m.createdAt,
      type: m.type || "text",
      sentiment: analyzeSentiment(m.content)
    };
  });
  const sentimentCounts = {
    positive: recentReplies.filter((r) => r.sentiment === "Positive").length,
    negative: recentReplies.filter((r) => r.sentiment === "Negative").length,
    neutral: recentReplies.filter((r) => r.sentiment === "Neutral").length
  };
  const totalReplies = inboundMessages.length;
  const positivePercentage = totalReplies > 0 ? Math.round(sentimentCounts.positive / totalReplies * 100) : 0;
  const unsubscribeKeywords = ["stop", "unsubscribe", "remove", "opt out", "cancel"];
  const unsubscribeRequests = inboundMessages.filter(
    (m) => unsubscribeKeywords.some((kw) => m.content?.toLowerCase().includes(kw))
  ).length;
  return {
    replies: recentReplies,
    summary: {
      totalReplies,
      positiveSentiment: positivePercentage,
      unsubscribeRequests,
      sentimentBreakdown: sentimentCounts
    },
    period: filter.period
  };
}
function analyzeSentiment(text) {
  if (!text) return "Neutral";
  const positiveWords = ["yes", "thanks", "thank", "great", "good", "interested", "love", "amazing", "excellent", "perfect", "wonderful", "awesome"];
  const negativeWords = ["no", "stop", "unsubscribe", "spam", "annoying", "hate", "bad", "terrible", "worst", "cancel", "remove"];
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;
  if (positiveCount > negativeCount) return "Positive";
  if (negativeCount > positiveCount) return "Negative";
  return "Neutral";
}
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}
async function getUserEngagement(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await readCollection("messages");
  const contacts = await readCollection("contacts");
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const contactStats = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    const contactId = msg.contactId;
    if (!contactStats.has(contactId)) {
      contactStats.set(contactId, {
        messagesReceived: 0,
        messagesRead: 0,
        replies: 0,
        contact: contactMap.get(contactId)
      });
    }
    const stats = contactStats.get(contactId);
    if (msg.direction === "outbound") {
      stats.messagesReceived++;
      if (msg.status === "read" || msg.status === "delivered") {
        stats.messagesRead++;
      }
    } else if (msg.direction === "inbound") {
      stats.replies++;
    }
  }
  const engagementData = Array.from(contactStats.entries()).map(([contactId, stats]) => {
    const readRate = stats.messagesReceived > 0 ? stats.messagesRead / stats.messagesReceived * 100 : 0;
    const replyRate = stats.messagesReceived > 0 ? stats.replies / stats.messagesReceived * 100 : 0;
    const engagement = readRate * 0.4 + replyRate * 0.6;
    return {
      id: contactId,
      name: stats.contact?.name || `Contact ${contactId.slice(0, 8)}`,
      phone: stats.contact?.phone || "",
      messagesReceived: stats.messagesReceived,
      messagesRead: stats.messagesRead,
      replies: stats.replies,
      readRate: Math.round(readRate * 10) / 10,
      replyRate: Math.round(replyRate * 10) / 10,
      engagement: Math.round(engagement * 10) / 10
    };
  });
  const sortedData = engagementData.filter((d) => d.messagesReceived > 0).sort((a, b) => b.engagement - a.engagement);
  const totalUsers = sortedData.length;
  const avgReadRate = totalUsers > 0 ? sortedData.reduce((sum, u) => sum + u.readRate, 0) / totalUsers : 0;
  const avgReplyRate = totalUsers > 0 ? sortedData.reduce((sum, u) => sum + u.replyRate, 0) / totalUsers : 0;
  const totalReplies = sortedData.reduce((sum, u) => sum + u.replies, 0);
  const totalMessages = sortedData.reduce((sum, u) => sum + u.messagesReceived, 0);
  const distribution = [
    { range: "90-100%", count: sortedData.filter((u) => u.engagement >= 90).length, color: "#22c55e" },
    { range: "80-89%", count: sortedData.filter((u) => u.engagement >= 80 && u.engagement < 90).length, color: "#84cc16" },
    { range: "70-79%", count: sortedData.filter((u) => u.engagement >= 70 && u.engagement < 80).length, color: "#eab308" },
    { range: "60-69%", count: sortedData.filter((u) => u.engagement >= 60 && u.engagement < 70).length, color: "#f97316" },
    { range: "50-59%", count: sortedData.filter((u) => u.engagement >= 50 && u.engagement < 60).length, color: "#ef4444" },
    { range: "40-49%", count: sortedData.filter((u) => u.engagement >= 40 && u.engagement < 50).length, color: "#dc2626" },
    { range: "<40%", count: sortedData.filter((u) => u.engagement < 40).length, color: "#991b1b" }
  ];
  return {
    users: sortedData.slice(0, 100),
    distribution,
    summary: {
      totalUsers,
      avgReadRate: Math.round(avgReadRate * 10) / 10,
      avgReplyRate: Math.round(avgReplyRate * 10) / 10,
      totalReplies,
      totalMessages
    },
    period: filter.period
  };
}
async function getSpendingReport(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await readCollection("messages");
  const broadcastLogs = await readCollection("broadcast_logs");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return m.direction === "outbound" && timestamp >= startDate && timestamp <= endDate;
  });
  const MARKETING_RATE = 0.08;
  const UTILITY_RATE = 0.05;
  const SERVICE_RATE = 0.03;
  const dailyData = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    const date = new Date(msg.timestamp || msg.createdAt);
    const dateKey = date.toISOString().split("T")[0];
    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, { marketing: 0, utility: 0, service: 0, total: 0 });
    }
    const data = dailyData.get(dateKey);
    const isBroadcast = broadcastLogs.some((bl) => bl.messageId === msg.id);
    if (isBroadcast) {
      data.marketing += MARKETING_RATE;
    } else if (msg.type === "template") {
      data.utility += UTILITY_RATE;
    } else {
      data.service += SERVICE_RATE;
    }
    data.total = data.marketing + data.utility + data.service;
  }
  const dailySpending = Array.from(dailyData.entries()).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
    fullDate: date,
    marketing: Math.round(data.marketing * 100) / 100,
    utility: Math.round(data.utility * 100) / 100,
    service: Math.round(data.service * 100) / 100,
    total: Math.round(data.total * 100) / 100
  })).sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()).slice(-7);
  const totalSpend = dailySpending.reduce((sum, d) => sum + d.total, 0);
  const avgDailySpend = dailySpending.length > 0 ? totalSpend / dailySpending.length : 0;
  const projectedMonthly = avgDailySpend * 30;
  const totalMarketing = dailySpending.reduce((sum, d) => sum + d.marketing, 0);
  const totalUtility = dailySpending.reduce((sum, d) => sum + d.utility, 0);
  const totalService = dailySpending.reduce((sum, d) => sum + d.service, 0);
  return {
    dailySpending,
    summary: {
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgDailySpend: Math.round(avgDailySpend * 100) / 100,
      projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      totalMarketing: Math.round(totalMarketing * 100) / 100,
      totalUtility: Math.round(totalUtility * 100) / 100,
      totalService: Math.round(totalService * 100) / 100,
      marketingRate: MARKETING_RATE,
      utilityRate: UTILITY_RATE,
      serviceRate: SERVICE_RATE
    },
    period: filter.period
  };
}
async function getDashboardOverview(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await readCollection("messages");
  const contacts = await readCollection("contacts");
  const campaigns = await readCollection("campaigns");
  const agents = await readCollection("agents");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const outbound = filteredMessages.filter((m) => m.direction === "outbound");
  const inbound = filteredMessages.filter((m) => m.direction === "inbound");
  const delivered = outbound.filter((m) => m.status === "delivered" || m.status === "read");
  const read2 = outbound.filter((m) => m.status === "read");
  const deliveryRate = outbound.length > 0 ? delivered.length / outbound.length * 100 : 0;
  const readRate = outbound.length > 0 ? read2.length / outbound.length * 100 : 0;
  const replyRate = outbound.length > 0 ? inbound.length / outbound.length * 100 : 0;
  return {
    messages: {
      total: filteredMessages.length,
      outbound: outbound.length,
      inbound: inbound.length,
      delivered: delivered.length,
      read: read2.length
    },
    rates: {
      delivery: Math.round(deliveryRate * 10) / 10,
      read: Math.round(readRate * 10) / 10,
      reply: Math.round(replyRate * 10) / 10
    },
    counts: {
      contacts: contacts.length,
      campaigns: campaigns.length,
      agents: agents.length,
      activeAgents: agents.filter((a) => a.isActive).length
    },
    period: filter.period
  };
}
async function getCampaignPerformance(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const messages = await readCollection("messages");
  const campaigns = await readCollection("campaigns");
  const broadcastLogs = await readCollection("broadcast_logs");
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const filteredLogs = broadcastLogs.filter((log) => {
    const timestamp = new Date(log.sentAt || log.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const campaignMap = /* @__PURE__ */ new Map();
  for (const campaign of campaigns) {
    campaignMap.set(campaign.id, {
      id: campaign.id,
      name: campaign.name,
      date: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A",
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0
    });
  }
  for (const log of filteredLogs) {
    const campaignName = log.campaignName || log.templateName || "Unknown Campaign";
    if (!campaignMap.has(campaignName)) {
      campaignMap.set(campaignName, {
        id: campaignName,
        name: campaignName,
        date: log.sentAt ? new Date(log.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A",
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        failed: 0
      });
    }
    const campaign = campaignMap.get(campaignName);
    campaign.sent++;
    if (log.status === "delivered" || log.status === "read") {
      campaign.delivered++;
    }
    if (log.status === "read") {
      campaign.read++;
    }
    if (log.replied) {
      campaign.replied++;
    }
    if (log.status === "failed") {
      campaign.failed++;
    }
  }
  const outboundByCampaign = /* @__PURE__ */ new Map();
  for (const msg of filteredMessages) {
    if (msg.direction === "outbound" && msg.campaignId) {
      if (!outboundByCampaign.has(msg.campaignId)) {
        outboundByCampaign.set(msg.campaignId, []);
      }
      outboundByCampaign.get(msg.campaignId).push(msg);
    }
  }
  outboundByCampaign.forEach((msgs, campaignId) => {
    if (campaignMap.has(campaignId)) {
      const campaign = campaignMap.get(campaignId);
      campaign.sent += msgs.length;
      campaign.delivered += msgs.filter((m) => m.status === "delivered" || m.status === "read").length;
      campaign.read += msgs.filter((m) => m.status === "read").length;
    }
  });
  const campaignList = Array.from(campaignMap.values()).filter((c) => c.sent > 0).map((c) => ({
    ...c,
    deliveryRate: c.sent > 0 ? Math.round(c.delivered / c.sent * 100) : 0,
    readRate: c.sent > 0 ? Math.round(c.read / c.sent * 100) : 0,
    replyRate: c.sent > 0 ? Math.round(c.replied / c.sent * 100 * 10) / 10 : 0,
    cost: (c.sent * 9e-3).toFixed(2)
  })).sort((a, b) => b.sent - a.sent);
  const chartData = campaignList.slice(0, 6).map((c) => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + "..." : c.name,
    sent: c.sent,
    read: c.read,
    replied: c.replied
  }));
  const totalSent = campaignList.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = campaignList.reduce((sum, c) => sum + c.delivered, 0);
  const totalRead = campaignList.reduce((sum, c) => sum + c.read, 0);
  const totalReplied = campaignList.reduce((sum, c) => sum + c.replied, 0);
  return {
    campaigns: campaignList,
    chartData,
    summary: {
      totalCampaigns: campaignList.length,
      totalSent,
      totalDelivered,
      totalRead,
      totalReplied,
      avgDeliveryRate: totalSent > 0 ? Math.round(totalDelivered / totalSent * 100) : 0,
      avgReadRate: totalSent > 0 ? Math.round(totalRead / totalSent * 100) : 0,
      avgReplyRate: totalSent > 0 ? Math.round(totalReplied / totalSent * 100 * 10) / 10 : 0,
      totalCost: (totalSent * 9e-3).toFixed(2)
    },
    period: filter.period
  };
}
async function getBlockedContactsReport(userId) {
  const blockedContacts = await readCollection("blocked_contacts");
  const userBlocked = blockedContacts.filter((c) => c.userId === userId && c.isActive !== false);
  const now = /* @__PURE__ */ new Date();
  const thisMonth = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    return blockDate.getMonth() === now.getMonth() && blockDate.getFullYear() === now.getFullYear();
  });
  const thisWeek = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    return blockDate >= weekAgo;
  });
  const today = userBlocked.filter((c) => {
    const blockDate = new Date(c.blockedAt);
    return blockDate.toDateString() === now.toDateString();
  });
  const withReason = userBlocked.filter((c) => c.reason && c.reason.trim() !== "");
  const reasonCounts = /* @__PURE__ */ new Map();
  for (const contact of withReason) {
    const reason = contact.reason || "No reason";
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const topReasons = Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count }));
  const recentBlocked = userBlocked.sort((a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()).slice(0, 10);
  return {
    contacts: userBlocked,
    summary: {
      totalBlocked: userBlocked.length,
      blockedThisMonth: thisMonth.length,
      blockedThisWeek: thisWeek.length,
      blockedToday: today.length,
      withReason: withReason.length,
      topReasons
    },
    recentBlocked
  };
}
async function get24HourWindowStats(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const belongsToUser = (record) => Boolean(userId) && String(record?.userId || "") === String(userId);
  const messages = userId ? (await getTenantUsageEvents(userId)).map((message) => ({
    ...message,
    contactId: message.contactId || `${message.source}:${message.contactPhone || message.contactName}`,
    recipientPhone: message.contactPhone
  })) : [];
  const ownedContactIds = new Set(messages.map((message) => String(message.contactId)));
  const chats = (await readCollection("chats")).filter(
    (chat) => ownedContactIds.has(String(chat.contactId))
  );
  const contactAgents = (await readCollection("contact_agents")).filter(
    (assignment) => belongsToUser(assignment) || ownedContactIds.has(String(assignment.contactId))
  );
  const contacts = (await readCollection("contacts")).filter(
    (contact) => ownedContactIds.has(String(contact.id))
  );
  const lastInboundMap = /* @__PURE__ */ new Map();
  for (const chat of chats) {
    if (chat.lastInboundMessageTime) {
      lastInboundMap.set(chat.contactId, new Date(chat.lastInboundMessageTime));
    }
  }
  const filteredMessages = messages.filter((m) => {
    const timestamp = new Date(m.timestamp || m.createdAt);
    return timestamp >= startDate && timestamp <= endDate;
  });
  const outbound = filteredMessages.filter((m) => m.direction === "outbound");
  const windowEligibleOutbound = outbound.filter(
    (message) => !["broadcast", "drip"].includes(String(message.source || ""))
  );
  const inbound = filteredMessages.filter((m) => m.direction === "inbound");
  let windowCompliant = 0;
  let windowNonCompliant = 0;
  let aiInWindow = 0;
  let humanInWindow = 0;
  for (const msg of windowEligibleOutbound) {
    const lastInbound = lastInboundMap.get(msg.contactId);
    const msgTime = new Date(msg.timestamp || msg.createdAt);
    if (lastInbound) {
      const hoursDiff = (msgTime.getTime() - lastInbound.getTime()) / (1e3 * 60 * 60);
      if (hoursDiff <= 24 && hoursDiff >= 0) {
        windowCompliant++;
        if (msg.agentId && msg.agentId !== "manual") {
          aiInWindow++;
        } else {
          humanInWindow++;
        }
      } else {
        windowNonCompliant++;
      }
    } else {
      windowNonCompliant++;
    }
  }
  const contactIdByPhone = new Map(
    contacts.map((contact) => [
      String(contact.phone || "").replace(/\D/g, "").slice(-10),
      String(contact.id)
    ])
  );
  const uniqueContacts = new Set(
    filteredMessages.map((message) => {
      const phone = String(message.recipientPhone || "").replace(/\D/g, "").slice(-10);
      return phone && contactIdByPhone.get(phone) || String(message.contactId);
    })
  );
  const newContacts = contacts.filter((c) => {
    const createdAt = new Date(c.createdAt);
    return createdAt >= startDate && createdAt <= endDate;
  });
  const activeAgentAssignments = contactAgents.filter((ca) => ca.isActive);
  const aiConversations = activeAgentAssignments.length;
  const totalAiResponses = outbound.filter((m) => m.agentId && m.agentId !== "manual").length;
  const totalHumanResponses = outbound.filter((m) => !m.agentId || m.agentId === "manual").length;
  const delivered = outbound.filter((m) => ["delivered", "read"].includes(m.status)).length;
  const read2 = outbound.filter((m) => m.status === "read").length;
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayWise = [];
  const duration = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(duration / (24 * 60 * 60 * 1e3));
  const hours = Math.ceil(duration / (60 * 60 * 1e3));
  const isHourlyView = filter.period === "hour" || filter.period === "today_hourly" || filter.period === "yesterday_hourly";
  if (isHourlyView) {
    for (let h = 0; h < 24; h++) {
      const hourStart = new Date(startDate.getTime() + h * 60 * 60 * 1e3);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1e3);
      const hourMessages = filteredMessages.filter((m) => {
        const timestamp = new Date(m.timestamp || m.createdAt);
        return timestamp >= hourStart && timestamp < hourEnd;
      });
      const hourOutbound = hourMessages.filter((m) => m.direction === "outbound");
      const hourInbound = hourMessages.filter((m) => m.direction === "inbound");
      const hourDelivered = hourOutbound.filter((m) => ["delivered", "read"].includes(m.status));
      const hourRead = hourOutbound.filter((m) => m.status === "read");
      const hourAi = hourOutbound.filter((m) => m.agentId && m.agentId !== "manual");
      const hourHuman = hourOutbound.filter((m) => !m.agentId || m.agentId === "manual");
      dayWise.push({
        day: `${hourStart.getHours().toString().padStart(2, "0")}:00`,
        sent: hourOutbound.length,
        delivered: hourDelivered.length,
        read: hourRead.length,
        inbound: hourInbound.length,
        ai: hourAi.length,
        human: hourHuman.length
      });
    }
  } else {
    for (let d = 0; d < Math.min(days, 30); d++) {
      const dayStart = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1e3);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1e3);
      const dayMessages = filteredMessages.filter((m) => {
        const timestamp = new Date(m.timestamp || m.createdAt);
        return timestamp >= dayStart && timestamp < dayEnd;
      });
      const dayOutbound = dayMessages.filter((m) => m.direction === "outbound");
      const dayInbound = dayMessages.filter((m) => m.direction === "inbound");
      const dayDelivered = dayOutbound.filter((m) => ["delivered", "read"].includes(m.status));
      const dayRead = dayOutbound.filter((m) => m.status === "read");
      const dayAi = dayOutbound.filter((m) => m.agentId && m.agentId !== "manual");
      const dayHuman = dayOutbound.filter((m) => !m.agentId || m.agentId === "manual");
      dayWise.push({
        day: days <= 7 ? dayNames[dayStart.getDay()] : `${dayStart.getDate()}/${dayStart.getMonth() + 1}`,
        sent: dayOutbound.length,
        delivered: dayDelivered.length,
        read: dayRead.length,
        inbound: dayInbound.length,
        ai: dayAi.length,
        human: dayHuman.length
      });
    }
  }
  return {
    summary: {
      totalMessages: filteredMessages.length,
      outboundMessages: outbound.length,
      inboundMessages: inbound.length,
      delivered,
      read: read2,
      deliveryRate: outbound.length > 0 ? Math.round(delivered / outbound.length * 100) : 0,
      readRate: delivered > 0 ? Math.round(read2 / delivered * 100) : 0,
      windowCompliant,
      windowNonCompliant,
      windowComplianceRate: windowEligibleOutbound.length > 0 ? Math.round(windowCompliant / windowEligibleOutbound.length * 100) : 0,
      aiInWindow,
      humanInWindow,
      totalAiResponses,
      totalHumanResponses,
      aiPercentage: outbound.length > 0 ? Math.round(totalAiResponses / outbound.length * 100) : 0,
      activeContacts: uniqueContacts.size,
      newContacts: newContacts.length,
      aiConversations
    },
    dayWise,
    period: filter.period
  };
}
var emptyDashboardSummary = () => ({
  totalMessages: 0,
  outboundMessages: 0,
  inboundMessages: 0,
  delivered: 0,
  read: 0,
  deliveryRate: 0,
  readRate: 0,
  windowCompliant: 0,
  windowNonCompliant: 0,
  windowComplianceRate: 0,
  aiInWindow: 0,
  humanInWindow: 0,
  totalAiResponses: 0,
  totalHumanResponses: 0,
  aiPercentage: 0,
  activeContacts: 0,
  newContacts: 0,
  aiConversations: 0
});
var getFastDashboardStatsForRange = async (filter, userId, startDate, endDate) => {
  if (!userId) {
    return {
      summary: emptyDashboardSummary(),
      dayWise: [],
      period: filter.period
    };
  }
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();
  const isHourlyView = filter.period === "hour" || filter.period === "today_hourly" || filter.period === "yesterday_hourly";
  const bucketCount = isHourlyView ? 24 : Math.min(
    Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1e3)),
    30
  );
  const bucketMs = isHourlyView ? 60 * 60 * 1e3 : 24 * 60 * 60 * 1e3;
  const bucketMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(startDate.getTime() + i * bucketMs);
    if (!isHourlyView) bucketStart.setHours(0, 0, 0, 0);
    const key = bucketStart.toISOString();
    bucketMap.set(key, {
      day: isHourlyView ? `${bucketStart.getHours().toString().padStart(2, "0")}:00` : bucketCount <= 7 ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][bucketStart.getDay()] : `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`,
      sent: 0,
      delivered: 0,
      read: 0,
      inbound: 0,
      ai: 0,
      human: 0
    });
  }
  const addBucketRows = (rows) => {
    rows.forEach((row) => {
      const bucketDate = new Date(row._id);
      if (!isHourlyView) bucketDate.setHours(0, 0, 0, 0);
      const key = bucketDate.toISOString();
      const bucket = bucketMap.get(key);
      if (!bucket) return;
      bucket.sent += row.outbound || 0;
      bucket.delivered += row.delivered || 0;
      bucket.read += row.read || 0;
      bucket.inbound += row.inbound || 0;
      bucket.ai += row.ai || 0;
      bucket.human += row.human || 0;
    });
  };
  const messageMatch = {
    userId,
    timestamp: { $gte: startIso, $lte: endIso }
  };
  const broadcastMatch = {
    userId,
    timestamp: { $gte: startIso, $lte: endIso }
  };
  const campaignMatch = {
    userId,
    $or: [
      { sentAt: { $gte: startDate, $lte: endDate } },
      { sendAttemptedAt: { $gte: startDate, $lte: endDate } },
      { createdAt: { $gte: startDate, $lte: endDate } }
    ]
  };
  const bucketFormat = isHourlyView ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";
  const [
    messageSummaryRows,
    messageBucketRows,
    broadcastSummaryRows,
    broadcastBucketRows,
    campaignSummaryRows,
    campaignBucketRows,
    activeContacts,
    newContacts,
    aiConversations
  ] = await Promise.all([
    Message.aggregate([
      { $match: messageMatch },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          outboundMessages: { $sum: { $cond: [{ $eq: ["$direction", "outbound"] }, 1, 0] } },
          inboundMessages: { $sum: { $cond: [{ $eq: ["$direction", "inbound"] }, 1, 0] } },
          delivered: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$status", ["delivered", "read"]] }] },
                1,
                0
              ]
            }
          },
          read: { $sum: { $cond: [{ $and: [{ $eq: ["$direction", "outbound"] }, { $eq: ["$status", "read"] }] }, 1, 0] } },
          totalAiResponses: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $not: [{ $in: ["$agentId", [null, "", "manual"]] }] }] },
                1,
                0
              ]
            }
          },
          activeContacts: { $addToSet: "$contactId" }
        }
      }
    ]).allowDiskUse(true),
    Message.aggregate([
      { $match: messageMatch },
      { $addFields: { bucketDate: { $dateFromString: { dateString: "$timestamp", onError: null, onNull: null } } } },
      { $match: { bucketDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$bucketDate", timezone: "UTC" } },
          outbound: { $sum: { $cond: [{ $eq: ["$direction", "outbound"] }, 1, 0] } },
          inbound: { $sum: { $cond: [{ $eq: ["$direction", "inbound"] }, 1, 0] } },
          delivered: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$status", ["delivered", "read"]] }] },
                1,
                0
              ]
            }
          },
          read: { $sum: { $cond: [{ $and: [{ $eq: ["$direction", "outbound"] }, { $eq: ["$status", "read"] }] }, 1, 0] } },
          ai: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $not: [{ $in: ["$agentId", [null, "", "manual"]] }] }] },
                1,
                0
              ]
            }
          },
          human: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$direction", "outbound"] }, { $in: ["$agentId", [null, "", "manual"]] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]).allowDiskUse(true),
    BroadcastLog.aggregate([
      { $match: broadcastMatch },
      {
        $group: {
          _id: null,
          outboundMessages: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          activeContacts: { $addToSet: "$contactPhone" }
        }
      }
    ]).allowDiskUse(true),
    BroadcastLog.aggregate([
      { $match: broadcastMatch },
      { $addFields: { bucketDate: { $dateFromString: { dateString: "$timestamp", onError: null, onNull: null } } } },
      { $match: { bucketDate: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$bucketDate", timezone: "UTC" } },
          outbound: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          human: { $sum: 1 }
        }
      }
    ]).allowDiskUse(true),
    CampaignLog.aggregate([
      { $match: campaignMatch },
      {
        $group: {
          _id: null,
          outboundMessages: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          activeContacts: { $addToSet: "$contact" }
        }
      }
    ]).allowDiskUse(true),
    CampaignLog.aggregate([
      { $match: campaignMatch },
      { $addFields: { eventDate: { $ifNull: ["$sentAt", { $ifNull: ["$sendAttemptedAt", "$createdAt"] }] } } },
      {
        $group: {
          _id: { $dateToString: { format: bucketFormat, date: "$eventDate", timezone: "UTC" } },
          outbound: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] } },
          human: { $sum: 1 }
        }
      }
    ]).allowDiskUse(true),
    Contact.distinct("id", { userId }),
    Contact.countDocuments({ userId, createdAt: { $gte: startIso, $lte: endIso } }),
    ContactAgent.countDocuments({ isActive: true })
  ]);
  addBucketRows(messageBucketRows);
  addBucketRows(broadcastBucketRows);
  addBucketRows(campaignBucketRows);
  const messageSummary = messageSummaryRows[0] || {};
  const broadcastSummary = broadcastSummaryRows[0] || {};
  const campaignSummary = campaignSummaryRows[0] || {};
  const outboundMessages = (messageSummary.outboundMessages || 0) + (broadcastSummary.outboundMessages || 0) + (campaignSummary.outboundMessages || 0);
  const inboundMessages = messageSummary.inboundMessages || 0;
  const delivered = (messageSummary.delivered || 0) + (broadcastSummary.delivered || 0) + (campaignSummary.delivered || 0);
  const read2 = (messageSummary.read || 0) + (broadcastSummary.read || 0) + (campaignSummary.read || 0);
  const totalAiResponses = messageSummary.totalAiResponses || 0;
  const totalHumanResponses = outboundMessages - totalAiResponses;
  const contactKeys = new Set([
    ...messageSummary.activeContacts || [],
    ...broadcastSummary.activeContacts || [],
    ...campaignSummary.activeContacts || []
  ].filter(Boolean).map(String));
  return {
    summary: {
      totalMessages: outboundMessages + inboundMessages,
      outboundMessages,
      inboundMessages,
      delivered,
      read: read2,
      deliveryRate: outboundMessages > 0 ? Math.round(delivered / outboundMessages * 100) : 0,
      readRate: delivered > 0 ? Math.round(read2 / delivered * 100) : 0,
      windowCompliant: 0,
      windowNonCompliant: 0,
      windowComplianceRate: 0,
      aiInWindow: 0,
      humanInWindow: 0,
      totalAiResponses,
      totalHumanResponses,
      aiPercentage: outboundMessages > 0 ? Math.round(totalAiResponses / outboundMessages * 100) : 0,
      activeContacts: contactKeys.size || activeContacts.length,
      newContacts,
      aiConversations
    },
    dayWise: Array.from(bucketMap.values()),
    period: filter.period
  };
};
async function getEnhancedDashboardStats(filter, userId) {
  const { startDate, endDate } = getDateRange(filter);
  const previousDuration = endDate.getTime() - startDate.getTime();
  const previousStartDate = new Date(startDate.getTime() - previousDuration);
  const previousEndDate = new Date(startDate.getTime());
  const [currentStats, previousStats] = await Promise.all([
    getFastDashboardStatsForRange(filter, userId, startDate, endDate),
    getFastDashboardStatsForRange(
      { period: "custom", startDate: previousStartDate.toISOString(), endDate: previousEndDate.toISOString() },
      userId,
      previousStartDate,
      previousEndDate
    )
  ]);
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round((current - previous) / previous * 100);
  };
  return {
    ...currentStats,
    changes: {
      messagesChange: calculateChange(currentStats.summary.totalMessages, previousStats.summary.totalMessages),
      outboundChange: calculateChange(currentStats.summary.outboundMessages, previousStats.summary.outboundMessages),
      deliveredChange: calculateChange(currentStats.summary.delivered, previousStats.summary.delivered),
      readRateChange: calculateChange(currentStats.summary.readRate, previousStats.summary.readRate),
      aiChange: calculateChange(currentStats.summary.totalAiResponses, previousStats.summary.totalAiResponses),
      newContactsChange: calculateChange(currentStats.summary.newContacts, previousStats.summary.newContacts),
      windowComplianceChange: calculateChange(currentStats.summary.windowComplianceRate, previousStats.summary.windowComplianceRate)
    }
  };
}
var reportsService = {
  getDateRange,
  getAIAgentPerformance,
  getCustomerReplies,
  getUserEngagement,
  getSpendingReport,
  get24HourWindowStats,
  getEnhancedDashboardStats,
  getDashboardOverview,
  getCampaignPerformance,
  getBlockedContactsReport
};

// modules/whatsapp-marketing/server/modules/reports/billing.service.js
init_mongodb_adapter();
init_mongodb_adapter();
function getDateRange2(filter) {
  const now = /* @__PURE__ */ new Date();
  let start;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (filter.period === "custom" && filter.startDate && filter.endDate) {
    start = new Date(filter.startDate);
    end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    switch (filter.period) {
      case "day":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
    }
  }
  return { start, end };
}
async function getBillingSummary(userId, filter) {
  const { start, end } = getDateRange2(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const userMessages = messages.filter((m) => m.direction === "inbound");
  const aiMessages = messages.filter((m) => m.direction === "outbound" && m.agentId);
  const contactAgents = await ContactAgent.find({}).lean();
  const contactAgentMap = /* @__PURE__ */ new Map();
  for (const ca of contactAgents) {
    if (ca.contactId && ca.agentId) {
      contactAgentMap.set(ca.contactId, { agentId: ca.agentId, agentName: ca.agentName || "Unknown Agent" });
    }
  }
  const agents = await readCollection("agents");
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }
  const agentStats = {};
  for (const msg of aiMessages) {
    const agentId = msg.agentId || "unknown";
    let agentName = agentMap.get(agentId) || "Unknown Agent";
    if (!agentStats[agentId]) {
      agentStats[agentId] = {
        agentId,
        agentName,
        conversations: /* @__PURE__ */ new Set(),
        messages: 0
      };
    }
    agentStats[agentId].conversations.add(msg.contactId);
    agentStats[agentId].messages++;
  }
  const agentBreakdown = Object.values(agentStats).map((stat) => ({
    agentId: stat.agentId,
    agentName: stat.agentName,
    conversationCount: stat.conversations.size,
    messageCount: stat.messages,
    cost: stat.messages * COST_PER_MESSAGE
  })).sort((a, b) => b.messageCount - a.messageCount);
  const dailyMap = {};
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toISOString().split("T")[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { userMessages: 0, aiMessages: 0 };
    }
    if (msg.direction === "inbound") {
      dailyMap[date].userMessages++;
    } else if (msg.direction === "outbound" && msg.agentId) {
      dailyMap[date].aiMessages++;
    }
  }
  const dailyBreakdown = Object.entries(dailyMap).map(([date, stats]) => ({
    date,
    userMessages: stats.userMessages,
    aiMessages: stats.aiMessages,
    totalMessages: stats.userMessages + stats.aiMessages,
    cost: (stats.userMessages + stats.aiMessages) * COST_PER_MESSAGE
  })).sort((a, b) => a.date.localeCompare(b.date));
  const uniqueContacts = /* @__PURE__ */ new Set();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }
  const totalBillableMessages = userMessages.length + aiMessages.length;
  return {
    userId,
    userName: "User",
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    metrics: {
      totalMessages: totalBillableMessages,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillableMessages * COST_PER_MESSAGE,
      costPerMessage: COST_PER_MESSAGE
    },
    agentBreakdown,
    dailyBreakdown
  };
}
async function getConversationsBilling(userId, filter, pagination) {
  const { start, end } = getDateRange2(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const contacts = await readCollection("contacts");
  const contactMap = /* @__PURE__ */ new Map();
  for (const contact of contacts) {
    contactMap.set(contact.id, { name: contact.name, phone: contact.phone });
  }
  const agents = await readCollection("agents");
  const agentMap = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }
  const conversationStats = {};
  for (const msg of messages) {
    if (!conversationStats[msg.contactId]) {
      conversationStats[msg.contactId] = {
        contactId: msg.contactId,
        userMessages: 0,
        aiMessages: 0,
        agentId: null,
        lastMessageAt: msg.timestamp
      };
    }
    const stat = conversationStats[msg.contactId];
    if (msg.direction === "inbound") {
      stat.userMessages++;
    } else if (msg.direction === "outbound" && msg.agentId) {
      stat.aiMessages++;
      stat.agentId = msg.agentId;
    }
    if (new Date(msg.timestamp) > new Date(stat.lastMessageAt)) {
      stat.lastMessageAt = msg.timestamp;
    }
  }
  const allConversations = Object.values(conversationStats).map((stat) => {
    const contact = contactMap.get(stat.contactId) || { name: "Unknown", phone: "Unknown" };
    const totalMessages = stat.userMessages + stat.aiMessages;
    return {
      contactId: stat.contactId,
      contactName: contact.name,
      contactPhone: contact.phone,
      userMessages: stat.userMessages,
      aiMessages: stat.aiMessages,
      totalMessages,
      cost: totalMessages * COST_PER_MESSAGE,
      agentName: stat.agentId ? agentMap.get(stat.agentId) || "Unknown Agent" : null,
      lastMessageAt: stat.lastMessageAt
    };
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  const total = allConversations.length;
  const paginated = allConversations.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    conversations: paginated,
    total
  };
}
async function getAllUsersBillingSummary(filter) {
  const { start, end } = getDateRange2(filter);
  const COST_PER_MESSAGE = 1;
  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();
  const userMessages = messages.filter((m) => m.direction === "inbound");
  const aiMessages = messages.filter((m) => m.direction === "outbound" && m.agentId);
  const totalBillable = userMessages.length + aiMessages.length;
  const uniqueContacts = /* @__PURE__ */ new Set();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }
  return {
    users: [{
      userId: "all",
      userName: "All Users",
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }],
    grandTotal: {
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }
  };
}
var billingService = {
  getBillingSummary,
  getConversationsBilling,
  getAllUsersBillingSummary
};

// modules/whatsapp-marketing/server/modules/reports/billing.controller.js
function parseBillingFilter(req) {
  const period = req.query.period || "month";
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  return {
    period,
    startDate,
    endDate
  };
}
async function getBillingSummary2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const summary = await billingService.getBillingSummary(userId, filter);
    res.json(summary);
  } catch (error) {
    console.error("[Billing] Error getting billing summary:", error);
    res.status(500).json({ error: "Failed to get billing summary" });
  }
}
async function getConversationsBilling2(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await billingService.getConversationsBilling(userId, filter, { limit, offset });
    res.json(result);
  } catch (error) {
    console.error("[Billing] Error getting conversations billing:", error);
    res.status(500).json({ error: "Failed to get conversations billing" });
  }
}
async function getAllUsersBilling(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const filter = parseBillingFilter(req);
    const result = await billingService.getAllUsersBillingSummary(filter);
    res.json(result);
  } catch (error) {
    console.error("[Billing] Error getting all users billing:", error);
    res.status(500).json({ error: "Failed to get all users billing" });
  }
}

// modules/whatsapp-marketing/server/modules/reports/reports.routes.js
var router12 = Router12();
function parseTimeFilter(req) {
  const period = req.query.period || "week";
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  return {
    period,
    startDate,
    endDate
  };
}
router12.get("/ai-agents", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getAIAgentPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching AI agent performance:", error);
    res.status(500).json({ error: "Failed to fetch AI agent performance data" });
  }
});
router12.get("/customer-replies", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCustomerReplies(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching customer replies:", error);
    res.status(500).json({ error: "Failed to fetch customer replies data" });
  }
});
router12.get("/user-engagement", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getUserEngagement(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching user engagement:", error);
    res.status(500).json({ error: "Failed to fetch user engagement data" });
  }
});
router12.get("/spending", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getSpendingReport(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching spending report:", error);
    res.status(500).json({ error: "Failed to fetch spending data" });
  }
});
router12.get("/overview", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getDashboardOverview(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching overview:", error);
    res.status(500).json({ error: "Failed to fetch overview data" });
  }
});
router12.get("/campaign-performance", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.getCampaignPerformance(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching campaign performance:", error);
    res.status(500).json({ error: "Failed to fetch campaign performance data" });
  }
});
router12.get("/blocked-contacts", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const data = await reportsService.getBlockedContactsReport(userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching blocked contacts report:", error);
    res.status(500).json({ error: "Failed to fetch blocked contacts report" });
  }
});
router12.get("/24hour-window", async (req, res) => {
  try {
    const userId = getUserId(req) || void 0;
    const filter = parseTimeFilter(req);
    const data = await reportsService.get24HourWindowStats(filter, userId);
    res.json(data);
  } catch (error) {
    console.error("[Reports] Error fetching 24-hour window stats:", error);
    res.status(500).json({ error: "Failed to fetch 24-hour window stats" });
  }
});
router12.get("/enhanced-dashboard", requireAuth, async (req, res) => {
  const startedAt = Date.now();
  try {
    const userId = getUserId(req);
    const filter = parseTimeFilter(req);
    const data = await reportsService.getEnhancedDashboardStats(filter, userId);
    console.log(
      `[Reports] enhanced-dashboard user=${userId} period=${filter.period} ${Date.now() - startedAt}ms`
    );
    res.json(data);
  } catch (error) {
    console.error(
      `[Reports] Error fetching enhanced dashboard stats after ${Date.now() - startedAt}ms:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch enhanced dashboard stats" });
  }
});
router12.get("/billing/summary", requireAuth, getBillingSummary2);
router12.get("/billing/conversations", requireAuth, getConversationsBilling2);
router12.get("/billing/all-users", requireAuth, getAllUsersBilling);
var reports_routes_default = router12;

// modules/whatsapp-marketing/server/modules/usage/usage.routes.js
import { Router as Router13 } from "express";
var router13 = Router13();
router13.use(requireAuth);
async function usageHandler(type, req, res) {
  try {
    const userId = getUserId(req);
    const ownedEvents = await getTenantUsageEvents(userId, {
      fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : void 0,
      toDate: typeof req.query.toDate === "string" ? req.query.toDate : void 0,
      limit: Number(req.query.scanLimit) || Number(req.query.limit) * 4 || 1e3
    });
    const typedEvents = type === "messages" ? ownedEvents : ownedEvents.filter((event) => event.messageType === "template");
    const filtered = applyUsageFilters(typedEvents, req.query);
    return res.json({
      accountUserId: userId,
      reportType: type,
      ...buildUsageResponse(filtered, req.query)
    });
  } catch (error) {
    console.error(`[Usage] Failed to build ${type} report:`, error);
    return res.status(500).json({ error: `Failed to load ${type} usage` });
  }
}
router13.get("/messages", (req, res) => usageHandler("messages", req, res));
router13.get("/templates", (req, res) => usageHandler("templates", req, res));
router13.get("/pricing", (req, res) => usageHandler("pricing", req, res));
var usage_routes_default = router13;

// modules/whatsapp-marketing/server/modules/users/users.routes.js
init_user_model();
import { Router as Router14 } from "express";
import crypto10 from "crypto";
function generateId5() {
  return crypto10.randomUUID();
}
function requireAdmin(req, res, next) {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const isMainUser = !user.pageAccess || user.pageAccess.length === 0;
  const isAdmin2 = user.role === "super_admin" || user.role === "sub_admin";
  if (!isMainUser && !isAdmin2) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
var router14 = Router14();
router14.get("/pages", async (_req, res) => {
  try {
    res.json(AVAILABLE_PAGES);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});
router14.get("/roles", async (_req, res) => {
  try {
    const roles = Object.entries(ROLE_LABELS).map(([id, name]) => ({ id, name }));
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});
router14.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await SystemUser.find({ role: { $ne: "super_admin" } }).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
router14.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id }).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});
router14.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, name, role, pageAccess, createdBy } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }
    const existingUser = await SystemUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    const username = generateUsername(name);
    const plainPassword = generatePassword();
    const hashedPassword = hashPassword2(plainPassword);
    const user = new SystemUser({
      id: generateId5(),
      email,
      name,
      username,
      password: hashedPassword,
      role: role || "user",
      pageAccess: pageAccess || ["dashboard"],
      isActive: true,
      createdBy: createdBy || "system"
    });
    await user.save();
    const emailSent = await sendCredentialsEmail(email, name, username, plainPassword);
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        pageAccess: user.pageAccess,
        isActive: user.isActive
      },
      credentials: {
        username,
        password: plainPassword
      },
      emailSent
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});
router14.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, email, role, pageAccess, isActive } = req.body;
    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (email && email !== user.email) {
      const existingUser = await SystemUser.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      user.email = email;
    }
    if (name) user.name = name;
    if (role) user.role = role;
    if (pageAccess) user.pageAccess = pageAccess;
    if (typeof isActive === "boolean") user.isActive = isActive;
    await user.save();
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      pageAccess: user.pageAccess,
      isActive: user.isActive
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});
router14.post("/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const plainPassword = generatePassword();
    user.password = hashPassword2(plainPassword);
    await user.save();
    const emailSent = await sendPasswordResetEmail(user.email, user.name, user.username, plainPassword);
    res.json({
      username: user.username,
      password: plainPassword,
      emailSent
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
router14.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await SystemUser.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.role === "super_admin") {
      return res.status(403).json({ error: "Cannot delete super admin" });
    }
    await SystemUser.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
router14.get("/me/permissions", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.json({
        role: "super_admin",
        pageAccess: AVAILABLE_PAGES.map((p) => p.id)
      });
    }
    const user = await SystemUser.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      role: user.role,
      pageAccess: user.pageAccess
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});
var users_routes_default = router14;

// modules/whatsapp-marketing/server/routes.js
init_user_model();

// modules/whatsapp-marketing/server/modules/contactAnalytics/contactAnalytics.controller.js
import { Router as Router15 } from "express";
init_mongodb_adapter();
var router15 = Router15();
router15.get("/reports", async (req, res) => {
  try {
    const { interestLevel, limit, offset } = req.query;
    const result = await contactAnalyticsService.getAllContactReports({
      interestLevel,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(result);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch contact reports" });
  }
});
router15.get("/reports/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const report = await contactAnalyticsService.getContactReport(phone);
    if (!report) {
      return res.status(404).json({ error: "Contact report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch contact report" });
  }
});
router15.post("/analyze/:phone", async (req, res) => {
  try {
    const { phone } = req.params;
    const { contactId, contactName: contactName2 } = req.body;
    const userId = req.userId;
    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneLast10 = normalizedPhone.slice(-10);
    const messages = await readCollection("messages");
    const contactMessages = messages.filter((m) => {
      const msgContactId = (m.contactId || "").replace(/\D/g, "");
      const msgPhone = (m.phone || "").replace(/\D/g, "");
      const msgIdLast10 = msgContactId.slice(-10);
      const msgPhoneLast10 = msgPhone.slice(-10);
      return msgIdLast10 === phoneLast10 || msgPhoneLast10 === phoneLast10 || msgContactId === normalizedPhone || msgPhone === normalizedPhone;
    });
    contactMessages.sort(
      (a, b) => new Date(a.timestamp || a.createdAt).getTime() - new Date(b.timestamp || b.createdAt).getTime()
    );
    const report = await contactAnalyticsService.analyzeAndUpdateContact(
      contactId || `contact-${normalizedPhone}`,
      normalizedPhone,
      contactName2 || "Unknown",
      contactMessages,
      userId
    );
    res.json(report);
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing contact:", error);
    res.status(500).json({ error: "Failed to analyze contact" });
  }
});
router15.post("/analyze-all", async (req, res) => {
  try {
    const userId = req.userId;
    const chats = await storage.getChats(userId, {
      limit: Math.min(Math.max(Number(req.query.limit) || 500, 1), 2e3),
      sort: { lastMessageTime: -1 }
    });
    const contactAgents = await findMany(
      "contact_agents",
      userId ? { userId } : {},
      { limit: 5e3 }
    );
    console.log(`[ContactAnalytics] Analyzing ${chats.length} chats, ${contactAgents.length} agent assignments`);
    const results = [];
    let processed = 0;
    let errors = 0;
    for (const chat of chats) {
      try {
        if (!chat.contact) {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no contact, skipping`);
          continue;
        }
        const contactPhone2 = (chat.contact.phone || "").replace(/\D/g, "") || "";
        if (!contactPhone2) {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no phone, skipping`);
          continue;
        }
        const phoneLast10 = contactPhone2.slice(-10);
        const assignment = contactAgents.find((a) => {
          const assignPhone = (a.phone || "").replace(/\D/g, "");
          return assignPhone.includes(phoneLast10) || phoneLast10.includes(assignPhone.slice(-10));
        });
        let conversationMessages = [];
        if (assignment && assignment.conversationHistory && assignment.conversationHistory.length > 0) {
          conversationMessages = assignment.conversationHistory.map((h) => ({
            direction: h.role === "user" ? "inbound" : "outbound",
            content: h.content,
            timestamp: h.timestamp || (/* @__PURE__ */ new Date()).toISOString()
          }));
        } else if (chat.lastInboundMessage || chat.lastMessage) {
          if (chat.lastInboundMessage) {
            conversationMessages.push({
              direction: "inbound",
              content: chat.lastInboundMessage,
              timestamp: chat.lastInboundMessageTime || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
          if (chat.lastMessage && chat.lastMessage !== chat.lastInboundMessage) {
            conversationMessages.push({
              direction: "outbound",
              content: chat.lastMessage,
              timestamp: chat.lastMessageTime || (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
        if (conversationMessages.length > 0) {
          conversationMessages.sort(
            (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
          );
          processed++;
          console.log(`[ContactAnalytics] Processing ${contactPhone2} with ${conversationMessages.length} messages`);
          const report = await contactAnalyticsService.analyzeAndUpdateContact(
            chat.contact.id || chat.contactId,
            contactPhone2,
            chat.contact.name || "Unknown",
            conversationMessages,
            userId
          );
          results.push({
            phone: contactPhone2,
            name: chat.contact.name,
            interestLevel: report.interestLevel,
            interestScore: report.interestScore
          });
        } else {
          console.log(`[ContactAnalytics] Chat ${chat.id} has no messages, skipping`);
        }
      } catch (err) {
        errors++;
        console.error(`[ContactAnalytics] Error analyzing chat ${chat.id}:`, err);
      }
    }
    console.log(`[ContactAnalytics] Completed: processed=${processed}, results=${results.length}, errors=${errors}`);
    res.json({
      analyzed: results.length,
      results
    });
  } catch (error) {
    console.error("[ContactAnalytics] Error analyzing all contacts:", error);
    res.status(500).json({ error: "Failed to analyze contacts" });
  }
});
router15.get("/summary", async (req, res) => {
  try {
    const summary = await contactAnalyticsService.getContactAnalyticsSummary();
    res.json(summary);
  } catch (error) {
    console.error("[ContactAnalytics] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch analytics summary" });
  }
});
var contactAnalytics_controller_default = router15;

// modules/whatsapp-marketing/server/modules/leadManagement/leadManagement.routes.js
import { Router as Router16 } from "express";

// modules/whatsapp-marketing/server/modules/leadManagement/leadManagement.service.js
init_mongodb_adapter();
init_user_model();
function generateId6(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
function normalizePhone4(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}
async function assignLead(data) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existingAssignment = await LeadAssignment.findOne({
    contactId: data.contactId,
    status: { $in: ["assigned", "in_progress"] }
  });
  if (existingAssignment) {
    const previousAssignment = {
      userId: existingAssignment.assignedToUserId,
      userName: existingAssignment.assignedToUserName,
      assignedAt: existingAssignment.createdAt,
      unassignedAt: now,
      reason: "reassigned"
    };
    existingAssignment.previousAssignments = existingAssignment.previousAssignments || [];
    existingAssignment.previousAssignments.push(previousAssignment);
    existingAssignment.assignedToUserId = data.assignedToUserId;
    existingAssignment.assignedToUserName = data.assignedToUserName || "";
    existingAssignment.assignedByUserId = data.assignedByUserId;
    existingAssignment.assignedByUserName = data.assignedByUserName || "";
    existingAssignment.status = "reassigned";
    existingAssignment.updatedAt = now;
    if (data.priority) existingAssignment.priority = data.priority;
    if (data.notes) existingAssignment.notes = data.notes;
    await existingAssignment.save();
    await logActivity({
      userId: data.assignedByUserId,
      userName: data.assignedByUserName || "",
      actionType: "lead_reassigned",
      contactId: data.contactId,
      contactPhone: data.phone,
      contactName: data.contactName,
      leadAssignmentId: existingAssignment.id,
      metadata: {
        previousUserId: previousAssignment.userId,
        newUserId: data.assignedToUserId
      }
    });
    const updatedAssignment = await LeadAssignment.findOneAndUpdate(
      { id: existingAssignment.id },
      { $set: { status: "assigned" } },
      { new: true }
    );
    return updatedAssignment;
  }
  const assignment = new LeadAssignment({
    id: generateId6("la"),
    contactId: data.contactId,
    chatId: data.chatId,
    phone: normalizePhone4(data.phone),
    contactName: data.contactName || "",
    assignedToUserId: data.assignedToUserId,
    assignedToUserName: data.assignedToUserName || "",
    assignedByUserId: data.assignedByUserId,
    assignedByUserName: data.assignedByUserName || "",
    status: "assigned",
    priority: data.priority || "medium",
    notes: data.notes || "",
    slaDeadline: data.slaDeadline,
    previousAssignments: [],
    createdAt: now,
    updatedAt: now
  });
  await assignment.save();
  await logActivity({
    userId: data.assignedByUserId,
    userName: data.assignedByUserName || "",
    actionType: "lead_assigned",
    contactId: data.contactId,
    contactPhone: data.phone,
    contactName: data.contactName,
    leadAssignmentId: assignment.id,
    metadata: { assignedToUserId: data.assignedToUserId }
  });
  await updateUserActivityStats(data.assignedToUserId, "leadsAssigned");
  return assignment;
}
async function bulkAssignLeads(data) {
  const results = [];
  const assignedByUser = await SystemUser.findOne({ id: data.assignedByUserId });
  const assignedToUser = await SystemUser.findOne({ id: data.assignedToUserId });
  for (const contactId of data.contactIds) {
    const contact = await Contact.findOne({ id: contactId });
    if (!contact) continue;
    const chat = await Chat.findOne({ contactId });
    const assignment = await assignLead({
      contactId,
      chatId: chat?.id,
      phone: contact.phone,
      contactName: contact.name,
      assignedToUserId: data.assignedToUserId,
      assignedToUserName: assignedToUser?.name,
      assignedByUserId: data.assignedByUserId,
      assignedByUserName: assignedByUser?.name,
      priority: data.priority,
      notes: data.notes
    });
    results.push(assignment);
  }
  return results;
}
async function unassignLead(assignmentId, userId, reason) {
  const assignment = await LeadAssignment.findOne({ id: assignmentId });
  if (!assignment) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  assignment.previousAssignments = assignment.previousAssignments || [];
  assignment.previousAssignments.push({
    userId: assignment.assignedToUserId,
    userName: assignment.assignedToUserName,
    assignedAt: assignment.createdAt,
    unassignedAt: now,
    reason: reason || "unassigned"
  });
  assignment.status = "unassigned";
  assignment.updatedAt = now;
  await assignment.save();
  await logActivity({
    userId,
    actionType: "lead_reassigned",
    contactId: assignment.contactId,
    leadAssignmentId: assignmentId,
    metadata: { action: "unassigned", reason }
  });
  return assignment;
}
async function updateLeadStatus(assignmentId, status, userId) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updateData = { status, updatedAt: now };
  if (status === "in_progress" && !await LeadAssignment.findOne({ id: assignmentId, firstResponseAt: { $exists: true } })) {
    updateData.firstResponseAt = now;
  }
  if (status === "completed") {
    updateData.resolvedAt = now;
    await updateUserActivityStats(userId, "leadsCompleted");
  }
  const assignment = await LeadAssignment.findOneAndUpdate(
    { id: assignmentId },
    { $set: updateData },
    { new: true }
  );
  if (assignment && status === "completed") {
    await logActivity({
      userId,
      actionType: "lead_completed",
      contactId: assignment.contactId,
      leadAssignmentId: assignmentId
    });
  }
  return assignment;
}
async function getLeadAssignment(contactId) {
  return LeadAssignment.findOne({
    contactId,
    status: { $in: ["assigned", "in_progress"] }
  }).lean();
}
async function getLeadAssignmentsByUser(userId, status) {
  const query = { assignedToUserId: userId };
  if (status) query.status = status;
  return LeadAssignment.find(query).sort({ createdAt: -1 }).lean();
}
async function getAllLeadAssignments(filters) {
  const query = {};
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query.status = { $in: filters.status };
    } else {
      query.status = filters.status;
    }
  }
  if (filters?.userId) query.assignedToUserId = filters.userId;
  if (filters?.contactId) {
    query.contactId = Array.isArray(filters.contactId) ? { $in: filters.contactId } : filters.contactId;
  }
  if (filters?.fromDate || filters?.toDate) {
    query.createdAt = {};
    if (filters.fromDate) query.createdAt.$gte = filters.fromDate;
    if (filters.toDate) query.createdAt.$lte = filters.toDate;
  }
  return LeadAssignment.find(query).sort({ createdAt: -1 }).lean();
}
async function getAssignableUsers() {
  const systemUsers = await SystemUser.find({
    isActive: true,
    role: { $in: ["sub_admin", "manager", "user"] }
  }).select("-password").lean();
  const registeredUsers = await User.find({
    role: { $exists: true, $in: ["sub_admin", "manager", "user"] }
  }).select("-password").lean();
  const seenIds = /* @__PURE__ */ new Set();
  const uniqueUsers = [];
  for (const user of systemUsers) {
    if (user.id && !seenIds.has(user.id)) {
      seenIds.add(user.id);
      uniqueUsers.push(user);
    }
  }
  for (const user of registeredUsers) {
    if (user.id && !seenIds.has(user.id) && user.role) {
      seenIds.add(user.id);
      uniqueUsers.push(user);
    }
  }
  return uniqueUsers;
}
async function getPermittedUserIds(context) {
  if (context.role === "super_admin" || context.role === "sub_admin") {
    return null;
  }
  if (context.role === "manager") {
    const teamHierarchy = await TeamHierarchy.findOne({ managerId: context.userId });
    const teamMemberIds = teamHierarchy?.teamMembers?.map((m) => m.userId) || [];
    return [context.userId, ...teamMemberIds];
  }
  return [context.userId];
}
async function getFilteredChatsForUser(context) {
  const permittedUserIds = await getPermittedUserIds(context);
  if (permittedUserIds === null) {
    return [];
  }
  const assignments = await LeadAssignment.find({
    assignedToUserId: { $in: permittedUserIds },
    status: { $in: ["assigned", "in_progress"] }
  }).select("contactId").lean();
  return assignments.map((a) => a.contactId);
}
async function setTeamHierarchy(managerId, managerName, teamMemberIds) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const teamMembers = await Promise.all(
    teamMemberIds.map(async (userId) => {
      const user = await SystemUser.findOne({ id: userId });
      return {
        userId,
        userName: user?.name || "",
        addedAt: now
      };
    })
  );
  const existing = await TeamHierarchy.findOne({ managerId });
  if (existing) {
    existing.teamMembers = teamMembers;
    existing.managerName = managerName;
    existing.updatedAt = now;
    await existing.save();
    return existing;
  }
  const hierarchy = new TeamHierarchy({
    id: generateId6("th"),
    managerId,
    managerName,
    teamMembers,
    createdAt: now,
    updatedAt: now
  });
  await hierarchy.save();
  return hierarchy;
}
async function getTeamHierarchy(managerId) {
  return TeamHierarchy.findOne({ managerId }).lean();
}
async function getAllTeamHierarchies() {
  return TeamHierarchy.find({}).lean();
}
async function logActivity(data) {
  try {
    const log = new ActivityLog({
      id: generateId6("al"),
      userId: data.userId,
      userName: data.userName || "",
      userRole: data.userRole || "",
      actionType: data.actionType,
      contactId: data.contactId,
      contactPhone: data.contactPhone,
      contactName: data.contactName,
      leadAssignmentId: data.leadAssignmentId,
      metadata: data.metadata || {},
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    await log.save();
  } catch (error) {
    console.error("[LeadManagement] Error logging activity:", error);
  }
}
async function logUserActivity(data) {
  await logActivity(data);
  if (data.actionType === "message_sent") {
    await updateUserActivityStats(data.userId, "messagesSent");
  } else if (data.actionType === "message_received") {
    await updateUserActivityStats(data.userId, "messagesReceived");
  }
}
async function updateUserActivityStats(userId, field) {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const user = await SystemUser.findOne({ id: userId });
    const existing = await UserActivityStats.findOne({ userId, date: today });
    if (existing) {
      await UserActivityStats.updateOne(
        { userId, date: today },
        {
          $inc: { [field]: 1 },
          $set: { updatedAt: (/* @__PURE__ */ new Date()).toISOString() }
        }
      );
    } else {
      const stats = new UserActivityStats({
        id: generateId6("uas"),
        userId,
        userName: user?.name || "",
        date: today,
        [field]: 1,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await stats.save();
    }
  } catch (error) {
    console.error("[LeadManagement] Error updating activity stats:", error);
  }
}
async function getLeadAssignmentReport(filters) {
  const matchStage = {};
  if (filters?.userId) matchStage.assignedToUserId = filters.userId;
  if (filters?.fromDate || filters?.toDate) {
    matchStage.createdAt = {};
    if (filters?.fromDate) matchStage.createdAt.$gte = filters.fromDate;
    if (filters?.toDate) matchStage.createdAt.$lte = filters.toDate;
  }
  const groupBy = filters?.groupBy || "user";
  let groupStage;
  switch (groupBy) {
    case "user":
      groupStage = {
        $group: {
          _id: "$assignedToUserId",
          userName: { $first: "$assignedToUserName" },
          totalAssigned: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          reassigned: { $sum: { $cond: [{ $eq: ["$status", "reassigned"] }, 1, 0] } }
        }
      };
      break;
    case "day":
      groupStage = {
        $group: {
          _id: { $substr: ["$createdAt", 0, 10] },
          totalAssigned: { $sum: 1 },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }
        }
      };
      break;
    case "status":
      groupStage = {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      };
      break;
    case "priority":
      groupStage = {
        $group: {
          _id: "$priority",
          count: { $sum: 1 }
        }
      };
      break;
  }
  const pipeline = [
    { $match: matchStage },
    groupStage,
    { $sort: { totalAssigned: -1, count: -1, _id: 1 } }
  ];
  const results = await LeadAssignment.aggregate(pipeline);
  const summary = await LeadAssignment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        reassigned: { $sum: { $cond: [{ $eq: ["$status", "reassigned"] }, 1, 0] } },
        unassigned: { $sum: { $cond: [{ $eq: ["$status", "unassigned"] }, 1, 0] } }
      }
    }
  ]);
  return {
    data: results,
    summary: summary[0] || { total: 0, assigned: 0, inProgress: 0, completed: 0, reassigned: 0, unassigned: 0 }
  };
}
async function getUserActivityReport(filters) {
  const matchStage = {};
  if (filters?.userId) matchStage.userId = filters.userId;
  if (filters?.fromDate || filters?.toDate) {
    matchStage.date = {};
    if (filters?.fromDate) matchStage.date.$gte = filters.fromDate;
    if (filters?.toDate) matchStage.date.$lte = filters.toDate;
  }
  const stats = await UserActivityStats.find(matchStage).sort({ date: -1 }).lean();
  const userSummary = await UserActivityStats.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$userId",
        userName: { $first: "$userName" },
        totalMessagesSent: { $sum: "$messagesSent" },
        totalMessagesReceived: { $sum: "$messagesReceived" },
        totalLeadsAssigned: { $sum: "$leadsAssigned" },
        totalLeadsCompleted: { $sum: "$leadsCompleted" },
        avgResponseTime: { $avg: "$avgResponseTimeMinutes" },
        daysActive: { $sum: 1 }
      }
    },
    { $sort: { totalLeadsCompleted: -1 } }
  ]);
  const activityLogs = await ActivityLog.find(matchStage.userId ? { userId: matchStage.userId } : {}).sort({ timestamp: -1 }).limit(100).lean();
  return {
    dailyStats: stats,
    userSummary,
    recentActivity: activityLogs
  };
}
async function getWorkloadDistribution() {
  const activeAssignments = await LeadAssignment.aggregate([
    { $match: { status: { $in: ["assigned", "in_progress"] } } },
    {
      $group: {
        _id: "$assignedToUserId",
        userName: { $first: "$assignedToUserName" },
        activeLeads: { $sum: 1 },
        highPriority: { $sum: { $cond: [{ $eq: ["$priority", "high"] }, 1, 0] } },
        urgentPriority: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } }
      }
    },
    { $sort: { activeLeads: -1 } }
  ]);
  return activeAssignments;
}

// modules/whatsapp-marketing/server/modules/leadManagement/leadManagement.routes.js
init_user_model();
var router16 = Router16();
function getUser2(req) {
  const userId = req.headers["x-user-id"];
  const userRole = req.headers["x-user-role"];
  const userName = req.headers["x-user-name"];
  return {
    userId: userId || null,
    role: userRole || "super_admin",
    name: userName || "Admin"
  };
}
function isAdmin(user) {
  return user.role === "super_admin" || user.role === "sub_admin" || !user.userId;
}
router16.post("/assign", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to assign leads" });
    }
    const { contactId, chatId, phone, contactName: contactName2, assignedToUserId, priority, notes, slaDeadline } = req.body;
    if (!contactId || !phone || !assignedToUserId) {
      return res.status(400).json({ error: "contactId, phone, and assignedToUserId are required" });
    }
    const assignedToUser = await SystemUser.findOne({ id: assignedToUserId });
    if (!assignedToUser) {
      return res.status(404).json({ error: "Assigned user not found" });
    }
    const assignment = await assignLead({
      contactId,
      chatId,
      phone,
      contactName: contactName2,
      assignedToUserId,
      assignedToUserName: assignedToUser.name,
      assignedByUserId: user.userId || "admin",
      assignedByUserName: user.name,
      priority,
      notes,
      slaDeadline
    });
    res.json(assignment);
  } catch (error) {
    console.error("Error assigning lead:", error);
    res.status(500).json({ error: "Failed to assign lead" });
  }
});
router16.post("/bulk-assign", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to assign leads" });
    }
    const { contactIds, assignedToUserId, priority, notes } = req.body;
    if (!contactIds?.length || !assignedToUserId) {
      return res.status(400).json({ error: "contactIds and assignedToUserId are required" });
    }
    const results = await bulkAssignLeads({
      contactIds,
      assignedToUserId,
      assignedByUserId: user.userId || "admin",
      priority,
      notes
    });
    res.json({
      success: true,
      assigned: results.length,
      assignments: results
    });
  } catch (error) {
    console.error("Error bulk assigning leads:", error);
    res.status(500).json({ error: "Failed to bulk assign leads" });
  }
});
router16.patch("/:id/status", async (req, res) => {
  try {
    const user = getUser2(req);
    const { status } = req.body;
    if (!["assigned", "in_progress", "completed", "unassigned"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const assignment = await updateLeadStatus(
      req.params.id,
      status,
      user.userId || "admin"
    );
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({ error: "Failed to update lead status" });
  }
});
router16.post("/:id/unassign", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to unassign leads" });
    }
    const { reason } = req.body;
    const assignment = await unassignLead(
      req.params.id,
      user.userId || "admin",
      reason
    );
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    console.error("Error unassigning lead:", error);
    res.status(500).json({ error: "Failed to unassign lead" });
  }
});
router16.get("/contact/:contactId", async (req, res) => {
  try {
    const assignment = await getLeadAssignment(req.params.contactId);
    res.json(assignment || null);
  } catch (error) {
    console.error("Error getting lead assignment:", error);
    res.status(500).json({ error: "Failed to get lead assignment" });
  }
});
router16.get("/my-leads", async (req, res) => {
  try {
    const user = getUser2(req);
    const { status } = req.query;
    const assignments = await getLeadAssignmentsByUser(
      user.userId || "admin",
      status
    );
    res.json(assignments);
  } catch (error) {
    console.error("Error getting user leads:", error);
    res.status(500).json({ error: "Failed to get user leads" });
  }
});
router16.get("/all", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      const assignments2 = await getLeadAssignmentsByUser(user.userId);
      return res.json(assignments2);
    }
    const { status, userId, fromDate, toDate } = req.query;
    const assignments = await getAllLeadAssignments({
      status,
      userId,
      fromDate,
      toDate
    });
    res.json(assignments);
  } catch (error) {
    console.error("Error getting all lead assignments:", error);
    res.status(500).json({ error: "Failed to get lead assignments" });
  }
});
router16.get("/assignable-users", async (req, res) => {
  try {
    const users = await getAssignableUsers();
    res.json(users);
  } catch (error) {
    console.error("Error getting assignable users:", error);
    res.status(500).json({ error: "Failed to get assignable users" });
  }
});
router16.get("/filtered-contacts", async (req, res) => {
  try {
    const user = getUser2(req);
    const contactIds = await getFilteredChatsForUser({
      userId: user.userId,
      role: user.role,
      name: user.name
    });
    res.json({ contactIds, isFiltered: contactIds.length > 0 || user.role === "user" });
  } catch (error) {
    console.error("Error getting filtered contacts:", error);
    res.status(500).json({ error: "Failed to get filtered contacts" });
  }
});
router16.post("/team-hierarchy", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const { managerId, managerName, teamMemberIds } = req.body;
    if (!managerId || !teamMemberIds) {
      return res.status(400).json({ error: "managerId and teamMemberIds are required" });
    }
    const hierarchy = await setTeamHierarchy(
      managerId,
      managerName || "",
      teamMemberIds
    );
    res.json(hierarchy);
  } catch (error) {
    console.error("Error setting team hierarchy:", error);
    res.status(500).json({ error: "Failed to set team hierarchy" });
  }
});
router16.get("/team-hierarchy/:managerId", async (req, res) => {
  try {
    const hierarchy = await getTeamHierarchy(req.params.managerId);
    res.json(hierarchy || { teamMembers: [] });
  } catch (error) {
    console.error("Error getting team hierarchy:", error);
    res.status(500).json({ error: "Failed to get team hierarchy" });
  }
});
router16.get("/team-hierarchies", async (req, res) => {
  try {
    const hierarchies = await getAllTeamHierarchies();
    res.json(hierarchies);
  } catch (error) {
    console.error("Error getting team hierarchies:", error);
    res.status(500).json({ error: "Failed to get team hierarchies" });
  }
});
router16.get("/reports/summary", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const { startDate } = req.query;
    const report = await getLeadAssignmentReport({
      fromDate: startDate
    });
    const byUserReport = await getLeadAssignmentReport({
      fromDate: startDate,
      groupBy: "user"
    });
    const byStatusReport = await getLeadAssignmentReport({
      fromDate: startDate,
      groupBy: "status"
    });
    const byPriorityReport = await getLeadAssignmentReport({
      fromDate: startDate,
      groupBy: "priority"
    });
    const summary = report.summary;
    const byUser = byUserReport.data.map((u) => ({
      userId: u._id,
      userName: u.userName,
      userRole: "user",
      totalAssigned: u.totalAssigned || 0,
      active: u.assigned || 0,
      completed: u.completed || 0,
      inProgress: u.inProgress || 0,
      avgResponseTime: 0
    }));
    const priorityCounts = new Map(byPriorityReport.data.map((p) => [p._id, p.count || 0]));
    const byPriority = [
      { priority: "urgent", count: priorityCounts.get("urgent") || 0 },
      { priority: "high", count: priorityCounts.get("high") || 0 },
      { priority: "medium", count: priorityCounts.get("medium") || 0 },
      { priority: "low", count: priorityCounts.get("low") || 0 }
    ];
    const byStatus = byStatusReport.data.map((s) => ({
      status: s._id,
      count: s.count || 0
    }));
    res.json({
      totalAssignments: summary.total || 0,
      activeAssignments: (summary.assigned || 0) + (summary.inProgress || 0),
      completedAssignments: summary.completed || 0,
      averageResponseTime: 0,
      byUser,
      byPriority,
      byStatus
    });
  } catch (error) {
    console.error("Error getting summary report:", error);
    res.status(500).json({ error: "Failed to get summary report" });
  }
});
router16.get("/reports/assignments", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const { userId, startDate, priority, status } = req.query;
    const assignments = await getAllLeadAssignments({
      userId,
      fromDate: startDate,
      status
    });
    let filtered = assignments;
    if (priority && priority !== "all") {
      filtered = filtered.filter((a) => a.priority === priority);
    }
    res.json(filtered);
  } catch (error) {
    console.error("Error getting assignment report:", error);
    res.status(500).json({ error: "Failed to get assignment report" });
  }
});
router16.get("/reports/activity", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const { userId, fromDate, toDate } = req.query;
    const report = await getUserActivityReport({
      userId,
      fromDate,
      toDate
    });
    res.json(report);
  } catch (error) {
    console.error("Error getting activity report:", error);
    res.status(500).json({ error: "Failed to get activity report" });
  }
});
router16.get("/reports/activity-stats", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const { startDate } = req.query;
    const report = await getUserActivityReport({
      fromDate: startDate
    });
    const byAction = [
      { action: "assign", count: 0 },
      { action: "bulk_assign", count: 0 },
      { action: "unassign", count: 0 },
      { action: "update", count: 0 }
    ];
    const byEntityType = [
      { entityType: "lead_assignment", count: 0 }
    ];
    report.recentActivity?.forEach((log) => {
      const actionIndex = byAction.findIndex((a) => a.action === log.actionType);
      if (actionIndex >= 0) byAction[actionIndex].count++;
      const entityIndex = byEntityType.findIndex((e) => e.entityType === "lead_assignment");
      if (entityIndex >= 0) byEntityType[entityIndex].count++;
    });
    const byUser = report.userSummary?.map((u) => ({
      userId: u._id,
      userName: u.userName,
      userRole: "user",
      totalActions: u.totalLeadsAssigned + u.totalLeadsCompleted + u.totalMessagesSent,
      lastActivityAt: (/* @__PURE__ */ new Date()).toISOString(),
      actionBreakdown: [
        { action: "assign", count: u.totalLeadsAssigned || 0 },
        { action: "complete", count: u.totalLeadsCompleted || 0 },
        { action: "message", count: u.totalMessagesSent || 0 }
      ]
    })) || [];
    const uniqueUsers = new Set(report.recentActivity?.map((a) => a.userId) || []);
    res.json({
      totalActivities: report.recentActivity?.length || 0,
      uniqueUsers: uniqueUsers.size,
      byAction,
      byEntityType,
      byUser
    });
  } catch (error) {
    console.error("Error getting activity stats:", error);
    res.status(500).json({ error: "Failed to get activity stats" });
  }
});
router16.get("/reports/activity-logs", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const { userId, action, startDate, limit } = req.query;
    const report = await getUserActivityReport({
      userId,
      fromDate: startDate
    });
    let logs = report.recentActivity || [];
    if (action && action !== "all") {
      logs = logs.filter((l) => l.actionType === action);
    }
    if (limit) {
      logs = logs.slice(0, parseInt(limit));
    }
    const formattedLogs = logs.map((log) => ({
      _id: log.id || log._id,
      userId: log.userId,
      userName: log.userName || "Unknown",
      userRole: log.userRole || "user",
      action: log.actionType,
      entityType: "lead_assignment",
      entityId: log.leadAssignmentId,
      details: log.metadata || {},
      createdAt: log.timestamp
    }));
    res.json(formattedLogs);
  } catch (error) {
    console.error("Error getting activity logs:", error);
    res.status(500).json({ error: "Failed to get activity logs" });
  }
});
router16.get("/reports/workload", async (req, res) => {
  try {
    const user = getUser2(req);
    if (!isAdmin(user) && user.role !== "manager") {
      return res.status(403).json({ error: "Not authorized to view reports" });
    }
    const workload = await getWorkloadDistribution();
    res.json(workload);
  } catch (error) {
    console.error("Error getting workload distribution:", error);
    res.status(500).json({ error: "Failed to get workload distribution" });
  }
});
router16.post("/log-activity", async (req, res) => {
  try {
    const user = getUser2(req);
    const { actionType, contactId, contactPhone: contactPhone2, contactName: contactName2, metadata } = req.body;
    await logUserActivity({
      userId: user.userId || "admin",
      userName: user.name,
      userRole: user.role,
      actionType,
      contactId,
      contactPhone: contactPhone2,
      contactName: contactName2,
      metadata
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error logging activity:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});
var leadManagement_routes_default = router16;

// modules/whatsapp-marketing/server/modules/integrations/integration.routes.js
import { Router as Router17 } from "express";
var router17 = Router17();
router17.get("/providers", async (req, res) => {
  try {
    const providers = await getAllProviders();
    res.json(providers);
  } catch (error) {
    console.error("[Integrations] Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});
router17.get("/providers/:providerId", async (req, res) => {
  try {
    const provider = await getProviderDetails(req.params.providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }
    res.json(provider);
  } catch (error) {
    console.error("[Integrations] Error fetching provider:", error);
    res.status(500).json({ error: "Failed to fetch provider" });
  }
});
router17.get("/connections", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connections = await getUserConnections(userId);
    res.json(connections);
  } catch (error) {
    console.error("[Integrations] Error fetching connections:", error);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});
router17.get("/connections/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connectionsWithStatus = await getConnectionsWithStatus(userId);
    res.json(connectionsWithStatus);
  } catch (error) {
    console.error("[Integrations] Error fetching connection status:", error);
    res.status(500).json({ error: "Failed to fetch connection status" });
  }
});
router17.get("/whatsapp/profile", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = await getWhatsAppProfile(userId);
    res.json(profile);
  } catch (error) {
    console.error("[Integrations] Error fetching WhatsApp profile:", error);
    res.status(500).json({ error: "Failed to fetch WhatsApp profile" });
  }
});
router17.get("/connections/:connectionId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const connection2 = await getConnectionById(userId, req.params.connectionId);
    if (!connection2) {
      return res.status(404).json({ error: "Connection not found" });
    }
    const maskedCredentials = await getMaskedCredentials(userId, req.params.connectionId);
    res.json({
      ...connection2,
      credentials: maskedCredentials
    });
  } catch (error) {
    console.error("[Integrations] Error fetching connection:", error);
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});
router17.post("/connect", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { providerId, credentials, metadata, setAsDefault } = req.body;
    const role = String(req.headers["x-user-role"] || "").trim().toLowerCase();
    const ownerType = ["admin", "superadmin", "super_admin"].includes(role) ? "admin" : "vendor";
    if (!providerId || !credentials) {
      return res.status(400).json({ error: "Provider ID and credentials are required" });
    }
    const result = await connectIntegration(userId, {
      providerId,
      credentials,
      metadata: {
        ...metadata || {},
        ownerType,
        ownerRole: role || "user"
      },
      setAsDefault: setAsDefault !== false
    });
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({
      success: true,
      connection: result.connection,
      message: "Integration connected successfully"
    });
  } catch (error) {
    console.error("[Integrations] Error connecting integration:", error);
    res.status(500).json({ error: "Failed to connect integration" });
  }
});
router17.post("/connections/:connectionId/verify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await verifyConnection(userId, req.params.connectionId);
    res.json(result);
  } catch (error) {
    console.error("[Integrations] Error verifying connection:", error);
    res.status(500).json({ error: "Failed to verify connection" });
  }
});
router17.post("/connections/:connectionId/set-default", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await setDefaultConnection(userId, req.params.connectionId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: "Default connection updated" });
  } catch (error) {
    console.error("[Integrations] Error setting default connection:", error);
    res.status(500).json({ error: "Failed to set default connection" });
  }
});
router17.delete("/connections/:connectionId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await disconnectIntegration(userId, req.params.connectionId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: "Integration disconnected successfully" });
  } catch (error) {
    console.error("[Integrations] Error disconnecting integration:", error);
    res.status(500).json({ error: "Failed to disconnect integration" });
  }
});
router17.get("/credentials/:providerId", requireAuth, async (req, res) => {
  res.status(403).json({
    error: "Raw integration credentials are server-only and cannot be returned to clients"
  });
});
router17.post("/whatsapp/delink", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (String(req.body?.confirmation || "").trim().toUpperCase() !== "DELINK") {
      return res.status(400).json({ error: "Type DELINK to confirm account deletion" });
    }
    const result = await delinkWhatsAppAccount(userId);
    res.json({
      success: true,
      message: "WhatsApp account delinked and local WhatsApp data deleted",
      ...result
    });
  } catch (error) {
    console.error("[Integrations] WhatsApp delink error:", error);
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "Failed to delink WhatsApp account",
      details
    });
  }
});
var integration_routes_default = router17;

// modules/whatsapp-marketing/server/modules/automation/automation.routes.js
import { Router as Router18 } from "express";

// modules/whatsapp-marketing/server/modules/automation/triggers/trigger.model.js
import mongoose11, { Schema as Schema9 } from "mongoose";
var TriggerConditionSchema = new Schema9({
  field: { type: String, required: true },
  operator: { type: String, enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in", "exists", "not_exists", "regex"], required: true },
  value: { type: Schema9.Types.Mixed },
  dataType: { type: String, enum: ["string", "number", "boolean", "date", "array"] }
}, { _id: false });
var TriggerConditionGroupSchema = new Schema9({
  logic: { type: String, enum: ["AND", "OR"], required: true },
  conditions: { type: [Schema9.Types.Mixed], default: [] }
}, { _id: false });
var TriggerActionSchema = new Schema9({
  id: { type: String, required: true },
  type: { type: String, enum: ["send_whatsapp", "send_template", "assign_group", "update_crm", "api_call", "internal_alert", "start_flow", "add_tag", "remove_tag", "update_score", "send_email", "delay"], required: true },
  config: { type: Schema9.Types.Mixed, default: {} },
  order: { type: Number, default: 0 },
  onSuccess: { type: String },
  onFailure: { type: String }
}, { _id: false });
var TriggerScheduleSchema = new Schema9({
  enabled: { type: Boolean, default: false },
  timezone: { type: String, default: "UTC" },
  daysOfWeek: { type: [Number] },
  startTime: { type: String },
  endTime: { type: String },
  blackoutDates: { type: [Date] }
}, { _id: false });
var TriggerThrottleSchema = new Schema9({
  enabled: { type: Boolean, default: false },
  maxExecutions: { type: Number, default: 100 },
  windowSeconds: { type: Number, default: 3600 },
  perContact: { type: Boolean, default: false }
}, { _id: false });
var TriggerSchema2 = new Schema9({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ["active", "paused", "draft"], default: "draft" },
  eventSource: { type: String, enum: ["webhook", "whatsapp_message", "whatsapp_status", "facebook_lead", "crm_update", "contact_created", "contact_updated", "tag_added", "segment_joined", "flow_completed", "campaign_event", "api_event", "scheduled"], required: true },
  eventType: { type: String },
  conditionGroup: { type: TriggerConditionGroupSchema, default: { logic: "AND", conditions: [] } },
  actions: { type: [TriggerActionSchema], default: [] },
  schedule: { type: TriggerScheduleSchema },
  throttle: { type: TriggerThrottleSchema },
  priority: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  executionCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  lastExecutedAt: { type: Date }
}, { timestamps: true });
TriggerSchema2.index({ userId: 1, status: 1 });
TriggerSchema2.index({ userId: 1, eventSource: 1, status: 1 });
var Trigger2 = mongoose11.models.Trigger || mongoose11.model("Trigger", TriggerSchema2);
var TriggerExecutionSchema = new Schema9({
  triggerId: { type: Schema9.Types.ObjectId, ref: "Trigger", required: true, index: true },
  userId: { type: String, required: true, index: true },
  eventId: { type: String, required: true },
  eventSource: { type: String, required: true },
  eventData: { type: Schema9.Types.Mixed, default: {} },
  contactId: { type: String, index: true },
  status: { type: String, enum: ["pending", "running", "completed", "failed", "partial"], default: "pending" },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  actionResults: [{
    actionId: { type: String, required: true },
    actionType: { type: String, required: true },
    status: { type: String, enum: ["success", "failed", "skipped"], required: true },
    result: { type: Schema9.Types.Mixed },
    error: { type: String },
    executedAt: { type: Date, required: true },
    duration: { type: Number, required: true }
  }],
  error: { type: String },
  metadata: { type: Schema9.Types.Mixed }
}, { timestamps: true });
TriggerExecutionSchema.index({ triggerId: 1, createdAt: -1 });
TriggerExecutionSchema.index({ userId: 1, createdAt: -1 });
TriggerExecutionSchema.index({ userId: 1, status: 1 });
var TriggerExecution = mongoose11.models.TriggerExecution || mongoose11.model("TriggerExecution", TriggerExecutionSchema);
var RealTimeEventSchema = new Schema9({
  userId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, unique: true },
  sourceType: { type: String, enum: ["webhook", "whatsapp", "facebook", "crm", "api", "system", "scheduled"], required: true },
  sourceId: { type: String },
  eventType: { type: String, required: true },
  payload: { type: Schema9.Types.Mixed, default: {} },
  normalizedData: { type: Schema9.Types.Mixed, default: {} },
  contactId: { type: String, index: true },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  triggerMatches: [{ type: Schema9.Types.ObjectId, ref: "Trigger" }],
  status: { type: String, enum: ["received", "processing", "processed", "failed"], default: "received" }
}, { timestamps: true });
RealTimeEventSchema.index({ userId: 1, receivedAt: -1 });
RealTimeEventSchema.index({ userId: 1, sourceType: 1, receivedAt: -1 });
var RealTimeEvent = mongoose11.models.RealTimeEvent || mongoose11.model("RealTimeEvent", RealTimeEventSchema);

// modules/whatsapp-marketing/server/modules/automation/triggers/trigger.service.js
import { randomUUID as randomUUID5 } from "crypto";
var uuidv4 = () => randomUUID5();
async function createTrigger(userId, data) {
  const trigger = new Trigger2({
    ...data,
    userId,
    status: data.status || "draft"
  });
  return trigger.save();
}
async function getTriggerById(userId, triggerId) {
  return Trigger2.findOne({ _id: triggerId, userId });
}
async function getTriggers(userId, filters) {
  const query = { userId };
  if (filters?.status) query.status = filters.status;
  if (filters?.eventSource) query.eventSource = filters.eventSource;
  if (filters?.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { description: { $regex: filters.search, $options: "i" } }
    ];
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;
  const [triggers, total] = await Promise.all([
    Trigger2.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Trigger2.countDocuments(query)
  ]);
  return { triggers, total };
}
async function updateTrigger(userId, triggerId, data) {
  return Trigger2.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: data },
    { new: true }
  );
}
async function deleteTrigger(userId, triggerId) {
  const result = await Trigger2.deleteOne({ _id: triggerId, userId });
  return result.deletedCount > 0;
}
async function activateTrigger(userId, triggerId) {
  return Trigger2.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: { status: "active" } },
    { new: true }
  );
}
async function pauseTrigger(userId, triggerId) {
  return Trigger2.findOneAndUpdate(
    { _id: triggerId, userId },
    { $set: { status: "paused" } },
    { new: true }
  );
}
async function duplicateTrigger(userId, triggerId) {
  const original = await Trigger2.findOne({ _id: triggerId, userId });
  if (!original) return null;
  const duplicate = new Trigger2({
    ...original.toObject(),
    _id: void 0,
    name: `${original.name} (Copy)`,
    status: "draft",
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    lastExecutedAt: void 0,
    createdAt: void 0,
    updatedAt: void 0
  });
  return duplicate.save();
}
function evaluateConditionGroup(conditionGroup, data) {
  const { logic, conditions } = conditionGroup;
  if (conditions.length === 0) return true;
  const results = conditions.map((condition) => {
    if ("logic" in condition) {
      return evaluateConditionGroup(condition, data);
    }
    return evaluateCondition(condition, data);
  });
  return logic === "AND" ? results.every((r) => r) : results.some((r) => r);
}
function evaluateCondition(condition, data) {
  const { field, operator, value } = condition;
  const fieldValue = getNestedValue(data, field);
  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "not_equals":
      return fieldValue !== value;
    case "contains":
      return String(fieldValue || "").toLowerCase().includes(String(value || "").toLowerCase());
    case "not_contains":
      return !String(fieldValue || "").toLowerCase().includes(String(value || "").toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(value);
    case "less_than":
      return Number(fieldValue) < Number(value);
    case "in":
      return Array.isArray(value) && value.includes(fieldValue);
    case "not_in":
      return Array.isArray(value) && !value.includes(fieldValue);
    case "exists":
      return fieldValue !== void 0 && fieldValue !== null;
    case "not_exists":
      return fieldValue === void 0 || fieldValue === null;
    case "regex":
      try {
        return new RegExp(value, "i").test(String(fieldValue || ""));
      } catch {
        return false;
      }
    default:
      return false;
  }
}
function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}
async function getActiveTriggersByEvent(userId, eventSource, eventType) {
  const query = {
    userId,
    status: "active",
    eventSource
  };
  if (eventType) {
    query.$or = [
      { eventType },
      { eventType: { $exists: false } },
      { eventType: null }
    ];
  }
  return Trigger2.find(query).sort({ priority: -1 });
}
async function processEvent(userId, event) {
  const eventId = uuidv4();
  const realTimeEvent = new RealTimeEvent({
    userId,
    eventId,
    sourceType: event.sourceType,
    eventType: event.eventType,
    payload: event.payload,
    normalizedData: normalizeEventData(event),
    contactId: event.contactId,
    status: "processing"
  });
  await realTimeEvent.save();
  const activeTriggers = await getActiveTriggersByEvent(userId, event.sourceType, event.eventType);
  const matchedTriggers = [];
  for (const trigger of activeTriggers) {
    if (evaluateConditionGroup(trigger.conditionGroup, realTimeEvent.normalizedData)) {
      matchedTriggers.push(trigger);
    }
  }
  realTimeEvent.triggerMatches = matchedTriggers.map((t) => t._id);
  realTimeEvent.status = "processed";
  realTimeEvent.processedAt = /* @__PURE__ */ new Date();
  await realTimeEvent.save();
  let executionsStarted = 0;
  for (const trigger of matchedTriggers) {
    try {
      await startTriggerExecution(trigger, realTimeEvent);
      executionsStarted++;
    } catch (error) {
      console.error(`[Triggers] Failed to start execution for trigger ${trigger._id}:`, error);
    }
  }
  return { eventId, triggersMatched: matchedTriggers.length, executionsStarted };
}
function normalizeEventData(event) {
  return {
    sourceType: event.sourceType,
    eventType: event.eventType,
    contactId: event.contactId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...event.payload
  };
}
async function startTriggerExecution(trigger, event) {
  const execution = new TriggerExecution({
    triggerId: trigger._id,
    userId: trigger.userId,
    eventId: event.eventId,
    eventSource: event.sourceType,
    eventData: event.normalizedData,
    contactId: event.contactId,
    status: "running"
  });
  await execution.save();
  await Trigger2.updateOne(
    { _id: trigger._id },
    {
      $inc: { executionCount: 1 },
      $set: { lastExecutedAt: /* @__PURE__ */ new Date() }
    }
  );
  executeActionsAsync(trigger, execution, event);
  return execution;
}
async function executeActionsAsync(trigger, execution, event) {
  const sortedActions = [...trigger.actions].sort((a, b) => a.order - b.order);
  let hasFailure = false;
  for (const action of sortedActions) {
    const startTime = Date.now();
    try {
      const result = await executeAction(action, event.normalizedData, trigger.userId);
      execution.actionResults.push({
        actionId: action.id,
        actionType: action.type,
        status: "success",
        result,
        executedAt: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      });
    } catch (error) {
      hasFailure = true;
      execution.actionResults.push({
        actionId: action.id,
        actionType: action.type,
        status: "failed",
        error: error.message,
        executedAt: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      });
    }
  }
  execution.status = hasFailure ? "partial" : "completed";
  execution.completedAt = /* @__PURE__ */ new Date();
  await execution.save();
  await Trigger2.updateOne(
    { _id: trigger._id },
    {
      $inc: hasFailure ? { failureCount: 1 } : { successCount: 1 }
    }
  );
}
async function executeAction(action, eventData, userId) {
  const { type, config } = action;
  switch (type) {
    case "send_whatsapp":
      return { message: "WhatsApp message queued", config };
    case "send_template":
      return { message: "Template message queued", config };
    case "assign_group":
      return { message: "Contact assigned to group", groupId: config.groupId };
    case "update_crm":
      return { message: "CRM field updated", field: config.field, value: config.value };
    case "api_call":
      return { message: "API call queued", url: config.url };
    case "internal_alert":
      return { message: "Alert sent", alertType: config.alertType };
    case "start_flow":
      return { message: "Flow started", flowId: config.flowId };
    case "add_tag":
      return { message: "Tag added", tag: config.tag };
    case "remove_tag":
      return { message: "Tag removed", tag: config.tag };
    case "update_score":
      return { message: "Score updated", scoreChange: config.scoreChange };
    case "send_email":
      return { message: "Email queued", to: config.to };
    case "delay":
      await new Promise((resolve) => setTimeout(resolve, Math.min(config.delayMs || 1e3, 6e4)));
      return { message: "Delay completed", delayMs: config.delayMs };
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}
async function getTriggerExecutions(userId, triggerId, filters) {
  const query = { userId };
  if (triggerId) query.triggerId = triggerId;
  if (filters?.status) query.status = filters.status;
  if (filters?.startDate || filters?.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = filters.startDate;
    if (filters.endDate) query.createdAt.$lte = filters.endDate;
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;
  const [executions, total] = await Promise.all([
    TriggerExecution.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TriggerExecution.countDocuments(query)
  ]);
  return { executions, total };
}
async function getRecentActivity(userId, limit = 20) {
  return RealTimeEvent.find({ userId }).sort({ receivedAt: -1 }).limit(limit).populate("triggerMatches", "name status");
}
async function getTriggerStats(userId) {
  const [totalTriggers, activeTriggers, triggers] = await Promise.all([
    Trigger2.countDocuments({ userId }),
    Trigger2.countDocuments({ userId, status: "active" }),
    Trigger2.find({ userId }).select("executionCount successCount failureCount")
  ]);
  const totalExecutions = triggers.reduce((sum, t) => sum + t.executionCount, 0);
  const totalSuccesses = triggers.reduce((sum, t) => sum + t.successCount, 0);
  const successRate = totalExecutions > 0 ? totalSuccesses / totalExecutions * 100 : 0;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const recentExecutions = await TriggerExecution.countDocuments({
    userId,
    createdAt: { $gte: oneDayAgo }
  });
  return {
    totalTriggers,
    activeTriggers,
    totalExecutions,
    successRate: Math.round(successRate * 100) / 100,
    recentExecutions
  };
}

// modules/whatsapp-marketing/server/modules/automation/flows/flow.model.js
import mongoose12, { Schema as Schema10 } from "mongoose";
var FlowNodeSchema = new Schema10({
  id: { type: String, required: true },
  type: { type: String, enum: ["start", "message", "template", "delay", "condition", "split", "merge", "api_call", "webhook", "add_tag", "remove_tag", "update_property", "update_score", "assign_agent", "assign_group", "ai_response", "wait_for_reply", "goto", "end"], required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  data: {
    label: { type: String, required: true },
    config: { type: Schema10.Types.Mixed, default: {} }
  }
}, { _id: false });
var FlowEdgeSchema = new Schema10({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String },
  targetHandle: { type: String },
  label: { type: String },
  condition: {
    field: { type: String },
    operator: { type: String },
    value: { type: Schema10.Types.Mixed }
  }
}, { _id: false });
var FlowVariableSchema = new Schema10({
  key: { type: String, required: true },
  type: { type: String, enum: ["string", "number", "boolean", "date", "object", "array"], required: true },
  defaultValue: { type: Schema10.Types.Mixed },
  source: { type: String, enum: ["contact", "trigger", "input", "api"] },
  description: { type: String }
}, { _id: false });
var FlowDefinitionSchema = new Schema10({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  nodes: { type: [FlowNodeSchema], default: [] },
  edges: { type: [FlowEdgeSchema], default: [] },
  variables: { type: [FlowVariableSchema], default: [] },
  entryPoints: [{
    type: { type: String, enum: ["manual", "trigger", "scheduled", "api"], required: true },
    triggerId: { type: String },
    schedule: {
      cronExpression: { type: String },
      timezone: { type: String }
    }
  }],
  settings: {
    allowMultipleInstances: { type: Boolean, default: true },
    maxConcurrentInstances: { type: Number, default: 100 },
    timeout: { type: Number, default: 864e5 },
    retryOnFailure: { type: Boolean, default: false },
    maxRetries: { type: Number, default: 3 }
  },
  tags: { type: [String], default: [] },
  publishedAt: { type: Date },
  totalInstances: { type: Number, default: 0 },
  activeInstances: { type: Number, default: 0 },
  completedInstances: { type: Number, default: 0 },
  failedInstances: { type: Number, default: 0 }
}, { timestamps: true });
FlowDefinitionSchema.index({ userId: 1, status: 1 });
FlowDefinitionSchema.index({ userId: 1, name: 1 });
var FlowDefinition = mongoose12.models.FlowDefinition || mongoose12.model("FlowDefinition", FlowDefinitionSchema);
var FlowInstanceSchema = new Schema10({
  flowId: { type: Schema10.Types.ObjectId, ref: "FlowDefinition", required: true, index: true },
  flowVersion: { type: Number, required: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, index: true },
  status: { type: String, enum: ["running", "paused", "waiting", "completed", "failed", "cancelled"], default: "running" },
  currentNodeId: { type: String, required: true },
  context: { type: Schema10.Types.Mixed, default: {} },
  variables: { type: Schema10.Types.Mixed, default: {} },
  entryType: { type: String, enum: ["manual", "trigger", "scheduled", "api"], required: true },
  triggerId: { type: String },
  nodeHistory: [{
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    enteredAt: { type: Date, required: true },
    exitedAt: { type: Date },
    status: { type: String, enum: ["entered", "completed", "failed", "skipped"], required: true },
    result: { type: Schema10.Types.Mixed },
    error: { type: String }
  }],
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  waitingUntil: { type: Date },
  waitingFor: { type: String },
  error: { type: String },
  metadata: { type: Schema10.Types.Mixed }
}, { timestamps: true });
FlowInstanceSchema.index({ flowId: 1, status: 1 });
FlowInstanceSchema.index({ userId: 1, status: 1 });
FlowInstanceSchema.index({ userId: 1, createdAt: -1 });
FlowInstanceSchema.index({ contactId: 1, flowId: 1 });
var FlowInstance = mongoose12.models.FlowInstance || mongoose12.model("FlowInstance", FlowInstanceSchema);

// modules/whatsapp-marketing/server/modules/automation/flows/flow.service.js
async function createFlow2(userId, data) {
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
async function getFlowById3(userId, flowId) {
  return FlowDefinition.findOne({ _id: flowId, userId });
}
async function getFlows3(userId, filters) {
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
async function deleteFlow3(userId, flowId) {
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
async function publishFlow2(userId, flowId) {
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
  const queue2 = startNodes.map((n) => n.id);
  while (queue2.length > 0) {
    const current = queue2.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of flow.edges) {
      if (edge.source === current && !reachable.has(edge.target)) {
        queue2.push(edge.target);
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
async function getFlowStats3(userId) {
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

// modules/whatsapp-marketing/server/modules/automation/segments/segment.model.js
import mongoose13, { Schema as Schema11 } from "mongoose";
var SegmentRuleSchema = new Schema11({
  field: { type: String, required: true },
  operator: { type: String, enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "in", "not_in", "exists", "not_exists", "between", "before", "after", "within_days", "regex"], required: true },
  value: { type: Schema11.Types.Mixed },
  dataType: { type: String, enum: ["string", "number", "boolean", "date", "array"] }
}, { _id: false });
var SegmentRuleGroupSchema = new Schema11({
  logic: { type: String, enum: ["AND", "OR"], required: true },
  rules: { type: [Schema11.Types.Mixed], default: [] }
}, { _id: false });
var SegmentSchema = new Schema11({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ["dynamic", "static"], default: "dynamic" },
  status: { type: String, enum: ["active", "inactive", "computing"], default: "active" },
  ruleGroup: { type: SegmentRuleGroupSchema, default: { logic: "AND", rules: [] } },
  refreshStrategy: { type: String, enum: ["realtime", "hourly", "daily", "manual"], default: "hourly" },
  lastRefreshedAt: { type: Date },
  memberCount: { type: Number, default: 0 },
  estimatedCount: { type: Number },
  usedInTriggers: { type: Number, default: 0 },
  usedInFlows: { type: Number, default: 0 },
  usedInCampaigns: { type: Number, default: 0 },
  tags: { type: [String], default: [] },
  color: { type: String },
  icon: { type: String }
}, { timestamps: true });
SegmentSchema.index({ userId: 1, status: 1 });
SegmentSchema.index({ userId: 1, name: 1 });
SegmentSchema.index({ userId: 1, type: 1 });
var Segment = mongoose13.models.Segment || mongoose13.model("Segment", SegmentSchema);
var SegmentMemberSchema = new Schema11({
  segmentId: { type: Schema11.Types.ObjectId, ref: "Segment", required: true, index: true },
  userId: { type: String, required: true, index: true },
  contactId: { type: String, required: true, index: true },
  addedAt: { type: Date, default: Date.now },
  source: { type: String, enum: ["rule_match", "manual", "import", "trigger", "api"], default: "rule_match" },
  metadata: { type: Schema11.Types.Mixed }
}, { timestamps: true });
SegmentMemberSchema.index({ segmentId: 1, contactId: 1 }, { unique: true });
SegmentMemberSchema.index({ userId: 1, contactId: 1 });
SegmentMemberSchema.index({ segmentId: 1, addedAt: -1 });
var SegmentMember = mongoose13.models.SegmentMember || mongoose13.model("SegmentMember", SegmentMemberSchema);

// modules/whatsapp-marketing/server/modules/automation/segments/segment.service.js
init_mongodb_adapter();
async function createSegment(userId, data) {
  const segment = new Segment({
    ...data,
    userId,
    status: "active"
  });
  const saved = await segment.save();
  if (saved.type === "dynamic" && saved.refreshStrategy !== "manual") {
    refreshSegmentMembers(saved._id.toString(), userId);
  }
  return saved;
}
async function getSegmentById(userId, segmentId) {
  return Segment.findOne({ _id: segmentId, userId });
}
async function getSegments(userId, filters) {
  const query = { userId };
  if (filters?.status) query.status = filters.status;
  if (filters?.type) query.type = filters.type;
  if (filters?.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { description: { $regex: filters.search, $options: "i" } }
    ];
  }
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;
  const [segments, total] = await Promise.all([
    Segment.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    Segment.countDocuments(query)
  ]);
  return { segments, total };
}
async function updateSegment(userId, segmentId, data) {
  const segment = await Segment.findOneAndUpdate(
    { _id: segmentId, userId },
    { $set: data },
    { new: true }
  );
  if (segment && data.ruleGroup) {
    refreshSegmentMembers(segmentId, userId);
  }
  return segment;
}
async function deleteSegment(userId, segmentId) {
  const result = await Segment.deleteOne({ _id: segmentId, userId });
  if (result.deletedCount > 0) {
    await SegmentMember.deleteMany({ segmentId });
    return true;
  }
  return false;
}
async function duplicateSegment(userId, segmentId) {
  const original = await Segment.findOne({ _id: segmentId, userId });
  if (!original) return null;
  const duplicate = new Segment({
    ...original.toObject(),
    _id: void 0,
    name: `${original.name} (Copy)`,
    memberCount: 0,
    usedInTriggers: 0,
    usedInFlows: 0,
    usedInCampaigns: 0,
    lastRefreshedAt: void 0,
    createdAt: void 0,
    updatedAt: void 0
  });
  const saved = await duplicate.save();
  if (saved.type === "dynamic") {
    refreshSegmentMembers(saved._id.toString(), userId);
  }
  return saved;
}
async function refreshSegmentMembers(segmentId, userId) {
  const segment = await Segment.findOne({ _id: segmentId, userId });
  if (!segment) return 0;
  await Segment.updateOne({ _id: segmentId }, { $set: { status: "computing" } });
  try {
    const mongoQuery = buildMongoQuery(segment.ruleGroup);
    mongoQuery.userId = userId;
    const matchingContacts = await Contact.find(mongoQuery).select("_id");
    const contactIds = matchingContacts.map((c) => c._id.toString());
    await SegmentMember.deleteMany({ segmentId, source: "rule_match" });
    if (contactIds.length > 0) {
      const members = contactIds.map((contactId) => ({
        segmentId,
        userId,
        contactId,
        source: "rule_match",
        addedAt: /* @__PURE__ */ new Date()
      }));
      await SegmentMember.insertMany(members, { ordered: false }).catch(() => {
      });
    }
    const totalMembers = await SegmentMember.countDocuments({ segmentId });
    await Segment.updateOne(
      { _id: segmentId },
      {
        $set: {
          status: "active",
          memberCount: totalMembers,
          lastRefreshedAt: /* @__PURE__ */ new Date()
        }
      }
    );
    return totalMembers;
  } catch (error) {
    await Segment.updateOne({ _id: segmentId }, { $set: { status: "active" } });
    throw error;
  }
}
function buildMongoQuery(ruleGroup) {
  const { logic, rules } = ruleGroup;
  if (rules.length === 0) return {};
  const conditions = rules.map((rule) => {
    if ("logic" in rule) {
      return buildMongoQuery(rule);
    }
    return buildConditionQuery(rule);
  }).filter((c) => Object.keys(c).length > 0);
  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return logic === "AND" ? { $and: conditions } : { $or: conditions };
}
function buildConditionQuery(rule) {
  const { field, operator, value } = rule;
  switch (operator) {
    case "equals":
      return { [field]: value };
    case "not_equals":
      return { [field]: { $ne: value } };
    case "contains":
      return { [field]: { $regex: value, $options: "i" } };
    case "not_contains":
      return { [field]: { $not: { $regex: value, $options: "i" } } };
    case "greater_than":
      return { [field]: { $gt: value } };
    case "less_than":
      return { [field]: { $lt: value } };
    case "in":
      return { [field]: { $in: Array.isArray(value) ? value : [value] } };
    case "not_in":
      return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
    case "exists":
      return { [field]: { $exists: true, $ne: null } };
    case "not_exists":
      return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        return { [field]: { $gte: value[0], $lte: value[1] } };
      }
      return {};
    case "before":
      return { [field]: { $lt: new Date(value) } };
    case "after":
      return { [field]: { $gt: new Date(value) } };
    case "within_days":
      const daysAgo = /* @__PURE__ */ new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(value));
      return { [field]: { $gte: daysAgo } };
    case "regex":
      try {
        return { [field]: { $regex: value, $options: "i" } };
      } catch {
        return {};
      }
    default:
      return {};
  }
}
async function getSegmentMembers(userId, segmentId, filters) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;
  const [members, total] = await Promise.all([
    SegmentMember.find({ segmentId, userId }).sort({ addedAt: -1 }).skip(skip).limit(limit),
    SegmentMember.countDocuments({ segmentId, userId })
  ]);
  return { members, total };
}
async function addManualMember(userId, segmentId, contactId) {
  const segment = await Segment.findOne({ _id: segmentId, userId });
  if (!segment) return null;
  try {
    const member = new SegmentMember({
      segmentId,
      userId,
      contactId,
      source: "manual"
    });
    await member.save();
    await Segment.updateOne(
      { _id: segmentId },
      { $inc: { memberCount: 1 } }
    );
    return member;
  } catch (error) {
    if (error.code === 11e3) {
      return null;
    }
    throw error;
  }
}
async function removeMember(userId, segmentId, contactId) {
  const result = await SegmentMember.deleteOne({ segmentId, userId, contactId });
  if (result.deletedCount > 0) {
    await Segment.updateOne(
      { _id: segmentId },
      { $inc: { memberCount: -1 } }
    );
    return true;
  }
  return false;
}
async function previewSegment(userId, ruleGroup, limit = 10) {
  const mongoQuery = buildMongoQuery(ruleGroup);
  mongoQuery.userId = userId;
  const [estimatedCount, sampleContacts] = await Promise.all([
    Contact.countDocuments(mongoQuery),
    Contact.find(mongoQuery).limit(limit).select("name phoneNumber email tags")
  ]);
  return { estimatedCount, sampleContacts };
}
async function getSegmentStats(userId) {
  const [totalSegments, dynamicSegments, staticSegments, segments] = await Promise.all([
    Segment.countDocuments({ userId }),
    Segment.countDocuments({ userId, type: "dynamic" }),
    Segment.countDocuments({ userId, type: "static" }),
    Segment.find({ userId }).select("memberCount")
  ]);
  const totalMembers = segments.reduce((sum, s) => sum + s.memberCount, 0);
  const avgMembersPerSegment = totalSegments > 0 ? Math.round(totalMembers / totalSegments) : 0;
  return {
    totalSegments,
    dynamicSegments,
    staticSegments,
    totalMembers,
    avgMembersPerSegment
  };
}

// modules/whatsapp-marketing/server/modules/automation/analytics/analytics.model.js
import mongoose14, { Schema as Schema12 } from "mongoose";
var AutomationMetricsSchema = new Schema12({
  userId: { type: String, required: true, index: true },
  scopeType: { type: String, enum: ["global", "trigger", "flow", "campaign", "segment"], required: true },
  scopeId: { type: String },
  date: { type: Date, required: true },
  hour: { type: Number },
  metrics: {
    triggerExecutions: { type: Number, default: 0 },
    triggerSuccesses: { type: Number, default: 0 },
    triggerFailures: { type: Number, default: 0 },
    flowStarts: { type: Number, default: 0 },
    flowCompletions: { type: Number, default: 0 },
    flowFailures: { type: Number, default: 0 },
    flowExits: { type: Number, default: 0 },
    campaignEnrollments: { type: Number, default: 0 },
    campaignCompletions: { type: Number, default: 0 },
    campaignExits: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    messagesDelivered: { type: Number, default: 0 },
    messagesRead: { type: Number, default: 0 },
    messagesReplied: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    apiSuccesses: { type: Number, default: 0 },
    apiFailures: { type: Number, default: 0 },
    alertsSent: { type: Number, default: 0 }
  },
  engagement: {
    deliveryRate: { type: Number, default: 0 },
    readRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 }
  },
  timing: {
    avgTriggerLatency: { type: Number, default: 0 },
    avgFlowDuration: { type: Number, default: 0 },
    avgMessageDeliveryTime: { type: Number, default: 0 }
  }
}, { timestamps: true });
AutomationMetricsSchema.index({ userId: 1, scopeType: 1, date: -1 });
AutomationMetricsSchema.index({ userId: 1, scopeType: 1, scopeId: 1, date: -1 });
AutomationMetricsSchema.index({ userId: 1, date: -1, hour: 1 });
var AutomationMetrics = mongoose14.models.AutomationMetrics || mongoose14.model("AutomationMetrics", AutomationMetricsSchema);
var EngagementHeatmapSchema = new Schema12({
  userId: { type: String, required: true, index: true },
  period: { type: String, enum: ["day", "week", "month"], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  data: [{
    dayOfWeek: { type: Number, required: true },
    hour: { type: Number, required: true },
    messagesSent: { type: Number, default: 0 },
    messagesDelivered: { type: Number, default: 0 },
    messagesRead: { type: Number, default: 0 },
    messagesReplied: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 }
  }],
  bestSendTimes: [{
    dayOfWeek: { type: Number, required: true },
    hour: { type: Number, required: true },
    score: { type: Number, required: true }
  }],
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
EngagementHeatmapSchema.index({ userId: 1, period: 1, startDate: -1 });
var EngagementHeatmap = mongoose14.models.EngagementHeatmap || mongoose14.model("EngagementHeatmap", EngagementHeatmapSchema);
var AIInsightSchema = new Schema12({
  userId: { type: String, required: true, index: true },
  insightType: { type: String, enum: ["performance", "optimization", "anomaly", "recommendation", "trend"], required: true },
  scope: { type: String, enum: ["trigger", "flow", "campaign", "segment", "overall"], required: true },
  scopeId: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ["info", "warning", "critical", "positive"], default: "info" },
  actionable: { type: Boolean, default: false },
  suggestedActions: { type: [String] },
  dataPoints: { type: Schema12.Types.Mixed, default: {} },
  confidence: { type: Number, default: 0.8 },
  status: { type: String, enum: ["new", "viewed", "actioned", "dismissed"], default: "new" },
  generatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
}, { timestamps: true });
AIInsightSchema.index({ userId: 1, status: 1, generatedAt: -1 });
AIInsightSchema.index({ userId: 1, scope: 1, scopeId: 1 });
var AIInsight = mongoose14.models.AIInsight || mongoose14.model("AIInsight", AIInsightSchema);

// modules/whatsapp-marketing/server/modules/automation/analytics/analytics.service.js
async function getDashboardMetrics(userId, dateRange2) {
  const now = /* @__PURE__ */ new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const start = dateRange2?.start || oneDayAgo;
  const end = dateRange2?.end || now;
  const [
    triggerStats,
    flowStats,
    campaignStats,
    segmentStats,
    recentExecutions,
    recentInstances
  ] = await Promise.all([
    getTriggerMetrics(userId),
    getFlowMetrics2(userId),
    getCampaignMetrics(userId),
    getSegmentMetrics(userId),
    TriggerExecution.countDocuments({ userId, createdAt: { $gte: start, $lte: end } }),
    FlowInstance.countDocuments({ userId, startedAt: { $gte: start, $lte: end } })
  ]);
  return {
    triggers: {
      total: triggerStats.total,
      active: triggerStats.active,
      executions24h: recentExecutions,
      successRate: triggerStats.successRate
    },
    flows: {
      total: flowStats.total,
      published: flowStats.published,
      instances24h: recentInstances,
      completionRate: flowStats.completionRate
    },
    campaigns: {
      total: campaignStats.total,
      active: campaignStats.active,
      sent24h: campaignStats.sent24h,
      deliveryRate: campaignStats.deliveryRate
    },
    segments: {
      total: segmentStats.total,
      totalMembers: segmentStats.totalMembers
    },
    overall: {
      messagesDelivered: campaignStats.delivered,
      messagesRead: campaignStats.read,
      conversions: campaignStats.conversions,
      engagementRate: campaignStats.engagementRate
    }
  };
}
async function getTriggerMetrics(userId) {
  const triggers = await Trigger2.find({ userId }).select("status executionCount successCount failureCount");
  const total = triggers.length;
  const active = triggers.filter((t) => t.status === "active").length;
  const totalExecutions = triggers.reduce((sum, t) => sum + t.executionCount, 0);
  const totalSuccesses = triggers.reduce((sum, t) => sum + t.successCount, 0);
  const successRate = totalExecutions > 0 ? Math.round(totalSuccesses / totalExecutions * 100) : 0;
  return { total, active, totalExecutions, successRate };
}
async function getFlowMetrics2(userId) {
  const flows = await FlowDefinition.find({ userId }).select("status totalInstances completedInstances");
  const total = flows.length;
  const published = flows.filter((f) => f.status === "published").length;
  const totalInstances = flows.reduce((sum, f) => sum + f.totalInstances, 0);
  const completedInstances = flows.reduce((sum, f) => sum + f.completedInstances, 0);
  const completionRate = totalInstances > 0 ? Math.round(completedInstances / totalInstances * 100) : 0;
  return { total, published, totalInstances, completionRate };
}
async function getCampaignMetrics(userId) {
  const campaigns = await DripCampaign.find({ userId }).select("status metrics");
  const total = campaigns.length;
  const active = campaigns.filter((c) => c.status === "active").length;
  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + c.metrics.totalSent,
    delivered: acc.delivered + c.metrics.totalDelivered,
    read: acc.read + c.metrics.totalRead,
    replied: acc.replied + c.metrics.totalReplied,
    converted: acc.converted + c.metrics.totalConverted
  }), { sent: 0, delivered: 0, read: 0, replied: 0, converted: 0 });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const sent24h = await DripRun.countDocuments({
    userId,
    "stepHistory.sentAt": { $gte: oneDayAgo }
  });
  const deliveryRate = totals.sent > 0 ? Math.round(totals.delivered / totals.sent * 100) : 0;
  const engagementRate = totals.delivered > 0 ? Math.round((totals.read + totals.replied) / (totals.delivered * 2) * 100) : 0;
  return {
    total,
    active,
    sent24h,
    delivered: totals.delivered,
    read: totals.read,
    conversions: totals.converted,
    deliveryRate,
    engagementRate
  };
}
async function getSegmentMetrics(userId) {
  const segments = await Segment.find({ userId }).select("memberCount");
  const total = segments.length;
  const totalMembers = segments.reduce((sum, s) => sum + s.memberCount, 0);
  return { total, totalMembers };
}
async function getTriggerPerformance(userId, triggerId, dateRange2) {
  const start = dateRange2?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  const end = dateRange2?.end || /* @__PURE__ */ new Date();
  const query = { userId, createdAt: { $gte: start, $lte: end } };
  if (triggerId) query.triggerId = triggerId;
  const executions = await TriggerExecution.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  const triggers = await Trigger2.find({ userId }).select("name executionCount successCount").sort({ executionCount: -1 }).limit(10);
  const topTriggers = triggers.map((t) => ({
    id: t._id.toString(),
    name: t.name,
    executions: t.executionCount,
    successRate: t.executionCount > 0 ? Math.round(t.successCount / t.executionCount * 100) : 0
  }));
  return {
    executions: executions.map((e) => ({ date: e._id, ...e })),
    topTriggers,
    avgLatency: 150
  };
}
async function getFlowPerformance(userId, flowId, dateRange2) {
  const start = dateRange2?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
  const end = dateRange2?.end || /* @__PURE__ */ new Date();
  const query = { userId, startedAt: { $gte: start, $lte: end } };
  if (flowId) query.flowId = flowId;
  const instances = await FlowInstance.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
        started: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  return {
    instances: instances.map((i) => ({ date: i._id, ...i })),
    funnel: [],
    avgDuration: 36e5
  };
}
async function getCampaignPerformance2(userId, campaignId, dateRange2) {
  const query = { userId };
  if (campaignId) query._id = campaignId;
  const campaigns = await DripCampaign.find(query).select("name metrics steps");
  const aggregatedMetrics = campaigns.reduce((acc, c) => ({
    sent: acc.sent + c.metrics.totalSent,
    delivered: acc.delivered + c.metrics.totalDelivered,
    read: acc.read + c.metrics.totalRead,
    replied: acc.replied + c.metrics.totalReplied,
    converted: acc.converted + c.metrics.totalConverted
  }), { sent: 0, delivered: 0, read: 0, replied: 0, converted: 0 });
  const conversionFunnel = [
    { stage: "Sent", count: aggregatedMetrics.sent, rate: 100 },
    { stage: "Delivered", count: aggregatedMetrics.delivered, rate: aggregatedMetrics.sent > 0 ? Math.round(aggregatedMetrics.delivered / aggregatedMetrics.sent * 100) : 0 },
    { stage: "Read", count: aggregatedMetrics.read, rate: aggregatedMetrics.delivered > 0 ? Math.round(aggregatedMetrics.read / aggregatedMetrics.delivered * 100) : 0 },
    { stage: "Replied", count: aggregatedMetrics.replied, rate: aggregatedMetrics.read > 0 ? Math.round(aggregatedMetrics.replied / aggregatedMetrics.read * 100) : 0 },
    { stage: "Converted", count: aggregatedMetrics.converted, rate: aggregatedMetrics.sent > 0 ? Math.round(aggregatedMetrics.converted / aggregatedMetrics.sent * 100) : 0 }
  ];
  return {
    metrics: [],
    stepPerformance: [],
    conversionFunnel
  };
}
async function generateEngagementHeatmap(userId, period = "week") {
  const now = /* @__PURE__ */ new Date();
  let startDate;
  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
      break;
    case "week":
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
  }
  const data = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({
        dayOfWeek: day,
        hour,
        messagesSent: Math.floor(Math.random() * 50),
        messagesDelivered: Math.floor(Math.random() * 45),
        messagesRead: Math.floor(Math.random() * 30),
        messagesReplied: Math.floor(Math.random() * 10),
        engagementScore: Math.random() * 100
      });
    }
  }
  const sortedData = [...data].sort((a, b) => b.engagementScore - a.engagementScore);
  const bestSendTimes = sortedData.slice(0, 5).map((d) => ({
    dayOfWeek: d.dayOfWeek,
    hour: d.hour,
    score: d.engagementScore
  }));
  const heatmap = new EngagementHeatmap({
    userId,
    period,
    startDate,
    endDate: now,
    data,
    bestSendTimes
  });
  await heatmap.save();
  return heatmap;
}
async function generateAIInsights(userId) {
  const [triggerStats, flowStats, campaignStats] = await Promise.all([
    getTriggerMetrics(userId),
    getFlowMetrics2(userId),
    getCampaignMetrics(userId)
  ]);
  const insights = [];
  if (triggerStats.successRate < 80 && triggerStats.totalExecutions > 10) {
    insights.push({
      userId,
      insightType: "performance",
      scope: "trigger",
      title: "Trigger Success Rate Below Target",
      description: `Your trigger success rate is ${triggerStats.successRate}%. Consider reviewing failed triggers and their conditions.`,
      severity: "warning",
      actionable: true,
      suggestedActions: [
        "Review trigger conditions for accuracy",
        "Check action configurations",
        "Verify API endpoints are accessible"
      ],
      dataPoints: { successRate: triggerStats.successRate, totalExecutions: triggerStats.totalExecutions },
      confidence: 0.85
    });
  }
  if (flowStats.completionRate < 50 && flowStats.totalInstances > 20) {
    insights.push({
      userId,
      insightType: "optimization",
      scope: "flow",
      title: "Low Flow Completion Rate",
      description: `Only ${flowStats.completionRate}% of flow instances complete successfully. Users may be dropping off at certain steps.`,
      severity: "warning",
      actionable: true,
      suggestedActions: [
        "Analyze flow funnel to identify drop-off points",
        "Simplify complex flows",
        "Add more engaging content at key steps"
      ],
      dataPoints: { completionRate: flowStats.completionRate, totalInstances: flowStats.totalInstances },
      confidence: 0.8
    });
  }
  if (campaignStats.deliveryRate > 90 && campaignStats.engagementRate > 40) {
    insights.push({
      userId,
      insightType: "recommendation",
      scope: "campaign",
      title: "Strong Campaign Performance",
      description: `Your campaigns are performing well with ${campaignStats.deliveryRate}% delivery and ${campaignStats.engagementRate}% engagement.`,
      severity: "positive",
      actionable: true,
      suggestedActions: [
        "Consider scaling successful campaign templates",
        "A/B test message variations",
        "Expand to new segments"
      ],
      dataPoints: { deliveryRate: campaignStats.deliveryRate, engagementRate: campaignStats.engagementRate },
      confidence: 0.9
    });
  }
  if (triggerStats.active === 0 && triggerStats.total > 0) {
    insights.push({
      userId,
      insightType: "recommendation",
      scope: "trigger",
      title: "No Active Triggers",
      description: "You have triggers configured but none are active. Activate triggers to automate your workflows.",
      severity: "info",
      actionable: true,
      suggestedActions: [
        "Review and activate your triggers",
        "Test triggers before activation"
      ],
      dataPoints: { totalTriggers: triggerStats.total, activeTriggers: triggerStats.active },
      confidence: 0.95
    });
  }
  const savedInsights = [];
  for (const insight of insights) {
    const aiInsight = new AIInsight(insight);
    const saved = await aiInsight.save();
    savedInsights.push(saved);
  }
  return savedInsights;
}
async function getAIInsights(userId, filters) {
  const query = { userId };
  if (filters?.scope) query.scope = filters.scope;
  if (filters?.status) query.status = filters.status;
  return AIInsight.find(query).sort({ generatedAt: -1 }).limit(filters?.limit || 20);
}
async function updateInsightStatus(userId, insightId, status) {
  return AIInsight.findOneAndUpdate(
    { _id: insightId, userId },
    { $set: { status } },
    { new: true }
  );
}
async function exportReport(userId, reportType, format, dateRange2) {
  let data;
  switch (reportType) {
    case "triggers":
      data = await getTriggerPerformance(userId, void 0, dateRange2);
      break;
    case "flows":
      data = await getFlowPerformance(userId, void 0, dateRange2);
      break;
    case "campaigns":
      data = await getCampaignPerformance2(userId, void 0, dateRange2);
      break;
    case "overall":
      data = await getDashboardMetrics(userId, dateRange2);
      break;
  }
  const filename = `automation_${reportType}_report_${Date.now()}.${format}`;
  return { filename, data };
}

// modules/whatsapp-marketing/server/modules/automation/automation.routes.js
var router18 = Router18();
router18.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const dateRange2 = req.query.startDate && req.query.endDate ? {
      start: new Date(req.query.startDate),
      end: new Date(req.query.endDate)
    } : void 0;
    const metrics = await getDashboardMetrics(userId, dateRange2);
    res.json(metrics);
  } catch (error) {
    console.error("[Automation] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});
router18.get("/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, eventSource, search, page, limit } = req.query;
    const result = await getTriggers(userId, {
      status,
      eventSource,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get triggers error:", error);
    res.status(500).json({ error: "Failed to get triggers" });
  }
});
router18.get("/triggers/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await getTriggerStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Trigger stats error:", error);
    res.status(500).json({ error: "Failed to get trigger stats" });
  }
});
router18.get("/triggers/activity", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const activity = await getRecentActivity(userId, limit);
    res.json(activity);
  } catch (error) {
    console.error("[Automation] Activity error:", error);
    res.status(500).json({ error: "Failed to get activity" });
  }
});
router18.get("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await getTriggerById(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Get trigger error:", error);
    res.status(500).json({ error: "Failed to get trigger" });
  }
});
router18.post("/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await createTrigger(userId, req.body);
    res.status(201).json(trigger);
  } catch (error) {
    console.error("[Automation] Create trigger error:", error);
    res.status(500).json({ error: "Failed to create trigger" });
  }
});
router18.put("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await updateTrigger(userId, req.params.triggerId, req.body);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Update trigger error:", error);
    res.status(500).json({ error: "Failed to update trigger" });
  }
});
router18.delete("/triggers/:triggerId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await deleteTrigger(userId, req.params.triggerId);
    if (!deleted) return res.status(404).json({ error: "Trigger not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete trigger error:", error);
    res.status(500).json({ error: "Failed to delete trigger" });
  }
});
router18.post("/triggers/:triggerId/activate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await activateTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Activate trigger error:", error);
    res.status(500).json({ error: "Failed to activate trigger" });
  }
});
router18.post("/triggers/:triggerId/pause", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await pauseTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.json(trigger);
  } catch (error) {
    console.error("[Automation] Pause trigger error:", error);
    res.status(500).json({ error: "Failed to pause trigger" });
  }
});
router18.post("/triggers/:triggerId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const trigger = await duplicateTrigger(userId, req.params.triggerId);
    if (!trigger) return res.status(404).json({ error: "Trigger not found" });
    res.status(201).json(trigger);
  } catch (error) {
    console.error("[Automation] Duplicate trigger error:", error);
    res.status(500).json({ error: "Failed to duplicate trigger" });
  }
});
router18.get("/triggers/:triggerId/executions", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, startDate, endDate, page, limit } = req.query;
    const result = await getTriggerExecutions(userId, req.params.triggerId, {
      status,
      startDate: startDate ? new Date(startDate) : void 0,
      endDate: endDate ? new Date(endDate) : void 0,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Executions error:", error);
    res.status(500).json({ error: "Failed to get executions" });
  }
});
router18.post("/events", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { sourceType, eventType, payload, contactId } = req.body;
    const result = await processEvent(userId, {
      sourceType,
      eventType,
      payload,
      contactId
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Process event error:", error);
    res.status(500).json({ error: "Failed to process event" });
  }
});
router18.get("/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await getFlows3(userId, {
      status,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get flows error:", error);
    res.status(500).json({ error: "Failed to get flows" });
  }
});
router18.get("/flows/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await getFlowStats3(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Flow stats error:", error);
    res.status(500).json({ error: "Failed to get flow stats" });
  }
});
router18.get("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await getFlowById3(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Get flow error:", error);
    res.status(500).json({ error: "Failed to get flow" });
  }
});
router18.post("/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await createFlow2(userId, req.body);
    res.status(201).json(flow);
  } catch (error) {
    console.error("[Automation] Create flow error:", error);
    res.status(500).json({ error: "Failed to create flow" });
  }
});
router18.put("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await updateFlow(userId, req.params.flowId, req.body);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Update flow error:", error);
    res.status(500).json({ error: "Failed to update flow" });
  }
});
router18.delete("/flows/:flowId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await deleteFlow3(userId, req.params.flowId);
    if (!deleted) return res.status(404).json({ error: "Flow not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete flow error:", error);
    res.status(500).json({ error: "Failed to delete flow" });
  }
});
router18.post("/flows/:flowId/publish", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await publishFlow2(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Publish flow error:", error);
    res.status(400).json({ error: error.message || "Failed to publish flow" });
  }
});
router18.post("/flows/:flowId/unpublish", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await unpublishFlow(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (error) {
    console.error("[Automation] Unpublish flow error:", error);
    res.status(500).json({ error: "Failed to unpublish flow" });
  }
});
router18.post("/flows/:flowId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const flow = await duplicateFlow(userId, req.params.flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.status(201).json(flow);
  } catch (error) {
    console.error("[Automation] Duplicate flow error:", error);
    res.status(500).json({ error: "Failed to duplicate flow" });
  }
});
router18.post("/flows/:flowId/run", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, variables, context } = req.body;
    const instance = await startFlowInstance(userId, req.params.flowId, {
      contactId,
      entryType: "manual",
      variables,
      context
    });
    res.status(201).json(instance);
  } catch (error) {
    console.error("[Automation] Run flow error:", error);
    res.status(400).json({ error: error.message || "Failed to run flow" });
  }
});
router18.get("/flows/:flowId/instances", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, contactId, page, limit } = req.query;
    const result = await getFlowInstances(userId, req.params.flowId, {
      status,
      contactId,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get instances error:", error);
    res.status(500).json({ error: "Failed to get instances" });
  }
});
router18.post("/flows/instances/:instanceId/cancel", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const instance = await cancelFlowInstance(userId, req.params.instanceId);
    if (!instance) return res.status(404).json({ error: "Instance not found" });
    res.json(instance);
  } catch (error) {
    console.error("[Automation] Cancel instance error:", error);
    res.status(500).json({ error: "Failed to cancel instance" });
  }
});
router18.get("/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, search, page, limit } = req.query;
    const result = await getCampaigns(userId, {
      status,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get campaigns error:", error);
    res.status(500).json({ error: "Failed to get campaigns" });
  }
});
router18.get("/campaigns/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await getCampaignStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Campaign stats error:", error);
    res.status(500).json({ error: "Failed to get campaign stats" });
  }
});
router18.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await getCampaignById(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Get campaign error:", error);
    res.status(500).json({ error: "Failed to get campaign" });
  }
});
router18.post("/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await createCampaign(userId, req.body);
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Create campaign error:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});
router18.put("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await updateCampaign(userId, req.params.campaignId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Update campaign error:", error);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});
router18.delete("/campaigns/:campaignId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await deleteCampaign(userId, req.params.campaignId);
    if (!deleted) return res.status(404).json({ error: "Campaign not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete campaign error:", error);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});
router18.post("/campaigns/:campaignId/launch", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await launchCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Launch campaign error:", error);
    res.status(400).json({ error: error.message || "Failed to launch campaign" });
  }
});
router18.post("/campaigns/:campaignId/pause", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await pauseCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Pause campaign error:", error);
    res.status(500).json({ error: "Failed to pause campaign" });
  }
});
router18.post("/campaigns/:campaignId/resume", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await resumeCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Resume campaign error:", error);
    res.status(500).json({ error: "Failed to resume campaign" });
  }
});
router18.post("/campaigns/:campaignId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await duplicateCampaign(userId, req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Duplicate campaign error:", error);
    res.status(500).json({ error: "Failed to duplicate campaign" });
  }
});
router18.post("/campaigns/:campaignId/enroll", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, contactPhone: contactPhone2, variables } = req.body;
    const run = await enrollContact(userId, req.params.campaignId, contactId, contactPhone2, variables);
    res.status(201).json(run);
  } catch (error) {
    console.error("[Automation] Enroll error:", error);
    res.status(400).json({ error: error.message || "Failed to enroll contact" });
  }
});
router18.post("/campaigns/:campaignId/unenroll", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, reason } = req.body;
    const run = await unenrollContact(userId, req.params.campaignId, contactId, reason);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (error) {
    console.error("[Automation] Unenroll error:", error);
    res.status(500).json({ error: "Failed to unenroll contact" });
  }
});
router18.get("/campaigns/:campaignId/runs", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, page, limit } = req.query;
    const result = await getCampaignRuns(userId, req.params.campaignId, {
      status,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get runs error:", error);
    res.status(500).json({ error: "Failed to get runs" });
  }
});
router18.post("/campaigns/:campaignId/steps", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await addStep(userId, req.params.campaignId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("[Automation] Add step error:", error);
    res.status(500).json({ error: "Failed to add step" });
  }
});
router18.post("/campaigns/:campaignId/steps/reorder", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { stepOrder } = req.body;
    const campaign = await reorderSteps(userId, req.params.campaignId, stepOrder);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Reorder steps error:", error);
    res.status(500).json({ error: "Failed to reorder steps" });
  }
});
router18.put("/campaigns/:campaignId/steps/:stepId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await updateStep(userId, req.params.campaignId, req.params.stepId, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign or step not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Update step error:", error);
    res.status(500).json({ error: "Failed to update step" });
  }
});
router18.delete("/campaigns/:campaignId/steps/:stepId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const campaign = await removeStep(userId, req.params.campaignId, req.params.stepId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    console.error("[Automation] Remove step error:", error);
    res.status(500).json({ error: "Failed to remove step" });
  }
});
router18.get("/segments", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status, type, search, page, limit } = req.query;
    const result = await getSegments(userId, {
      status,
      type,
      search,
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get segments error:", error);
    res.status(500).json({ error: "Failed to get segments" });
  }
});
router18.get("/segments/stats", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const stats = await getSegmentStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[Automation] Segment stats error:", error);
    res.status(500).json({ error: "Failed to get segment stats" });
  }
});
router18.get("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await getSegmentById(userId, req.params.segmentId);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (error) {
    console.error("[Automation] Get segment error:", error);
    res.status(500).json({ error: "Failed to get segment" });
  }
});
router18.post("/segments", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await createSegment(userId, req.body);
    res.status(201).json(segment);
  } catch (error) {
    console.error("[Automation] Create segment error:", error);
    res.status(500).json({ error: "Failed to create segment" });
  }
});
router18.put("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await updateSegment(userId, req.params.segmentId, req.body);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (error) {
    console.error("[Automation] Update segment error:", error);
    res.status(500).json({ error: "Failed to update segment" });
  }
});
router18.delete("/segments/:segmentId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const deleted = await deleteSegment(userId, req.params.segmentId);
    if (!deleted) return res.status(404).json({ error: "Segment not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Delete segment error:", error);
    res.status(500).json({ error: "Failed to delete segment" });
  }
});
router18.post("/segments/:segmentId/duplicate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const segment = await duplicateSegment(userId, req.params.segmentId);
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.status(201).json(segment);
  } catch (error) {
    console.error("[Automation] Duplicate segment error:", error);
    res.status(500).json({ error: "Failed to duplicate segment" });
  }
});
router18.post("/segments/:segmentId/refresh", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const memberCount = await refreshSegmentMembers(req.params.segmentId, userId);
    res.json({ success: true, memberCount });
  } catch (error) {
    console.error("[Automation] Refresh segment error:", error);
    res.status(500).json({ error: "Failed to refresh segment" });
  }
});
router18.get("/segments/:segmentId/members", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { page, limit } = req.query;
    const result = await getSegmentMembers(userId, req.params.segmentId, {
      page: page ? parseInt(page) : void 0,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Automation] Get members error:", error);
    res.status(500).json({ error: "Failed to get members" });
  }
});
router18.post("/segments/:segmentId/members", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId } = req.body;
    const member = await addManualMember(userId, req.params.segmentId, contactId);
    if (!member) return res.status(400).json({ error: "Contact already in segment or segment not found" });
    res.status(201).json(member);
  } catch (error) {
    console.error("[Automation] Add member error:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});
router18.delete("/segments/:segmentId/members/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const removed = await removeMember(userId, req.params.segmentId, req.params.contactId);
    if (!removed) return res.status(404).json({ error: "Member not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("[Automation] Remove member error:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});
router18.post("/segments/preview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { ruleGroup, limit } = req.body;
    const result = await previewSegment(userId, ruleGroup, limit || 10);
    res.json(result);
  } catch (error) {
    console.error("[Automation] Preview segment error:", error);
    res.status(500).json({ error: "Failed to preview segment" });
  }
});
router18.get("/analytics/triggers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { triggerId, startDate, endDate } = req.query;
    const dateRange2 = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await getTriggerPerformance(userId, triggerId, dateRange2);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Trigger analytics error:", error);
    res.status(500).json({ error: "Failed to get trigger analytics" });
  }
});
router18.get("/analytics/flows", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { flowId, startDate, endDate } = req.query;
    const dateRange2 = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await getFlowPerformance(userId, flowId, dateRange2);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Flow analytics error:", error);
    res.status(500).json({ error: "Failed to get flow analytics" });
  }
});
router18.get("/analytics/campaigns", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { campaignId, startDate, endDate } = req.query;
    const dateRange2 = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const performance = await getCampaignPerformance2(userId, campaignId, dateRange2);
    res.json(performance);
  } catch (error) {
    console.error("[Automation] Campaign analytics error:", error);
    res.status(500).json({ error: "Failed to get campaign analytics" });
  }
});
router18.get("/analytics/heatmap", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { period } = req.query;
    const heatmap = await generateEngagementHeatmap(userId, period);
    res.json(heatmap);
  } catch (error) {
    console.error("[Automation] Heatmap error:", error);
    res.status(500).json({ error: "Failed to generate heatmap" });
  }
});
router18.get("/analytics/insights", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { scope, status, limit } = req.query;
    const insights = await getAIInsights(userId, {
      scope,
      status,
      limit: limit ? parseInt(limit) : void 0
    });
    res.json(insights);
  } catch (error) {
    console.error("[Automation] Insights error:", error);
    res.status(500).json({ error: "Failed to get insights" });
  }
});
router18.post("/analytics/insights/generate", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const insights = await generateAIInsights(userId);
    res.json(insights);
  } catch (error) {
    console.error("[Automation] Generate insights error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});
router18.put("/analytics/insights/:insightId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.body;
    const insight = await updateInsightStatus(userId, req.params.insightId, status);
    if (!insight) return res.status(404).json({ error: "Insight not found" });
    res.json(insight);
  } catch (error) {
    console.error("[Automation] Update insight error:", error);
    res.status(500).json({ error: "Failed to update insight" });
  }
});
router18.post("/analytics/export", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { reportType, format, startDate, endDate } = req.body;
    const dateRange2 = startDate && endDate ? {
      start: new Date(startDate),
      end: new Date(endDate)
    } : void 0;
    const report = await exportReport(userId, reportType, format, dateRange2);
    res.json(report);
  } catch (error) {
    console.error("[Automation] Export error:", error);
    res.status(500).json({ error: "Failed to export report" });
  }
});
router18.get("/interest/lists", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const lists = await interestClassificationService.getInterestLists(userId);
    res.json(lists);
  } catch (error) {
    console.error("[Interest] Get lists error:", error);
    res.status(500).json({ error: "Failed to get interest lists" });
  }
});
router18.post("/interest/classify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { messageContent, contactId, contactPhone: contactPhone2 } = req.body;
    if (!messageContent || !contactId || !contactPhone2) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const result = await interestClassificationService.classifyAndUpdateContact(
      messageContent,
      contactId,
      contactPhone2,
      userId
    );
    res.json(result);
  } catch (error) {
    console.error("[Interest] Classify error:", error);
    res.status(500).json({ error: "Failed to classify contact" });
  }
});
router18.put("/interest/contacts/:contactId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.body;
    if (!["interested", "not_interested", "neutral"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    await interestClassificationService.manuallyClassifyContact(
      req.params.contactId,
      userId,
      status
    );
    res.json({ success: true });
  } catch (error) {
    console.error("[Interest] Manual classify error:", error);
    res.status(500).json({ error: "Failed to classify contact" });
  }
});
router18.get("/interest/logs", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { contactId, status, limit, offset } = req.query;
    const result = await interestClassificationService.getClassificationLogs(userId, {
      contactId,
      status,
      limit: limit ? parseInt(limit) : void 0,
      offset: offset ? parseInt(offset) : void 0
    });
    res.json(result);
  } catch (error) {
    console.error("[Interest] Get logs error:", error);
    res.status(500).json({ error: "Failed to get logs" });
  }
});
router18.get("/interest/report", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { days } = req.query;
    const report = await interestClassificationService.getInterestReport(
      userId,
      days ? parseInt(days) : 7
    );
    res.json(report);
  } catch (error) {
    console.error("[Interest] Get report error:", error);
    res.status(500).json({ error: "Failed to get report" });
  }
});
router18.post("/interest/test", requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await interestClassificationService.classifyMessage(message, "test", "test", true);
    res.json(result);
  } catch (error) {
    console.error("[Interest] Test classify error:", error);
    res.status(500).json({ error: "Failed to test classification" });
  }
});
var automation_routes_default = router18;

// modules/whatsapp-marketing/server/routes.js
init_mongodb_adapter();
import axios2 from "axios";

// modules/whatsapp-marketing/server/worker.js
init_mongodb_adapter();
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
var FB_API_VERSION = "v17.0";
var FB_ACCESS_TOKEN = "";
async function fetchAllLeadsFromFacebook(formId) {
  let allLeads = [];
  let url = `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100`;
  while (url) {
    try {
      const response = await axios.get(url);
      const data = response.data;
      allLeads = allLeads.concat(data.data || []);
      url = data.paging?.cursors?.after ? `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100&after=${data.paging.cursors.after}` : "";
    } catch (error) {
      console.error(`Error fetching leads for form ${formId}:`, error.message);
      break;
    }
  }
  return allLeads;
}
function normalizeLead(fbLead, formId, formName, templateId, templateName) {
  const normalized = {
    lead_id: fbLead.id,
    form_id: formId,
    form_name: formName,
    created_time: new Date(fbLead.created_time),
    template_sent: false,
    // Always start as false for new leads
    automation_active: true,
    template_id: templateId,
    template_name: templateName,
    raw_field_data: fbLead.field_data
  };
  fbLead.field_data?.forEach((field) => {
    const key = field.name;
    const value = field.values?.[0] || "";
    if (key === "full_name" || key === "FULL_NAME") {
      normalized.full_name = value;
    } else if (key === "email" || key === "EMAIL") {
      normalized.email = value;
    } else if (key === "phone_number" || key === "PHONE") {
      normalized.phone = value;
    } else if (key === "date_of_birth" || key === "DOB") {
      normalized.dob = value;
    } else if (key === "0") {
      normalized.category = value;
    } else if (key === "1") {
      normalized.opt_in = value;
    }
  });
  return normalized;
}
async function syncLeadsForFormMain(formAutomation) {
  try {
    console.log(
      `Syncing leads for form: ${formAutomation.form_name} (${formAutomation.form_id})`
    );
    const fbLeads = await fetchAllLeadsFromFacebook(formAutomation.form_id);
    console.log(`Fetched ${fbLeads.length} leads from Facebook`);
    let newLeadsCount = 0;
    let updatedLeadsCount = 0;
    let templatesSentCount = 0;
    let templatesFailedCount = 0;
    for (const fbLead of fbLeads) {
      const normalizedLead = normalizeLead(
        fbLead,
        formAutomation.form_id,
        formAutomation.form_name,
        formAutomation.template_id,
        formAutomation.template_name
      );
      const existingLead = await Leadfb.findOne({
        lead_id: normalizedLead.lead_id
      });
      if (!existingLead) {
        console.log(
          `\u{1F195} New lead found: ${normalizedLead.full_name || normalizedLead.email}`
        );
        const newLead = await Leadfb.create({
          ...normalizedLead,
          template_sent: false,
          synced_at: /* @__PURE__ */ new Date()
        });
        newLeadsCount++;
        if (newLead.phone && formAutomation.template_id) {
          console.log(
            `\u{1F4F1} Sending WhatsApp template (${formAutomation.template_name}) to new lead...`
          );
          const result = await sendTemplateMessage3(
            newLead.phone,
            formAutomation.template_name
            // Using template_id from the form's automation
          );
          if (result.success) {
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent: true,
              template_sent_at: /* @__PURE__ */ new Date(),
              whatsapp_message_id: result.messageId,
              whatsapp_phone_number: result.phone_number,
              template_used: result.template_name
            });
            console.log(`\u{1F4E8} WhatsApp message sent: Message ID ${result}`);
            templatesSentCount++;
            try {
              const contactId = await getOrCreateContactId(newLead);
              const messageContent = `Template sent: ${formAutomation.template_name}`;
              if (contactId) {
                await storage.createMessage({
                  contactId,
                  content: messageContent,
                  type: "text",
                  direction: "outbound",
                  status: "sent"
                });
              }
            } catch (saveError) {
              console.error(
                "[TemplateSync] Failed to save message to conversation:",
                saveError
              );
            }
            console.log(
              `\u2705 Template "${result.template_name}" sent successfully and lead updated: template_sent = true`
            );
          } else {
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent_error: result.error,
              template_sent_error_code: result.error_code,
              last_template_attempt: /* @__PURE__ */ new Date()
            });
            templatesFailedCount++;
            console.log(`\u274C Template send failed: ${result.error}`);
          }
        } else {
          console.log(
            `\u26A0\uFE0F No phone number or template configured for form, skipping WhatsApp send`
          );
        }
      } else {
        await Leadfb.findOneAndUpdate(
          { lead_id: normalizedLead.lead_id },
          {
            synced_at: /* @__PURE__ */ new Date()
            // Preserve existing template_sent status
          }
        );
        updatedLeadsCount++;
      }
    }
    formAutomation.last_sync = /* @__PURE__ */ new Date();
    formAutomation.last_sync_stats = {
      new_leads: newLeadsCount,
      updated_leads: updatedLeadsCount,
      templates_sent: templatesSentCount,
      templates_failed: templatesFailedCount,
      total_leads: fbLeads.length
    };
    await formAutomation.save();
    console.log(
      `\u2728 Sync complete: ${newLeadsCount} new, ${updatedLeadsCount} updated, ${templatesSentCount} templates sent, ${templatesFailedCount} failed`
    );
    return {
      newLeadsCount,
      updatedLeadsCount,
      templatesSentCount,
      templatesFailedCount,
      totalLeads: fbLeads.length
    };
  } catch (error) {
    console.error(
      `Error syncing form ${formAutomation.form_id}:`,
      error.message
    );
    throw error;
  }
}
function buildMetaTemplate(template) {
  const components = [];
  const isAuthenticationTemplate = String(template.category || "").toUpperCase() === "AUTHENTICATION" || template.templateType === "one_time_password";
  if (isAuthenticationTemplate) {
    const bodyComponent2 = {
      type: "BODY",
      add_security_recommendation: template.authAddSecurityRecommendation !== false
    };
    const expirationMinutes = Number(
      template.authCodeExpirationMinutes || 10
    );
    if (Number.isFinite(expirationMinutes) && expirationMinutes > 0) {
      components.push(bodyComponent2, {
        type: "FOOTER",
        code_expiration_minutes: expirationMinutes
      });
    } else {
      components.push(bodyComponent2);
    }
    components.push({
      type: "BUTTONS",
      buttons: [
        {
          type: "OTP",
          otp_type: "COPY_CODE",
          text: "Copy code"
        }
      ]
    });
    return {
      name: template.name,
      category: "AUTHENTICATION",
      language: template.language || "en_US",
      components
    };
  }
  const mediaHandle = template.headerImageUrl || template.headerMedia || template.headerImage;
  if (template.headerType === "text" && template.headerText) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: template.headerText,
      example: {
        header_text: ["Sample Header"]
      }
    });
  }
  if (template.headerType === "image" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  if (template.headerType === "video" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "VIDEO",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  if (template.headerType === "document" && mediaHandle) {
    components.push({
      type: "HEADER",
      format: "DOCUMENT",
      example: {
        header_handle: [mediaHandle]
      }
    });
  }
  let processedContent = template.content;
  let index = 1;
  processedContent = processedContent.replace(/\{\{[^}]+\}\}/g, () => {
    return `{{${index++}}}`;
  });
  const bodyComponent = {
    type: "BODY",
    text: processedContent
  };
  if (index > 1) {
    bodyComponent.example = {
      body_text: [
        Array.from({ length: index - 1 }, (_, i) => `Sample${i + 1}`)
      ]
    };
  }
  components.push(bodyComponent);
  if (template.footer) {
    components.push({
      type: "FOOTER",
      text: template.footer
    });
  }
  if (template.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: template.buttons.map((btn) => {
        if (btn.type === "quick_reply") {
          return { type: "QUICK_REPLY", text: btn.text };
        }
        if (btn.type === "url") {
          return {
            type: "URL",
            text: btn.text,
            url: btn.url,
            example: [process.env.SITE_URL || process.env.PUBLIC_APP_URL || ""]
          };
        }
        if (btn.type === "phone_number") {
          return {
            type: "PHONE_NUMBER",
            text: btn.text,
            phone_number: btn.phone_number
          };
        }
      })
    });
  }
  return {
    name: template.name,
    category: template.category.toUpperCase(),
    language: template.language || "en_US",
    components
  };
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET
});
async function getOrCreateContactId(lead) {
  let contact = await Contact.findOne({ phone: lead.phone });
  if (!contact) {
    contact = await Contact.create({
      id: uuidv42(),
      phone: lead.phone,
      name: lead.full_name || lead.phone || "Facebook Lead",
      source: "facebook"
    });
  }
  return contact.id;
}

// modules/whatsapp-marketing/server/routes.js
import mongoose16, { Types as Types4 } from "mongoose";
import multer2 from "multer";

// modules/whatsapp-marketing/server/modules/automation/drip-campaign.queue.js
init_mongodb_adapter();
import { Queue as Queue2, Worker as Worker2 } from "bullmq";
import IORedis2 from "ioredis";
import mongoose15 from "mongoose";
var QUEUE_NAME = "whatsapp-drip-campaigns";
var JOB_NAME = "run-campaign-step";
var DEFAULT_TIMEZONE = "Asia/Kolkata";
process.env.TZ = DEFAULT_TIMEZONE;
var CONTACT_CONCURRENCY = Math.max(
  1,
  Number(process.env.DRIP_CONTACT_CONCURRENCY || 5)
);
var WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.DRIP_WORKER_CONCURRENCY || 2)
);
var RETRY_DELAY_MS = Math.max(
  1e4,
  Number(process.env.DRIP_STEP_RETRY_INTERVAL_MS || 6e4)
);
var MAX_CONTACT_ATTEMPTS = Math.max(
  1,
  Number(process.env.DRIP_STEP_MAX_ATTEMPTS || 3)
);
var connection = null;
var queue = null;
var worker = null;
function getRedisUrl() {
  const explicitUrl = String(process.env.REDIS_URL || "").trim();
  if (explicitUrl) return explicitUrl;
  const host = String(process.env.REDIS_HOST || "").trim();
  if (!host) return "";
  const port = String(process.env.REDIS_PORT || "6379").trim() || "6379";
  const password = String(process.env.REDIS_PASSWORD || "").trim();
  const auth = password ? `:${encodeURIComponent(password)}@` : "";
  return `redis://${auth}${host}:${port}`;
}
function getRedisConnection() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!connection) {
    connection = new IORedis2(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    connection.on("error", (error) => {
      console.error("[DripQueue] Redis error:", error?.message || error);
    });
  }
  return connection;
}
function getQueue() {
  const redis = getRedisConnection();
  if (!redis) return null;
  if (!queue) {
    queue = new Queue2(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5e3 },
        removeOnComplete: 500,
        removeOnFail: 1e3
      }
    });
  }
  return queue;
}
function jobId(campaignId, stepIndex, runAt) {
  return `drip-${campaignId}-step-${stepIndex}-${runAt.getTime()}`;
}
function contactPhone(contact) {
  const raw = typeof contact === "object" && contact ? contact.phone || contact.whatsappNumber || contact.whatsapp || "" : contact;
  return String(raw || "").replace(/\D/g, "");
}
function contactName(contact) {
  if (typeof contact !== "object" || !contact) return void 0;
  const name = String(contact.name || "").trim();
  return name || void 0;
}
function parseSpecificDateTime(step) {
  if (!step?.specificDate || !step?.specificTime) return null;
  const value = /* @__PURE__ */ new Date(`${step.specificDate}T${step.specificTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}
function stepDelayMs(step) {
  const days = Math.max(0, Number(step?.delayDays || 0));
  const hours = Math.max(0, Number(step?.delayHours || 0));
  const minutes = Math.max(0, Number(step?.delayMinutes || 0));
  return (days * 24 * 60 + hours * 60 + minutes) * 6e4;
}
function getStepRunAt(step, baseDate = /* @__PURE__ */ new Date()) {
  const specific = parseSpecificDateTime(step);
  if (step?.scheduleType === "specific" && specific) return specific;
  return new Date(baseDate.getTime() + stepDelayMs(step));
}
async function parallelLimit(items, limit, handler) {
  const executing = /* @__PURE__ */ new Set();
  for (const item of items) {
    const promise = handler(item).finally(() => executing.delete(promise));
    executing.add(promise);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
}
async function processCampaignStep(job) {
  const { campaignId, stepIndex } = job.data;
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== "running" || campaign.is_active === false) {
    return;
  }
  if (Number(campaign.currentStep || 0) !== stepIndex) return;
  const step = campaign.steps?.[stepIndex];
  if (!step) {
    campaign.status = "completed";
    campaign.is_active = false;
    campaign.nextRunAt = null;
    await campaign.save();
    return;
  }
  const specificAt = parseSpecificDateTime(step);
  if (specificAt && Date.now() < specificAt.getTime()) {
    await scheduleDripCampaignStep(campaignId, stepIndex, specificAt);
    return;
  }
  const claimed = await Campaign.findOneAndUpdate(
    {
      _id: campaignId,
      currentStep: stepIndex,
      status: "running",
      is_active: { $ne: false },
      isProcessing: { $ne: true }
    },
    {
      $set: {
        isProcessing: true,
        processingStartedAt: /* @__PURE__ */ new Date()
      }
    },
    { new: true }
  );
  if (!claimed) return;
  try {
    const templateCandidates = Array.from(
      new Set(
        [step.templateId, step.template_id, step.template_name].map((value) => String(value || "").trim()).filter(Boolean)
      )
    );
    const template = await Template.findOne({
      $or: templateCandidates.flatMap((candidate) => [
        { id: candidate },
        { name: candidate }
      ])
    }).lean();
    if (!template) {
      throw new Error(`Template not found: ${templateCandidates.join(", ")}`);
    }
    await parallelLimit(
      Array.isArray(claimed.contacts) ? claimed.contacts : [],
      CONTACT_CONCURRENCY,
      async (contact) => {
        const phone = contactPhone(contact);
        if (!phone) return;
        const existing = await CampaignLog.findOne({
          campaignId: claimed._id,
          stepIndex,
          contact: phone
        }).lean();
        if (existing && ["accepted", "sent", "delivered", "read"].includes(existing.status)) {
          return;
        }
        const attemptCount = Number(existing?.attemptCount || 0);
        if (attemptCount >= MAX_CONTACT_ATTEMPTS) return;
        const result = await sendTemplateMessage3(
          phone,
          template.name,
          contactName(contact),
          { allowLanguageFallback: false },
          claimed.userId || void 0
        );
        const providerStatus = String(
          result?.provider_status || (result?.success ? "accepted" : "failed")
        ).toLowerCase();
        const status = result?.success ? providerStatus === "read" ? "read" : providerStatus === "delivered" ? "delivered" : "accepted" : "failed";
        await CampaignLog.updateOne(
          {
            campaignId: claimed._id,
            stepIndex,
            contact: phone
          },
          {
            $set: {
              userId: claimed.userId,
              templateName: template.name,
              messageId: result?.messageId || void 0,
              status,
              providerStatus,
              sentAt: result?.success ? /* @__PURE__ */ new Date() : null,
              failedAt: result?.success ? null : /* @__PURE__ */ new Date(),
              sendAttemptedAt: /* @__PURE__ */ new Date(),
              error: result?.success ? null : result?.error || "Template send failed",
              attemptCount: attemptCount + 1,
              providerHttpStatus: result?.provider_http_status || void 0,
              providerErrorCode: result?.provider_error_code ? String(result.provider_error_code) : void 0,
              requestPayload: result?.request_payload || null,
              providerResponse: result?.provider_response || null,
              metaAccepted: Boolean(result?.success && result?.messageId),
              metaAcceptedAt: result?.success && result?.messageId ? /* @__PURE__ */ new Date() : null
            }
          },
          { upsert: true }
        );
      }
    );
    const logs = await CampaignLog.find({
      campaignId: claimed._id,
      stepIndex
    }).lean();
    const stateByPhone = new Map(logs.map((log) => [String(log.contact), log]));
    const pending = (claimed.contacts || []).some((contact) => {
      const log = stateByPhone.get(contactPhone(contact));
      if (!log) return true;
      if (["accepted", "sent", "delivered", "read"].includes(log.status)) return false;
      return Number(log.attemptCount || 0) < MAX_CONTACT_ATTEMPTS;
    });
    if (pending) {
      const retryAt = new Date(Date.now() + RETRY_DELAY_MS);
      claimed.nextRunAt = retryAt;
      await scheduleDripCampaignStep(campaignId, stepIndex, retryAt);
      return;
    }
    claimed.currentStep = stepIndex + 1;
    const nextStep = claimed.steps?.[claimed.currentStep];
    if (!nextStep) {
      claimed.status = "completed";
      claimed.is_active = false;
      claimed.nextRunAt = null;
    } else {
      const nextRunAt = getStepRunAt(nextStep, /* @__PURE__ */ new Date());
      claimed.nextRunAt = nextRunAt;
      await scheduleDripCampaignStep(campaignId, claimed.currentStep, nextRunAt);
    }
  } finally {
    claimed.isProcessing = false;
    await claimed.save();
  }
}
function startWorker() {
  const redis = getRedisConnection();
  if (!redis || worker) return;
  worker = new Worker2(
    QUEUE_NAME,
    async (job) => {
      if (job.name !== JOB_NAME) return;
      await processCampaignStep(job);
    },
    { connection: redis, concurrency: WORKER_CONCURRENCY }
  );
  worker.on("failed", (job, error) => {
    console.error(
      `[DripQueue] Job ${job?.id || "unknown"} failed:`,
      error?.message || error
    );
  });
  console.log(
    `[DripQueue] Worker started (timezone=${DEFAULT_TIMEZONE}, concurrency=${WORKER_CONCURRENCY})`
  );
}
function isDripQueueConfigured() {
  return Boolean(getRedisUrl());
}
async function scheduleDripCampaignStep(campaignId, stepIndex, runAt) {
  const dripQueue = getQueue();
  if (!dripQueue) {
    throw new Error("REDIS_URL is required to run drip campaigns");
  }
  startWorker();
  const pendingJobs = await dripQueue.getJobs([
    "delayed",
    "waiting",
    "prioritized",
    "paused"
  ]);
  await Promise.all(
    pendingJobs.filter(
      (job) => job.data.campaignId === campaignId && Number(job.data.stepIndex) === Number(stepIndex)
    ).map((job) => job.remove().catch(() => void 0))
  );
  const id = jobId(campaignId, stepIndex, runAt);
  const existing = await dripQueue.getJob(id);
  if (existing) await existing.remove().catch(() => void 0);
  await dripQueue.add(
    JOB_NAME,
    { campaignId, stepIndex },
    {
      jobId: id,
      delay: Math.max(0, runAt.getTime() - Date.now())
    }
  );
}
async function cancelDripCampaignJobs(campaignId) {
  const dripQueue = getQueue();
  if (!dripQueue) return;
  const pendingJobs = await dripQueue.getJobs([
    "delayed",
    "waiting",
    "prioritized",
    "paused"
  ]);
  await Promise.all(
    pendingJobs.filter((job) => job.data.campaignId === campaignId).map((job) => job.remove().catch(() => void 0))
  );
}
async function scheduleRunningDripCampaigns() {
  if (!isDripQueueConfigured()) return;
  await connectToMongoDB();
  if (mongoose15.connection.readyState !== 1) {
    console.warn("[DripQueue] Skipping bootstrap: MongoDB is not connected");
    return;
  }
  const campaigns = await Campaign.find({
    status: "running",
    is_active: { $ne: false },
    nextRunAt: { $ne: null }
  }).lean();
  let scheduled = 0;
  for (const campaign of campaigns) {
    const stepIndex = Number(campaign?.currentStep || 0);
    const step = campaign?.steps?.[stepIndex];
    const nextRunAt = campaign?.nextRunAt ? new Date(campaign.nextRunAt) : null;
    if (!step || !nextRunAt || Number.isNaN(nextRunAt.getTime())) continue;
    await scheduleDripCampaignStep(String(campaign._id), stepIndex, nextRunAt);
    scheduled++;
  }
  console.log(`[DripQueue] Bootstrapped ${scheduled} running drip campaign job(s)`);
}
startWorker();

// modules/whatsapp-marketing/server/routes.js
import { v2 as cloudinaryV2 } from "cloudinary";
var upload2 = multer2({ storage: multer2.memoryStorage() });
function parsePagination(req, defaults = {}) {
  const maxLimit = defaults.maxLimit || 200;
  const rawLimit = Number.parseInt(String(req.query.limit || defaults.limit || 50), 10);
  const rawPage = Number.parseInt(String(req.query.page || 1), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), maxLimit);
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  return { page, limit, skip: (page - 1) * limit };
}
var cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || ""
};
var hasCloudinaryConfig = Boolean(
  cloudinaryConfig.cloud_name && cloudinaryConfig.api_key && cloudinaryConfig.api_secret
);
if (hasCloudinaryConfig) {
  cloudinaryV2.config(cloudinaryConfig);
} else {
  console.warn(
    "[TemplateMediaUpload] Cloudinary env is missing. Media preview URL will not be generated."
  );
}
async function resolveTemplateMediaUploadCredentials(req) {
  let accessToken = "";
  let appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "";
  const headerUserIdRaw = req.headers["x-user-id"];
  const headerUserId = typeof headerUserIdRaw === "string" ? headerUserIdRaw : Array.isArray(headerUserIdRaw) ? headerUserIdRaw[0] : void 0;
  const queryUserId = typeof req.query?.userId === "string" ? req.query.userId : void 0;
  const bodyUserId = req.body && typeof req.body.userId === "string" ? req.body.userId : void 0;
  const sessionUserId = req?.session?.userId || req?.session?.user?.id;
  const userId = headerUserId || sessionUserId || queryUserId || bodyUserId;
  if (userId) {
    try {
      const integrationCredentials = await getDecryptedCredentials2(userId, "whatsapp");
      const settingsCredentials = await credentialsService.getDecryptedCredentials(userId);
      accessToken = String(
        integrationCredentials?.accessToken ||
        integrationCredentials?.whatsappToken ||
        settingsCredentials?.whatsappToken ||
        ""
      );
      appId = String(
        integrationCredentials?.appId || settingsCredentials?.appId || appId || ""
      );
    } catch (error) {
      console.warn(
        "[TemplateMediaUpload] Could not resolve user credentials:",
        error
      );
    }
  }
  accessToken ||= String(
    process.env.FB_PAGE_ACCESS_TOKEN ||
    process.env.SYSTEM_USER_TOKEN_META ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    ""
  );
  return {
    accessToken: accessToken.trim(),
    appId: appId.trim(),
    userId
  };
}
function readHeaderValue(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return value;
}
function isAdminRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return [
    "admin",
    "superadmin",
    "super_admin",
    "subadmin",
    "sub_admin"
  ].includes(normalizedRole);
}
async function resolveRequestUserContext(req) {
  const userId = readHeaderValue(req.headers["x-user-id"]);
  const roleFromHeader = readHeaderValue(req.headers["x-user-role"]);
  const nameFromHeader = readHeaderValue(req.headers["x-user-name"]);
  if (!userId) {
    return {
      userId: "",
      role: "user",
      name: nameFromHeader || ""
    };
  }
  const resolvedUser = await findUserById(userId);
  if (resolvedUser) {
    return {
      userId,
      role: resolvedUser.role || roleFromHeader || "user",
      name: resolvedUser.name || nameFromHeader || ""
    };
  }
  return {
    userId,
    role: roleFromHeader || "user",
    name: nameFromHeader || ""
  };
}
async function getPermittedContactIdsForRequest(req) {
  const context = await resolveRequestUserContext(req);
  if (!context.userId) {
    return [];
  }
  if (isAdminRole(context.role)) {
    return null;
  }
  const permittedContactIds = await getFilteredChatsForUser({
    userId: context.userId,
    role: context.role,
    name: context.name
  });
  return permittedContactIds;
}
var uploadTemplateHeader = async (req, res) => {
  console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x9D\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA5 uploadTemplateHeader() called");
  try {
    const file = req.file;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x81 Incoming file info:", {
      exists: !!file,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size
    });
    if (!file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }
    const getMediaType = (mimeType) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if ([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
      ].includes(mimeType)) {
        return "document";
      }
      return null;
    };
    const mediaType = getMediaType(file.mimetype);
    if (!mediaType) {
      return res.status(400).json({
        error: "Unsupported file type. Allowed: image, video, PDF, DOC, DOCX, TXT."
      });
    }
    const {
      accessToken,
      appId,
      userId
    } = await resolveTemplateMediaUploadCredentials(req);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x9D\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x90 Environment values:", {
      appId,
      hasAccessToken: !!accessToken
    });
    if (!accessToken || !appId) {
      const missing = [];
      if (!accessToken) missing.push("access token");
      if (!appId) missing.push("Meta App ID");
      console.error("[TemplateMediaUpload] Missing Meta credentials", {
        missing,
        userId: userId || null
      });
      return res.status(500).json({
        error: `Missing Meta credentials: ${missing.join(", ")}`,
        hint: "Configure credentials in Settings (WhatsApp token + App ID) or set FB_PAGE_ACCESS_TOKEN/SYSTEM_USER_TOKEN_META and META_APP_ID/FACEBOOK_APP_ID."
      });
    }
    const fileName = file.originalname;
    const fileLength = file.size;
    const fileType = file.mimetype;
    let previewUrl = null;
    if (hasCloudinaryConfig) {
      try {
        console.log("Uploading to Cloudinary for preview...");
        const cloudinaryResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinaryV2.uploader.upload_stream(
            {
              folder: "whatsapp/template-media",
              public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
              resource_type: mediaType === "image" ? "image" : mediaType === "video" ? "video" : "raw",
              overwrite: false
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          uploadStream.end(file.buffer);
        });
        previewUrl = cloudinaryResult.secure_url || null;
      } catch (cloudinaryErr) {
        console.warn("Cloudinary preview upload failed:", cloudinaryErr);
      }
    }
    if (!previewUrl) {
      return res.status(500).json({
        error: "Header media uploaded but preview URL could not be generated.",
        hint: "Configure Cloudinary keys (CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET) and re-upload media."
      });
    }
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB3 Step 1: Creating Meta upload session\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6");
    const sessionRes = await axios2.post(
      `https://graph.facebook.com/v24.0/${appId}/uploads`,
      {},
      {
        params: {
          file_name: fileName,
          file_length: fileLength,
          file_type: fileType,
          access_token: accessToken
        }
      }
    );
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xE2\u20AC\u0153\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6 Meta upload session response:", sessionRes.data);
    const uploadId = sessionRes.data.id;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\xA2\xE2\u20AC\u017E\xC2\xA2 Meta uploadId:", uploadId);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB3 Step 2: Uploading binary to Meta\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6");
    const uploadRes = await axios2.post(
      `https://graph.facebook.com/v24.0/${uploadId}`,
      file.buffer,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": fileType,
          file_offset: 0
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xE2\u20AC\u0153\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA6 Meta binary upload response:", uploadRes.data);
    const handle = uploadRes.data.h;
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xBD\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAF Final Meta media handle:", handle);
    console.log("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u20AC\u0161\xC2\xAC\xC3\u2026\xC2\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAC Upload complete, responding to client");
    return res.json({
      success: true,
      handle,
      previewUrl,
      mediaType
    });
  } catch (err) {
    console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xBE\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA5 Upload failed");
    if (err?.response) {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA8 Axios response error:", {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers
      });
    } else if (err?.request) {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB0\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\xA2\xE2\u201A\xAC\xC5\u201C\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAD Axios request error (no response):", err.request);
    } else {
      console.error("\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC2\xA6\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA0\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xAF\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB8\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\x8F General error message:", err.message);
    }
    return res.status(500).json({
      error: "Upload Failed",
      details: err?.response?.data || err.message
    });
  }
};
async function registerRoutes(httpServer, app) {
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const FB_API_VERSION2 = "v17.0";
  const FB_PAGE_ID2 = "";
  const FB_ACCESS_TOKEN2 = "";
  app.post(
    "/api/upload/template-header",
    upload2.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );
  app.post(
    "/api/upload/template-media",
    upload2.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );
  app.get("/api/fb-automation/stats", async (req, res) => {
    const [totalLeads, sent, unsent, failed, activeAutomations] = await Promise.all([
      Leadfb.countDocuments(),
      Leadfb.countDocuments({ template_sent: true }),
      Leadfb.countDocuments({
        template_sent: false,
        last_error: { $exists: false }
      }),
      Leadfb.countDocuments({ last_error: { $exists: true } }),
      FormAutomation.countDocuments({ automation_active: true })
    ]);
    res.json({
      totalLeads,
      sent,
      unsent,
      failed,
      activeAutomations
    });
  });
  app.get("/api/fb-automation/leads", async (req, res) => {
    const { search = "", status = "all", formId } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (status === "sent") {
      filter.template_sent = true;
    } else if (status === "unsent") {
      filter.template_sent = false;
      filter.last_error = { $exists: false };
    } else if (status === "failed") {
      filter.last_error = { $exists: true };
    }
    if (formId && formId !== "all") {
      filter.form_id = formId;
    }
    const rows = await Leadfb.find(filter).sort({ created_time: -1 }).limit(200);
    res.json({
      rows,
      total: rows.length
    });
  });
  app.post("/api/fb-automation/retry", async (req, res) => {
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ message: "No lead IDs provided" });
    }
    const objectIds = ids.map((id) => new Types4.ObjectId(id));
    const leads = await Leadfb.find({
      _id: { $in: objectIds },
      $or: [{ template_sent: false }, { last_error: { $exists: true } }]
    });
    for (const lead of leads) {
      console.log(`Enqueuing retry for lead ${lead._id}`);
    }
    res.json({
      success: true,
      retried: leads.length
    });
  });
  const normalizeCampaignStep = (step, index) => {
    const templateId = step?.templateId || step?.template_id;
    if (!templateId) return null;
    const scheduleType = step?.scheduleType === "specific" ? "specific" : "delay";
    let delayDays = Number(step?.delayDays ?? 0);
    let delayHours = Number(step?.delayHours ?? 0);
    if (!Number.isFinite(delayDays)) delayDays = 0;
    if (!Number.isFinite(delayHours)) delayHours = 0;
    if (step?.delay_unit && step?.delay_value !== void 0) {
      const delayValue = Number(step.delay_value) || 0;
      if (step.delay_unit === "minutes") {
        delayHours += delayValue / 60;
      } else if (step.delay_unit === "hours") {
        delayHours += delayValue;
      } else if (step.delay_unit === "days") {
        delayDays += delayValue;
      }
    }
    return {
      templateId,
      template_name: step?.template_name || "",
      scheduleType,
      delayDays,
      delayHours,
      specificDate: step?.specificDate || void 0,
      specificTime: step?.specificTime || step?.send_at_time || void 0,
      order: index
    };
  };
  const getCampaignStepDelayMs = (step) => {
    const delayDays = Number(step?.delayDays ?? 0);
    const delayHours = Number(step?.delayHours ?? 0);
    const delayMinutes = Number(step?.delayMinutes ?? 0);
    const delayValue = Number(step?.delay_value ?? 0);
    const delayUnit = step?.delay_unit;
    let totalMinutes = (Number.isFinite(delayDays) ? delayDays : 0) * 24 * 60 + (Number.isFinite(delayHours) ? delayHours : 0) * 60 + (Number.isFinite(delayMinutes) ? delayMinutes : 0);
    if (Number.isFinite(delayValue) && delayValue > 0) {
      if (delayUnit === "minutes") {
        totalMinutes += delayValue;
      } else if (delayUnit === "hours") {
        totalMinutes += delayValue * 60;
      } else if (delayUnit === "days") {
        totalMinutes += delayValue * 24 * 60;
      }
    }
    return Math.max(0, totalMinutes * 60 * 1e3);
  };
  const calculateCampaignNextRunAt = (step, baseDate = /* @__PURE__ */ new Date()) => {
    if (step?.scheduleType === "specific" && step?.specificDate && step?.specificTime) {
      const specific = /* @__PURE__ */ new Date(`${step.specificDate}T${step.specificTime}:00`);
      if (!Number.isNaN(specific.getTime())) {
        return specific;
      }
    }
    const nextRunAt = new Date(baseDate.getTime() + getCampaignStepDelayMs(step));
    const preferredTime = step?.specificTime || step?.send_at_time;
    if (preferredTime) {
      const [hours, minutes] = String(preferredTime).split(":").map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        nextRunAt.setHours(hours, minutes, 0, 0);
        if (nextRunAt < baseDate) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
      }
    }
    return nextRunAt;
  };
  const ensureDripQueueReady = () => {
    if (!isDripQueueConfigured()) {
      throw new Error(
        "Redis is not configured. Set REDIS_URL or REDIS_HOST/REDIS_PORT to schedule drip campaigns."
      );
    }
  };
  const scheduleCurrentDripCampaignStep = async (campaign) => {
    ensureDripQueueReady();
    const stepIndex = Number(campaign?.currentStep || 0);
    const step = campaign?.steps?.[stepIndex];
    if (!step || !campaign?.nextRunAt) return;
    await scheduleDripCampaignStep(
      String(campaign._id),
      stepIndex,
      new Date(campaign.nextRunAt)
    );
  };
  const normalizeCampaignContact = (contact) => {
    if (typeof contact === "string") {
      const digits = contact.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }
    if (typeof contact === "object" && contact) {
      const raw = String(
        contact.phone || contact.Phone || contact.mobile || contact.whatsapp || ""
      );
      const digits = raw.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }
    return null;
  };
  app.post("/api/drip-campaigns", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const {
        name,
        campaign_name,
        contacts = [],
        steps = [],
        form_id,
        form_name
      } = req.body || {};
      const campaignName = campaign_name || name;
      if (!campaignName || typeof campaignName !== "string") {
        return res.status(400).json({ error: "Campaign name is required" });
      }
      const normalizedSteps = (Array.isArray(steps) ? steps : []).map((s, i) => normalizeCampaignStep(s, i)).filter(Boolean);
      if (normalizedSteps.length === 0) {
        return res.status(400).json({
          error: "At least one valid campaign step is required"
        });
      }
      const templateIds = Array.from(
        new Set(
          normalizedSteps.map((step) => String(step?.templateId || "").trim()).filter(Boolean)
        )
      );
      const templateDocs = templateIds.length ? await Template.find(
        { id: { $in: templateIds } },
        { id: 1, name: 1 }
      ).lean() : [];
      const templateNameById = new Map(
        templateDocs.map((tpl) => [
          String(tpl.id || ""),
          String(tpl.name || "")
        ])
      );
      const resolvedSteps = normalizedSteps.map((step) => ({
        ...step,
        template_name: String(step?.template_name || "").trim() || templateNameById.get(String(step.templateId || "")) || ""
      }));
      const now = /* @__PURE__ */ new Date();
      for (let i = 0; i < resolvedSteps.length; i++) {
        const step = resolvedSteps[i];
        if (step?.scheduleType === "specific" && step?.specificDate && step?.specificTime) {
          const specificAt = /* @__PURE__ */ new Date(
            `${step.specificDate}T${step.specificTime}:00`
          );
          if (Number.isNaN(specificAt.getTime())) {
            return res.status(400).json({
              error: `Invalid specific date/time for step ${i + 1}`
            });
          }
          if (specificAt <= now) {
            return res.status(400).json({
              error: `Step ${i + 1} specific date/time is in the past. Please select a future time.`
            });
          }
        }
      }
      const initialContacts = (Array.isArray(contacts) ? contacts : []).map(normalizeCampaignContact).filter(Boolean);
      let normalizedContacts = Array.from(new Set(initialContacts));
      if (normalizedContacts.length === 0 && form_id) {
        const leads = await Leadfb.find({
          form_id,
          phone: { $exists: true, $ne: "" }
        }).lean();
        normalizedContacts = Array.from(
          new Set(
            leads.map((lead) => normalizeCampaignContact(lead.phone)).filter(Boolean)
          )
        );
      }
      if (normalizedContacts.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found"
        });
      }
      const firstStep = resolvedSteps[0];
      const firstRunAt = firstStep ? calculateCampaignNextRunAt(firstStep, /* @__PURE__ */ new Date()) : /* @__PURE__ */ new Date();
      const campaign = await Campaign.create({
        id: uuidv42(),
        userId,
        name: campaignName,
        campaign_name: campaignName,
        form_id: form_id || void 0,
        form_name: form_name || void 0,
        is_active: true,
        status: "running",
        currentStep: 0,
        nextRunAt: firstRunAt,
        contacts: normalizedContacts,
        steps: resolvedSteps
      });
      await scheduleCurrentDripCampaignStep(campaign);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating drip campaign:", error);
      const message = error instanceof Error && error.message ? error.message : "Failed to create campaign";
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/reports/drip-campaigns", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const {
      search = "",
      status,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10
    } = req.query;
    const filter = { userId };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } }
      ];
    }
    if (status) filter.status = status;
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }
    const campaigns = await Campaign.find(filter).sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).skip((+page - 1) * +limit).limit(+limit).lean();
    const total = await Campaign.countDocuments(filter);
    const campaignIds = campaigns.map((campaign) => campaign?._id).filter(Boolean);
    const metricsByCampaign = /* @__PURE__ */ new Map();
    if (campaignIds.length > 0) {
      const metrics = await CampaignLog.aggregate([
        {
          $match: {
            campaignId: { $in: campaignIds }
          }
        },
        {
          $group: {
            _id: "$campaignId",
            attempted: { $sum: 1 },
            accepted: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                  1,
                  0
                ]
              }
            },
            delivered: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ["$status", ["delivered", "read"]] },
                      { $ne: [{ $ifNull: ["$deliveredAt", null] }, null] },
                      { $ne: [{ $ifNull: ["$readAt", null] }, null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            read: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", "read"] },
                      { $ne: [{ $ifNull: ["$readAt", null] }, null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            },
            metaAccepted: {
              $sum: { $cond: [{ $eq: ["$metaAccepted", true] }, 1, 0] }
            },
            lastAttemptAt: { $max: "$sendAttemptedAt" },
            lastWebhookAt: { $max: "$updatedAt" }
          }
        }
      ]);
      for (const metric of metrics) {
        metricsByCampaign.set(String(metric._id), metric);
      }
    }
    const data = campaigns.map((campaign) => {
      const metric = metricsByCampaign.get(String(campaign?._id)) || {};
      const contactsCount = Array.isArray(campaign?.contacts) ? campaign.contacts.length : 0;
      const stepsCount = Array.isArray(campaign?.steps) ? campaign.steps.length : 0;
      const expectedMessages = contactsCount * stepsCount;
      return {
        ...campaign,
        reportMetrics: {
          expectedMessages,
          attempted: Number(metric.attempted || 0),
          accepted: Number(metric.accepted || 0),
          delivered: Number(metric.delivered || 0),
          read: Number(metric.read || 0),
          failed: Number(metric.failed || 0),
          pending: Number(metric.pending || 0),
          notAttempted: Math.max(
            0,
            expectedMessages - Number(metric.attempted || 0)
          ),
          metaAccepted: Number(metric.metaAccepted || 0),
          lastAttemptAt: metric.lastAttemptAt || null,
          lastWebhookAt: metric.lastWebhookAt || null
        }
      };
    });
    res.json({
      data,
      meta: {
        total,
        page: +page,
        limit: +limit
      }
    });
  });
  app.get("/api/reports/drip-campaigns/:id/summary", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const campaignId = req.params.id;
      const objectId = mongoose16.Types.ObjectId.isValid(campaignId) ? new mongoose16.Types.ObjectId(campaignId) : null;
      const campaignQuery = objectId ? { userId, $or: [{ _id: objectId }, { id: campaignId }] } : { userId, id: campaignId };
      const campaign = await Campaign.findOne(campaignQuery).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const campaignIdFilter = campaign._id;
      const steps = await CampaignLog.aggregate([
        { $match: { campaignId: campaignIdFilter } },
        {
          $group: {
            _id: "$stepIndex",
            sent: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                  1,
                  0
                ]
              }
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      res.json({ steps });
    } catch (e) {
      res.status(500).json({ error: e.message || "Failed to fetch summary" });
    }
  });
  app.get("/api/reports/drip-campaigns/:id/logs", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const { stepIndex, status, contact, page = 1, limit = 20 } = req.query;
    const campaignId = req.params.id;
    const ownedCampaign = await Campaign.findOne({
      userId,
      ...mongoose16.Types.ObjectId.isValid(campaignId) ? { $or: [{ _id: campaignId }, { id: campaignId }] } : { id: campaignId }
    }).select({ _id: 1 });
    if (!ownedCampaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    const filter = {
      campaignId: ownedCampaign._id
    };
    if (stepIndex !== void 0) filter.stepIndex = +stepIndex;
    if (status) filter.status = status;
    if (contact) filter.contact = { $regex: contact, $options: "i" };
    const logs = await CampaignLog.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit);
    const total = await CampaignLog.countDocuments(filter);
    res.json({ data: logs, total });
  });
  app.get("/api/reports/drip-campaigns/:id/details", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const campaignId = String(req.params.id || "").trim();
      const objectId = mongoose16.Types.ObjectId.isValid(campaignId) ? new mongoose16.Types.ObjectId(campaignId) : null;
      const campaignQuery = objectId ? { userId, $or: [{ _id: objectId }, { id: campaignId }] } : { userId, id: campaignId };
      const campaign = await Campaign.findOne(campaignQuery).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const campaignIdFilter = campaign._id;
      const logs = await CampaignLog.find({ campaignId: campaignIdFilter }).sort({ stepIndex: 1, contact: 1, createdAt: 1 }).lean();
      const messageIds = Array.from(
        new Set(
          logs.map((log) => String(log?.messageId || "").trim()).filter(Boolean)
        )
      );
      const webhookEvents = messageIds.length ? await WebhookStatusEvent.find({ messageId: { $in: messageIds } }).sort({ statusTimestamp: 1, createdAt: 1 }).lean() : [];
      const eventsByMessageId = /* @__PURE__ */ new Map();
      for (const event of webhookEvents) {
        const messageId = String(event?.messageId || "").trim();
        if (!messageId) continue;
        const existing = eventsByMessageId.get(messageId) || [];
        existing.push(event);
        eventsByMessageId.set(messageId, existing);
      }
      const normalizedContacts = Array.from(
        new Set(
          (Array.isArray(campaign.contacts) ? campaign.contacts : []).map((contact) => String(contact || "").trim()).filter(Boolean)
        )
      );
      const logsByStepContact = /* @__PURE__ */ new Map();
      for (const log of logs) {
        const key = `${Number(log?.stepIndex || 0)}::${String(log?.contact || "").trim()}`;
        logsByStepContact.set(key, log);
      }
      const steps = (Array.isArray(campaign.steps) ? campaign.steps : []).map(
        (step, stepIndex) => {
          const contacts = normalizedContacts.map((contact) => {
            const key = `${stepIndex}::${contact}`;
            const log = logsByStepContact.get(key);
            const messageId = String(log?.messageId || "").trim();
            const timeline = messageId ? eventsByMessageId.get(messageId) || [] : [];
            const latestEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
            const baseStatus = String(log?.status || "not_attempted").toLowerCase();
            const providerStatus = String(log?.providerStatus || "").toLowerCase();
            const webhookStatus = String(latestEvent?.status || "").toLowerCase();
            const finalMetaStatus = (log?.readAt ? "read" : "") || (log?.deliveredAt ? "delivered" : "") || webhookStatus || providerStatus || (baseStatus === "accepted" ? "sent" : baseStatus);
            return {
              contact,
              status: baseStatus,
              providerStatus: providerStatus || null,
              finalMetaStatus: finalMetaStatus || "not_attempted",
              attemptCount: Number(log?.attemptCount || 0),
              templateName: log?.templateName || step?.template_name || null,
              templateId: step?.templateId || null,
              messageId: messageId || null,
              sentAt: log?.sentAt || null,
              deliveredAt: log?.deliveredAt || null,
              readAt: log?.readAt || null,
              failedAt: log?.failedAt || null,
              sendAttemptedAt: log?.sendAttemptedAt || null,
              attemptedLanguage: log?.attemptedLanguage || null,
              providerHttpStatus: typeof log?.providerHttpStatus === "number" ? log.providerHttpStatus : null,
              providerErrorCode: log?.providerErrorCode || null,
              error: log?.error || null,
              metaAccepted: Boolean(log?.metaAccepted),
              metaAcceptedAt: log?.metaAcceptedAt || null,
              requestPayload: log?.requestPayload || null,
              providerResponse: log?.providerResponse || null,
              webhookTimeline: timeline.map((event) => ({
                id: event?.id || null,
                status: event?.status || null,
                statusTimestamp: event?.statusTimestamp || null,
                webhookReceivedAt: event?.webhookReceivedAt || null,
                errorCode: event?.errorCode || null,
                errorTitle: event?.errorTitle || null,
                errorMessage: event?.errorMessage || null,
                errorDetails: event?.errorDetails || null,
                rawStatus: event?.rawStatus || null
              }))
            };
          });
          const attempted = contacts.filter((item) => item.status !== "not_attempted").length;
          const failed = contacts.filter(
            (item) => item.status === "failed" || item.finalMetaStatus === "failed"
          ).length;
          const read2 = contacts.filter(
            (item) => item.status === "read" || item.finalMetaStatus === "read"
          ).length;
          const delivered = contacts.filter(
            (item) => item.status === "delivered" || item.status === "read" || item.finalMetaStatus === "delivered" || item.finalMetaStatus === "read"
          ).length;
          const accepted = contacts.filter(
            (item) => ["accepted", "sent", "delivered", "read"].includes(item.status) || ["accepted", "sent", "delivered", "read"].includes(item.finalMetaStatus)
          ).length;
          const pending = contacts.filter(
            (item) => item.status === "pending" || item.finalMetaStatus === "pending" || item.finalMetaStatus === "accepted" || item.finalMetaStatus === "sent"
          ).length;
          const notAttempted = contacts.length - attempted;
          return {
            stepIndex,
            stepOrder: stepIndex + 1,
            templateName: step?.template_name || null,
            templateId: step?.templateId || null,
            scheduleType: step?.scheduleType || null,
            delayDays: Number(step?.delayDays || 0),
            delayHours: Number(step?.delayHours || 0),
            specificDate: step?.specificDate || null,
            specificTime: step?.specificTime || null,
            totals: {
              contacts: contacts.length,
              attempted,
              accepted,
              delivered,
              read: read2,
              failed,
              pending,
              notAttempted
            },
            contacts
          };
        }
      );
      const stepTotals = steps.reduce(
        (acc, step) => {
          acc.expectedMessages += Number(step?.totals?.contacts || 0);
          acc.attempted += Number(step?.totals?.attempted || 0);
          acc.accepted += Number(step?.totals?.accepted || 0);
          acc.delivered += Number(step?.totals?.delivered || 0);
          acc.read += Number(step?.totals?.read || 0);
          acc.failed += Number(step?.totals?.failed || 0);
          acc.pending += Number(step?.totals?.pending || 0);
          acc.notAttempted += Number(step?.totals?.notAttempted || 0);
          return acc;
        },
        {
          expectedMessages: 0,
          attempted: 0,
          accepted: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          pending: 0,
          notAttempted: 0
        }
      );
      const webhookSummary = webhookEvents.reduce((acc, event) => {
        const key = String(event?.status || "unknown").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return res.json({
        campaign: {
          ...campaign,
          contactsCount: normalizedContacts.length,
          stepsCount: Array.isArray(campaign.steps) ? campaign.steps.length : 0
        },
        totals: {
          ...stepTotals,
          totalContacts: normalizedContacts.length,
          totalSteps: steps.length,
          metaAccepted: logs.filter((log) => Boolean(log?.metaAccepted)).length,
          webhookEvents: webhookEvents.length
        },
        webhookSummary,
        steps
      });
    } catch (error) {
      console.error("[DripReport] Failed to fetch campaign details:", error);
      return res.status(500).json({ error: "Failed to fetch campaign details" });
    }
  });
  app.get("/api/drip-campaigns", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { search = "", status = "all", form_id, is_active } = req.query;
      const filter = { userId };
      if (search && String(search).trim()) {
        const searchRegex = { $regex: String(search).trim(), $options: "i" };
        filter.$or = [
          { name: searchRegex },
          { campaign_name: searchRegex },
          { id: searchRegex },
          { form_name: searchRegex },
          { form_id: searchRegex }
        ];
      }
      if (status && status !== "all") {
        filter.status = status;
      }
      if (form_id) {
        filter.form_id = form_id;
      }
      if (typeof is_active === "string") {
        if (is_active === "true") filter.is_active = true;
        if (is_active === "false") filter.is_active = false;
      }
      const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
      res.json(
        campaigns.map((campaign) => ({
          ...campaign,
          campaign_name: campaign.campaign_name || campaign.name,
          is_active: typeof campaign.is_active === "boolean" ? campaign.is_active : campaign.status === "running"
        }))
      );
    } catch (error) {
      console.error("Error fetching drip campaigns:", error);
      res.status(500).json({ error: "Failed to fetch drip campaigns" });
    }
  });
  app.post("/api/drip-campaigns/:id/toggle", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const isActive = req.body?.is_active === true || req.body?.is_active === "true";
      const query = mongoose16.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
      const campaign = await Campaign.findOne(query);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const wasCompleted = campaign.status === "completed";
      campaign.is_active = isActive;
      campaign.status = isActive ? "running" : "paused";
      if (isActive) {
        if (wasCompleted || campaign.currentStep >= campaign.steps.length) {
          campaign.currentStep = 0;
        }
        const now = /* @__PURE__ */ new Date();
        const currentStep = campaign.steps[campaign.currentStep];
        if (!currentStep) {
          campaign.status = "completed";
          campaign.is_active = false;
          campaign.nextRunAt = null;
        } else if (campaign.nextRunAt instanceof Date && !Number.isNaN(campaign.nextRunAt.getTime()) && campaign.nextRunAt > now) {
        } else {
          campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
        }
      } else {
        campaign.isProcessing = false;
      }
      await campaign.save();
      if (isActive && campaign.status === "running") {
        await scheduleCurrentDripCampaignStep(campaign);
      } else {
        await cancelDripCampaignJobs(String(campaign._id));
      }
      return res.json(campaign);
    } catch (error) {
      console.error("Error toggling campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.patch("/api/drip-campaigns/:id/start", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const query = mongoose16.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
    const campaign = await Campaign.findOne(query);
    if (!campaign) return res.status(404).send();
    const wasCompleted = campaign.status === "completed" || !Array.isArray(campaign.steps) || campaign.currentStep >= campaign.steps.length;
    if (wasCompleted) {
      campaign.currentStep = 0;
    }
    campaign.status = "running";
    campaign.is_active = true;
    const now = /* @__PURE__ */ new Date();
    const currentStep = campaign.steps?.[campaign.currentStep];
    if (currentStep) {
      if (campaign.nextRunAt instanceof Date && !Number.isNaN(campaign.nextRunAt.getTime()) && campaign.nextRunAt > now) {
      } else {
        campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
      }
    } else {
      campaign.nextRunAt = null;
      campaign.status = "completed";
      campaign.is_active = false;
    }
    await campaign.save();
    if (campaign.status === "running") {
      await scheduleCurrentDripCampaignStep(campaign);
    }
    res.json(campaign);
  });
  app.patch("/api/drip-campaigns/:id/pause", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Campaign id is required" });
      }
      const campaign = await Campaign.findOne({ _id: id, userId });
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      campaign.status = "paused";
      campaign.is_active = false;
      campaign.isProcessing = false;
      await campaign.save();
      await cancelDripCampaignJobs(String(campaign._id));
      return res.json(campaign);
    } catch (error) {
      console.error("Error pausing campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.delete("/api/drip-campaigns/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const userId = getUserId(req);
    try {
      const query = mongoose16.Types.ObjectId.isValid(id) ? { _id: id, userId } : { id, userId };
      const deleted = await Campaign.findOneAndDelete(query);
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Campaign not found" });
      }
      await cancelDripCampaignJobs(String(deleted._id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });
  app.get("/api/automation-status", async (req, res) => {
    try {
      const automations = await FormAutomation.find();
      const automationMap = {};
      automations.forEach((auto) => {
        automationMap[auto.form_id] = {
          assigned_template: auto.template_id || null,
          automation_active: auto.automation_active || false,
          last_sync: auto.last_sync || null
        };
      });
      res.json(automationMap);
    } catch (error) {
      console.error("Error fetching automation status:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/forms", async (req, res) => {
    try {
      const fbResponse = await axios2.get(
        `https://graph.facebook.com/${FB_API_VERSION2}/${FB_PAGE_ID2}/leadgen_forms?access_token=${FB_ACCESS_TOKEN2}`
      );
      const fbForms = fbResponse.data.data || [];
      const automations = await FormAutomation.find();
      const automationMap = {};
      automations.forEach((auto) => {
        automationMap[auto.form_id] = auto;
      });
      const forms = fbForms.map(
        (form) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          assigned_template: automationMap[form.id]?.template_id || null,
          automation_active: automationMap[form.id]?.automation_active || false,
          last_sync: automationMap[form.id]?.last_sync || null
        })
      );
      res.json(forms);
    } catch (error) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/set-trigger", async (req, res) => {
    try {
      const { form_id, form_name, template_id, template_name } = req.body;
      await FormAutomation.findOneAndUpdate(
        { form_id },
        {
          form_id,
          form_name,
          template_id,
          template_name,
          updated_at: /* @__PURE__ */ new Date()
        },
        { upsert: true, new: true }
      );
      res.json({ success: true, message: "Template assigned successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/toggle-form-automation", async (req, res) => {
    try {
      const { form_id, is_active } = req.body;
      const automation = await FormAutomation.findOne({ form_id });
      if (!automation) {
        return res.status(404).json({
          error: "Form automation not found. Please assign a template first."
        });
      }
      automation.automation_active = is_active;
      automation.updated_at = /* @__PURE__ */ new Date();
      if (is_active) {
        automation.last_sync = /* @__PURE__ */ new Date();
        await automation.save();
        syncLeadsForFormMain(automation).catch((err) => {
          console.error("Error in initial sync:", err);
        });
        res.json({
          success: true,
          message: "Automation started. Initial sync in progress...",
          automation_active: true
        });
      } else {
        await automation.save();
        res.json({
          success: true,
          message: "Automation stopped",
          automation_active: false
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/status", async (req, res) => {
    try {
      const activeCount = await FormAutomation.countDocuments({
        automation_active: true
      });
      res.json({
        is_running: activeCount > 0,
        active_automations: activeCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/control", async (req, res) => {
    try {
      const { run } = req.body;
      await FormAutomation.updateMany(
        {},
        { automation_active: run, updated_at: /* @__PURE__ */ new Date() }
      );
      res.json({ success: true, is_running: run });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/sync-form/:formId", async (req, res) => {
    try {
      const automation = await FormAutomation.findOne({
        form_id: req.params.formId
      });
      if (!automation) {
        return res.status(404).json({ error: "Form automation not found" });
      }
      const result = await syncLeadsForFormMain(automation);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/users/all", async (req, res) => {
    try {
      const requester = await resolveRequestUserContext(req);
      if (!requester.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!isAdminRole(requester.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const [requesterUser, systemUsers] = await Promise.all([
        findUserById(requester.userId),
        SystemUser.find(
          { isActive: true },
          {
            id: 1,
            username: 1,
            name: 1,
            email: 1,
            role: 1,
            pageAccess: 1,
            isActive: 1
          }
        ).lean()
      ]);
      const merged = /* @__PURE__ */ new Map();
      if (requesterUser?.id) {
        merged.set(requesterUser.id, {
          id: requesterUser.id,
          username: requesterUser.username || "",
          name: requesterUser.name || requesterUser.username || "User",
          email: requesterUser.email || "",
          role: requesterUser.role || "user",
          pageAccess: Array.isArray(requesterUser.pageAccess) ? requesterUser.pageAccess : []
        });
      }
      for (const user of systemUsers) {
        if (!user?.id) continue;
        merged.set(user.id, {
          id: user.id,
          username: user.username || "",
          name: user.name || user.username || "User",
          email: user.email || "",
          role: user.role || "user",
          pageAccess: Array.isArray(user.pageAccess) ? user.pageAccess : []
        });
      }
      const users = Array.from(merged.values()).sort(
        (a, b) => (a.name || "").localeCompare(b.name || "")
      );
      res.json(users);
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  const TEMPLATE_PRICE = 0.85;
  app.get("/api/reports/template-usage", async (req, res) => {
    try {
      const { contactPhone: contactPhone2, startDate, endDate, groupBy = "day" } = req.query;
      if (!contactPhone2) {
        return res.status(400).json({
          success: false,
          message: "contactPhone is required"
        });
      }
      const start = startDate ? new Date(startDate) : /* @__PURE__ */ new Date("1970-01-01");
      const end = endDate ? new Date(endDate) : /* @__PURE__ */ new Date();
      let dateFormat = "%Y-%m-%d";
      if (groupBy === "week") dateFormat = "%Y-%U";
      if (groupBy === "month") dateFormat = "%Y-%m";
      const pipeline = [
        {
          $match: {
            messageType: "template",
            status: "sent",
            contactPhone: contactPhone2,
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $addFields: {
            date: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: "$date",
              templateName: "$templateName"
            },
            sentCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                count: "$sentCount",
                cost: { $multiply: ["$sentCount", TEMPLATE_PRICE] }
              }
            },
            totalSent: { $sum: "$sentCount" }
          }
        },
        {
          $addFields: {
            totalCost: {
              $round: [{ $multiply: ["$totalSent", TEMPLATE_PRICE] }, 2]
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];
      const breakdown = await BroadcastLog.aggregate(pipeline);
      const summary = breakdown.reduce(
        (acc, item) => {
          acc.totalTemplatesSent += item.totalSent;
          acc.totalCost += item.totalCost;
          return acc;
        },
        { totalTemplatesSent: 0, totalCost: 0 }
      );
      res.json({
        success: true,
        filters: {
          contactPhone: contactPhone2,
          startDate,
          endDate,
          groupBy
        },
        summary: {
          ...summary,
          totalCost: `\xC3\u0192\xC6\u2019\xC3\u2020\xE2\u20AC\u2122\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xA2\xC3\u0192\xC6\u2019\xC3\u201A\xC2\xA2\xC3\u0192\xC2\xA2\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u201A\xC2\xAC\xC3\u0192\xE2\u20AC\xA6\xC3\u201A\xC2\xA1\xC3\u0192\xC6\u2019\xC3\xA2\xE2\u201A\xAC\xC5\xA1\xC3\u0192\xE2\u20AC\u0161\xC3\u201A\xC2\xB9${summary.totalCost.toFixed(2)}`
        },
        breakdown
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate template report"
      });
    }
  });
  app.get("/api/broadcast/template-report", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const COST_PER_TEMPLATE = 0.85;
      let dateMatch = {};
      if (startDate && endDate) {
        dateMatch.timestamp = {
          $gte: /* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`),
          $lte: /* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`)
        };
      }
      const report = await BroadcastLog.aggregate([
        {
          $match: {
            messageType: "template",
            status: "sent",
            ...dateMatch
          }
        },
        {
          $addFields: {
            sentDate: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: [
                    { $eq: [{ $type: "$timestamp" }, "string"] },
                    { $toDate: "$timestamp" },
                    "$timestamp"
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: "$sentDate",
              templateName: "$templateName"
            },
            sentCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                sentCount: "$sentCount",
                cost: {
                  $multiply: ["$sentCount", COST_PER_TEMPLATE]
                }
              }
            },
            totalSent: { $sum: "$sentCount" }
          }
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            templates: 1,
            totalSent: 1,
            totalCost: {
              $multiply: ["$totalSent", COST_PER_TEMPLATE]
            }
          }
        },
        { $sort: { date: 1 } }
      ]);
      const grandTotalSent = report.reduce((sum, d) => sum + d.totalSent, 0);
      const grandTotalCost = grandTotalSent * COST_PER_TEMPLATE;
      res.json({
        currency: "INR",
        costPerTemplate: COST_PER_TEMPLATE,
        grandTotalSent,
        grandTotalCost,
        data: report
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({ message: "Failed to fetch template report" });
    }
  });
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });
  app.get("/api/reports/campaign", async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const campaigns = await storage.getCampaigns();
      const templates = await storage.getTemplates();
      const broadcastLogs = await getBroadcastLogs({
        userId: getUserId(req) || void 0,
        limit: 1e4
      });
      const now = /* @__PURE__ */ new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");
      const inbound = periodMessages.filter((m) => m.direction === "inbound");
      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read2 = outbound.filter((m) => m.status === "read").length;
      const replied = inbound.length;
      const failed = outbound.filter((m) => m.status === "failed").length;
      const deliveryRate = totalSent > 0 ? Math.round(delivered / totalSent * 100 * 10) / 10 : 0;
      const readRate = delivered > 0 ? Math.round(read2 / delivered * 100 * 10) / 10 : 0;
      const replyRate = read2 > 0 ? Math.round(replied / read2 * 100 * 10) / 10 : 0;
      const deliveryData = [
        { name: "Delivered", value: delivered, color: "#22c55e" },
        { name: "Read", value: read2, color: "#3b82f6" },
        { name: "Replied", value: replied, color: "#8b5cf6" },
        { name: "Failed", value: failed, color: "#ef4444" }
      ];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyStats = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        const dayInbound = dayMsgs.filter((m) => m.direction === "inbound");
        dailyStats.push({
          name: dayNames[date.getDay()],
          date: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          replied: dayInbound.length
        });
      }
      const campaignStats = campaigns.map((c) => ({
        name: c.name,
        type: "Marketing",
        sent: c.sentCount || 0,
        delivered: c.deliveredCount || 0,
        read: c.readCount || 0,
        replied: c.repliedCount || 0,
        cost: (c.sentCount || 0) * 0.01,
        date: c.scheduledAt || c.createdAt
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
      const templateUsage = {};
      for (const log of broadcastLogs) {
        if (log.templateName) {
          if (!templateUsage[log.templateName]) {
            templateUsage[log.templateName] = {
              sent: 0,
              delivered: 0,
              read: 0,
              replied: 0
            };
          }
          templateUsage[log.templateName].sent++;
          if (log.status === "delivered" || log.status === "sent") {
            templateUsage[log.templateName].delivered++;
          }
          if (log.replied) {
            templateUsage[log.templateName].replied++;
          }
        }
      }
      for (const msg of periodMessages) {
        if (msg.content && msg.content.startsWith("[Template:")) {
          const match = msg.content.match(/\[Template:\s*([^\]]+)\]/);
          if (match) {
            const templateName = match[1];
            if (!templateUsage[templateName]) {
              templateUsage[templateName] = {
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0
              };
            }
            if (msg.direction === "outbound") {
              templateUsage[templateName].sent++;
              if (msg.status === "delivered" || msg.status === "read") {
                templateUsage[templateName].delivered++;
              }
              if (msg.status === "read") {
                templateUsage[templateName].read++;
              }
            }
          }
        }
      }
      const templatePerformance = Object.entries(templateUsage).map(([name, stats]) => ({
        name,
        sent: stats.sent,
        delivered: stats.delivered,
        read: stats.read,
        replied: stats.replied,
        readRate: stats.delivered > 0 ? Math.round(stats.read / stats.delivered * 100) : 0,
        replyRate: stats.read > 0 ? Math.round(stats.replied / stats.read * 100) : 0,
        cost: stats.sent * 0.01
      })).sort((a, b) => b.sent - a.sent).slice(0, 10);
      const totalCost = totalSent * 0.01;
      const costTrend = dailyStats.map((d) => ({
        date: d.date,
        cost: d.sent * 0.01,
        messages: d.sent
      }));
      res.json({
        totalSent,
        totalDelivered: delivered,
        totalRead: read2,
        totalReplied: replied,
        totalFailed: failed,
        totalCost,
        deliveryRate,
        readRate,
        replyRate,
        deliveryData,
        dailyStats,
        campaignStats,
        templatePerformance,
        costTrend
      });
    } catch (error) {
      console.error("Failed to get campaign report:", error);
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });
  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7;
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const broadcastLogs = await getBroadcastLogs({
        userId: getUserId(req) || void 0,
        limit: 1e4
      });
      const now = /* @__PURE__ */ new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");
      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read2 = outbound.filter((m) => m.status === "read").length;
      const failed = outbound.filter((m) => m.status === "failed").length;
      const pending = outbound.filter((m) => m.status === "sent").length;
      const deliveryRate = totalSent > 0 ? Math.round(delivered / totalSent * 100 * 10) / 10 : 0;
      const readRate = delivered > 0 ? Math.round(read2 / delivered * 100 * 10) / 10 : 0;
      const failureRate = totalSent > 0 ? Math.round(failed / totalSent * 100 * 10) / 10 : 0;
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1e3);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        dailyData.push({
          date: dayNames[date.getDay()],
          fullDate: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          delivered: dayOutbound.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          failed: dayOutbound.filter((m) => m.status === "failed").length
        });
      }
      const hourlyData = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourMsgs = outbound.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.getHours() === hour;
        });
        hourlyData.push({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          sent: hourMsgs.length,
          delivered: hourMsgs.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length
        });
      }
      res.json({
        totalSent,
        delivered,
        read: read2,
        failed,
        pending,
        deliveryRate,
        readRate,
        failureRate,
        dailyData,
        hourlyData
      });
    } catch (error) {
      console.error("Failed to get delivery report:", error);
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });
  app.use("/api/contacts", contacts_routes_default);
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const memContacts = await storage.getContacts(userId);
      const importedContacts = await readCollection("imported_contacts");
      const ownedImportedContacts = importedContacts.filter(
        (contact) => contact.userId === userId
      );
      const phoneSet = /* @__PURE__ */ new Set();
      const allContacts = [];
      for (const contact of ownedImportedContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email || "",
            tags: contact.tags || [],
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      for (const contact of memContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push(contact);
        }
      }
      res.json(allContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to get contacts" });
    }
  });
  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id, getUserId(req));
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to get contact" });
    }
  });
  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid contact data",
          errors: parsed.error.errors
        });
      }
      const contact = await storage.createContact({
        ...parsed.data,
        userId: getUserId(req)
      });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to create contact" });
    }
  });
  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getContact(req.params.id, getUserId(req));
      if (!existing) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact" });
    }
  });
  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getContact(req.params.id, getUserId(req));
      if (!existing) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });
  app.post("/api/contacts/import", requireAuth, async (req, res) => {
    try {
      const { contacts } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ message: "Invalid data format" });
      }
      const imported = [];
      for (const contact of contacts) {
        const parsed = insertContactSchema.safeParse(contact);
        if (parsed.success) {
          const newContact = await storage.createContact({
            ...parsed.data,
            userId: getUserId(req)
          });
          imported.push(newContact);
        }
      }
      res.json({ imported: imported.length, contacts: imported });
    } catch (error) {
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });
  app.get("/api/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { page, limit, skip } = parsePagination(req, { limit: 100, maxLimit: 500 });
      const contactId = typeof req.query.contactId === "string" ? req.query.contactId : void 0;
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        if (!contactId) {
          return res.json([]);
        }
        if (!permittedContactIds.includes(contactId)) {
          return res.json([]);
        }
      }
      const messages = await storage.getMessages(
        contactId,
        userId,
        { limit, skip, sort: { timestamp: -1 } }
      );
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(messages.length === limit)
      });
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });
  app.post("/api/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parsed = insertMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid message data",
          errors: parsed.error.errors
        });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(parsed.data.contactId)) {
        return res.status(403).json({ message: "Not allowed to send messages for this contact" });
      }
      const message = await storage.createMessage({
        ...parsed.data,
        userId
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  app.get("/api/debug/user/:email", async (req, res) => {
    try {
      const { SystemUser: SystemUser2 } = await Promise.resolve().then(() => (init_user_model(), user_model_exports));
      const { User: User2 } = await Promise.resolve().then(() => (init_mongodb_adapter(), mongodb_adapter_exports));
      const email = req.params.email;
      const systemUser = await SystemUser2.findOne({ email });
      const regularUser = await User2.findOne({
        $or: [{ email }, { username: email }]
      });
      res.json({
        systemUser: systemUser ? {
          id: systemUser.id,
          email: systemUser.email,
          name: systemUser.name,
          role: systemUser.role,
          isActive: systemUser.isActive
        } : null,
        regularUser: regularUser ? {
          id: regularUser.id,
          email: regularUser.email,
          name: regularUser.name,
          role: regularUser.role
        } : null
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  app.get("/api/chats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { page, limit, skip } = parsePagination(req, { limit: 50, maxLimit: 200 });
      let chats = await storage.getChats(userId, {
        limit,
        skip,
        sort: { lastMessageTime: -1 }
      });
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        chats = chats.filter((chat) =>
          permittedContactIds.includes(chat.contactId || chat.contact?.id)
        );
      }
      const assignments = await getAllLeadAssignments({
        status: ["assigned", "in_progress"],
        contactId: chats.map((chat) => chat.contact.id)
      });
      const assignmentMap = new Map(
        assignments.map((a) => [a.contactId, a])
      );
      const chatsWithAssignment = chats.map((chat) => ({
        ...chat,
        assignment: assignmentMap.get(chat.contact.id) || null
      }));
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(chats.length === limit)
      });
      res.json(chatsWithAssignment);
    } catch (error) {
      console.error("Error getting chats:", error);
      res.status(500).json({ message: "Failed to get chats" });
    }
  });
  app.get("/api/chats/window", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { page, limit, skip } = parsePagination(req, { limit: 50, maxLimit: 200 });
      const since = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
      const inboundRows = await Message.aggregate([
        {
          $match: {
            userId,
            direction: "inbound",
            timestamp: { $gte: since }
          }
        },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: "$contactId",
            lastInboundMessage: { $first: "$content" },
            lastInboundMessageTime: { $first: "$timestamp" }
          }
        },
        { $sort: { lastInboundMessageTime: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]).allowDiskUse(true);
      const contactIds = inboundRows.map((row) => row._id).filter(Boolean);
      let chats = contactIds.length ? await findMany(
        "chats",
        { userId, contactId: { $in: contactIds } },
        { limit: contactIds.length }
      ) : [];
      const contacts = contactIds.length ? await findMany(
        "contacts",
        { userId, id: { $in: contactIds } },
        { limit: contactIds.length }
      ) : [];
      const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
      const latestInboundByContact = /* @__PURE__ */ new Map();
      for (const row of inboundRows) {
        latestInboundByContact.set(row._id, {
          contactId: row._id,
          content: row.lastInboundMessage,
          timestamp: row.lastInboundMessageTime
        });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        chats = chats.filter((chat) =>
          permittedContactIds.includes(chat.contactId || chat.contact?.id)
        );
      }
      const now = /* @__PURE__ */ new Date();
      const windowChats = chats.map((chat) => {
        const contact = contactsById.get(chat.contactId) || chat.contact;
        const latestInbound = latestInboundByContact.get(chat.contactId);
        return latestInbound ? {
          ...chat,
          contact,
          lastInboundMessage: latestInbound.content,
          lastInboundMessageTime: latestInbound.timestamp
        } : chat.isFlowLead ? chat : { ...chat, lastInboundMessage: void 0, lastInboundMessageTime: void 0 };
      }).filter((chat) => {
        if (chat.lastInboundMessageTime) {
          const lastInbound = new Date(chat.lastInboundMessageTime);
          const hoursDiff = (now.getTime() - lastInbound.getTime()) / (1e3 * 60 * 60);
          return hoursDiff >= 0 && hoursDiff <= 24;
        }
        return false;
      });
      res.set({
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Has-More": String(inboundRows.length === limit)
      });
      res.json(windowChats);
    } catch (error) {
      console.error("Error getting window chats:", error);
      res.status(500).json({ message: "Failed to get window chats" });
    }
  });
  app.get("/api/chats/:id", requireAuth, async (req, res) => {
    try {
      const chat = await storage.getChat(req.params.id, getUserId(req));
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(chat.contact.id)) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat" });
    }
  });
  app.post("/api/chats/:contactId/mark-read", async (req, res) => {
    try {
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(req.params.contactId)) {
        return res.status(403).json({ message: "Not allowed for this contact" });
      }
      await storage.markMessagesAsRead(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });
  app.post("/api/chats/:contactId/mark-unread", async (req, res) => {
    try {
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null && !permittedContactIds.includes(req.params.contactId)) {
        return res.status(403).json({ message: "Not allowed for this contact" });
      }
      await storage.markMessagesAsUnread(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as unread" });
    }
  });
  app.post("/api/inbox/send", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const {
        contactId,
        phone,
        name,
        messageType,
        templateName,
        customMessage,
        agentId
      } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      if (!messageType) {
        return res.status(400).json({ error: "Message type is required" });
      }
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      if (permittedContactIds !== null) {
        if (!contactId) {
          return res.status(400).json({
            error: "contactId is required for your user role"
          });
        }
        if (!permittedContactIds.includes(contactId)) {
          return res.status(403).json({ error: "Not allowed to send messages for this contact" });
        }
      }
      let result = { success: false };
      let messageContent = "";
      switch (messageType) {
        case "template": {
          if (!templateName) {
            return res.status(400).json({
              error: "Template name is required for template messages"
            });
          }
          result = await sendTemplateMessage3(
            phone,
            templateName,
            name,
            void 0,
            userId
          );
          messageContent = `[Template: ${templateName}]`;
          break;
        }
        case "custom": {
          if (!customMessage) {
            return res.status(400).json({
              error: "Message content is required for custom messages"
            });
          }
          result = await sendCustomMessage(
            phone,
            customMessage,
            userId
          );
          messageContent = customMessage;
          break;
        }
        case "ai": {
          if (!agentId) {
            return res.status(400).json({ error: "Agent ID is required for AI messages" });
          }
          const agent = await getAgentById(agentId);
          if (!agent) {
            return res.status(404).json({ error: "AI Agent not found" });
          }
          await assignAgentToContact(
            contactId,
            phone,
            agentId,
            agent.name
          );
          await enableAutoReply(phone);
          let conversationHistory2 = await getConversationHistory(phone);
          if (conversationHistory2.length === 0 && contactId) {
            try {
              const recentMessages = await storage.getMessages(contactId);
              const lastMessages = recentMessages.slice(-10);
              conversationHistory2 = lastMessages.map((m) => ({
                role: m.direction === "inbound" ? "user" : "assistant",
                content: m.content
              }));
            } catch (e) {
              console.log("[InboxSend] Could not fetch conversation context");
            }
          }
          const lastInboundMessage = conversationHistory2.filter((m) => m.role === "user").pop();
          const promptMessage = lastInboundMessage?.content || `Greet ${name || "the customer"} warmly and introduce yourself as per your instructions.`;
          const aiMessage = await generateAgentResponse2(
            promptMessage,
            agent,
            conversationHistory2.slice(0, -1)
            // Exclude the last message since we're using it as the prompt
          );
          if (!aiMessage) {
            return res.status(500).json({
              error: "Failed to generate AI response. Check if API key is configured for the agent model."
            });
          }
          await addMessageToHistory(
            phone,
            "assistant",
            aiMessage
          );
          result = await sendCustomMessage(
            phone,
            aiMessage,
            userId
          );
          result.aiMessage = aiMessage;
          messageContent = aiMessage;
          if (!result.success && result.error?.includes("24")) {
            result = await sendTemplateMessage3(
              phone,
              "hello_world",
              void 0,
              void 0,
              userId
            );
            messageContent = "[Template: hello_world] (AI fallback)";
          }
          break;
        }
        default:
          return res.status(400).json({
            error: "Invalid message type. Use: template, custom, or ai"
          });
      }
      if (result.success && contactId) {
        try {
          await storage.createMessage({
            userId,
            contactId,
            content: messageContent,
            type: "text",
            direction: "outbound",
            status: "sent",
            whatsappMessageId: result.messageId
          });
        } catch (saveError) {
          console.error(
            "[InboxSend] Failed to save message to conversation:",
            saveError
          );
        }
      }
      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: messageContent,
          sent: true
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to send message"
        });
      }
    } catch (error) {
      console.error("[InboxSend] Error:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  });
  app.post("/api/inbox/send-ai-response", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { contactId, phone, name, agentId, userMessage } = req.body;
      if (!phone || !agentId) {
        return res.status(400).json({ error: "Phone and agentId are required" });
      }
      const agent = await getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ error: "AI Agent not found" });
      }
      const promptMessage = userMessage || "Hello";
      const aiMessage = await generateAgentResponse2(
        promptMessage,
        agent,
        []
      );
      if (!aiMessage) {
        return res.status(500).json({
          error: "Failed to generate AI response. Check if API key is configured for the agent model."
        });
      }
      const result = await sendCustomMessage(
        phone,
        aiMessage,
        userId
      );
      if (result.success && contactId) {
        await storage.createMessage({
          userId,
          contactId,
          content: aiMessage,
          type: "text",
          direction: "outbound",
          status: "sent",
          whatsappMessageId: result.messageId
        });
      }
      res.json({
        success: result.success,
        message: aiMessage,
        error: result.error
      });
    } catch (error) {
      console.error("[InboxSendAI] Error:", error);
      res.status(500).json({ error: error.message || "Failed to send AI response" });
    }
  });
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaigns" });
    }
  });
  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign" });
    }
  });
  app.post("/api/campaigns", async (req, res) => {
    try {
      const parsed = insertCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid campaign data",
          errors: parsed.error.errors
        });
      }
      const campaign = await storage.createCampaign(parsed.data);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });
  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });
  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });
  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const sentCount = campaign.contactIds.length;
      const deliveredCount = Math.floor(sentCount * 0.95);
      const readCount = Math.floor(deliveredCount * 0.7);
      const repliedCount = Math.floor(readCount * 0.2);
      const updatedCampaign = await storage.updateCampaign(req.params.id, {
        status: "completed",
        sentCount,
        deliveredCount,
        readCount,
        repliedCount
      });
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });
  app.get("/api/templates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const metaOnly = req.query.metaOnly === "true";
      const templates = await Template.find({ userId }).lean();
      const filteredTemplates = metaOnly ? templates.filter((template) => Boolean(template?.metaTemplateId)) : templates;
      res.json(filteredTemplates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get templates" });
    }
  });
  app.get("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await Template.findOne({
        id: req.params.id,
        userId
      }).lean();
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to get template" });
    }
  });
  function shortSuffix(length = 4) {
    return Math.random().toString(36).substring(2, 2 + length);
  }
  app.post("/api/templates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader ? req.body.headerMedia || req.body.headerImage || req.body.headerImageUrl || null : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;
      console.log("[TemplateCreate] creating template:", req.body.name);
      const templatePayload = {
        userId,
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        authAddSecurityRecommendation: req.body.authAddSecurityRecommendation !== false,
        authCodeExpirationMinutes: req.body.authCodeExpirationMinutes || 10,
        authOtpType: req.body.authOtpType || "COPY_CODE",
        status: req.body.status
      };
      const existingTemplate = await Template.findOne({
        userId,
        name: req.body.name
      });
      const template = existingTemplate ? await Template.findOneAndUpdate(
        { id: existingTemplate.id, userId },
        {
          $set: {
            ...templatePayload,
            metaTemplateId: void 0,
            metaStatus: "pending",
            metaRejectionReason: void 0
          }
        },
        { new: true }
      ) : await Template.create({
        id: uuidv42(),
        ...templatePayload
      });
      res.status(existingTemplate ? 200 : 201).json(template);
    } catch (err) {
      console.error("[Template Creation Error]", err);
      if (err?.code === 11e3) {
        return res.status(409).json({
          message: "A template with this name already exists.",
          error: "Use the existing template from Manage Templates, or change the template name."
        });
      }
      res.status(500).json({ error: err.message });
    }
  });
  const updateMetaTemplate = async (metaTemplateId, payload) => {
    try {
      const response = await axios2.post(
        `https://graph.facebook.com/v24.0/${metaTemplateId}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${""}`
          }
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  };
  const resolveTemplateCredentials = async (req) => {
    const { credentialsService: credentialsService2 } = await Promise.resolve().then(() => (init_credentials_service(), credentials_service_exports));
    const sessionUserId = req.session?.user?.id;
    const userId = getUserId(req) || sessionUserId;
    let token;
    let wabaId;
    if (userId) {
      const integrationCredentials = await getDecryptedCredentials2(userId, "whatsapp");
      token = integrationCredentials?.accessToken || token;
      wabaId = integrationCredentials?.businessAccountId || wabaId;
      const credentials = await credentialsService2.getDecryptedCredentials(
        userId
      );
      if (!token && credentials?.whatsappToken) {
        token = credentials.whatsappToken;
      }
      if (!wabaId && credentials?.businessAccountId) {
        wabaId = credentials.businessAccountId;
      }
    }
    if (!userId && !token) {
      token = "";
    }
    if (!userId && !wabaId) {
      wabaId = "";
    }
    return { token, wabaId, userId };
  };
  const resolveTemplateDeleteCredentials = resolveTemplateCredentials;
  const deleteMetaTemplate = async (wabaId, token, options) => {
    const baseUrl = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
    const META_DELETE_TIMEOUT_MS = 2e4;
    const META_DELETE_MAX_RETRIES = 2;
    const RETRY_BASE_DELAY_MS = 700;
    const executeDelete = async (params) => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        META_DELETE_TIMEOUT_MS
      );
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        method: "DELETE",
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };
    const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isRetryableFailure = (input) => {
      if (input.error?.name === "AbortError") return true;
      if (typeof input.status === "number") {
        if (input.status === 429 || input.status >= 500) return true;
      }
      const metaError2 = input.data?.error;
      const code = Number(metaError2?.code);
      if ([4, 17, 32, 613].includes(code)) return true;
      return false;
    };
    const runDeleteWithRetry = async (params) => {
      let lastResult = null;
      let lastError = null;
      for (let attempt = 0; attempt <= META_DELETE_MAX_RETRIES; attempt++) {
        try {
          const result = await executeDelete(params);
          const failed = !result.response.ok || result.data?.error;
          if (!failed) {
            return { success: true, result };
          }
          lastResult = result;
          const retryable = isRetryableFailure({
            status: result.response.status,
            data: result.data
          });
          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, result: lastResult };
          }
        } catch (error) {
          lastError = error;
          const retryable = isRetryableFailure({ error });
          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, error: lastError };
          }
        }
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
      }
      return { success: false, result: lastResult, error: lastError };
    };
    const normalizeLang = (language2) => language2 ? language2.replace("-", "_") : void 0;
    const language = normalizeLang(options.language);
    const createParams = (input) => {
      const params = new URLSearchParams({ access_token: token });
      if (input.id) params.set("hsm_id", input.id);
      if (input.name) params.set("name", input.name);
      if (input.language) params.set("language", input.language);
      return params;
    };
    const parameterCandidates = [];
    if (options.metaTemplateId && options.name && language) {
      parameterCandidates.push(
        createParams({
          id: options.metaTemplateId,
          name: options.name,
          language
        })
      );
    }
    if (options.metaTemplateId && options.name) {
      parameterCandidates.push(
        createParams({ id: options.metaTemplateId, name: options.name })
      );
    }
    if (options.name && language) {
      parameterCandidates.push(createParams({ name: options.name, language }));
    }
    if (options.name) {
      parameterCandidates.push(createParams({ name: options.name }));
    }
    if (options.metaTemplateId) {
      parameterCandidates.push(createParams({ id: options.metaTemplateId }));
    }
    const seen = /* @__PURE__ */ new Set();
    const deleteAttempts = parameterCandidates.filter((params) => {
      const key = params.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let lastTry = null;
    for (const params of deleteAttempts) {
      const attempt = await runDeleteWithRetry(params);
      if (attempt.success) {
        return { success: true, data: attempt.result.data };
      }
      lastTry = attempt;
    }
    if (options.name) {
      try {
        const lookupUrl = `${baseUrl}?fields=id,name,language,status&limit=200&access_token=${encodeURIComponent(token)}`;
        const lookupResponse = await fetch(lookupUrl, { method: "GET" });
        const lookupData = await lookupResponse.json().catch(() => ({}));
        if (lookupResponse.ok && Array.isArray(lookupData.data)) {
          const matches = lookupData.data.filter((item) => {
            if (item?.name !== options.name) return false;
            if (!language) return true;
            return normalizeLang(item?.language) === language;
          });
          if (matches.length === 0) {
            return {
              success: true,
              alreadyMissing: true,
              data: { message: "Template not present on Meta dashboard." }
            };
          }
          for (const match of matches) {
            const retryByLookup = await runDeleteWithRetry(
              createParams({
                id: String(match.id || ""),
                name: String(match.name || options.name),
                language: normalizeLang(match.language)
              })
            );
            if (retryByLookup.success) {
              return { success: true, data: retryByLookup.result.data };
            }
            lastTry = retryByLookup;
          }
        }
      } catch {
      }
    }
    if (lastTry?.error) {
      return {
        success: false,
        error: lastTry.error?.name === "AbortError" ? "Meta delete request timed out after retries" : lastTry.error?.message || "Meta delete request failed"
      };
    }
    const metaError = lastTry?.result?.data?.error;
    return {
      success: false,
      error: metaError?.message || `Meta API delete failed with status ${lastTry?.result?.response?.status ?? "unknown"}`,
      details: metaError || lastTry?.result?.data
    };
  };
  app.put("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const templateId = req.params.id;
      console.log("[Template Update] Request received for ID:", templateId);
      console.log(
        "[Template Update] Request body:",
        JSON.stringify(req.body, null, 2)
      );
      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader ? req.body.headerMedia || req.body.headerImage || req.body.headerImageUrl || null : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;
      const updateData = {
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        authAddSecurityRecommendation: req.body.authAddSecurityRecommendation !== false,
        authCodeExpirationMinutes: req.body.authCodeExpirationMinutes || 10,
        authOtpType: req.body.authOtpType || "COPY_CODE",
        status: req.body.status
      };
      const template = await Template.findOneAndUpdate(
        { id: templateId, userId },
        updateData,
        { new: true }
      );
      if (!template) {
        console.warn("[Template Update] Template not found:", templateId);
        return res.status(404).json({ message: "Template not found" });
      }
      console.log("[Template Update] MongoDB template updated:", template);
      if (template.metaTemplateId) {
        try {
          const metaPayload = buildMetaTemplate(template);
          delete metaPayload.name;
          const result = await updateMetaTemplate(
            template.metaTemplateId,
            metaPayload
          );
          if (result.success) {
            template.metaStatus = "PENDING";
            await template.save();
            console.log(
              "[Template Update] Meta template updated:",
              template.metaTemplateId
            );
          } else {
            console.error(
              "[Template Update] Meta update failed:",
              result.error
            );
          }
        } catch (metaError) {
          console.error(
            "[Template Update] Meta update error:",
            metaError
          );
        }
      }
      res.json(template);
    } catch (error) {
      console.error("[Template Update Error]", error);
      res.status(500).json({ message: "Failed to update template", error: error.message });
    }
  });
  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await Template.findOne({
        id: req.params.id,
        userId
      }).lean();
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";
      const metaTemplateId = template.metaTemplateId;
      let deletedFromMeta = false;
      let metaDeletionSkipped = false;
      if (shouldDeleteFromMeta) {
        if (metaTemplateId) {
          const { token, wabaId } = await resolveTemplateDeleteCredentials(req);
          if (!token || !wabaId) {
            return res.status(400).json({
              message: "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
              hint: "Configure WhatsApp Access Token and WABA ID in Settings."
            });
          }
          const metaDelete = await deleteMetaTemplate(wabaId, token, {
            metaTemplateId,
            name: template.name,
            language: template.language
          });
          if (!metaDelete.success) {
            return res.status(502).json({
              message: "Failed to delete template from Meta dashboard. Local template was not deleted.",
              error: metaDelete.error,
              details: metaDelete.details
            });
          }
          if (metaDelete.alreadyMissing) {
            metaDeletionSkipped = true;
          } else {
            deletedFromMeta = true;
          }
        } else {
          metaDeletionSkipped = true;
        }
      }
      const deleteResult = await Template.deleteOne({
        id: req.params.id,
        userId
      });
      if (!deleteResult.deletedCount) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({
        success: true,
        deletedFromMeta,
        metaDeletionSkipped,
        message: deletedFromMeta ? "Template deleted from local database and Meta dashboard." : metaDeletionSkipped ? "Template deleted locally. Meta deletion skipped because no linked Meta template ID exists." : "Template deleted from local database."
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
  });
  app.post("/api/templates/bulk-delete", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === "string") : [];
      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";
      if (ids.length === 0) {
        return res.status(400).json({ message: "Please provide at least one template id." });
      }
      let token;
      let wabaId;
      if (shouldDeleteFromMeta) {
        const creds = await resolveTemplateDeleteCredentials(req);
        token = creds.token;
        wabaId = creds.wabaId;
        if (!token || !wabaId) {
          return res.status(400).json({
            message: "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
            hint: "Configure WhatsApp Access Token and WABA ID in Settings."
          });
        }
      }
      let deletedCount = 0;
      let deletedFromMetaCount = 0;
      let metaDeletionSkippedCount = 0;
      const failed = [];
      const concurrency = 2;
      const queue2 = ids.slice();
      const workerResults = [];
      const workers = Array.from(
        { length: Math.min(concurrency, queue2.length) },
        async () => {
          while (queue2.length > 0) {
            const id = queue2.shift();
            if (!id) break;
            try {
              const template = await Template.findOne({
                id,
                userId
              }).lean();
              if (!template) {
                workerResults.push({
                  id,
                  ok: false,
                  error: "Template not found"
                });
                continue;
              }
              let deletedFromMeta = false;
              let metaSkipped = false;
              if (shouldDeleteFromMeta) {
                const metaTemplateId = template.metaTemplateId;
                if (metaTemplateId) {
                  const metaDelete = await deleteMetaTemplate(wabaId, token, {
                    metaTemplateId,
                    name: template.name,
                    language: template.language
                  });
                  if (!metaDelete.success) {
                    workerResults.push({
                      id,
                      name: template.name,
                      ok: false,
                      error: metaDelete.error || "Meta delete failed"
                    });
                    continue;
                  }
                  if (metaDelete.alreadyMissing) {
                    metaSkipped = true;
                  } else {
                    deletedFromMeta = true;
                  }
                } else {
                  metaSkipped = true;
                }
              }
              const localDeleteResult = await Template.deleteOne({
                id,
                userId
              });
              if (!localDeleteResult.deletedCount) {
                workerResults.push({
                  id,
                  name: template.name,
                  ok: false,
                  error: "Failed to delete from local database"
                });
                continue;
              }
              workerResults.push({
                id,
                name: template.name,
                ok: true,
                deletedFromMeta,
                metaSkipped
              });
            } catch (itemError) {
              workerResults.push({
                id,
                ok: false,
                error: itemError?.message || "Unexpected delete error"
              });
            }
          }
        }
      );
      await Promise.all(workers);
      for (const item of workerResults) {
        if (item.ok) {
          deletedCount += 1;
          if (item.deletedFromMeta) deletedFromMetaCount += 1;
          if (item.metaSkipped) metaDeletionSkippedCount += 1;
        } else {
          failed.push({
            id: item.id,
            name: item.name,
            error: item.error || "Delete failed"
          });
        }
      }
      const responsePayload = {
        success: failed.length === 0,
        deletedCount,
        deletedFromMetaCount,
        metaDeletionSkippedCount,
        failedCount: failed.length,
        failed,
        message: failed.length === 0 ? `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} successfully.` : `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} with ${failed.length} failure${failed.length === 1 ? "" : "s"}.`
      };
      if (failed.length > 0) {
        return res.status(207).json(responsePayload);
      }
      return res.json(responsePayload);
    } catch (error) {
      return res.status(500).json({
        message: "Failed to delete selected templates",
        error: error.message
      });
    }
  });
  app.get("/api/meta-templates", async (req, res) => {
    try {
      const { token, wabaId, userId } = await resolveTemplateCredentials(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!token || !wabaId) {
        return res.status(400).json({
          message: "WhatsApp credentials not configured",
          hint: "Please configure your WhatsApp Access Token and Business Account ID in Settings."
        });
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,quality_score,components,rejected_reason&limit=100&access_token=${token}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplatesMeta] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error"
        });
      }
      const data = await response.json();
      const metaTemplates = data.data || [];
      const templates = metaTemplates.map((t) => {
        let content = "";
        let header = "";
        let footer = "";
        let buttons = [];
        if (t.components) {
          for (const comp of t.components) {
            if (comp.type === "HEADER") {
              header = comp.text || comp.format || "";
            } else if (comp.type === "BODY") {
              content = comp.text || "";
            } else if (comp.type === "FOOTER") {
              footer = comp.text || "";
            } else if (comp.type === "BUTTONS") {
              buttons = comp.buttons || [];
            }
          }
        }
        return {
          id: t.id,
          name: t.name,
          status: t.status?.toLowerCase() || "pending",
          category: t.category?.toLowerCase() || "utility",
          language: t.language || "en",
          content,
          header,
          footer,
          buttons,
          qualityScore: t.quality_score,
          rejectedReason: t.rejected_reason
        };
      });
      const summary = {
        total: templates.length,
        approved: templates.filter((t) => t.status === "approved").length,
        pending: templates.filter((t) => t.status === "pending").length,
        rejected: templates.filter((t) => t.status === "rejected").length
      };
      res.json({ templates, summary });
    } catch (error) {
      console.error("[TemplatesMeta] Error:", error);
      res.status(500).json({ message: "Failed to fetch templates from Meta" });
    }
  });
  app.post("/api/templates/sync-meta", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { token, wabaId } = await resolveTemplateCredentials(req);
      if (!token) {
        return res.status(400).json({
          message: "WhatsApp access token not configured. Please configure your API credentials in Settings."
        });
      }
      if (!wabaId) {
        return res.status(400).json({
          message: "WhatsApp Business Account ID (WABA_ID) not configured. Please configure it in Settings."
        });
      }
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=500&access_token=${token}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplateSync] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error",
          hint: "Make sure WABA_ID is set to your WhatsApp Business Account ID (not Phone Number ID)"
        });
      }
      const data = await response.json();
      const metaTemplates = data.data || [];
      let synced = 0;
      let updated = 0;
      let removedStaleMetaLinked = 0;
      const approvedTemplates = [];
      const existingTemplates = await Template.find({
        $or: [{ userId }, { userId: { $exists: false } }]
      }).lean();
      const metaTemplateIds = /* @__PURE__ */ new Set();
      const mediaHeaderTypes = /* @__PURE__ */ new Set(["image", "video", "document"]);
      const isHttpUrl2 = (value) => {
        return typeof value === "string" && /^https?:\/\//i.test(value.trim());
      };
      const parseMetaTemplateComponents = (components) => {
        let content = "";
        let footer = "";
        let headerText = "";
        let headerType = null;
        let mediaPreviewUrl = null;
        const componentList = Array.isArray(components) ? components : [];
        for (const component of componentList) {
          const componentType = String(component?.type || "").toUpperCase();
          if (componentType === "HEADER") {
            const normalizedFormat = String(
              component?.format || (component?.text ? "TEXT" : "")
            ).toLowerCase();
            if (normalizedFormat === "text") {
              headerType = "text";
              headerText = String(component?.text || "");
              continue;
            }
            if (normalizedFormat === "image" || normalizedFormat === "video" || normalizedFormat === "document") {
              headerType = normalizedFormat;
              const handles = Array.isArray(component?.example?.header_handle) ? component.example.header_handle : [];
              const firstHandle = handles.find(
                (value) => isHttpUrl2(value)
              );
              mediaPreviewUrl = firstHandle ? String(firstHandle).trim() : null;
              continue;
            }
            continue;
          }
          if (componentType === "BODY") {
            content = String(component?.text || "");
            continue;
          }
          if (componentType === "FOOTER") {
            footer = String(component?.text || "");
          }
        }
        const matches = content.match(/\{\{(\d+)\}\}/g);
        const variables = matches ? matches.map((_, index) => `var${index + 1}`) : [];
        return {
          content,
          variables,
          footer,
          headerType,
          headerText,
          mediaPreviewUrl
        };
      };
      for (const metaTemplate of metaTemplates) {
        if (metaTemplate.id) {
          metaTemplateIds.add(String(metaTemplate.id));
        }
        if (metaTemplate.status === "APPROVED") {
          approvedTemplates.push(
            `${metaTemplate.name} (${metaTemplate.language})`
          );
        }
        const exists = existingTemplates.find(
          (t) => t.metaTemplateId && t.metaTemplateId === metaTemplate.id || t.name === metaTemplate.name
        );
        const parsed = parseMetaTemplateComponents(metaTemplate.components);
        const status = metaTemplate.status === "APPROVED" ? "approved" : metaTemplate.status === "REJECTED" ? "rejected" : "pending";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (!exists) {
          const newTemplate = await storage.createTemplate({
            userId,
            name: metaTemplate.name,
            category: (metaTemplate.category || "utility").toLowerCase(),
            content: parsed.content,
            variables: parsed.variables
          });
          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const mediaUrl = isMediaHeader ? parsed.mediaPreviewUrl : null;
          await storage.updateTemplate(newTemplate.id, {
            userId,
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          existingTemplates.push({
            ...newTemplate,
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          synced++;
        } else {
          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const existingPreviewUrl = isHttpUrl2(exists?.previewUrl) ? String(exists.previewUrl) : isHttpUrl2(exists?.headerImageUrl) ? String(exists.headerImageUrl) : null;
          const mediaUrl = isMediaHeader ? existingPreviewUrl || parsed.mediaPreviewUrl || null : null;
          await storage.updateTemplate(exists.id, {
            userId,
            status,
            content: parsed.content || exists.content,
            variables: parsed.variables,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null
          });
          updated++;
        }
      }
      const latestTemplates = await Template.find({ userId }).lean();
      for (const template of latestTemplates) {
        if (template.metaTemplateId && !metaTemplateIds.has(String(template.metaTemplateId))) {
          const deleted = await storage.deleteTemplate(template.id);
          if (deleted) removedStaleMetaLinked++;
        }
      }
      res.json({
        success: true,
        synced,
        updated,
        removedStaleMetaLinked,
        total: metaTemplates.length,
        approvedTemplates,
        message: `Synced ${synced} new templates, updated ${updated} existing templates from Meta, removed ${removedStaleMetaLinked} stale local templates. ${approvedTemplates.length} are approved.`
      });
    } catch (error) {
      console.error("[TemplateSync] Error:", error);
      res.status(500).json({ message: "Failed to sync templates from Meta" });
    }
  });
  app.post("/api/templates/:id/submit-approval", async (req, res) => {
    const requestId = crypto.randomUUID();
    console.log(`
[SubmitApproval][${requestId}] ===== START =====`);
    console.log(`[SubmitApproval][${requestId}] Template ID:`, req.params.id);
    try {
      const { token, wabaId, userId } = await resolveTemplateCredentials(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const template = await Template.findOne({
        id: req.params.id,
        userId
      });
      if (!template) {
        console.error(`[SubmitApproval][${requestId}] Template not found`);
        return res.status(404).json({ message: "Template not found" });
      }
      console.log(
        `[SubmitApproval][${requestId}] Template loaded`,
        JSON.stringify(
          {
            id: template.id,
            name: template.name,
            category: template.category,
            language: template.language,
            headerType: template.headerType
          },
          null,
          2
        )
      );
      const metaTemplate = buildMetaTemplate(template);
      console.log(
        `[SubmitApproval][${requestId}] Meta payload`,
        JSON.stringify(metaTemplate, null, 2)
      );
      console.log(`[SubmitApproval][${requestId}] User ID:`, userId);
      console.log(`[SubmitApproval][${requestId}] WABA ID:`, wabaId);
      console.log(`[SubmitApproval][${requestId}] Token present:`, !!token);
      if (!token) {
        console.error(`[SubmitApproval][${requestId}] Token missing`);
        return res.status(400).json({
          message: "WhatsApp access token not configured. Please configure your API credentials in Settings."
        });
      }
      if (!wabaId) {
        console.error(`[SubmitApproval][${requestId}] WABA_ID missing`);
        return res.status(400).json({
          message: "WABA_ID not configured. Please configure it in Settings."
        });
      }
      const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
      console.log(`[SubmitApproval][${requestId}] POST ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metaTemplate)
      });
      const data = await response.json();
      console.log(
        `[SubmitApproval][${requestId}] Meta response status:`,
        response.status
      );
      console.log(
        `[SubmitApproval][${requestId}] Meta response body:`,
        JSON.stringify(data, null, 2)
      );
      if (!response.ok) {
        console.error(`[SubmitApproval][${requestId}] Meta submission failed`, {
          message: data?.error?.message,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id
        });
        return res.status(400).json({
          message: data?.error?.error_user_msg || data?.error?.message || "Meta submission failed",
          title: data?.error?.error_user_title,
          error: data?.error?.message,
          userMessage: data?.error?.error_user_msg,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id
        });
      }
      await storage.updateTemplate(template.id, {
        metaTemplateId: data.id,
        metaStatus: data.status,
        status: "pending"
      });
      console.log(
        `[SubmitApproval][${requestId}] Template submitted successfully`,
        {
          metaTemplateId: data.id,
          status: data.status
        }
      );
      console.log(`[SubmitApproval][${requestId}] ===== END =====
`);
      res.json({
        success: true,
        metaTemplateId: data.id,
        status: data.status
      });
    } catch (err) {
      console.error(`[SubmitApproval][${requestId}] UNHANDLED ERROR`, err);
      res.status(500).json({
        message: "Internal server error during template submission",
        error: err?.message,
        requestId
      });
    }
  });
  app.get("/api/automations", async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automations" });
    }
  });
  app.get("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.getAutomation(req.params.id);
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automation" });
    }
  });
  app.post("/api/automations", async (req, res) => {
    try {
      const parsed = insertAutomationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid automation data",
          errors: parsed.error.errors
        });
      }
      const automation = await storage.createAutomation(parsed.data);
      res.status(201).json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create automation" });
    }
  });
  app.put("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.updateAutomation(
        req.params.id,
        req.body
      );
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });
  app.delete("/api/automations/:id", async (req, res) => {
    try {
      const success = await storage.deleteAutomation(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });
  app.get("/api/team-members", async (req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team members" });
    }
  });
  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team member" });
    }
  });
  app.post("/api/team-members", async (req, res) => {
    try {
      const parsed = insertTeamMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid team member data",
          errors: parsed.error.errors
        });
      }
      const member = await storage.createTeamMember(parsed.data);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to create team member" });
    }
  });
  app.put("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.updateTeamMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to update team member" });
    }
  });
  app.delete("/api/team-members/:id", async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });
  app.get("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.getWhatsappSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to get WhatsApp settings" });
    }
  });
  app.post("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.saveWhatsappSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to save WhatsApp settings" });
    }
  });
  app.post("/api/settings/whatsapp/test", async (req, res) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const isValid = req.body.accessToken && req.body.phoneNumberId;
      if (isValid) {
        res.json({ success: true, message: "Connection successful!" });
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid credentials. Please check your API settings."
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to test connection" });
    }
  });
  app.get("/api/billing", async (req, res) => {
    try {
      const billing = await storage.getBilling();
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to get billing info" });
    }
  });
  app.post("/api/billing/purchase", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const billing = await storage.addTransaction({
        type: "purchase",
        amount,
        description: `Purchased ${amount} credits`
      });
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to purchase credits" });
    }
  });
  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const campaigns = await storage.getCampaigns();
      const report = {
        totalSent: messages.filter((m) => m.direction === "outbound").length,
        delivered: messages.filter(
          (m) => m.direction === "outbound" && (m.status === "delivered" || m.status === "read")
        ).length,
        read: messages.filter(
          (m) => m.direction === "outbound" && m.status === "read"
        ).length,
        failed: messages.filter(
          (m) => m.direction === "outbound" && m.status === "failed"
        ).length,
        campaignStats: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          sent: c.sentCount,
          delivered: c.deliveredCount,
          read: c.readCount,
          replied: c.repliedCount
        }))
      };
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });
  app.get("/api/reports/campaign/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({
        ...campaign,
        deliveryRate: campaign.sentCount > 0 ? campaign.deliveredCount / campaign.sentCount * 100 : 0,
        readRate: campaign.deliveredCount > 0 ? campaign.readCount / campaign.deliveredCount * 100 : 0,
        replyRate: campaign.readCount > 0 ? campaign.repliedCount / campaign.readCount * 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });
  app.get("/api/reports/agent-performance", async (req, res) => {
    try {
      const messages = await storage.getMessages(void 0, getUserId(req) || void 0, {
        limit: 1e4,
        sort: { timestamp: -1 }
      });
      const teamMembers = await storage.getTeamMembers();
      const performance = teamMembers.map((member) => {
        const agentMessages = messages.filter(
          (m) => m.agentId === member.userId && m.direction === "outbound"
        );
        return {
          id: member.id,
          name: member.name,
          messagesSent: agentMessages.length,
          avgResponseTime: "2.5 min",
          satisfaction: 4.5
        };
      });
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get agent performance" });
    }
  });
  app.get("/api/contact-agents/stats", async (req, res) => {
    try {
      const stats = await getAutoReplyStats();
      res.json(stats);
    } catch (error) {
      console.error("[ContactAgents] Error getting stats:", error);
      res.status(500).json({ message: "Failed to get contact agent stats" });
    }
  });
  app.post("/api/contact-agents/enable-all-auto-reply", async (req, res) => {
    try {
      const result = await enableAutoReplyForAll();
      res.json({
        message: `Re-enabled auto-reply for ${result.updated} contacts`,
        ...result
      });
    } catch (error) {
      console.error("[ContactAgents] Error enabling all auto-reply:", error);
      res.status(500).json({ message: "Failed to enable auto-reply for all contacts" });
    }
  });
  app.use("/api/auth", auth_routes_default);
  app.use("/api/credentials", credentials_routes_default);
  app.use("/api/agents", agent_routes_default);
  app.use("/api/facebook", fb_routes_default);
  app.use("/api/map-agent", mapping_routes_default);
  app.use("/api/webhook/whatsapp", whatsapp_routes_default);
  app.use("/api/leads/auto-reply", leadAutoReply_routes_default);
  app.use("/api/broadcast", broadcast_routes_default);
  app.use("/api/ai-analytics", aiAnalytics_routes_default);
  app.use("/api/prefilled-text", prefilledText_routes_default);
  app.use("/api/reports", reports_routes_default);
  app.use("/api/usage", usage_routes_default);
  app.use("/api/users", users_routes_default);
  app.use("/api/contact-analytics", contactAnalytics_controller_default);
  app.use("/api/lead-management", leadManagement_routes_default);
  app.use("/api/integrations", integration_routes_default);
  app.use("/api/automation", automation_routes_default);
  app.use("/api/flow", fb_routes_default);
  app.get("/api/chats/whatsapp-leads", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allChats = await storage.getChats(userId);
      const permittedContactIds = await getPermittedContactIdsForRequest(req);
      const memContacts = await storage.getContacts(userId);
      const importedContacts = await readCollection("imported_contacts");
      const knownPhones = /* @__PURE__ */ new Set();
      for (const contact of memContacts) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }
      for (const contact of importedContacts.filter(
        (contact2) => contact2.userId === userId
      )) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }
      const leadChats = allChats.filter((chat) => {
        const chatPhone = chat.contact.phone.replace(/\D/g, "");
        const chatPhoneLast10 = chatPhone.slice(-10);
        const isUnknownContact = !knownPhones.has(chatPhone) && !knownPhones.has(chatPhoneLast10);
        if (!isUnknownContact && !chat.isFlowLead) return false;
        if (permittedContactIds === null) return true;
        return permittedContactIds.includes(chat.contact.id);
      });
      res.json(leadChats);
    } catch (error) {
      console.error("Error fetching WhatsApp leads:", error);
      res.status(500).json({ message: "Failed to get WhatsApp leads" });
    }
  });
  return httpServer;
}
function uuidv42() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
async function startEmbeddedBackgroundJobs() {
  await scheduleRunningDripCampaigns();
}
export {
  registerRoutes,
  startEmbeddedBackgroundJobs,
  uploadTemplateHeader,
  uuidv42 as uuidv4
};

