const INTEGRATION_PROVIDERS = [
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
function getProvidersByCategory(category) {
  return INTEGRATION_PROVIDERS.filter((p) => p.category === category);
}
export {
  INTEGRATION_PROVIDERS,
  getProviderById,
  getProvidersByCategory
};
