import { NextResponse } from "next/server";

import { collectAgentEvidence } from "@/lib/agent/context";
import { AgentConfigurationError, AgentResponseError, assertAgentConfigured, generateAgentAnswer } from "@/lib/agent/openai";
import type { AgentConversation, AgentEvidence, AgentMessage, AgentMessageRole } from "@/lib/agent/types";
import { AgentInputError, parseAgentChatInput, titleFromQuestion } from "@/lib/agent/validation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function conversationFromRow(row: Record<string, unknown>): AgentConversation {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function messageFromRow(row: Record<string, unknown>): AgentMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: row.role === "assistant" ? "assistant" : "user" as AgentMessageRole,
    content: String(row.content),
    createdAt: String(row.created_at),
    evidence: row.evidence && typeof row.evidence === "object" ? row.evidence as AgentEvidence : null,
  };
}

function databaseErrorMessage(error: { code?: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "El historial del agente aún no está preparado. Aplica la migración de Supabase del proyecto Represas.";
  }
  return "No fue posible guardar o recuperar el historial del agente.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let input;
  try {
    input = parseAgentChatInput(await request.json());
    assertAgentConfigured();
  } catch (error) {
    if (error instanceof AgentInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AgentConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: "No fue posible leer la pregunta." }, { status: 400 });
  }

  let conversationRow: Record<string, unknown> | null;
  if (input.conversationId) {
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });
    conversationRow = data as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({ user_id: userId, title: titleFromQuestion(input.message) })
      .select("id, title, created_at, updated_at")
      .single();
    if (error || !data) return NextResponse.json({ error: databaseErrorMessage(error ?? {}) }, { status: 500 });
    conversationRow = data as Record<string, unknown>;
  }

  const conversationId = String(conversationRow.id);
  const { data: savedUserRow, error: userMessageError } = await supabase
    .from("agent_messages")
    .insert({ conversation_id: conversationId, role: "user", content: input.message })
    .select("id, conversation_id, role, content, evidence, created_at")
    .single();
  if (userMessageError || !savedUserRow) return NextResponse.json({ error: databaseErrorMessage(userMessageError ?? {}) }, { status: 500 });

  const [{ data: historyRows, error: historyError }, evidence] = await Promise.all([
    supabase
      .from("agent_messages")
      .select("id, conversation_id, role, content, evidence, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12),
    collectAgentEvidence(),
  ]);
  if (historyError) return NextResponse.json({ error: databaseErrorMessage(historyError) }, { status: 500 });

  let answer;
  try {
    answer = await generateAgentAnswer({
      evidence,
      history: (historyRows ?? []).reverse().map((row) => messageFromRow(row as Record<string, unknown>)),
      question: input.message,
      userId,
    });
  } catch (error) {
    if (error instanceof AgentConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof AgentResponseError) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ error: "No fue posible generar una respuesta del agente. Intenta de nuevo." }, { status: 502 });
  }

  const { data: savedAssistantRow, error: assistantMessageError } = await supabase
    .from("agent_messages")
    .insert({ conversation_id: conversationId, role: "assistant", content: answer.content, evidence })
    .select("id, conversation_id, role, content, evidence, created_at")
    .single();
  if (assistantMessageError || !savedAssistantRow) return NextResponse.json({ error: databaseErrorMessage(assistantMessageError ?? {}) }, { status: 500 });

  const { data: updatedConversationRow, error: updateError } = await supabase
    .from("agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("id, title, created_at, updated_at")
    .single();
  if (updateError || !updatedConversationRow) return NextResponse.json({ error: databaseErrorMessage(updateError ?? {}) }, { status: 500 });

  return NextResponse.json({
    conversation: conversationFromRow(updatedConversationRow as Record<string, unknown>),
    userMessage: messageFromRow(savedUserRow as Record<string, unknown>),
    assistantMessage: messageFromRow(savedAssistantRow as Record<string, unknown>),
    model: answer.model,
  }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
