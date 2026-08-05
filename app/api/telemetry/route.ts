import { NextResponse } from "next/server";
import { isPlantId } from "@/lib/data/catalog";
import { getTelemetry } from "@/lib/data/providers";
import type { Period } from "@/lib/data/types";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient(); const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const params = new URL(request.url).searchParams; const plant = params.get("plant") ?? ""; const period = params.get("period") ?? "day";
  if (!isPlantId(plant) || !["day", "month", "year"].includes(period)) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  const data = await getTelemetry(plant, period as Period);
  return NextResponse.json(data, { status: data.error ? 503 : 200, headers: { "Cache-Control": "private, max-age=60" } });
}
