import { buildSystemPrompt } from "../domain/chat-prompts.js";
import { buildSafetyMessage, detectSafetyTrigger } from "../domain/safety-policy.js";
import { generateOllamaCompletion } from "../infrastructure/ollama-client.js";

const RECENT_MESSAGE_LIMIT = 6;

function removePartnerEcho(response, recentMessages) {
  const lastUser = [...recentMessages].reverse().find((message) => message.role === "user");
  const userText = lastUser?.text?.trim() || "";

  if (userText.length < 12) {
    return response;
  }

  const original = response;
  let cleaned = response;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userLower = userText.toLowerCase();
    const responseLower = cleaned.toLowerCase();
    let prefixLength = 0;

    for (let index = 12; index <= Math.min(userLower.length, responseLower.length); index += 1) {
      if (userLower.slice(0, index) === responseLower.slice(0, index)) {
        prefixLength = index;
      }
    }

    if (prefixLength < 12 || cleaned.length <= prefixLength) {
      break;
    }

    cleaned = cleaned.slice(prefixLength).trim();
  }

  return cleaned.length >= 2 ? cleaned : original;
}

function dedupeRepeatedStart(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);

  if (parts.length >= 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts.slice(1).join(" ");
  }

  return cleaned;
}

function removeTruncatedRestart(text) {
  if (!text || text.length < 18) {
    return text;
  }

  const cleaned = text.replace(/\s+/g, " ").trim();

  for (let length = 8; length <= Math.min(40, Math.floor(cleaned.length / 2)); length += 1) {
    const prefix = cleaned.slice(0, length);
    const rest = cleaned.slice(length);
    const index = rest.indexOf(prefix);

    if (index !== -1) {
      const cut = cleaned.slice(0, length + index).trim();
      if (cut.length >= 8) {
        return cut;
      }
    }
  }

  return cleaned;
}

function stripGeneratedAlertText(text, language) {
  let didStrip = false;
  let cleaned = text;

  if (/alerta de seguridad/i.test(cleaned) || /safety alert/i.test(cleaned)) {
    didStrip = true;
    cleaned = cleaned
      .replace(/^\s*(?:alerta de seguridad|safety alert)\s*:?\s*/i, "")
      .replace(/\s*(?:alerta de seguridad|safety alert)\s*:?\s*.*/i, "")
      .trim();
  }

  if (didStrip && cleaned.length < 10) {
    cleaned = language.startsWith("en")
      ? "If you need to talk or support, I am here. You can contact 016 or emergency services."
      : "Si necesitas hablar o apoyo, aqui estoy. Puedes contactar con el 016 si lo necesitas.";
  }

  return { text: cleaned, didStrip };
}

async function completeTruncatedResponse(response, generateCompletion, language) {
  const endsWithPunctuation = /[.!?]$/;
  let completed = response;

  for (let attempt = 0; attempt < 2 && completed && !endsWithPunctuation.test(completed.trim()); attempt += 1) {
    let base = completed.replace(/\s+[a-zA-ZáéíóúñÁÉÍÓÚÑ]{1,5}$/u, "").trim();
    if (base.length < 8) {
      base = completed;
    }

    const systemPrompt = language.startsWith("en")
      ? "Finish the previous reply in one complete sentence. Reply with only the continuation, no repetition."
      : "Termina la respuesta anterior en una sola frase. Responde solo con la continuacion, sin repetir lo anterior.";

    const fix = await generateCompletion({
      systemPrompt,
      messages: [{ role: "user", text: `Respuesta anterior: ${base}` }],
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 150
    });

    if (!fix) {
      break;
    }

    completed = `${base} ${fix.replace(/^[.,;]\s*/, "")}`.trim();
  }

  if (completed && completed.length > 2 && !endsWithPunctuation.test(completed.trim())) {
    const trimmed = completed.trim();
    return trimmed.endsWith(",") || trimmed.endsWith(" y") ? `${trimmed}...` : `${trimmed}.`;
  }

  return completed;
}

function cleanResponse(response, { simulatorMode, recentMessages, alreadyGreeted, language }) {
  let cleaned = response || "";

  if (simulatorMode === "partner") {
    cleaned = removePartnerEcho(cleaned, recentMessages);
  }

  cleaned = dedupeRepeatedStart(cleaned);
  cleaned = removeTruncatedRestart(cleaned);
  cleaned = cleaned.replace(/^¡?hola!?\s*/i, alreadyGreeted ? "" : "$&").trim();

  const stripped = stripGeneratedAlertText(cleaned, language);
  return stripped;
}

export async function createChatResponse(
  request,
  { generateCompletion = generateOllamaCompletion } = {}
) {
  const { messages, language, simulatorMode } = request;
  const isPartnerMode = simulatorMode === "partner";
  const filteredMessages = messages.filter((message) => message.text);
  const recentMessages = filteredMessages.slice(-RECENT_MESSAGE_LIMIT);
  const alreadyGreeted = recentMessages.some((message) => message.role === "assistant");
  const initialSafetyTrigger = detectSafetyTrigger(messages, { includeAssistant: isPartnerMode });

  const baseSystemPrompt = buildSystemPrompt(simulatorMode, language);
  const systemPrompt = alreadyGreeted
    ? `${baseSystemPrompt}\nDo not greet or restart the conversation.`
    : baseSystemPrompt;

  const rawResponse = await generateCompletion({
    systemPrompt,
    messages: recentMessages,
    temperature: isPartnerMode ? 0.75 : 0.5,
    topP: 0.9,
    maxTokens: isPartnerMode ? 280 : 512
  });

  const { text, didStrip } = cleanResponse(rawResponse, {
    simulatorMode,
    recentMessages,
    alreadyGreeted,
    language
  });

  const response = await completeTruncatedResponse(text, generateCompletion, language);
  const finalSafetyTrigger =
    initialSafetyTrigger ||
    didStrip ||
    (isPartnerMode && detectSafetyTrigger([{ role: "assistant", text: response }], { includeAssistant: true }));

  return {
    response,
    ...(finalSafetyTrigger && {
      safetyAlert: true,
      safetyMessage: buildSafetyMessage(language)
    })
  };
}
