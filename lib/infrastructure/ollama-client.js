const DEFAULT_MODEL = "llama3.1:latest";
const DEFAULT_TIMEOUT_MS = 55000;

export function getOllamaConfig() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim().replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  return {
    baseUrl,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS
  };
}

export function getOllamaConfigError(config = getOllamaConfig()) {
  if (!config.baseUrl) {
    return "OLLAMA_BASE_URL is not configured";
  }

  try {
    new URL(config.baseUrl);
  } catch {
    return "OLLAMA_BASE_URL must be a valid URL";
  }

  return null;
}

function buildOllamaMessages(systemPrompt, messages) {
  return [
    { role: "system", content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.text
    }))
  ];
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateOllamaCompletion({
  systemPrompt,
  messages,
  temperature,
  topP,
  maxTokens
}) {
  const config = getOllamaConfig();
  const configError = getOllamaConfigError(config);

  if (configError) {
    throw new Error(configError);
  }

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: buildOllamaMessages(systemPrompt, messages),
        stream: false,
        options: {
          temperature,
          top_p: topP,
          num_predict: maxTokens
        }
      })
    },
    config.timeoutMs
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama request failed with status ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return (data.message?.content ?? "").trim();
}

export async function listOllamaModels() {
  const config = getOllamaConfig();
  const configError = getOllamaConfigError(config);

  if (configError) {
    throw new Error(configError);
  }

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/tags`,
    { method: "GET" },
    config.timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Ollama model list failed with status ${response.status}`);
  }

  const data = await response.json();
  return (data.models || []).map((model) => ({
    name: model.name,
    displayName: model.name,
    size: model.size,
    modifiedAt: model.modified_at
  }));
}
