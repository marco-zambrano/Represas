import type { PlantId } from "./catalog";
import type { Observation, Period, TelemetryResponse } from "./types";

function readNumber(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function normalize(record: Record<string, unknown>): Observation {
  return { timestamp: String(record.timestamp ?? record.fecha ?? record.date ?? ""), generationMw: readNumber(record.generationMw ?? record.generacion_mw ?? record.mw), flowM3s: readNumber(record.flowM3s ?? record.caudal ?? record.flow), elevationM: readNumber(record.elevationM ?? record.cota), activeUnits: readNumber(record.activeUnits ?? record.unidades_activas ?? record.turbinas) };
}
export async function getTelemetry(plant: PlantId, period: Period): Promise<TelemetryResponse> {
  const endpoint = process.env.CELEC_TELEMETRY_URL;
  if (!endpoint) return { plant, period, source: "CELEC", retrievedAt: new Date().toISOString(), observations: [], error: "La ruta de telemetría CELEC aún no está configurada." };
  try {
    const url = new URL(endpoint); url.searchParams.set("plant", plant); url.searchParams.set("period", period);
    const response = await fetch(url, { next: { revalidate: 300 }, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`CELEC respondió ${response.status}`);
    const body = await response.json() as unknown;
    const rows = Array.isArray(body) ? body : Array.isArray((body as { items?: unknown[] }).items) ? (body as { items: unknown[] }).items : [];
    return { plant, period, source: "CELEC", retrievedAt: new Date().toISOString(), observations: rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")).map(normalize).filter((row) => row.timestamp) };
  } catch (error) { return { plant, period, source: "CELEC", retrievedAt: new Date().toISOString(), observations: [], error: error instanceof Error ? error.message : "No fue posible consultar CELEC." }; }
}
export function estimateCocaFlow(inputs: { h0719?: number | null; h0728?: number | null; m1124Lag9?: number | null; m5247Lag6?: number | null; m5124Lag6?: number | null }) {
  const values = Object.values(inputs); if (values.some((value) => value === null || value === undefined || !Number.isFinite(value))) return null;
  return 219.53 * inputs.h0719! + 115.85 * inputs.h0728! - 7.86 * inputs.m1124Lag9! + 42.8 * inputs.m5247Lag6! + .5 * inputs.m5124Lag6! - 47.79;
}
