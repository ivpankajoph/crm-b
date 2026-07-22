import { z } from "zod";
const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(["admin", "agent"]).default("agent"),
  avatar: z.string().optional(),
  createdAt: z.string()
});
const contactSchema = z.object({
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
const messageSchema = z.object({
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
const campaignSchema = z.object({
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
const templateSchema = z.object({
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
const automationSchema = z.object({
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
const teamMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["admin", "agent"]),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.string()
});
const whatsappSettingsSchema = z.object({
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
const billingSchema = z.object({
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
const dashboardStatsSchema = z.object({
  totalMessages: z.number(),
  delivered: z.number(),
  readRate: z.number(),
  replied: z.number(),
  messagesChange: z.number(),
  deliveredChange: z.number(),
  readRateChange: z.number(),
  repliedChange: z.number()
});
const chatSchema = z.object({
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
const insertUserSchema = userSchema.omit({ id: true, createdAt: true });
const insertContactSchema = contactSchema.omit({ id: true, createdAt: true, updatedAt: true });
const insertMessageSchema = messageSchema.omit({ id: true, timestamp: true });
const insertCampaignSchema = campaignSchema.omit({ id: true, createdAt: true, updatedAt: true, sentCount: true, deliveredCount: true, readCount: true, repliedCount: true });
const insertTemplateSchema = templateSchema.omit({ id: true, createdAt: true, updatedAt: true, status: true });
const insertAutomationSchema = automationSchema.omit({ id: true, createdAt: true, updatedAt: true });
const insertTeamMemberSchema = teamMemberSchema.omit({ id: true, createdAt: true });
export {
  automationSchema,
  billingSchema,
  campaignSchema,
  chatSchema,
  contactSchema,
  dashboardStatsSchema,
  insertAutomationSchema,
  insertCampaignSchema,
  insertContactSchema,
  insertMessageSchema,
  insertTeamMemberSchema,
  insertTemplateSchema,
  insertUserSchema,
  messageSchema,
  teamMemberSchema,
  templateSchema,
  userSchema,
  whatsappSettingsSchema
};
