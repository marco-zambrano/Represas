"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { plants, type PlantId } from "@/lib/data/catalog";
import type { Observation, TelemetryResponse } from "@/lib/data/types";

type RangePreset = "current" | "7d" | "30d" | "custom";
type ChartRow = Observation & { time: number };

const number = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 });
const timestamp = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function metric(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "—" : `${number.format(value)}${unit ? ` ${unit}` : ""}`;
}

function localDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function subtractDays(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return localDate(value);
}

/** Quita sólo instantes completamente vacíos al final; jamás inventa un valor. */
function trimEmptyTail(rows: ChartRow[]) {
  let end = rows.length;
  while (end > 0) {
    const row = rows[end - 1];
    if (row.energyMwh !== null || row.flowM3s !== null || row.activeUnits !== null) break;
    end -= 1;
  }
  return rows.slice(0, end);
}

export function Dashboard() {
  const [plant, setPlant] = useState<PlantId>("coca-codo-sinclair");
  const [preset, setPreset] = useState<RangePreset>("current");
  const [from, setFrom] = useState(() => localDate(new Date()));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [data, setData] = useState<TelemetryResponse>();
  const [requestError, setRequestError] = useState<string>();

  const rangeError = useMemo(() => {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T23:59:59Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return Number.isNaN(days) || days < 1 || days > 31 ? "El historial debe estar entre 1 y 31 días." : undefined;
  }, [from, to]);
  const loading = !rangeError && !data && !requestError;

  const resetRequest = () => {
    setData(undefined);
    setRequestError(undefined);
  };

  const selectPreset = (nextPreset: RangePreset) => {
    const today = localDate(new Date());
    setPreset(nextPreset);
    if (nextPreset === "current") { setFrom(today); setTo(today); }
    if (nextPreset === "7d") { setFrom(subtractDays(6)); setTo(today); }
    if (nextPreset === "30d") { setFrom(subtractDays(29)); setTo(today); }
    resetRequest();
  };

  useEffect(() => {
    if (rangeError) return;
    let cancelled = false;
    const days = Math.floor((new Date(`${to}T23:59:59Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
    const params = new URLSearchParams({ plant, period: days === 1 ? "day" : "month", from, to });
    fetch(`/api/telemetry?${params}`)
      .then(async (response) => {
        const body = await response.json() as TelemetryResponse;
        if (!response.ok) throw new Error(body.error ?? "CELEC no pudo entregar telemetría.");
        return body;
      })
      .then((body) => { if (!cancelled) setData(body); })
      .catch((error: unknown) => {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : "No fue posible conectar con la fuente CELEC.");
      });
    return () => { cancelled = true; };
  }, [plant, from, to, rangeError]);

  const chart = useMemo(() => trimEmptyTail(
    (data?.observations ?? [])
      .map((observation) => ({ ...observation, time: new Date(observation.timestamp).getTime() }))
      .filter((observation) => Number.isFinite(observation.time)),
  ), [data]);
  const latest = chart.at(-1);
  const isCocaCodo = plant === "coca-codo-sinclair";
  const hasEnergy = chart.some((row) => row.energyMwh !== null);
  const hasFlow = chart.some((row) => row.flowM3s !== null);
  const hasActiveUnits = chart.some((row) => row.activeUnits !== null);
  const showEnergyOnChart = !isCocaCodo && hasEnergy;
  const showActiveUnits = !isCocaCodo && hasActiveUnits;
  const cocaCodoEnergy = data?.cocaCodoEnergy;

  return <div className="shell py-7 sm:py-9">
    <section className="dashboard-intro">
      <div>
        <p className="eyebrow">Panorama hidroeléctrico · Ecuador continental (UTC−5)</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Energía y caudal, en una sola lectura</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Telemetría observada de CELEC. Cada serie conserva su unidad; un dato no publicado se mantiene como ausencia, nunca como cero.</p>
      </div>
    </section>

    <section className="panel control-panel mt-7 p-4 sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(230px,.7fr)_minmax(0,1.3fr)] xl:items-end">
        <label className="text-sm font-bold text-[var(--foreground)]">Central hidroeléctrica
          <select className="mt-2 block w-full rounded-xl border px-3 py-3 text-base" value={plant} onChange={(event) => { setPlant(event.target.value as PlantId); resetRequest(); }}>
            {plants.map((item) => <option key={item.id} value={item.id}>{item.name} · río {item.river}</option>)}
          </select>
        </label>
        <div>
          <p className="text-sm font-bold">Periodo de consulta</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([ ["current", "Datos actuales"], ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"], ["custom", "Rango personalizado"] ] as [RangePreset, string][]).map(([value, label]) => <button key={value} onClick={() => selectPreset(value)} className={`filter-chip ${preset === value ? "filter-chip-active" : ""}`}>{label}</button>)}
          </div>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <label className="text-xs font-bold text-[var(--muted)]">Desde<input type="date" value={from} max={to} onChange={(event) => { setPreset("custom"); setFrom(event.target.value); resetRequest(); }} className="mt-1 block w-full rounded-lg border px-2 py-2 text-sm" /></label>
            <label className="text-xs font-bold text-[var(--muted)]">Hasta<input type="date" value={to} min={from} max={localDate(new Date())} onChange={(event) => { setPreset("custom"); setTo(event.target.value); resetRequest(); }} className="mt-1 block w-full rounded-lg border px-2 py-2 text-sm" /></label>
          </div>
        </div>
      </div>
      {rangeError && <p role="alert" className="mt-4 rounded-xl bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger-foreground)]">{rangeError}</p>}
    </section>

    <section aria-label="Indicadores operativos" className={`mt-5 grid gap-3 ${isCocaCodo ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      <Stat tone="energy" label="Energía producida" value={metric(isCocaCodo ? cocaCodoEnergy?.energyMwh : latest?.energyMwh, "MWh")} note={isCocaCodo ? cocaCodoEnergy?.dataAsOf ? `CENACE · ${cocaCodoEnergy.dataAsOf}` : "CENACE · snapshot operativo preliminar" : "última muestra publicada"} />
      <Stat tone="flow" label="Caudal" value={metric(latest?.flowM3s, "m³/s")} note="flujo observado" />
      {!isCocaCodo && <Stat tone="units" label="Turbinas activas" value={metric(latest?.activeUnits, "")} note="unidades en servicio" />}
    </section>

    <ChartPanel loading={loading} error={requestError ?? data?.error} hasData={Boolean(chart.length)}>
      <div className="chart-head">
        <div><p className="eyebrow">Lectura integrada</p><h2 className="mt-2 text-xl font-black">{isCocaCodo ? "Caudal observado" : "Producción y operación"}</h2><p className="mt-1 text-sm text-[var(--muted)]">{isCocaCodo ? "Serie hidráulica CELEC; la energía se presenta arriba como snapshot CENACE." : "Energía, caudal y turbinas en ejes independientes."}</p></div>
        <SeriesLegend latest={latest} available={{ energy: showEnergyOnChart, flow: hasFlow, units: showActiveUnits }} />
      </div>
      <div className="mt-5 h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis type="number" dataKey="time" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(value) => timestamp.format(new Date(value))} minTickGap={54} tick={axisTick} />
            <YAxis yAxisId="energy" tick={axisTick} width={58} />
            <YAxis yAxisId="flow" orientation="right" tick={axisTick} width={56} />
            <YAxis yAxisId="units" orientation="right" tick={axisTick} width={44} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timestamp.format(new Date(Number(value)))} formatter={(value, name) => [formatTooltipValue(value, String(name)), name]} />
            {showEnergyOnChart && <Line yAxisId="energy" type="monotone" dataKey="energyMwh" name="Energía" stroke="var(--chart-energy)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
            {hasFlow && <Line yAxisId="flow" type="monotone" dataKey="flowM3s" name="Caudal" stroke="var(--chart-flow)" strokeWidth={3} strokeDasharray="9 4" dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
            {showActiveUnits && <Line yAxisId="units" type="stepAfter" dataKey="activeUnits" name="Turbinas activas" stroke="var(--chart-units)" strokeWidth={3} strokeDasharray="2 4" dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isCocaCodo && <p className="mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--muted)]"><strong className="text-[var(--foreground)]">Coca Codo Sinclair opera a filo de agua.</strong> No se representa cota ni turbinas. El caudal proviene de CELEC; la energía es el acumulado preliminar de CENACE y no se dibuja contra esta serie horaria.</p>}
    </ChartPanel>
  </div>;
}

function formatTooltipValue(value: unknown, name: string) {
  const numeric = typeof value === "number" ? value : null;
  if (name === "Energía") return metric(numeric, "MWh");
  if (name === "Caudal") return metric(numeric, "m³/s");
  return metric(numeric, "");
}

const axisTick = { fill: "var(--text-subtle)", fontSize: 11 };
const tooltipStyle = { borderRadius: 14, border: "1px solid var(--border-strong)", background: "var(--surface-raised)", color: "var(--foreground)", boxShadow: "var(--shadow-panel)" };

function SeriesLegend({ latest, available }: { latest?: ChartRow; available: { energy: boolean; flow: boolean; units: boolean } }) {
  const series = [
    available.energy ? ["energy", "Energía", metric(latest?.energyMwh, "MWh"), "continua"] : null,
    available.flow ? ["flow", "Caudal", metric(latest?.flowM3s, "m³/s"), "segmentada"] : null,
    available.units ? ["units", "Turbinas", metric(latest?.activeUnits, ""), "punteada"] : null,
  ].filter((series): series is [string, string, string, string] => series !== null);
  return <ul aria-label="Leyenda y valores más recientes" className="series-legend">
    {series.map(([tone, label, value, pattern]) => <li key={tone} className={`legend-${tone}`}><span className="legend-line" aria-hidden="true" /><span><strong>{label}</strong><small>{pattern}</small></span><b>{value}</b></li>)}
  </ul>;
}

function ChartPanel({ loading, error, hasData, children }: { loading: boolean; error?: string; hasData: boolean; children: React.ReactNode }) {
  return <section className="panel chart-panel mt-5 p-5">{hasData ? children : <div className="flex h-[330px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] px-6 text-center text-[var(--muted)]"><p><strong className="block text-[var(--foreground)]">{loading ? "Consultando telemetría" : "Sin muestras publicadas"}</strong><span className="mt-1 block text-sm">{error ?? "La fuente aún no publicó datos para este período."}</span></p></div>}</section>;
}

function Stat({ tone, label, value, note }: { tone: "energy" | "flow" | "units"; label: string; value: string; note: string }) {
  return <article className={`panel stat-card stat-${tone} p-5`}><p className="text-sm font-bold text-[var(--muted)]">{label}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{note}</p></article>;
}
