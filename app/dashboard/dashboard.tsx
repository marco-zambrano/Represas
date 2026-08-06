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

type QueryMode = "current" | "range";
type ChartRow = Observation & { time: number };
type CalendarMonth = { year: number; month: number };

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

const spanishMonth = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" });
function monthFromDate(value: Date): CalendarMonth { return { year: value.getFullYear(), month: value.getMonth() }; }
function shiftMonth({ year, month }: CalendarMonth, offset: number): CalendarMonth { const date = new Date(Date.UTC(year, month + offset, 1)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() }; }
function dateKey(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function daysInMonth({ year, month }: CalendarMonth) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
function monthLabel({ year, month }: CalendarMonth) { return spanishMonth.format(new Date(Date.UTC(year, month, 1))); }
function displayDate(value: string) { return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }

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
  const [mode, setMode] = useState<QueryMode>("current");
  const [from, setFrom] = useState(() => localDate(new Date()));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [draftFrom, setDraftFrom] = useState(() => localDate(new Date()));
  const [draftTo, setDraftTo] = useState(() => localDate(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromDate(new Date()));
  const [rangeHover, setRangeHover] = useState<string>();
  const [data, setData] = useState<TelemetryResponse>();
  const [requestError, setRequestError] = useState<string>();
  const [requestVersion, setRequestVersion] = useState(0);

  const dateRangeError = useMemo(() => {
    if (!draftFrom || !draftTo) return undefined;
    const start = new Date(`${draftFrom}T00:00:00Z`);
    const end = new Date(`${draftTo}T23:59:59Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return Number.isNaN(days) || days < 1 || days > 31 ? "El historial debe estar entre 1 y 31 días." : undefined;
  }, [draftFrom, draftTo]);
  const loading = !data && !requestError;

  const resetRequest = () => {
    setData(undefined);
    setRequestError(undefined);
    // Fuerza una lectura aunque se vuelva a la misma central y fecha.
    setRequestVersion((version) => version + 1);
  };

  const selectCurrent = () => {
    const today = localDate(new Date());
    setMode("current");
    setFrom(today); setTo(today); setDraftFrom(today); setDraftTo(today);
    resetRequest();
  };

  const beginRange = () => { setMode("range"); setRangeHover(undefined); if (mode !== "range") { setDraftFrom(""); setDraftTo(""); } };
  const selectRangeDate = (value: string) => {
    if (value > localDate(new Date())) return;
    setRangeHover(undefined);
    if (!draftFrom || draftTo) { setDraftFrom(value); setDraftTo(""); return; }
    if (value < draftFrom) { setDraftFrom(value); return; }
    setDraftTo(value);
  };
  const applyRange = () => { if (!draftFrom || !draftTo || dateRangeError) return; setMode("range"); setFrom(draftFrom); setTo(draftTo); resetRequest(); };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const days = Math.floor((new Date(`${to}T23:59:59Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
    // El modo actual permite al servidor usar la última jornada que CELEC haya
    // publicado. Un rango elegido por la persona siempre conserva sus fechas.
    const params = mode === "current"
      ? new URLSearchParams({ plant, period: "current" })
      : new URLSearchParams({ plant, period: days === 1 ? "day" : "month", from, to });
    fetch(`/api/telemetry?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as TelemetryResponse;
        if (!response.ok) throw new Error(body.error ?? "CELEC no pudo entregar telemetría.");
        return body;
      })
      .then((body) => { if (!cancelled) setData(body); })
      .catch((error: unknown) => {
        if (!cancelled && !controller.signal.aborted) setRequestError(error instanceof Error ? error.message : "No fue posible conectar con la fuente CELEC.");
      });
    return () => { cancelled = true; controller.abort(); };
  }, [plant, mode, from, to, requestVersion]);

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
  // CCS usa CENACE para el KPI actual, pero `ccsEnerDia` de CELEC sí es la
  // única serie por fecha que puede representar el progreso histórico.
  const showEnergyOnChart = hasEnergy;
  const showActiveUnits = !isCocaCodo && mode === "current" && hasActiveUnits;
  const cocaCodoEnergy = data?.cocaCodoEnergy;
  const usingPublishedCcsDay = isCocaCodo && mode === "current" && Boolean(data?.range.from && data.range.from !== from);

  return <div className="shell py-7 sm:py-9">
    <section className="dashboard-intro">
      <div>
        <p className="eyebrow">Panorama hidroeléctrico · Ecuador continental (UTC−5)</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Energía y caudal, en una sola lectura</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">Telemetría observada de CELEC. Cada serie conserva su unidad; un dato no publicado se mantiene como ausencia, nunca como cero.</p>
      </div>
    </section>

    <section className="mt-7" aria-label="Selección de central y filtro de fechas">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Central hidroeléctrica</p><h2 className="mt-1 text-xl font-black">Elige una central para explorarla</h2></div><p className="text-sm text-[var(--muted)]">{plants.find((item) => item.id === plant)?.installedCapacityMw} MW instalados</p></div>
      <div className="plant-picker mt-4" aria-label="Centrales hidroeléctricas disponibles">
        {plants.map((item) => <button key={item.id} type="button" aria-pressed={plant === item.id} className={`plant-card ${plant === item.id ? "plant-card-active" : ""}`} onClick={() => { setPlant(item.id); resetRequest(); }}>
          <span className="plant-card-image" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" />
          <span className="plant-card-overlay" aria-hidden="true" />
          <span className="plant-card-content"><strong>{item.name}</strong><small>Río {item.river}</small></span>
        </button>)}
      </div>
      <div className="panel date-filter mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Filtro de datos</p><h2 className="mt-1 text-xl font-black">Consulta la telemetría</h2></div><div className="date-mode" role="group" aria-label="Modo de consulta"><button type="button" className={mode === "current" ? "date-mode-active" : ""} onClick={selectCurrent}>Datos actuales</button><button type="button" className={mode === "range" ? "date-mode-active" : ""} onClick={beginRange}>Elegir por rango</button></div></div>
        {mode === "current" ? <p className="current-data-note">{usingPublishedCcsDay ? <>CELEC aún no publicó la energía horaria de hoy. Se muestra la última jornada completa con energía y caudal: <strong>{displayDate(data!.range.from)}</strong>.</> : "Se consulta la última jornada publicada por CELEC para la central seleccionada."}</p> : <DateRangePicker month={calendarMonth} onMonthChange={setCalendarMonth} from={draftFrom} to={draftTo} hoverDate={rangeHover} onHoverDate={setRangeHover} onSelect={selectRangeDate} onApply={applyRange} error={dateRangeError} />}
      </div>
    </section>

    <section aria-label="Indicadores operativos" className={`mt-5 grid gap-3 ${isCocaCodo ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      <Stat tone="energy" label="Energía producida" value={metric(isCocaCodo ? cocaCodoEnergy?.energyMwh : latest?.energyMwh, "MWh")} note={isCocaCodo ? cocaCodoEnergy?.dataAsOf ? `CENACE · ${cocaCodoEnergy.dataAsOf}` : "CENACE · snapshot operativo preliminar" : "última muestra publicada"} />
      <Stat tone="flow" label="Caudal" value={metric(latest?.flowM3s, "m³/s")} note="flujo observado" />
      {!isCocaCodo && mode === "current" && <Stat tone="units" label="Turbinas activas" value={metric(latest?.activeUnits, "")} note="unidades en servicio" activeUnits={latest?.activeUnits} />}
    </section>

    <ChartPanel loading={loading} error={requestError ?? data?.error} hasData={Boolean(chart.length)}>
      <div className="chart-head">
        <div><p className="eyebrow">Lectura integrada</p><h2 className="mt-2 text-xl font-black">{isCocaCodo ? "Energía y caudal observados" : "Producción y operación"}</h2><p className="mt-1 text-sm text-[var(--muted)]">{isCocaCodo ? "Series históricas CELEC filtradas por fecha. El KPI superior conserva el snapshot actual de CENACE." : "Energía, caudal y turbinas en ejes independientes."}</p></div>
        <SeriesLegend latest={latest} available={{ energy: showEnergyOnChart, flow: hasFlow, units: showActiveUnits }} energyLabel={isCocaCodo ? "Energía CELEC" : "Energía"} energyUnavailableLabel={isCocaCodo ? "Energía CELEC" : undefined} />
      </div>
      <div className="mt-5 h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 12, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
            <XAxis type="number" dataKey="time" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(value) => timestamp.format(new Date(value))} minTickGap={54} tick={axisTick} />
            {showEnergyOnChart && <YAxis yAxisId="energy" tick={axisTick} width={58} />}
            <YAxis yAxisId="flow" orientation="right" tick={axisTick} width={56} />
            {showActiveUnits && <YAxis yAxisId="units" orientation="right" tick={axisTick} width={44} allowDecimals={false} />}
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => timestamp.format(new Date(Number(value)))} formatter={(value, name) => [formatTooltipValue(value, String(name)), name]} />
            {showEnergyOnChart && <Line yAxisId="energy" type="monotone" dataKey="energyMwh" name="Energía" stroke="var(--chart-energy)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
            {hasFlow && <Line yAxisId="flow" type="monotone" dataKey="flowM3s" name="Caudal" stroke="var(--chart-flow)" strokeWidth={3} strokeDasharray="9 4" dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
            {showActiveUnits && <Line yAxisId="units" type="stepAfter" dataKey="activeUnits" name="Turbinas activas" stroke="var(--chart-units)" strokeWidth={3} strokeDasharray="2 4" dot={false} activeDot={{ r: 5 }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isCocaCodo && <p className="mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--muted)]"><strong className="text-[var(--foreground)]">Coca Codo Sinclair opera a filo de agua.</strong> No se representa cota ni turbinas. El gráfico usa caudal y energía histórica de CELEC para el rango elegido; el KPI de energía usa el acumulado preliminar actual de CENACE. Una jornada completa de ceros de CELEC se mantiene como no publicada.</p>}
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

function SeriesLegend({ latest, available, energyLabel = "Energía", energyUnavailableLabel }: { latest?: ChartRow; available: { energy: boolean; flow: boolean; units: boolean }; energyLabel?: string; energyUnavailableLabel?: string }) {
  const series = [
    available.energy
      ? ["energy", energyLabel, metric(latest?.energyMwh, "MWh"), "continua"]
      : energyUnavailableLabel ? ["energy", energyUnavailableLabel, "No publicada", "sin serie"] : null,
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

function Stat({ tone, label, value, note, activeUnits }: { tone: "energy" | "flow" | "units"; label: string; value: string; note: string; activeUnits?: number | null }) {
  const turbineCount = tone === "units" && Number.isFinite(activeUnits) ? Math.max(0, Math.round(activeUnits!)) : 0;
  return <article className={`panel stat-card stat-${tone} p-5`}>
    <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
    <div className="stat-value-row mt-3"><p className="text-2xl font-black tracking-tight">{value}</p>{turbineCount > 0 && <TurbineIndicators count={turbineCount} />}</div>
    <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
  </article>;
}

function TurbineIndicators({ count }: { count: number }) {
  return <span className="turbine-indicators" aria-hidden="true">{Array.from({ length: count }, (_, index) => <svg key={index} className="turbine-indicator" viewBox="0 0 24 24" style={{ animationDelay: `${index * -180}ms` }}><circle cx="12" cy="12" r="2.15" /><path d="M10.7 10.3C8.1 9.8 6.4 7.2 7.2 4.1c.2-.8 1.2-1 1.7-.3l3.4 5.7a2.2 2.2 0 0 0-1.6.8Z" /><path d="M13.5 10.3c1.8-1.9 4.9-2 7.2.2.6.6.2 1.5-.6 1.6l-6.5.4a2.2 2.2 0 0 0-.1-2.2Z" /><path d="M12.1 13.6c.8 2.5-.6 5.2-3.5 6.3-.8.3-1.5-.4-1.2-1.1l3-5.8a2.2 2.2 0 0 0 1.7.6Z" /></svg>)}</span>;
}

function DateRangePicker({ month, onMonthChange, from, to, hoverDate, onHoverDate, onSelect, onApply, error }: {
  month: CalendarMonth;
  onMonthChange: (month: CalendarMonth) => void;
  from: string;
  to: string;
  hoverDate?: string;
  onHoverDate: (value?: string) => void;
  onSelect: (value: string) => void;
  onApply: () => void;
  error?: string;
}) {
  const today = localDate(new Date());
  const previewTo = from && !to && hoverDate && hoverDate >= from ? hoverDate : undefined;
  const rangeEnd = to || previewTo;
  const selectedDays = from && rangeEnd ? Math.floor((Date.parse(`${rangeEnd}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1 : undefined;
  const previewError = selectedDays && selectedDays > 31 ? "El historial admite como máximo 31 días." : undefined;
  const helper = error ?? previewError ?? (selectedDays ? `${selectedDays} ${selectedDays === 1 ? "día seleccionado" : "días seleccionados"} de máximo 31.` : "Selecciona la fecha inicial y final.");
  return <div className="date-range-picker">
    <div className="date-range-heading"><p><strong>{from ? new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(`${from}T12:00:00`)) : "Fecha inicial"}</strong><span>Inicio</span></p><i aria-hidden="true" /><p><strong>{to ? new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(`${to}T12:00:00`)) : "Fecha final"}</strong><span>Fin</span></p></div>
    <div className="calendar-toolbar"><button type="button" aria-label="Mes anterior" onClick={() => onMonthChange(shiftMonth(month, -1))}>‹</button><span>Selecciona el inicio y final del rango</span><button type="button" aria-label="Mes siguiente" onClick={() => onMonthChange(shiftMonth(month, 1))}>›</button></div>
    <div className="calendar-months" onMouseLeave={() => onHoverDate(undefined)}><MonthCalendar month={month} today={today} from={from} to={to} rangeEnd={rangeEnd} preview={Boolean(previewTo)} onHoverDate={onHoverDate} onSelect={onSelect} /><MonthCalendar month={shiftMonth(month, 1)} today={today} from={from} to={to} rangeEnd={rangeEnd} preview={Boolean(previewTo)} onHoverDate={onHoverDate} onSelect={onSelect} /></div>
    <div className="date-range-actions"><p className={error || previewError ? "date-range-error" : ""}>{helper}</p><button type="button" className="button button-primary" disabled={Boolean(error) || !from || !to} onClick={onApply}>Aplicar rango</button></div>
  </div>;
}

function MonthCalendar({ month, today, from, to, rangeEnd, preview, onHoverDate, onSelect }: { month: CalendarMonth; today: string; from: string; to: string; rangeEnd?: string; preview: boolean; onHoverDate: (value?: string) => void; onSelect: (value: string) => void }) {
  const firstDay = (new Date(Date.UTC(month.year, month.month, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: firstDay + daysInMonth(month) }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  return <div className="calendar-month"><h3>{monthLabel(month)}</h3><div className="calendar-weekdays">{["L", "M", "X", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => {
    if (day === null) return <i key={`blank-${index}`} aria-hidden="true" />;
    const value = dateKey(month.year, month.month, day); const disabled = value > today; const selected = value === from || value === to; const inRange = Boolean(from && rangeEnd && value > from && value < rangeEnd); const previewEnd = Boolean(preview && value === rangeEnd);
    return <button key={value} type="button" disabled={disabled} className={`${selected ? "calendar-day-selected" : ""} ${inRange ? "calendar-day-range" : ""} ${previewEnd ? "calendar-day-preview-end" : ""}`} aria-label={new Intl.DateTimeFormat("es-EC", { dateStyle: "full" }).format(new Date(`${value}T12:00:00`))} onMouseEnter={() => !disabled && onHoverDate(value)} onFocus={() => !disabled && onHoverDate(value)} onClick={() => onSelect(value)}>{day}</button>;
  })}</div></div>;
}
