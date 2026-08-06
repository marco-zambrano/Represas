import "server-only";

import { getNationalDemand } from "@/lib/data/cenace";
import { plants } from "@/lib/data/catalog";
import { getForecast, getTelemetry, resolveTelemetryRequest } from "@/lib/data/providers";
import type { SourceStatus } from "@/lib/data/types";
import { mergeSourceStatuses, summarizeAgentPlant } from "./summary";
import type { AgentDemandEvidence, AgentEvidence } from "./types";

function summarizeDemand(demand: Awaited<ReturnType<typeof getNationalDemand>>): AgentDemandEvidence {
  return {
    status: demand.status,
    dataAsOf: demand.dataAsOf,
    retrievedAt: demand.retrievedAt,
    nationalDemandMw: demand.metrics.nationalDemandMw,
    previousDemandMw: demand.metrics.previousDemandMw,
    cnelDemandMw: demand.metrics.cnelDemandMw,
    electricityCompaniesMw: demand.metrics.electricityCompaniesMw,
    topDistributors: demand.distributors.slice(0, 5).map((item) => ({
      name: item.name,
      mw: item.mw,
      percentageOfNationalDemand: item.percentageOfNationalDemand,
    })),
    ...(demand.error ? { message: demand.error } : {}),
  };
}

export async function collectAgentEvidence(now = new Date()): Promise<AgentEvidence> {
  const request = resolveTelemetryRequest(new URLSearchParams(), now);
  const [telemetry, demand] = await Promise.all([
    Promise.all(plants.map((plant) => getTelemetry(plant.id, request))),
    getNationalDemand(),
  ]);
  const forecasts = await Promise.all(
    plants.map((plant, index) => getForecast(plant.id, request.range, telemetry[index])),
  );
  const plantEvidence = plants.map((plant, index) => summarizeAgentPlant(plant, telemetry[index], forecasts[index]));
  const demandSource: SourceStatus = {
    source: "CENACE",
    availability: demand.status === "unavailable" ? "unavailable" : "available",
    retrievedAt: demand.retrievedAt,
    ...(demand.error ? { message: demand.error } : {}),
  };

  return {
    generatedAt: now.toISOString(),
    modelContextVersion: 1,
    plants: plantEvidence,
    nationalDemand: summarizeDemand(demand),
    sourceSummary: mergeSourceStatuses(...plantEvidence.map((plant) => plant.sources), [demandSource]),
  };
}

export function serializeAgentEvidence(evidence: AgentEvidence): string {
  return JSON.stringify(evidence);
}
