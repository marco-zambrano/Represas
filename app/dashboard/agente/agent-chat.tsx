"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import type { AgentChatResponse, AgentConversation, AgentEvidence, AgentMessage } from "@/lib/agent/types";

const suggestions = [
  "Compara el caudal observado y el pronóstico de las cinco centrales.",
  "¿Qué centrales muestran cambios relevantes frente a su última publicación?",
  "Resume el contexto hidroeléctrico junto con la demanda nacional actual.",
  "¿Qué información existe para Coca Codo Sinclair a tres horas y cuáles son sus límites?",
];

type ConversationPayload = { conversation: AgentConversation; messages: AgentMessage[] };

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorMessage(value: unknown, fallback: string) {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function latestEvidence(messages: AgentMessage[]): AgentEvidence | null {
  return [...messages].reverse().find((message) => message.role === "assistant" && message.evidence)?.evidence ?? null;
}

export function AgentChat() {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/conversations")
      .then(async (response) => {
        const body = await response.json() as { conversations?: AgentConversation[]; error?: string };
        if (!response.ok) throw new Error(errorMessage(body, "No fue posible cargar las conversaciones."));
        return body.conversations ?? [];
      })
      .then((items) => { if (!cancelled) setConversations(items); })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "No fue posible cargar las conversaciones.");
      })
      .finally(() => { if (!cancelled) setLoadingConversations(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) ?? null,
    [conversationId, conversations],
  );
  const evidence = useMemo(() => latestEvidence(messages), [messages]);

  const openConversation = async (id: string) => {
    if (id === conversationId || loadingConversation || sending) return;
    setConversationId(id);
    setMessages([]);
    setError(null);
    setLoadingConversation(true);
    try {
      const response = await fetch(`/api/agent/conversations/${id}`);
      const body = await response.json() as Partial<ConversationPayload> & { error?: string };
      if (!response.ok || !body.conversation || !body.messages) throw new Error(errorMessage(body, "No fue posible abrir la conversación."));
      setMessages(body.messages);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible abrir la conversación.");
    } finally {
      setLoadingConversation(false);
    }
  };

  const newConversation = () => {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;

    const temporaryId = `pending-${Date.now()}`;
    const optimisticMessage: AgentMessage = {
      id: temporaryId,
      conversationId: conversationId ?? "",
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
      evidence: null,
    };
    setDraft("");
    setError(null);
    setSending(true);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, ...(conversationId ? { conversationId } : {}) }),
      });
      const body = await response.json() as Partial<AgentChatResponse> & { error?: string };
      if (!response.ok || !body.conversation || !body.userMessage || !body.assistantMessage) {
        throw new Error(errorMessage(body, "No fue posible recibir una respuesta del agente."));
      }

      setConversationId(body.conversation.id);
      setConversations((current) => [body.conversation!, ...current.filter((item) => item.id !== body.conversation!.id)]);
      setMessages((current) => [
        ...current.filter((message) => message.id !== temporaryId),
        body.userMessage!,
        body.assistantMessage!,
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No fue posible recibir una respuesta del agente.");
    } finally {
      setSending(false);
    }
  };

  return <div className="shell agent-page py-7 sm:py-9">
    <section className="agent-heading">
      <div>
        <p className="eyebrow">Agente conversacional · datos públicos verificables</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Pregunta, compara y entiende el sistema hidroeléctrico</h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">El agente interpreta la telemetría de las cinco centrales, los pronósticos de caudal y la demanda nacional actual. No emite alertas ni instrucciones operativas.</p>
      </div>
      <div className="agent-scope" aria-label="Fuentes que analiza el agente">
        <span>CELEC</span><span>GEOGLOWS</span><span>INAMHI</span><span>CENACE</span>
      </div>
    </section>

    <section className="agent-layout mt-6" aria-label="Conversación con el Agente HidroVista">
      <aside className="agent-sidebar panel">
        <div className="agent-sidebar-head">
          <div><p className="eyebrow">Historial privado</p><h2>Conversaciones</h2></div>
          <button type="button" className="agent-new-conversation" onClick={newConversation} disabled={sending} aria-label="Crear nueva conversación">+</button>
        </div>
        <button type="button" className="button button-primary agent-new-button" onClick={newConversation} disabled={sending}>Nueva conversación</button>
        <div className="agent-conversation-list" aria-live="polite">
          {loadingConversations ? <div className="agent-sidebar-loading">Cargando historial…</div> : conversations.length ? conversations.map((conversation) => <button key={conversation.id} type="button" className={`agent-conversation-item ${conversation.id === conversationId ? "agent-conversation-item-active" : ""}`} onClick={() => void openConversation(conversation.id)} disabled={sending || loadingConversation}>
            <strong>{conversation.title}</strong><span>{formatDate(conversation.updatedAt)}</span>
          </button>) : <p className="agent-sidebar-empty">Tus conversaciones aparecerán aquí cuando hagas tu primera pregunta.</p>}
        </div>
      </aside>

      <div className="agent-chat-panel panel">
        <header className="agent-chat-head">
          <div><p className="eyebrow">{selectedConversation ? "Conversación activa" : "Nueva conversación"}</p><h2>{selectedConversation?.title ?? "Agente HidroVista"}</h2></div>
          <span className="agent-live-chip"><i aria-hidden="true" />Contexto en vivo</span>
        </header>

        <div className="agent-messages" aria-live="polite" aria-busy={sending || loadingConversation}>
          {loadingConversation ? <div className="agent-chat-loading">Cargando conversación…</div> : messages.length ? messages.map((message) => <article key={message.id} className={`agent-message agent-message-${message.role}`}>
            <p className="agent-message-label">{message.role === "assistant" ? "Agente HidroVista" : "Tú"}<span>{formatDate(message.createdAt)}</span></p>
            <div className="agent-message-body">{message.content}</div>
          </article>) : <Welcome onSuggestion={setDraft} />}
          {sending && <article className="agent-message agent-message-assistant agent-message-pending"><p className="agent-message-label">Agente HidroVista</p><div className="agent-typing"><i /><i /><i /><span>Analizando fuentes actuales…</span></div></article>}
        </div>

        {error && <p className="agent-error" role="alert">{error}</p>}
        <form className="agent-composer" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="agent-question">Pregunta al Agente HidroVista</label>
          <textarea id="agent-question" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={3} placeholder="Ej.: ¿Cómo se compara el caudal actual entre las centrales?" disabled={sending || loadingConversation} />
          <div className="agent-composer-foot"><span>{draft.length}/2.000</span><button type="submit" className="button button-primary" disabled={!draft.trim() || sending || loadingConversation}>{sending ? "Analizando…" : "Enviar pregunta"}</button></div>
        </form>
      </div>

      <aside className="agent-evidence panel" aria-label="Evidencia del contexto actual">
        <div><p className="eyebrow">Evidencia</p><h2>Contexto utilizado</h2></div>
        {evidence ? <Evidence evidence={evidence} /> : <div className="agent-evidence-empty"><p>La respuesta del agente mostrará aquí las fuentes y la hora del contexto empleado.</p></div>}
        <div className="agent-boundary"><strong>Límites</strong><p>Un pronóstico no es una medición. Los datos no publicados se conservan como ausencia y no se convierten en cero.</p></div>
      </aside>
    </section>
  </div>;
}

function Welcome({ onSuggestion }: { onSuggestion: (value: string) => void }) {
  return <div className="agent-welcome">
    <div className="agent-welcome-mark" aria-hidden="true">⌁</div>
    <h2>¿Qué quieres analizar?</h2>
    <p>Elige una pregunta o escribe la tuya. En cada respuesta se conserva la diferencia entre observación, pronóstico y dato preliminar.</p>
    <div className="agent-suggestions">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)}>{suggestion}</button>)}</div>
  </div>;
}

function Evidence({ evidence }: { evidence: AgentEvidence }) {
  const available = evidence.sourceSummary.filter((source) => source.availability === "available").map((source) => source.source);
  const unavailable = evidence.sourceSummary.filter((source) => source.availability !== "available");
  return <div className="agent-evidence-content">
    <p className="agent-evidence-time">Consultado: <strong>{formatDate(evidence.generatedAt)}</strong></p>
    <div className="agent-source-list"><p>Fuentes disponibles</p>{available.length ? available.map((source) => <span key={source} className="agent-source-available">{source}</span>) : <span>Sin fuentes disponibles</span>}</div>
    {unavailable.length ? <div className="agent-source-list"><p>Con limitaciones</p>{unavailable.map((source) => <span key={source.source} className="agent-source-limited">{source.source} · {source.availability === "unconfigured" ? "sin configurar" : "no disponible"}</span>)}</div> : null}
    <div className="agent-evidence-plants"><p>Centrales incluidas</p>{evidence.plants.map((plant) => <div key={plant.id}><strong>{plant.name}</strong><span>{plant.latest?.timestamp ? formatDate(plant.latest.timestamp) : "sin dato observado"}</span></div>)}</div>
    <div className="agent-demand-evidence"><p>Demanda nacional</p><strong>{evidence.nationalDemand.nationalDemandMw === null ? "Sin dato" : `${new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(evidence.nationalDemand.nationalDemandMw)} MW`}</strong><span>{evidence.nationalDemand.dataAsOf ?? "snapshot sin fecha publicada"}</span></div>
  </div>;
}
