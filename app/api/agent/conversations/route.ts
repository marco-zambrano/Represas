import { NextResponse } from "next/server";

import type { AgentConversation } from "@/lib/agent/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function databaseMessage(error: { code?: string; message: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "El historial del agente aún no está preparado. Aplica la migración de Supabase del proyecto Represas.";
  }
  return "No fue posible cargar las conversaciones del agente.";
}

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("agent_conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: databaseMessage(error) }, { status: 500 });

  const conversations: AgentConversation[] = (data ?? []).map((conversation) => ({
    id: String(conversation.id),
    title: String(conversation.title),
    createdAt: String(conversation.created_at),
    updatedAt: String(conversation.updated_at),
  }));
  return NextResponse.json({ conversations }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
