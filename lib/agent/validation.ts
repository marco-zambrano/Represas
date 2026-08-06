export const MAX_AGENT_MESSAGE_LENGTH = 2_000;

export class AgentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentInputError";
  }
}

export type AgentChatInput = {
  message: string;
  conversationId?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

export function parseAgentChatInput(value: unknown): AgentChatInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentInputError("La solicitud del agente no tiene un formato válido.");
  }

  const input = value as { message?: unknown; conversationId?: unknown };
  if (typeof input.message !== "string") {
    throw new AgentInputError("Escribe una pregunta para el agente.");
  }

  const message = input.message.trim();
  if (!message) {
    throw new AgentInputError("Escribe una pregunta para el agente.");
  }
  if (message.length > MAX_AGENT_MESSAGE_LENGTH) {
    throw new AgentInputError(`La pregunta no puede superar ${MAX_AGENT_MESSAGE_LENGTH.toLocaleString("es-EC")} caracteres.`);
  }

  if (input.conversationId === undefined || input.conversationId === null || input.conversationId === "") {
    return { message };
  }
  if (typeof input.conversationId !== "string" || !isUuid(input.conversationId)) {
    throw new AgentInputError("La conversación seleccionada no es válida.");
  }

  return { message, conversationId: input.conversationId };
}

export function titleFromQuestion(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length <= 72 ? compact : `${compact.slice(0, 69).trimEnd()}…`;
}
