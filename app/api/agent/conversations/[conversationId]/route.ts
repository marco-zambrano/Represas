import { NextResponse } from "next/server";

import type { AgentConversation, AgentEvidence, AgentMessage, AgentMessageRole } from "@/lib/agent/types";
import { isUuid } from "@/lib/agent/validation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteProps = { params: Promise<{ conversationId: string }> };

function databaseMessage(error: { code?: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "El historial del agente aún no está preparado. Aplica la migración de Supabase del proyecto Represas.";
  }
  return "No fue posible cargar la conversación.";
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

export async function GET(_request: Request, { params }: RouteProps) {
  const { conversationId } = await params;
  if (!isUuid(conversationId)) return NextResponse.json({ error: "La conversación seleccionada no es válida." }, { status: 400 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [{ data: conversation, error: conversationError }, { data: messageRows, error: messagesError }] = await Promise.all([
    supabase.from("agent_conversations").select("id, title, created_at, updated_at").eq("id", conversationId).maybeSingle(),
    supabase.from("agent_messages").select("id, conversation_id, role, content, evidence, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  if (conversationError || messagesError) {
    return NextResponse.json({ error: databaseMessage(conversationError ?? messagesError ?? {}) }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "No se encontró esa conversación." }, { status: 404 });

  const response: AgentConversation = {
    id: String(conversation.id),
    title: String(conversation.title),
    createdAt: String(conversation.created_at),
    updatedAt: String(conversation.updated_at),
  };
  return NextResponse.json({ conversation: response, messages: (messageRows ?? []).map((row) => messageFromRow(row as Record<string, unknown>)) }, {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
