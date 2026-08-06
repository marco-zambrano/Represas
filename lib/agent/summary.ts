import type { Plant } from "@/lib/data/catalog";
import type { ForecastObservation, ForecastResponse, Observation, SourceStatus, TelemetryResponse } from "@/lib/data/types";
import type {
  AgentForecastSample,
  AgentForecastSummary,
  AgentLocalTrend,
  AgentObservation,
  AgentPlantEvidence,
} from "./types";

const MAX_CONTEXT_OBSERVATIONS = 12;
const MAX_CONTEXT_FORECASTS = 12;

function asAgentObservation(observation: Observation): AgentObservation {
  return {
    timestamp: observation.timestamp,
    energyMwh: observation.energyMwh,
    flowM3s: observation.flowM3s,
    activeUnits: observation.activeUnits,
  };
}

function isMeaningful(observation: Observation): boolean {
  return observation.energyMwh !== null || observation.flowM3s !== null || observation.activeUnits !== null;
}

function timestampSort<T extends { timestamp: string }>(left: T, right: T): number {
  return Date.parse(left.timestamp) - Date.parse(right.timestamp);
}

function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  const result = ((current - previous) / Math.abs(previous)) * 100;
  return Number.isFinite(result) ? Number(result.toFixed(1)) : null;
}

function forecastSamples(forecasts: ForecastObservation[]): AgentForecastSample[] {
  return forecasts
    .filter((forecast) => forecast.flowM3s !== null && Number.isFinite(Date.parse(forecast.timestamp)))
    .sort(timestampSort)
    .slice(0, MAX_CONTEXT_FORECASTS)
    .map(({ timestamp, flowM3s, series }) => ({ timestamp, flowM3s, series }));
}

function summarizeForecast(forecasts: AgentForecastSample[], latestFlow: number | null): AgentForecastSummary {
  const next = forecasts[0];
  if (!next || next.flowM3s === null) {
    return { targetAt: null, flowM3s: null, direction: "unknown", changePercent: null, series: null };
  }

  const changePercent = percentChange(next.flowM3s, latestFlow);
  const direction = changePercent === null
    ? "unknown"
    : changePercent >= 5
      ? "increasing"
      : changePercent <= -5
        ? "decreasing"
        : "stable";
  return { targetAt: next.timestamp, flowM3s: next.flowM3s, direction, changePercent, series: next.series };
}

function summarizeLocalTrend(latest: AgentObservation | null, previous: AgentObservation | null): AgentLocalTrend {
  const disclaimer = "Extrapolación indicativa de 3 horas basada solo en las dos últimas publicaciones de CELEC; no es un pronóstico GEOGLOWS ni incorpora lluvia de INAMHI.";
  if (latest?.flowM3s === null || previous?.flowM3s === null || !latest || !previous) {
    return { targetAt: null, flowM3s: null, direction: "unknown", changePercent: null, basis: "CELEC_last_two_observations", disclaimer };
  }

  const elapsedHours = (Date.parse(latest.timestamp) - Date.parse(previous.timestamp)) / 3_600_000;
  if (!Number.isFinite(elapsedHours) || elapsedHours < 0.25 || elapsedHours > 6) {
    return { targetAt: null, flowM3s: null, direction: "unknown", changePercent: null, basis: "CELEC_last_two_observations", disclaimer };
  }

  const projectedFlow = Math.max(0, latest.flowM3s + ((latest.flowM3s - previous.flowM3s) / elapsedHours) * 3);
  const roundedFlow = Number(projectedFlow.toFixed(1));
  const changePercent = percentChange(roundedFlow, latest.flowM3s);
  const direction = changePercent === null
    ? "unknown"
    : changePercent >= 5
      ? "increasing"
      : changePercent <= -5
        ? "decreasing"
        : "stable";
  return {
    targetAt: new Date(Date.parse(latest.timestamp) + 3 * 3_600_000).toISOString(),
    flowM3s: roundedFlow,
    direction,
    changePercent,
    basis: "CELEC_last_two_observations",
    disclaimer,
  };
}

export function mergeSourceStatuses(...groups: SourceStatus[][]): SourceStatus[] {
  const bySource = new Map<SourceStatus["source"], SourceStatus>();
  for (const source of groups.flat()) {
    const current = bySource.get(source.source);
    if (!current || current.availability !== "available" || source.availability === "available") {
      bySource.set(source.source, source);
    }
  }
  return [...bySource.values()];
}

function forecastText(forecast: AgentForecastSummary): string {
  const labels = { increasing: "aumento", decreasing: "disminución", stable: "estabilidad", unknown: "sin tendencia disponible" } as const;
  const change = forecast.changePercent === null ? "" : ` (${forecast.changePercent > 0 ? "+" : ""}${forecast.changePercent}%)`;
  return `El siguiente pronóstico indica ${labels[forecast.direction]} de caudal${change}.`;
}

function notableChanges(
  latest: AgentObservation | null,
  previous: AgentObservation | null,
  forecast: AgentForecastSummary,
): string[] {
  if (!latest || !previous) return forecast.direction === "unknown" ? [] : [forecastText(forecast)];

  const messages: string[] = [];
  const flowChange = percentChange(latest.flowM3s, previous.flowM3s);
  const energyChange = percentChange(latest.energyMwh, previous.energyMwh);
  const unitsChange = latest.activeUnits !== null && previous.activeUnits !== null
    ? latest.activeUnits - previous.activeUnits
    : null;

  if (flowChange !== null && Math.abs(flowChange) >= 20) {
    messages.push(`El caudal cambió ${flowChange > 0 ? "+" : ""}${flowChange}% frente a la publicación previa.`);
  }
  if (energyChange !== null && Math.abs(energyChange) >= 20) {
    messages.push(`La energía publicada cambió ${energyChange > 0 ? "+" : ""}${energyChange}% frente a la publicación previa.`);
  }
  if (unitsChange !== null && unitsChange !== 0) {
    messages.push(`Las unidades activas cambiaron en ${unitsChange > 0 ? "+" : ""}${unitsChange}.`);
  }
  if (forecast.direction !== "unknown") messages.push(forecastText(forecast));
  return messages;
}

export function summarizeAgentPlant(
  plant: Plant,
  telemetry: TelemetryResponse,
  forecastResponse: ForecastResponse,
): AgentPlantEvidence {
  const meaningful = telemetry.observations.filter(isMeaningful).sort(timestampSort);
  const recentObservations = meaningful.slice(-MAX_CONTEXT_OBSERVATIONS).map(asAgentObservation);
  const latest = recentObservations.at(-1) ?? null;
  const previous = recentObservations.at(-2) ?? null;
  const horizon = forecastSamples(forecastResponse.forecasts);
  const forecast = summarizeForecast(horizon, latest?.flowM3s ?? null);
  const localTrend = summarizeLocalTrend(latest, previous);
  const ccs = forecastResponse.ccsThreeHour;

  return {
    id: plant.id,
    name: plant.name,
    river: plant.river,
    installedCapacityMw: plant.installedCapacityMw,
    observedRange: telemetry.range,
    latest,
    previous,
    recentObservations,
    forecast,
    forecastHorizon: horizon,
    localTrend,
    ...(ccs
      ? {
          ccsThreeHourForecast: {
            status: ccs.status,
            ...(ccs.issuedAt ? { issuedAt: ccs.issuedAt } : {}),
            ...(ccs.targetAt ? { targetAt: ccs.targetAt } : {}),
            ...(ccs.flowM3s !== undefined ? { flowM3s: ccs.flowM3s } : {}),
            ...(ccs.message ? { message: ccs.message } : {}),
            disclaimer: ccs.disclaimer,
          },
        }
      : {}),
    notableChanges: notableChanges(latest, previous, forecast),
    sources: mergeSourceStatuses(telemetry.sources, forecastResponse.sources),
    warnings: [...(telemetry.warnings ?? []), ...(forecastResponse.warnings ?? [])],
  };
}
