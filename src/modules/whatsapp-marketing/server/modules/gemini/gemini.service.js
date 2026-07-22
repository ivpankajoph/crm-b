import { GoogleGenAI } from "@google/genai";
import { credentialsService } from "../credentials/credentials.service.js";
const SYSTEM_GOOGLE_API_KEY = process.env.GEMINI_API_KEY?.trim();
const SYSTEM_GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
let loggedDualKeyWarning = false;
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
  const modelMap = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-1.5-pro": "gemini-1.5-pro"
  };
  return modelMap[model] || "gemini-2.5-flash";
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
async function generateGeminiAgentResponse(userMessage, agent, conversationHistory = [], userId) {
  const messages = [
    ...conversationHistory,
    { role: "user", content: userMessage }
  ];
  return sendGeminiCompletion(messages, agent, userId);
}
async function testGeminiConnection(userId) {
  const apiKey = await getGeminiApiKey(userId);
  if (!apiKey) {
    return false;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello"
    });
    return !!response.text;
  } catch (error) {
    console.error("[Gemini Service] Connection test failed:", error);
    return false;
  }
}
export {
  generateGeminiAgentResponse,
  sendGeminiCompletion,
  testGeminiConnection
};
