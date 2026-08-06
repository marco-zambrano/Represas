import { NextResponse } from "next/server";
import { getNationalDemand } from "@/lib/data/cenace";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await getNationalDemand();
  return NextResponse.json(data, {
    status: data.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
