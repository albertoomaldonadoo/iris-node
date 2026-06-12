import { createChatResponse } from "../lib/application/create-chat-response.js";
import { validateAndNormalizeChatRequest } from "../lib/domain/chat-contract.js";
import { getOllamaConfigError } from "../lib/infrastructure/ollama-client.js";
import { isAuthorizedRequest } from "../lib/interfaces/http-auth.js";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendError(res, status, error, details = []) {
  return res.status(status).json({
    error,
    ...(details.length > 0 && { details })
  });
}

function parseBody(req) {
  if (req.body === undefined || req.body === null) {
    return {};
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed");
  }

  if (!isAuthorizedRequest(req)) {
    return sendError(res, 401, "Unauthorized");
  }

  const configError = getOllamaConfigError();
  if (configError) {
    return sendError(res, 503, configError);
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return sendError(res, 400, "Invalid JSON body", [
      { message: "Request body must be valid JSON." }
    ]);
  }

  const validation = validateAndNormalizeChatRequest(body);
  if (!validation.ok) {
    return sendError(res, 400, "Invalid request body", validation.details);
  }

  try {
    const response = await createChatResponse(validation.value);
    return res.status(200).json(response);
  } catch (error) {
    console.error("Chat failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return sendError(res, 500, "Chat failed");
  }
}
