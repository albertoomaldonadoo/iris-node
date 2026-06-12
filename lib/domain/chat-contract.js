const ALLOWED_ROLES = new Set(["user", "assistant"]);
const ALLOWED_SIMULATOR_MODES = new Set(["iris", "partner"]);
const MAX_LANGUAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 10000;

function detail(field, message) {
  return { field, message };
}

export function normalizeSimulatorMode(value = "iris") {
  if (typeof value === "boolean") {
    return value ? "partner" : "iris";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ALLOWED_SIMULATOR_MODES.has(normalized) ? normalized : null;
}

export function normalizeLanguage(value = "es") {
  if (value === undefined || value === null || value === "") {
    return { value: "es" };
  }

  if (typeof value !== "string") {
    return { error: detail("language", "language must be a string.") };
  }

  const normalized = value.trim().toLowerCase() || "es";
  if (normalized.length > MAX_LANGUAGE_LENGTH) {
    return { error: detail("language", "language must be at most 10 characters.") };
  }

  return { value: normalized };
}

function normalizeMessages(body, errors) {
  const sourceMessages = Array.isArray(body?.messages)
    ? body.messages
    : body?.message
      ? [{ role: "user", text: body.message }]
      : null;

  if (!Array.isArray(sourceMessages)) {
    errors.push(detail("messages", "messages is required."));
    return [];
  }

  if (sourceMessages.length === 0) {
    errors.push(detail("messages", "messages must be a non-empty array."));
    return [];
  }

  return sourceMessages.map((message, index) => {
    const role = message?.role;
    const text = typeof message?.text === "string" ? message.text : message?.content;
    const fieldPrefix = `messages.${index}`;

    if (typeof role !== "string") {
      errors.push(detail(`${fieldPrefix}.role`, "Each message role must be a string."));
    } else if (!ALLOWED_ROLES.has(role)) {
      errors.push(detail(`${fieldPrefix}.role`, "Each message role must be one of: user, assistant."));
    }

    if (typeof text !== "string") {
      errors.push(detail(`${fieldPrefix}.text`, "Each message needs text or content."));
    } else {
      const trimmed = text.trim();
      if (trimmed.length < 1 || trimmed.length > MAX_MESSAGE_LENGTH) {
        errors.push(
          detail(
            `${fieldPrefix}.text`,
            "Each message text/content must be between 1 and 10000 characters."
          )
        );
      }
    }

    return {
      role: role === "assistant" ? "assistant" : "user",
      text: typeof text === "string" ? text.trim() : ""
    };
  });
}

export function validateAndNormalizeChatRequest(body) {
  const errors = [];
  const languageResult = normalizeLanguage(body?.language);
  const simulatorMode = normalizeSimulatorMode(body?.simulatorMode ?? "iris");
  const messages = normalizeMessages(body, errors);

  if (languageResult.error) {
    errors.push(languageResult.error);
  }

  if (!simulatorMode) {
    errors.push(
      detail("simulatorMode", "simulatorMode must be a boolean or one of: iris, partner.")
    );
  }

  if (errors.length > 0) {
    return { ok: false, details: errors };
  }

  return {
    ok: true,
    value: {
      messages,
      language: languageResult.value,
      simulatorMode
    }
  };
}
