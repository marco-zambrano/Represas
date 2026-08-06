import assert from "node:assert/strict";
import test from "node:test";

import { summarizeAgentPlant } from "../lib/agent/summary";
import { findFocusedPlantIds } from "../lib/agent/focus";
import { plants } from "../lib/data/catalog";
import type { ForecastResponse, TelemetryResponse } from "../lib/data/types";

const telemetry: TelemetryResponse = {
  plant: "mazar",
  period: "day",
  range: { from: "2026-08-05", to: "2026-08-05", timezone: "America/Guayaquil", kind: "current" },
  source: "CELEC",
  sources: [{ source: "CELEC", availability: "available", retrievedAt: "2026-08-05T12:00:00Z" }],
  retrievedAt: "2026-08-05T12:00:00Z",
  units: { energy: "MWh", power: "MW", flow: "m³/s", activeUnits: "unidades" },
  observations: [
    { timestamp: "2026-08-05T10:00:00Z", energyMwh: 100, generationMw: null, flowM3s: 200, activeUnits: 2 },
    { timestamp: "2026-08-05T11:00:00Z", energyMwh: 130, generationMw: null, flowM3s: 250, activeUnits: 3 },
  ],
};

const forecast: ForecastResponse = {
  plant: "mazar",
  range: telemetry.range,
  retrievedAt: "2026-08-05T12:00:00Z",
  source: "GEOGLOWS",
  sources: [
    { source: "CELEC", availability: "available", retrievedAt: "2026-08-05T12:00:00Z" },
    { source: "GEOGLOWS", availability: "available", retrievedAt: "2026-08-05T12:00:00Z" },
  ],
  observed: telemetry.observations.map(({ timestamp, flowM3s }) => ({ timestamp, flowM3s })),
  forecasts: [{ timestamp: "2026-08-05T12:00:00Z", flowM3s: 300, series: "high_res" }],
};

test("el contexto del agente conserva observaciones, pronóstico y cambios explicables", () => {
  const plant = summarizeAgentPlant(plants[0], telemetry, forecast);

  assert.equal(plant.name, "Mazar");
  assert.equal(plant.latest?.flowM3s, 250);
  assert.equal(plant.previous?.flowM3s, 200);
  assert.equal(plant.forecast.direction, "increasing");
  assert.equal(plant.forecast.changePercent, 20);
  assert.equal(plant.forecast.series, "high_res");
  assert.deepEqual(plant.sources.map((source) => source.source), ["CELEC", "GEOGLOWS"]);
  assert.ok(plant.notableChanges.some((message) => message.includes("caudal cambió +25%")));
});

test("el contexto no completa un pronóstico cuando GEOGLOWS no lo publica", () => {
  const withoutForecast: ForecastResponse = {
    ...forecast,
    sources: [
      telemetry.sources[0],
      { source: "GEOGLOWS", availability: "unconfigured", message: "Falta configurar el endpoint." },
    ],
    forecasts: [],
  };

  const plant = summarizeAgentPlant(plants[0], telemetry, withoutForecast);

  assert.equal(plant.forecast.flowM3s, null);
  assert.equal(plant.forecast.direction, "unknown");
  assert.equal(plant.forecast.targetAt, null);
  assert.equal(plant.sources.find((source) => source.source === "GEOGLOWS")?.availability, "unconfigured");
});

test("la evidencia de una comparación se limita a las centrales mencionadas", () => {
  assert.deepEqual(
    findFocusedPlantIds("Compara Paute-Molino y Sopladora", "Paute-Molino produjo más que Sopladora."),
    ["paute-molino", "sopladora"],
  );
  assert.deepEqual(
    findFocusedPlantIds("Resume el sistema", "Las cinco centrales siguen el contexto disponible."),
    ["mazar", "paute-molino", "sopladora", "minas-san-francisco", "coca-codo-sinclair"],
  );
});
