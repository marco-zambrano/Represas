import { getPlant, type PlantId } from "./catalog";
import { hasUnpublishedCcsEnergy, normalizeCcsEnergy } from "./ccs-energy";
import { getCocaCodoProduction } from "./cenace";
import type {
  CcsForecastInputs,
  CcsThreeHourForecast,
  DateRange,
  ForecastObservation,
  ForecastResponse,
  Observation,
  Period,
  SourceStatus,
  TelemetryRequest,
  TelemetryResponse,
} from "./types";

export const ECUADOR_TIME_ZONE = "America/Guayaquil" as const;
export const CELEC_ORDS_DEFAULT_BASE_URL = "https://generacioncsr.celec.gob.ec:8443/ords/csr";
const MAX_RANGE_DAYS = 31;
const CACHE_SECONDS = 300;
const CCS_PUBLISHED_ENERGY_LOOKBACK_DAYS = 7;

type TimeValue = { timestamp: string; value: number | null };
type MetricName = "energy" | "flow" | "activeUnits";
type MetricResult = { metric: MetricName; rows: TimeValue[]; succeeded: boolean; errors: string[] };
type UnknownRecord = Record<string, unknown>;

export class DataRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataRequestError";
  }
}

/**
 * Resuelve la consulta del endpoint sin interpretar fechas en la zona horaria
 * del servidor. Las fechas de entrada son días civiles de Ecuador continental.
 */
export function resolveTelemetryRequest(searchParams: URLSearchParams, now = new Date()): TelemetryRequest {
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  if (Boolean(from) !== Boolean(to)) {
    throw new DataRequestError("Los parámetros from y to deben enviarse juntos.");
  }

  if (from && to) {
    const range = createDateRange(from, to, "custom");
    return { range, period: range.from === range.to ? "day" : "month" };
  }

  const preset = (searchParams.get("preset") ?? searchParams.get("period") ?? "current")
    .trim()
    .toLowerCase();
  const today = dateInTimeZone(now, ECUADOR_TIME_ZONE);

  if (["current", "today", "day"].includes(preset)) {
    return { range: createDateRange(today, today, "current"), period: "day" };
  }

  if (["7d", "7days", "week"].includes(preset)) {
    return { range: createDateRange(addDays(today, -6), today, "preset"), period: "month" };
  }

  if (["30d", "30days", "month"].includes(preset)) {
    return { range: createDateRange(addDays(today, -29), today, "preset"), period: "month" };
  }

  if (preset === "year") {
    throw new DataRequestError("El historial consultable por esta ruta tiene un máximo de 31 días. Use from/to.");
  }

  throw new DataRequestError("Preset inválido. Use current, 7d, 30d o un rango from/to.");
}

/** El endpoint de pronóstico comparte la misma validación de rango. */
export const resolveForecastRange = (searchParams: URLSearchParams, now = new Date()) =>
  resolveTelemetryRequest(searchParams, now).range;

export function createDateRange(from: string, to: string, kind: DateRange["kind"]): DateRange {
  assertDateOnly(from, "from");
  assertDateOnly(to, "to");

  const days = calendarDayDistance(from, to);
  if (days < 0) {
    throw new DataRequestError("La fecha from no puede ser posterior a to.");
  }
  if (days + 1 > MAX_RANGE_DAYS) {
    throw new DataRequestError(`El rango máximo es de ${MAX_RANGE_DAYS} días.`);
  }

  return { from, to, timezone: ECUADOR_TIME_ZONE, kind };
}

/**
 * Consulta directamente los endpoints ORDS que usa el portal de CELEC. No se
 * usa una URL genérica en el navegador: el adaptador vive exclusivamente en
 * servidor y conserva los `null` de `valueedit`.
 */
export async function getTelemetry(
  plantId: PlantId,
  request: TelemetryRequest | Period = "day",
): Promise<TelemetryResponse> {
  const resolvedRequest = typeof request === "string" ? legacyTelemetryRequest(request) : request;
  const retrievedAt = new Date().toISOString();
  const plant = getPlant(plantId);
  let effectiveRequest = resolvedRequest;
  let window = rangeToCelecUtcWindow(effectiveRequest.range);
  const cocaCodoEnergyPromise = plantId === "coca-codo-sinclair" ? getCocaCodoProduction() : Promise.resolve(undefined);

  let [energy, flow, activeUnits] = await Promise.all([
    loadEnergy(plantId, plant.celec.code, effectiveRequest.range, window),
    loadPointMetric("flow", plant.celec.points.flowM3s, effectiveRequest.range, window),
    // No se consulta un historial de turbinas: CELEC sólo lo expone como snapshot.
    effectiveRequest.range.from === effectiveRequest.range.to
      ? loadPointMetric("activeUnits", plant.celec.points.activeUnits, effectiveRequest.range, window)
      : Promise.resolve({ metric: "activeUnits" as const, rows: [], succeeded: false, errors: [] }),
  ]);

  const fallbackWarnings: string[] = [];
  if (shouldFindLatestPublishedDay(plantId, effectiveRequest, energy, flow, activeUnits)) {
    for (let daysAgo = 1; daysAgo <= CCS_PUBLISHED_ENERGY_LOOKBACK_DAYS; daysAgo += 1) {
      const date = addDays(effectiveRequest.range.from, -daysAgo);
      const fallbackRange = createDateRange(date, date, "current");
      const fallbackWindow = rangeToCelecUtcWindow(fallbackRange);
      const fallbackEnergy = await loadEnergy(plantId, plant.celec.code, fallbackRange, fallbackWindow);
      const [fallbackFlow, fallbackActiveUnits] = await Promise.all([
        loadPointMetric("flow", plant.celec.points.flowM3s, fallbackRange, fallbackWindow),
        loadPointMetric("activeUnits", plant.celec.points.activeUnits, fallbackRange, fallbackWindow),
      ]);
      if (!hasPublishedTelemetry(plantId, fallbackEnergy, fallbackFlow, fallbackActiveUnits)) continue;

      effectiveRequest = { ...effectiveRequest, range: fallbackRange };
      window = fallbackWindow;
      energy = fallbackEnergy;
      flow = fallbackFlow;
      activeUnits = fallbackActiveUnits;
      fallbackWarnings.push(
        plantId === "coca-codo-sinclair"
          ? `CELEC aún no publicó energía horaria de Coca Codo Sinclair para ${resolvedRequest.range.from}; se muestra la última jornada con energía publicada (${date}).`
          : `CELEC aún no publicó telemetría para ${resolvedRequest.range.from}; se muestra la última jornada con datos publicada (${date}).`,
      );
      break;
    }
  }

  const cocaCodoEnergy = await cocaCodoEnergyPromise;

  const metrics = [energy, flow, activeUnits];
  const observations = mergeMetricRows(metrics, window);
  const warnings = [...metrics.flatMap((metric) => metric.errors), ...fallbackWarnings];
  const succeeded = metrics.some((metric) => metric.succeeded);
  const source: SourceStatus = succeeded
    ? {
        source: "CELEC",
        availability: "available",
        retrievedAt,
        ...(warnings.length ? { message: "Algunas series de CELEC no estuvieron disponibles." } : {}),
      }
    : {
        source: "CELEC",
        availability: "unavailable",
        retrievedAt,
        message: "No fue posible consultar las series ORDS de CELEC.",
      };

  return {
    plant: plantId,
    period: effectiveRequest.period,
    range: effectiveRequest.range,
    source: "CELEC",
    sources: [
      source,
      ...(cocaCodoEnergy ? [{
        source: "CENACE" as const,
        availability: cocaCodoEnergy.status === "available" ? "available" as const : "unavailable" as const,
        retrievedAt: cocaCodoEnergy.retrievedAt,
        ...(cocaCodoEnergy.message ? { message: cocaCodoEnergy.message } : {}),
      }] : []),
    ],
    retrievedAt,
    units: {
      energy: "MWh",
      power: "MW",
      flow: "m³/s",
      activeUnits: "unidades",
    },
    observations,
    ...(cocaCodoEnergy ? { cocaCodoEnergy } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(!succeeded
      ? { error: warnings[0] ?? "No fue posible consultar CELEC." }
      : {}),
  };
}

/**
 * CELEC puede tardar en publicar una jornada completa. Sólo en la vista actual
 * se prueba un día anterior; los rangos manuales se respetan estrictamente y
 * nunca se sustituyen. Para CCS, una jornada de energía toda en cero también
 * se considera no publicada.
 */
function shouldFindLatestPublishedDay(
  plantId: PlantId,
  request: TelemetryRequest,
  energy: MetricResult,
  flow: MetricResult,
  activeUnits: MetricResult,
) {
  return request.range.kind === "current" && !hasPublishedTelemetry(plantId, energy, flow, activeUnits);
}

function hasPublishedEnergy(rows: TimeValue[]) {
  return rows.some((row) => row.value !== null);
}

function hasPublishedTelemetry(
  plantId: PlantId,
  energy: MetricResult,
  flow: MetricResult,
  activeUnits: MetricResult,
) {
  if (plantId === "coca-codo-sinclair") return hasPublishedEnergy(energy.rows);
  return [energy, flow, activeUnits].some((metric) => metric.rows.some((row) => row.value !== null));
}

/**
 * Entrega el pronóstico GEOGLOWS y, sólo para CCS, el modelo independiente de
 * 3 h. La serie observada se devuelve separada y siempre conserva su fuente
 * CELEC para que la UI no mezcle observación y pronóstico.
 */
export async function getForecast(
  plantId: PlantId,
  range: DateRange,
  observedTelemetry?: TelemetryResponse,
): Promise<ForecastResponse> {
  const retrievedAt = new Date().toISOString();
  const period: Period = range.from === range.to ? "day" : "month";
  const [telemetry, geoglows, ccs] = await Promise.all([
    observedTelemetry ? Promise.resolve(observedTelemetry) : getTelemetry(plantId, { range, period }),
    loadGeoglowsForecast(plantId, range),
    plantId === "coca-codo-sinclair" ? getCcsThreeHourForecast() : Promise.resolve(undefined),
  ]);

  const sources: SourceStatus[] = [
    telemetry.sources[0],
    geoglows.source,
    ...(ccs
      ? [
          {
            source: "INAMHI" as const,
            availability: ccs.status,
            ...(ccs.message ? { message: ccs.message } : {}),
            ...(ccs.status === "available" ? { retrievedAt } : {}),
          },
        ]
      : []),
  ];
  const warnings = [
    ...(telemetry.warnings ?? []),
    ...(geoglows.warning ? [geoglows.warning] : []),
    ...(ccs?.message && ccs.status !== "available" ? [ccs.message] : []),
  ];

  return {
    plant: plantId,
    range,
    retrievedAt,
    source: "GEOGLOWS",
    sources,
    observed: telemetry.observations.map(({ timestamp, flowM3s }) => ({ timestamp, flowM3s })),
    forecasts: geoglows.forecasts,
    ...(ccs ? { ccsThreeHour: ccs } : {}),
    ...(warnings.length ? { warnings } : {}),
    ...(geoglows.source.availability === "unavailable" && !telemetry.observations.length
      ? { error: geoglows.source.message ?? "No fue posible consultar las fuentes de pronóstico." }
      : {}),
  };
}

export function estimateCocaFlow(inputs: {
  h0719?: number | null;
  h0728?: number | null;
  m1124Lag9?: number | null;
  m5247Lag6?: number | null;
  m5124Lag6?: number | null;
}) {
  const values = Object.values(inputs);
  if (values.some((value) => value === null || value === undefined || !Number.isFinite(value))) {
    return null;
  }

  return (
    219.53 * inputs.h0719! +
    115.85 * inputs.h0728! -
    7.86 * inputs.m1124Lag9! +
    42.8 * inputs.m5247Lag6! +
    0.5 * inputs.m5124Lag6! -
    47.79
  );
}

async function loadEnergy(
  plantId: PlantId,
  plantCode: string,
  range: DateRange,
  window: UtcWindow,
): Promise<MetricResult> {
  const dates = datesInRange(range);
  const results = await mapWithConcurrency(dates, 4, async (date) => {
    try {
      const url = celecUrl(`sardom${plantCode}/${plantCode}EnerDia`);
      url.searchParams.set("fecha", `${formatCelecDate(date)} 00:00:00`);
      return await fetchCelecRows(url, `energía de ${plantId} (${date})`);
    } catch (error) {
      return { ok: false as const, error: `La configuración CELEC no es válida: ${errorMessage(error)}` };
    }
  });

  const rows: TimeValue[] = [];
  const errors: string[] = [];
  let succeeded = false;
  for (const result of results) {
    if (result.ok) {
      succeeded = true;
      rows.push(...result.rows);
    } else {
      errors.push(result.error);
    }
  }

  const insideWindow = rows.filter((row) => isInsideWindow(row.timestamp, window));
  const ccsEnergyWasUnpublished =
    plantId === "coca-codo-sinclair" && hasUnpublishedCcsEnergy(insideWindow.map((row) => row.value));

  if (ccsEnergyWasUnpublished) {
    errors.push(
      "CELEC publicó energía cero para toda la jornada de Coca Codo Sinclair; se muestra como no publicada y no se reemplaza con CENACE.",
    );
  }

  return {
    metric: "energy",
    rows: ccsEnergyWasUnpublished ? normalizeCcsEnergy(insideWindow) : insideWindow,
    succeeded,
    errors,
  };
}

async function loadPointMetric(
  metric: Exclude<MetricName, "energy">,
  mrid: string,
  range: DateRange,
  window: UtcWindow,
): Promise<MetricResult> {
  // pointValues ancla la respuesta al parámetro fecha. Una petición de rango
  // devuelve por ello sólo el primer tramo; se consulta cada jornada y se unen
  // las muestras dentro de la ventana solicitada.
  const results = await mapWithConcurrency(datesInRange(range), 4, async (date) => {
    try {
      const dayWindow = rangeToCelecUtcWindow(createDateRange(date, date, range.kind));
      const url = celecUrl("sardomcsr/pointValues");
      url.searchParams.set("mrid", mrid);
      url.searchParams.set("fechaInicio", dayWindow.start.toISOString());
      url.searchParams.set("fechaFin", dayWindow.endInclusive.toISOString());
      url.searchParams.set("fecha", `${formatCelecDate(date)} 01:00:00`);
      return await fetchCelecRows(url, `${metric} (mrid ${mrid}, ${date})`);
    } catch (error) {
      return { ok: false as const, error: `La configuración CELEC no es válida: ${errorMessage(error)}` };
    }
  });

  const rows: TimeValue[] = [];
  const errors: string[] = [];
  let succeeded = false;
  for (const result of results) {
    if (result.ok) {
      succeeded = true;
      rows.push(...result.rows);
    } else {
      errors.push(result.error);
    }
  }

  return {
    metric,
    rows: rows.filter((row) => isInsideWindow(row.timestamp, window)),
    succeeded,
    errors,
  };
}

function mergeMetricRows(metrics: MetricResult[], window: UtcWindow): Observation[] {
  type Draft = Partial<Record<MetricName, number | null>>;
  const byTimestamp = new Map<string, Draft>();

  for (const metric of metrics) {
    for (const row of metric.rows) {
      if (!isInsideWindow(row.timestamp, window)) continue;
      const draft = byTimestamp.get(row.timestamp) ?? {};
      // Un valor publicado tiene prioridad sobre un null duplicado, sin cambiar
      // nunca un null por cero.
      if (draft[metric.metric] === undefined || row.value !== null) {
        draft[metric.metric] = row.value;
      }
      byTimestamp.set(row.timestamp, draft);
    }
  }

  return [...byTimestamp.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([timestamp, values]) => ({
      timestamp,
      energyMwh: values.energy ?? null,
      // CELEC etiqueta EnerDia como MWh; calcular MW sin una duración/método
      // publicado sería engañoso.
      generationMw: null,
      flowM3s: values.flow ?? null,
      activeUnits: values.activeUnits ?? null,
    }));
}

function legacyTelemetryRequest(period: Period): TelemetryRequest {
  const today = dateInTimeZone(new Date(), ECUADOR_TIME_ZONE);
  if (period === "year") {
    throw new DataRequestError("El historial de telemetría está limitado a 31 días.");
  }
  return {
    range:
      period === "month"
        ? createDateRange(addDays(today, -29), today, "preset")
        : createDateRange(today, today, "current"),
    period,
  };
}

type FetchRowsResult = { ok: true; rows: TimeValue[] } | { ok: false; error: string };

async function fetchCelecRows(url: URL, label: string): Promise<FetchRowsResult> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { ok: false, error: `CELEC no pudo entregar ${label} (HTTP ${response.status}).` };
    }

    const payload = (await response.json()) as unknown;
    return { ok: true, rows: parseCelecPayload(payload) };
  } catch (error) {
    return { ok: false, error: `CELEC no pudo entregar ${label}: ${errorMessage(error)}` };
  }
}

/** Exportado para probar fixtures ORDS sin hacer solicitudes de red. */
export function parseCelecPayload(payload: unknown): TimeValue[] {
  return extractRows(payload).flatMap((row) => {
    const timestamp = normalizeTimestamp(readFirst(row, ["loctimestamp", "timestamp", "fecha", "date"]));
    if (!timestamp) return [];
    return [{ timestamp, value: readNumber(readFirst(row, ["valueedit", "value", "valor"])) }];
  });
}

type GeoglowsResult = { source: SourceStatus; forecasts: ForecastObservation[]; warning?: string };

async function loadGeoglowsForecast(plantId: PlantId, range: DateRange): Promise<GeoglowsResult> {
  const endpoint = process.env.GEOGLOWS_FORECAST_URL?.trim();
  const reachId = geoglowsReachId(plantId);
  if (!endpoint || !reachId) {
    const missing = [!endpoint ? "GEOGLOWS_FORECAST_URL" : undefined, !reachId ? geoglowsReachVariable(plantId) : undefined]
      .filter(Boolean)
      .join(", ");
    return {
      source: {
        source: "GEOGLOWS",
        availability: "unconfigured",
        message: `Falta configurar ${missing}.`,
      },
      forecasts: [],
    };
  }

  let url: URL;
  try {
    url = configuredUrl(endpoint, { reachId, start: range.from, end: range.to });
  } catch (error) {
    return {
      source: { source: "GEOGLOWS", availability: "unconfigured", message: `GEOGLOWS_FORECAST_URL no es válida: ${errorMessage(error)}` },
      forecasts: [],
    };
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: "text/csv, application/json;q=0.9, text/plain;q=0.8" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return {
        source: { source: "GEOGLOWS", availability: "unavailable", message: `GEOGLOWS respondió HTTP ${response.status}.` },
        forecasts: [],
      };
    }

    const payload = await response.text();
    const forecasts = parseGeoglowsPayload(payload, response.headers.get("content-type"));
    return {
      source: { source: "GEOGLOWS", availability: "available", retrievedAt: new Date().toISOString() },
      forecasts,
      ...(forecasts.length ? {} : { warning: "GEOGLOWS respondió sin muestras publicadas para este tramo." }),
    };
  } catch (error) {
    return {
      source: { source: "GEOGLOWS", availability: "unavailable", message: `No fue posible consultar GEOGLOWS: ${errorMessage(error)}` },
      forecasts: [],
    };
  }
}

/** Exportado para validar fixtures CSV o JSON de GEOGLOWS sin red. */
export function parseGeoglowsPayload(payload: string, contentType: string | null): ForecastObservation[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  let rows: UnknownRecord[];
  if (contentType?.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      rows = extractForecastRows(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  } else {
    rows = parseCsvRecords(trimmed);
  }

  const byTimestamp = new Map<string, ForecastObservation>();
  for (const row of rows) {
    const timestamp = normalizeTimestamp(readFirst(row, ["datetime", "timestamp", "date", "time", "timeutc"]));
    if (!timestamp) continue;
    const highRes = readNumber(readFirst(row, ["high_res", "highres", "flow_high_res"]));
    const flowAverage = readNumber(readFirst(row, ["flow_avg", "flowaverage", "flow_mean", "flow"]));
    const next: ForecastObservation = {
      timestamp,
      flowM3s: highRes ?? flowAverage,
      series: highRes !== null ? "high_res" : flowAverage !== null ? "flow_avg" : null,
    };
    const existing = byTimestamp.get(timestamp);
    if (!existing || (existing.series !== "high_res" && next.series === "high_res")) {
      byTimestamp.set(timestamp, next);
    }
  }

  return [...byTimestamp.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

async function getCcsThreeHourForecast(): Promise<CcsThreeHourForecast> {
  const configuredInputs = ccsInputUrls();
  const missingUrls = Object.entries(configuredInputs)
    .filter(([, value]) => !value)
    .map(([key]) => ccsInputEnvironmentVariable(key as keyof CcsForecastInputs));

  if (missingUrls.length) {
    return unavailableCcsForecast(
      "unconfigured",
      `Falta configurar ${missingUrls.join(", ")}. No se calculó el modelo CCS.`,
      missingUrls,
    );
  }

  const entries = Object.entries(configuredInputs) as Array<[keyof CcsForecastInputs, string]>;
  const results = await Promise.all(entries.map(async ([key, url]) => [key, await fetchInamhiSeries(url)] as const));
  const failed = results.filter(([, result]) => !result.ok);
  if (failed.length) {
    const failedNames = failed.map(([key]) => key);
    const reason = failed.map(([, result]) => (result.ok ? "" : result.error)).filter(Boolean).join(" ");
    return unavailableCcsForecast("unavailable", `INAMHI no pudo entregar ${failedNames.join(", ")}. ${reason}`, failedNames);
  }

  const series = Object.fromEntries(
    results.map(([key, result]) => [key, result.ok ? result.rows : []]),
  ) as Record<keyof CcsForecastInputs, TimeValue[]>;
  const estimate = findLatestCcsEstimate(series);
  if (!estimate) {
    return unavailableCcsForecast(
      "unavailable",
      "INAMHI no publicó una hora con los cinco insumos y rezagos requeridos para el modelo CCS.",
      ["H0719", "H0728", "M1124(t-9)", "M5247(t-6)", "M5124(t-6)"],
    );
  }

  return {
    status: "available",
    issuedAt: estimate.issuedAt,
    targetAt: new Date(new Date(estimate.issuedAt).getTime() + 3 * 60 * 60 * 1000).toISOString(),
    flowM3s: estimate.flowM3s,
    inputs: estimate.inputs,
    validation: ccsValidation,
    disclaimer: ccsDisclaimer,
  };
}

const ccsValidation = {
  sampleSize: 215,
  maeM3s: 38.63,
  rmseM3s: 64.46,
  biasM3s: -30.7,
  pearsonR: 0.935,
} as const;

const ccsDisclaimer =
  "Estimación independiente a 3 horas basada en datos INAMHI. Es una señal de tendencia con incertidumbre, no telemetría ni una instrucción operativa.";

function unavailableCcsForecast(
  status: "unconfigured" | "unavailable",
  message: string,
  missingInputs: string[],
): CcsThreeHourForecast {
  return { status, message, missingInputs, validation: ccsValidation, disclaimer: ccsDisclaimer };
}

type InamhiResult = { ok: true; rows: TimeValue[] } | { ok: false; error: string };

async function fetchInamhiSeries(url: string): Promise<InamhiResult> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json, text/csv;q=0.9, text/plain;q=0.8" },
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}.` };

    const text = await response.text();
    return { ok: true, rows: parseInamhiPayload(text, response.headers.get("content-type")) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Acepta respuestas horarias JSON o CSV configuradas desde INAMHI. */
export function parseInamhiPayload(payload: string, contentType: string | null): TimeValue[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  let rows: UnknownRecord[];
  if (contentType?.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      rows = extractForecastRows(JSON.parse(trimmed) as unknown);
    } catch {
      return [];
    }
  } else {
    rows = parseCsvRecords(trimmed);
  }

  return rows.flatMap((row) => {
    const timestamp = normalizeTimestamp(readFirst(row, ["timestamp", "datetime", "fecha_hora", "fecha", "date", "time"]));
    if (!timestamp) return [];
    return [
      {
        timestamp,
        value: readNumber(readFirst(row, ["valueedit", "value", "valor", "measurement", "level", "nivel", "rain", "precipitation"])),
      },
    ];
  });
}

function findLatestCcsEstimate(series: Record<keyof CcsForecastInputs, TimeValue[]>) {
  const maps = Object.fromEntries(
    (Object.entries(series) as Array<[keyof CcsForecastInputs, TimeValue[]]>).map(([key, rows]) => [key, toHourlyValueMap(rows)]),
  ) as Record<keyof CcsForecastInputs, Map<string, number>>;
  const candidateHours = [...maps.h0719.keys()]
    .filter((hour) => maps.h0728.has(hour))
    .sort((left, right) => right.localeCompare(left));

  for (const issuedAt of candidateHours) {
    const inputs: CcsForecastInputs = {
      h0719: maps.h0719.get(issuedAt)!,
      h0728: maps.h0728.get(issuedAt)!,
      m1124Lag9: maps.m1124Lag9.get(shiftHour(issuedAt, -9)) ?? Number.NaN,
      m5247Lag6: maps.m5247Lag6.get(shiftHour(issuedAt, -6)) ?? Number.NaN,
      m5124Lag6: maps.m5124Lag6.get(shiftHour(issuedAt, -6)) ?? Number.NaN,
    };
    const flowM3s = estimateCocaFlow(inputs);
    if (flowM3s !== null) return { issuedAt, inputs, flowM3s };
  }
  return null;
}

function toHourlyValueMap(rows: TimeValue[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.value === null) continue;
    map.set(hourKey(row.timestamp), row.value);
  }
  return map;
}

function ccsInputUrls(): Record<keyof CcsForecastInputs, string | undefined> {
  return {
    h0719: process.env.INAMHI_CCS_H0719_URL?.trim(),
    h0728: process.env.INAMHI_CCS_H0728_URL?.trim(),
    m1124Lag9: process.env.INAMHI_CCS_M1124_URL?.trim(),
    m5247Lag6: process.env.INAMHI_CCS_M5247_URL?.trim(),
    m5124Lag6: process.env.INAMHI_CCS_M5124_URL?.trim(),
  };
}

function ccsInputEnvironmentVariable(key: keyof CcsForecastInputs) {
  const station = {
    h0719: "H0719",
    h0728: "H0728",
    m1124Lag9: "M1124",
    m5247Lag6: "M5247",
    m5124Lag6: "M5124",
  } satisfies Record<keyof CcsForecastInputs, string>;
  return `INAMHI_CCS_${station[key]}_URL`;
}

function geoglowsReachId(plantId: PlantId) {
  const suffix = geoglowsReachSuffix[plantId];
  return process.env[`GEOGLOWS_REACH_ID_${suffix}`]?.trim() ||
    (plantId === "coca-codo-sinclair" ? process.env.GEOGLOWS_REACH_ID_CCS?.trim() : undefined);
}

function geoglowsReachVariable(plantId: PlantId) {
  return `GEOGLOWS_REACH_ID_${geoglowsReachSuffix[plantId]}`;
}

const geoglowsReachSuffix: Record<PlantId, string> = {
  mazar: "MAZAR",
  "paute-molino": "PAUTE_MOLINO",
  sopladora: "SOPLADORA",
  "minas-san-francisco": "MINAS_SAN_FRANCISCO",
  "coca-codo-sinclair": "COCA_CODO_SINCLAIR",
};

function configuredUrl(template: string, values: { reachId: string; start: string; end: string }) {
  const usesReachPlaceholder = template.includes("{reachId}");
  const url = new URL(
    template
      .replaceAll("{reachId}", encodeURIComponent(values.reachId))
      .replaceAll("{start}", encodeURIComponent(values.start))
      .replaceAll("{end}", encodeURIComponent(values.end)),
  );
  if (!usesReachPlaceholder && !url.searchParams.has("reach_id")) {
    url.searchParams.set("reach_id", values.reachId);
  }
  return url;
}

function celecUrl(path: string) {
  const base = (process.env.CELEC_ORDS_BASE_URL?.trim() || CELEC_ORDS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  return new URL(`${base}/${path.replace(/^\/+/, "")}`);
}

function extractRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["items", "data", "rows", "results", "records"]) {
    if (Array.isArray(payload[key])) return payload[key].filter(isRecord);
  }
  return [];
}

function extractForecastRows(payload: unknown): UnknownRecord[] {
  const direct = extractRows(payload);
  if (direct.length) return direct;
  if (!isRecord(payload)) return [];

  for (const key of ["forecast", "forecasts", "series"]) {
    const nested = payload[key];
    const rows = extractRows(nested);
    if (rows.length) return rows;
    if (isRecord(nested)) {
      const columnar = columnarRows(nested);
      if (columnar.length) return columnar;
    }
  }
  return columnarRows(payload);
}

function columnarRows(value: UnknownRecord): UnknownRecord[] {
  const timestampKey = Object.keys(value).find((key) => ["datetime", "timestamp", "date", "time"].includes(key.toLowerCase()));
  if (!timestampKey || !Array.isArray(value[timestampKey])) return [];
  const timestamps = value[timestampKey];
  return timestamps.map((timestamp, index) => {
    const row: UnknownRecord = { [timestampKey]: timestamp };
    for (const [key, column] of Object.entries(value)) {
      if (key === timestampKey || !Array.isArray(column)) continue;
      row[key] = column[index];
    }
    return row;
  });
}

function parseCsvRecords(text: string): UnknownRecord[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function readFirst(record: UnknownRecord, candidates: string[]) {
  const byLowercaseKey = new Map(Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]));
  for (const candidate of candidates) {
    const value = byLowercaseKey.get(candidate.toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  const canonical =
    comma > -1 && dot > -1
      ? comma > dot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "")
      : normalized.replace(",", ".");
  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  // Respaldo para CSV sin zona, documentado para fixtures locales. Las fuentes
  // de producción deben preferiblemente incluir UTC explícito.
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second = "0"] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error de red no identificado.";
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        output[index] = await mapper(items[index]);
      }
    }),
  );
  return output;
}

type UtcWindow = { start: Date; endInclusive: Date };

/**
 * CELEC devuelve cada jornada `EnerDia` desde las 06:00Z hasta las 05:00Z
 * siguiente, según el contrato observado del portal. Esta ventana no infiere
 * un desfase horario: las muestras siguen en UTC y la conversión para Ecuador
 * continental se realiza sólo al presentarlas.
 */
function rangeToCelecUtcWindow(range: DateRange): UtcWindow {
  return {
    start: new Date(`${range.from}T06:00:00.000Z`),
    endInclusive: new Date(`${addDays(range.to, 1)}T05:00:00.000Z`),
  };
}

function isInsideWindow(timestamp: string, window: UtcWindow) {
  const milliseconds = new Date(timestamp).getTime();
  return milliseconds >= window.start.getTime() && milliseconds <= window.endInclusive.getTime();
}

function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function assertDateOnly(value: string, parameter: string) {
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!parsed) {
    throw new DataRequestError(`${parameter} debe tener el formato YYYY-MM-DD.`);
  }
  const [, year, month, day] = parsed;
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    instant.getUTCFullYear() !== Number(year) ||
    instant.getUTCMonth() !== Number(month) - 1 ||
    instant.getUTCDate() !== Number(day)
  ) {
    throw new DataRequestError(`${parameter} debe ser una fecha válida.`);
  }
}

function addDays(date: string, amount: number) {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}

function calendarDayDistance(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
}

function datesInRange(range: DateRange) {
  const dates: string[] = [];
  for (let date = range.from; date <= range.to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function formatCelecDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function hourKey(timestamp: string) {
  const date = new Date(timestamp);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours())).toISOString();
}

function shiftHour(timestamp: string, amount: number) {
  const date = new Date(timestamp);
  date.setUTCHours(date.getUTCHours() + amount);
  return hourKey(date.toISOString());
}
