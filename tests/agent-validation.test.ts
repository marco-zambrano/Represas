import assert from "node:assert/strict";
import test from "node:test";

import { AgentInputError, MAX_AGENT_MESSAGE_LENGTH, parseAgentChatInput, titleFromQuestion } from "../lib/agent/validation";

test("la entrada del agente normaliza una pregunta y una conversación opcional", () => {
  assert.deepEqual(parseAgentChatInput({ message: "  Compara Mazar y Paute.  " }), { message: "Compara Mazar y Paute." });
  assert.deepEqual(parseAgentChatInput({
    message: "Resume Coca Codo.",
    conversationId: "f9fe5e9a-2410-44b1-a338-a768b6cb5a50",
  }), {
    message: "Resume Coca Codo.",
    conversationId: "f9fe5e9a-2410-44b1-a338-a768b6cb5a50",
  });
});

test("la entrada del agente rechaza preguntas vacías, largas o IDs inválidos", () => {
  assert.throws(() => parseAgentChatInput({ message: " " }), AgentInputError);
  assert.throws(() => parseAgentChatInput({ message: "x".repeat(MAX_AGENT_MESSAGE_LENGTH + 1) }), AgentInputError);
  assert.throws(() => parseAgentChatInput({ message: "Hola", conversationId: "no-es-un-uuid" }), AgentInputError);
});

test("el título de conversación conserva una frase corta y trunca de manera legible", () => {
  assert.equal(titleFromQuestion("¿Cómo está Mazar?"), "¿Cómo está Mazar?");
  assert.match(titleFromQuestion("x".repeat(90)), /…$/);
  assert.ok(titleFromQuestion("x".repeat(90)).length <= 72);
});
