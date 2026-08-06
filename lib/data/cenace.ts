import "server-only";

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import type {
  DistributorDemand,
  NationalDemandMetrics,
  NationalDemandResponse,
} from "./national-demand-types";

export const CENACE_OPERATING_BOARD_URL = "https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm";
const CENACE_FALLBACK_SNAPSHOT = path.join(process.cwd(), "public", "data", "cenace-operating-snapshot.html");

type PlotlyTrace = {
  name?: unknown;
  orientation?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
};

export type CocaCodoProduction = {
  energyMwh: number | null;
  dataAsOf: string | null;
  retrievedAt: string;
  status: "available" | "unavailable";
  preliminary: true;
  message?: string;
};

type NumericPayload = {
  dtype?: unknown;
  bdata?: unknown;
};

const distributorAliases = [
  { id: "emelnorte", name: "EMELNORTE", aliases: ["EMELNORTE"] },
  { id: "ee-regional-sur", name: "E.E. Regional Sur", aliases: ["EE REGIONAL SUR", "EMPRESA ELECTRICA REGIONAL SUR"] },
  { id: "ee-quito", name: "E.E. Quito", aliases: ["EE QUITO", "EMPRESA ELECTRICA QUITO"] },
  { id: "cnel-los-rios", name: "CNEL Los Ríos", aliases: ["CNEL LOS RIOS"] },
  { id: "cnel-el-oro", name: "CNEL El Oro", aliases: ["CNEL EL ORO"] },
  { id: "elepco", name: "ELEPCO", aliases: ["ELEPCO"] },
  { id: "ee-riobamba", name: "E.E. Riobamba", aliases: ["EE RIOBAMBA", "EMPRESA ELECTRICA RIOBAMBA"] },
  { id: "cnel-bolivar", name: "CNEL Bolívar", aliases: ["CNEL BOLIVAR"] },
  { id: "cnel-manabi", name: "CNEL Manabí", aliases: ["CNEL MANABI"] },
  { id: "ee-ambato", name: "E.E. Ambato", aliases: ["EE AMBATO", "EMPRESA ELECTRICA AMBATO"] },
  { id: "cnel-esmeraldas", name: "CNEL Esmeraldas", aliases: ["CNEL ESMERALDAS"] },
  { id: "cnel-santa-elena", name: "CNEL Santa Elena", aliases: ["CNEL SANTA ELENA"] },
  { id: "cnel-guayaquil", name: "CNEL Guayaquil", aliases: ["CNEL GUAYAQUIL"] },
  { id: "cnel-milagro", name: "CNEL Milagro", aliases: ["CNEL MILAGRO"] },
  { id: "cnel-santo-domingo", name: "CNEL Santo Domingo", aliases: ["CNEL SANTO DOMINGO"] },
  { id: "cnel-sucumbios", name: "CNEL Sucumbíos", aliases: ["CNEL SUCUMBIOS"] },
  { id: "ee-centro-sur", name: "E.E. Centro Sur", aliases: ["EE CENTRO SUR", "EMPRESA ELECTRICA CENTRO SUR"] },
  { id: "ee-azogues", name: "E.E. Azogues", aliases: ["EE AZOGUES", "EMPRESA ELECTRICA AZOGUES"] },
  { id: "cnel-guayas-los-rios", name: "CNEL Guayas Los Ríos", aliases: ["CNEL GUAYAS LOS RIOS"] },
] as const;

type DistributorAlias = (typeof distributorAliases)[number];

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .replace(/\bE E\b/g, "EE")
    .trim()
    .toUpperCase();
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findDistributor(value: string): DistributorAlias | undefined {
  const normalized = normalizeLabel(value);
  return distributorAliases.find((candidate) => candidate.aliases.some((alias) => normalized === normalizeLabel(alias)));
}

function readNumericText(value: string): number | null {
  const cleaned = value.replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;

  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(cleaned)
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return readNumericText(value);
  return null;
}

function isNumericPayload(value: unknown): value is NumericPayload {
  return Boolean(value && typeof value === "object" && "dtype" in value && "bdata" in value);
}

/** Decodes the compact binary arrays emitted by Plotly without evaluating the remote script. */
function decodeNumericSeries(value: unknown): Array<number | null> {
  if (Array.isArray(value)) return value.map(readNumber);
  if (!isNumericPayload(value) || typeof value.dtype !== "string" || typeof value.bdata !== "string") return [];

  const type = value.dtype.toLowerCase();
  const sizeByType: Record<string, number> = { i1: 1, u1: 1, i2: 2, u2: 2, i4: 4, u4: 4, f4: 4, f8: 8 };
  const bytesPerValue = sizeByType[type];
  if (!bytesPerValue) return [];

  const bytes = Buffer.from(value.bdata, "base64");
  if (!bytes.length || bytes.length % bytesPerValue !== 0) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values: Array<number | null> = [];

  for (let offset = 0; offset < bytes.length; offset += bytesPerValue) {
    const parsed = type === "i1" ? view.getInt8(offset)
      : type === "u1" ? view.getUint8(offset)
        : type === "i2" ? view.getInt16(offset, true)
          : type === "u2" ? view.getUint16(offset, true)
            : type === "i4" ? view.getInt32(offset, true)
              : type === "u4" ? view.getUint32(offset, true)
                : type === "f4" ? view.getFloat32(offset, true)
                  : view.getFloat64(offset, true);
    values.push(Number.isFinite(parsed) ? parsed : null);
  }

  return values;
}

/** Returns a JSON array argument from Plotly.newPlot while treating it strictly as data. */
function extractJsonArray(script: string, start: number): string | null {
  const arrayStart = script.indexOf("[", start);
  if (arrayStart < 0) return null;

  let depth = 0;
  let quote: "\"" | "'" | null = null;
  let escaped = false;
  for (let index = arrayStart; index < script.length; index += 1) {
    const character = script[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;
      if (depth === 0) return script.slice(arrayStart, index + 1);
    }
  }
  return null;
}

function extractFigures(script: string): PlotlyTrace[][] {
  const figures: PlotlyTrace[][] = [];
  let offset = 0;
  while (offset >= 0) {
    const call = script.indexOf("Plotly.newPlot", offset);
    if (call < 0) break;
    const source = extractJsonArray(script, call);
    if (source) {
      try {
        const parsed: unknown = JSON.parse(source);
        if (Array.isArray(parsed)) figures.push(parsed.filter((trace): trace is PlotlyTrace => Boolean(trace && typeof trace === "object")));
      } catch {
        // CENACE may change an individual visualization; keep parsing other figures.
      }
      offset = script.indexOf("[", call) + source.length;
    } else {
      offset = call + "Plotly.newPlot".length;
    }
  }
  return figures;
}

function parseDistributorFigure(figures: PlotlyTrace[][], nationalDemandMw: number | null): DistributorDemand[] {
  const candidates = figures.flatMap((figure) => figure.map((trace) => {
    const horizontal = trace.orientation === "h";
    const labels = horizontal ? trace.y : trace.x;
    const values = horizontal ? trace.x : trace.y;
    if (!Array.isArray(labels)) return [] as DistributorDemand[];
    const numericValues = decodeNumericSeries(values);
    if (labels.length !== numericValues.length) return [] as DistributorDemand[];

    return labels.flatMap((label, index) => {
      if (typeof label !== "string") return [];
      const distributor = findDistributor(label);
      const mw = numericValues[index];
      if (!distributor || mw === null || !Number.isFinite(mw)) return [];
      return [{
        id: distributor.id,
        name: distributor.name,
        mw,
        percentageOfNationalDemand: nationalDemandMw && nationalDemandMw > 0 ? (mw / nationalDemandMw) * 100 : null,
      }];
    });
  }));

  const best = candidates
    .filter((candidate) => candidate.length > 0)
    .sort((left, right) => right.length - left.length)[0] ?? [];

  return [...new Map(best.map((item) => [item.id, item])).values()].sort((left, right) => right.mw - left.mw);
}

function emptyMetrics(): NationalDemandMetrics {
  return { nationalDemandMw: null, previousDemandMw: null, cnelDemandMw: null, electricityCompaniesMw: null };
}

function cardMetrics(html: string): { metrics: NationalDemandMetrics; dataAsOf: string | null; figures: PlotlyTrace[][] } {
  const $ = load(html);
  const heading = $("h2").filter((_, element) => normalizeLabel($(element).text()).includes("DEMANDAS EMPRESAS ELECTRICAS DE DISTRIBUCION")).first();
  if (!heading.length) return { metrics: emptyMetrics(), dataAsOf: null, figures: [] };

  const section = heading.closest(".tab-content");
  const scope = section.length ? section : heading.parent().parent();
  const metrics = emptyMetrics();
  scope.find(".resumen-box").each((_, element) => {
    const children = $(element).children("div");
    const label = normalizeLabel(children.first().text());
    const value = readNumericText(children.last().text());
    if (value === null) return;
    if (label === "DEMANDA TOTAL") metrics.nationalDemandMw = value;
    if (label === "ANTERIOR") metrics.previousDemandMw = value;
    if (label === "DEMANDA CNEL") metrics.cnelDemandMw = value;
    if (label === "EMPRESAS ELECTRICAS") metrics.electricityCompaniesMw = value;
  });

  const dataAsOf = scope.find("span, p, div").toArray()
    .map((element) => compactText($(element).text()))
    .find((value) => value.length <= 100 && /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo).+\d{4}/i.test(value)) ?? null;

  return {
    metrics,
    dataAsOf,
    figures: scope.find("script").toArray().flatMap((element) => extractFigures($(element).text())),
  };
}

/**
 * Extracts only the Coca Codo total from CENACE's current production panel.
 * It is an MWh snapshot, deliberately not a time series to merge with the
 * CELEC hydraulic readings.
 */
export function parseCenaceCocaCodoProduction(html: string, retrievedAt = new Date().toISOString()): CocaCodoProduction {
  const $ = load(html);
  const heading = $("h2").filter((_, element) => normalizeLabel($(element).text()) === "PRODUCCION EN TIEMPO REAL").first();
  if (!heading.length) {
    return { energyMwh: null, dataAsOf: null, retrievedAt, status: "unavailable", preliminary: true, message: "CENACE no publicó el panel de producción en tiempo real." };
  }

  const section = heading.closest(".tab-content");
  const scope = section.length ? section : heading.parent().parent();
  const dataAsOf = scope.find("span, p, div").toArray()
    .map((element) => compactText($(element).text()))
    .find((value) => value.length <= 100 && /(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo).+\d{4}/i.test(value)) ?? null;
  const figures = scope.find("script").toArray().flatMap((element) => extractFigures($(element).text()));
  const trace = figures.flat().find((candidate) =>
    typeof candidate.name === "string" && normalizeLabel(candidate.name) === "COCA CODO",
  );
  const energyMwh = decodeNumericSeries(trace?.y).find((value): value is number => value !== null) ?? null;

  return energyMwh === null
    ? { energyMwh: null, dataAsOf, retrievedAt, status: "unavailable", preliminary: true, message: "CENACE no publicó el detalle de Coca Codo en MWh." }
    : { energyMwh, dataAsOf, retrievedAt, status: "available", preliminary: true };
}

export function unavailableNationalDemand(error: string, retrievedAt = new Date().toISOString()): NationalDemandResponse {
  return {
    source: "CENACE",
    sourceUrl: CENACE_OPERATING_BOARD_URL,
    retrievedAt,
    dataAsOf: null,
    unit: "MW",
    preliminary: true,
    status: "unavailable",
    metrics: emptyMetrics(),
    distributors: [],
    error,
  };
}

/** Parses the public CENACE HTML snapshot; it never calls or evaluates the embedded scripts. */
export function parseCenaceNationalDemand(html: string, retrievedAt = new Date().toISOString()): NationalDemandResponse {
  const { metrics, dataAsOf, figures } = cardMetrics(html);
  const distributors = parseDistributorFigure(figures, metrics.nationalDemandMw);
  const hasMetrics = Object.values(metrics).some((value) => value !== null);
  const status = distributors.length > 0 ? "available" : hasMetrics ? "partial" : "unavailable";

  return {
    source: "CENACE",
    sourceUrl: CENACE_OPERATING_BOARD_URL,
    retrievedAt,
    dataAsOf,
    unit: "MW",
    preliminary: true,
    status,
    metrics,
    distributors,
    ...(status === "available" ? {} : { error: hasMetrics ? "CENACE publicó el resumen, pero no una distribución legible por empresa." : "CENACE no publicó el bloque de demanda esperado." }),
  };
}

/** Fetches a short-lived snapshot. This source intentionally has no date or historical query parameters. */
export async function getNationalDemand(): Promise<NationalDemandResponse> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(CENACE_OPERATING_BOARD_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "HidroVista/1.0 (national-demand dashboard)",
      },
      next: { revalidate: 120 },
    });
    if (!response.ok) throw new Error(`CENACE respondió ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 3_000_000) throw new Error("La respuesta de CENACE supera el tamaño permitido.");
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error("La respuesta de CENACE supera el tamaño permitido.");
    return parseCenaceNationalDemand(html, retrievedAt);
  } catch {
    try {
      const snapshot = await readFile(CENACE_FALLBACK_SNAPSHOT, "utf8");
      const fallback = parseCenaceNationalDemand(snapshot, retrievedAt);
      if (fallback.distributors.length) {
        return {
          ...fallback,
          status: "partial",
          error: "CENACE no respondió en tiempo real; se muestra el último snapshot validado disponible.",
        };
      }
    } catch {
      // The primary error below deliberately avoids exposing internal network details.
    }
    return unavailableNationalDemand("CENACE no está disponible temporalmente. Intenta actualizar de nuevo en unos minutos.", retrievedAt);
  }
}

/** Fetches the same current CENACE snapshot used for the CCS energy KPI. */
export async function getCocaCodoProduction(): Promise<CocaCodoProduction> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(CENACE_OPERATING_BOARD_URL, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "HidroVista/1.0 (CCS production KPI)" },
      next: { revalidate: 120 },
    });
    if (!response.ok) throw new Error("CENACE no respondió correctamente.");
    const html = await response.text();
    if (html.length > 3_000_000) throw new Error("La respuesta de CENACE supera el tamaño permitido.");
    return parseCenaceCocaCodoProduction(html, retrievedAt);
  } catch {
    try {
      const snapshot = await readFile(CENACE_FALLBACK_SNAPSHOT, "utf8");
      const fallback = parseCenaceCocaCodoProduction(snapshot, retrievedAt);
      return fallback.status === "available"
        ? { ...fallback, message: "CENACE no respondió en tiempo real; se muestra el último snapshot validado disponible." }
        : fallback;
    } catch {
      return { energyMwh: null, dataAsOf: null, retrievedAt, status: "unavailable", preliminary: true, message: "CENACE no está disponible temporalmente." };
    }
  }
}
