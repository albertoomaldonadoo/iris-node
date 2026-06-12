import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createChatResponse } from "../lib/application/create-chat-response.js";
import {
  normalizeSimulatorMode,
  validateAndNormalizeChatRequest
} from "../lib/domain/chat-contract.js";
import { detectSafetyTrigger } from "../lib/domain/safety-policy.js";

describe("chat contract", () => {
  it("normalizes canonical chat requests", () => {
    const result = validateAndNormalizeChatRequest({
      messages: [{ role: "user", content: "Hola" }],
      language: "ES",
      simulatorMode: true
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
      messages: [{ role: "user", text: "Hola" }],
      language: "es",
      simulatorMode: "partner"
    });
  });

  it("rejects invalid messages with stable details", () => {
    const result = validateAndNormalizeChatRequest({
      messages: [{ role: "system", text: "" }],
      simulatorMode: "iris"
    });

    assert.equal(result.ok, false);
    assert.equal(result.details.some((detail) => detail.field === "messages.0.role"), true);
    assert.equal(result.details.some((detail) => detail.field === "messages.0.text"), true);
  });

  it("maps simulator mode values", () => {
    assert.equal(normalizeSimulatorMode("partner"), "partner");
    assert.equal(normalizeSimulatorMode("iris"), "iris");
    assert.equal(normalizeSimulatorMode(true), "partner");
    assert.equal(normalizeSimulatorMode(false), "iris");
    assert.equal(normalizeSimulatorMode("unknown"), null);
  });

  it("detects safety triggers with or without accents", () => {
    const messages = [{ role: "user", text: "Mi pareja me pide la ubicación todo el tiempo." }];
    assert.equal(detectSafetyTrigger(messages), true);
  });

  it("returns documented safety fields from the use case", async () => {
    const response = await createChatResponse(
      {
        messages: [{ role: "user", text: "No me deja salir con mis amigas" }],
        language: "es",
        simulatorMode: "iris"
      },
      {
        generateCompletion: async () => "Eso suena a control y es importante que puedas hablarlo con apoyo."
      }
    );

    assert.equal(response.response, "Eso suena a control y es importante que puedas hablarlo con apoyo.");
    assert.equal(response.safetyAlert, true);
    assert.match(response.safetyMessage, /016/);
  });

  it("detects toxic partner replies in partner mode", async () => {
    const response = await createChatResponse(
      {
        messages: [{ role: "user", text: "Donde estabas?" }],
        language: "es",
        simulatorMode: "partner"
      },
      {
        generateCompletion: async () => "No tengo que explicarte nada. Si no te gusta, es tu problema."
      }
    );

    assert.equal(response.safetyAlert, true);
    assert.match(response.response, /No tengo que explicarte nada/);
  });
});
