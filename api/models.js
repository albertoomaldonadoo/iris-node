import { getOllamaConfigError, listOllamaModels } from "../lib/infrastructure/ollama-client.js";
import { isAuthorizedRequest } from "../lib/interfaces/http-auth.js";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorizedRequest(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const configError = getOllamaConfigError();
  if (configError) {
    return res.status(503).json({ error: configError });
  }

  try {
    const models = await listOllamaModels();
    return res.status(200).json({ models, provider: "ollama" });
  } catch (error) {
    console.error("List models failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: "List models failed" });
  }
}
