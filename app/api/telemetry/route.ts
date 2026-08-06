import { NextResponse } from "next/server";

import { isPlantId } from "@/lib/data/catalog";
import { DataRequestError, getTelemetry, resolveTelemetryRequest } from "@/lib/data/providers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const plant = searchParams.get("plant") ?? "";
  if (!isPlantId(plant)) {
    return NextResponse.json({ error: "Central inválida" }, { status: 400 });
  }

  try {
    const telemetryRequest = resolveTelemetryRequest(searchParams);
    const data = await getTelemetry(plant, telemetryRequest);
    return NextResponse.json(data, {
      status: data.error ? 503 : 200,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  } catch (error) {
    if (error instanceof DataRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "No fue posible preparar la consulta de telemetría." }, { status: 500 });
  }
}
