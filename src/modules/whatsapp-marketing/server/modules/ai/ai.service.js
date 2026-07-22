import { sendChatCompletion, generateAgentResponse as generateOpenAIResponse } from "../openai/openai.service.js";
import { sendGeminiCompletion, generateGeminiAgentResponse } from "../gemini/gemini.service.js";
function isGeminiModel(model) {
  return model.startsWith("gemini-");
}
function isOpenAIModel(model) {
  return model.startsWith("gpt-") || !isGeminiModel(model);
}
async function generateAIResponse(messages, agent, userId) {
  const model = agent?.model || "gpt-4o";
  if (isGeminiModel(model)) {
    return sendGeminiCompletion(messages, agent, userId);
  }
  return sendChatCompletion(messages, agent, userId);
}
async function generateAgentResponse(userMessage, agent, conversationHistory = [], userId) {
  const model = agent?.model || "gpt-4o";
  if (isGeminiModel(model)) {
    return generateGeminiAgentResponse(userMessage, agent, conversationHistory, userId);
  }
  return generateOpenAIResponse(userMessage, agent, conversationHistory, userId);
}
function getProviderForModel(model) {
  return isGeminiModel(model) ? "gemini" : "openai";
}
const aiService = {
  generateAIResponse,
  generateAgentResponse,
  getProviderForModel,
  isGeminiModel,
  isOpenAIModel
};
export {
  aiService,
  generateAIResponse,
  generateAgentResponse,
  getProviderForModel
};
