import { credentialsService } from "../credentials/credentials.service.js";
const SYSTEM_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
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
async function generateAgentResponse(userMessage, agent, conversationHistory = [], userId) {
  const messages = [
    ...conversationHistory,
    { role: "user", content: userMessage }
  ];
  return sendChatCompletion(messages, agent, userId);
}
async function testOpenAIConnection(userId) {
  const apiKey = await getOpenAIApiKey(userId);
  if (!apiKey) {
    return false;
  }
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    return response.ok;
  } catch (error) {
    console.error("[OpenAI Service] Connection test failed:", error);
    return false;
  }
}
export {
  generateAgentResponse,
  sendChatCompletion,
  testOpenAIConnection
};
