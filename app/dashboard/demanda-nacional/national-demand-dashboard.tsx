"use client";

import { useEffect, useMemo, useState } from "react";
import type { DistributorDemand, NationalDemandResponse } from "@/lib/data/national-demand-types";

type Position = [number, number];
type ProvinceFeature = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } };
type Projector = (position: Position) => [number, number];
type AreaKind = "cnel" | "company" | "isolated";
type ProvinceArea = { area: string; distributorId?: string; distributorName?: string; kind: AreaKind; note?: string };

const integer = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-EC", { maximumFractionDigits: 1 });

/* CENACE publishes MW by distributor, not by province. This is a display-area
 * association, and never converts a distributor total into a provincial measurement. */
const provinceCoverage: Record<string, ProvinceArea> = {
  AZUAY: { area: "Área Centro Sur", distributorId: "ee-centro-sur", distributorName: "E.E. Centro Sur", kind: "company" },
  BOLIVAR: { area: "Área CNEL Bolívar", distributorId: "cnel-bolivar", distributorName: "CNEL Bolívar", kind: "cnel" },
  CANAR: { area: "Área Azogues", distributorId: "ee-azogues", distributorName: "E.E. Azogues", kind: "company" },
  CARCHI: { area: "Área EMELNORTE", distributorId: "emelnorte", distributorName: "EMELNORTE", kind: "company" },
  CHIMBORAZO: { area: "Área Riobamba", distributorId: "ee-riobamba", distributorName: "E.E. Riobamba", kind: "company" },
  COTOPAXI: { area: "Área ELEPCO", distributorId: "elepco", distributorName: "ELEPCO", kind: "company" },
  "EL ORO": { area: "Área CNEL El Oro", distributorId: "cnel-el-oro", distributorName: "CNEL El Oro", kind: "cnel" },
  ESMERALDAS: { area: "Área CNEL Esmeraldas", distributorId: "cnel-esmeraldas", distributorName: "CNEL Esmeraldas", kind: "cnel" },
  GALAPAGOS: { area: "Sistema aislado Galápagos", kind: "isolated", note: "No aparece como distribuidora individual en el snapshot del SNI de CENACE." },
  GUAYAS: { area: "Áreas CNEL Guayaquil, Milagro y Guayas–Los Ríos", kind: "cnel", note: "La provincia reúne varias áreas; CENACE no publica un único MW provincial." },
  IMBABURA: { area: "Área EMELNORTE", distributorId: "emelnorte", distributorName: "EMELNORTE", kind: "company" },
  LOJA: { area: "Área Regional Sur", distributorId: "ee-regional-sur", distributorName: "E.E. Regional Sur", kind: "company" },
  "LOS RIOS": { area: "Área CNEL Los Ríos", distributorId: "cnel-los-rios", distributorName: "CNEL Los Ríos", kind: "cnel" },
  MANABI: { area: "Área CNEL Manabí", distributorId: "cnel-manabi", distributorName: "CNEL Manabí", kind: "cnel" },
  "MORONA SANTIAGO": { area: "Área Centro Sur", distributorId: "ee-centro-sur", distributorName: "E.E. Centro Sur", kind: "company" },
  NAPO: { area: "Área Ambato", distributorId: "ee-ambato", distributorName: "E.E. Ambato", kind: "company" },
  ORELLANA: { area: "Área CNEL Sucumbíos", distributorId: "cnel-sucumbios", distributorName: "CNEL Sucumbíos", kind: "cnel" },
  PASTAZA: { area: "Área Ambato", distributorId: "ee-ambato", distributorName: "E.E. Ambato", kind: "company" },
  PICHINCHA: { area: "Área E.E. Quito", distributorId: "ee-quito", distributorName: "E.E. Quito", kind: "company" },
  "SANTA ELENA": { area: "Área CNEL Santa Elena", distributorId: "cnel-santa-elena", distributorName: "CNEL Santa Elena", kind: "cnel" },
  "SANTO DOMINGO DE LOS TSACHILAS": { area: "Área CNEL Santo Domingo", distributorId: "cnel-santo-domingo", distributorName: "CNEL Santo Domingo", kind: "cnel" },
  SUCUMBIOS: { area: "Área CNEL Sucumbíos", distributorId: "cnel-sucumbios", distributorName: "CNEL Sucumbíos", kind: "cnel" },
  TUNGURAHUA: { area: "Área Ambato", distributorId: "ee-ambato", distributorName: "E.E. Ambato", kind: "company" },
  "ZAMORA CHINCHIPE": { area: "Área Regional Sur", distributorId: "ee-regional-sur", distributorName: "E.E. Regional Sur", kind: "company" },
};

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/gi, " ").trim().toUpperCase(); }
function formatMw(value: number | null | undefined) { return value === null || value === undefined ? "Sin dato" : `${integer.format(value)} MW`; }
function formatChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "—";
  const change = current - previous;
  const percentage = previous === 0 ? null : (change / previous) * 100;
  return `${change > 0 ? "+" : ""}${integer.format(change)} MW${percentage === null ? "" : ` · ${change > 0 ? "+" : ""}${decimal.format(percentage)}%`}`;
}
function isNationalDemandResponse(value: unknown): value is NationalDemandResponse { return Boolean(value && typeof value === "object" && "source" in value && (value as { source?: unknown }).source === "CENACE" && "metrics" in value && "distributors" in value && Array.isArray((value as { distributors?: unknown }).distributors)); }
function isProvinceFeature(value: unknown): value is ProvinceFeature { return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === "Feature" && "properties" in value && "geometry" in value); }
function provinceName(feature: ProvinceFeature) { return String(feature.properties.dpa_despro ?? feature.properties.nombre ?? feature.properties.name ?? "Provincia"); }
function asPosition(value: unknown): Position | null { return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number" ? [value[0], value[1]] : null; }
function rings(feature: ProvinceFeature): Position[][] {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [];
  return polygons.flatMap((polygon) => Array.isArray(polygon) ? polygon.map((ring) => Array.isArray(ring) ? ring.map(asPosition).filter((point): point is Position => point !== null) : []).filter((ring) => ring.length > 2) : []);
}
function projectorFor(features: ProvinceFeature[], frame: { x: number; y: number; width: number; height: number }): Projector {
  const points = features.flatMap(rings).flat();
  const longitude = points.map(([value]) => value); const latitude = points.map(([, value]) => value);
  const minX = Math.min(...longitude); const maxX = Math.max(...longitude); const minY = Math.min(...latitude); const maxY = Math.max(...latitude);
  const scale = Math.min(frame.width / Math.max(maxX - minX, 0.001), frame.height / Math.max(maxY - minY, 0.001));
  return ([x, y]) => [frame.x + (frame.width - (maxX - minX) * scale) / 2 + (x - minX) * scale, frame.y + (frame.height - (maxY - minY) * scale) / 2 + (maxY - y) * scale];
}
function pathFor(feature: ProvinceFeature, project: Projector) { return rings(feature).map((ring) => `${ring.map((point, index) => `${index === 0 ? "M" : "L"}${project(point).map((value) => value.toFixed(1)).join(" ")}`).join(" ")} Z`).join(" "); }
function areaColor(kind: AreaKind) { return kind === "cnel" ? "var(--map-cnel)" : kind === "company" ? "var(--map-company)" : "var(--map-isolated)"; }

export function NationalDemandDashboard() {
  const [data, setData] = useState<NationalDemandResponse | null>(null);
  const [provinces, setProvinces] = useState<ProvinceFeature[]>([]);
  const [loading, setLoading] = useState(true); const [mapLoading, setMapLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null); const [reload, setReload] = useState(0);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null); const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/ecuador-provinces.geojson", { signal: controller.signal }).then((response) => response.json()).then((body: unknown) => {
      const features = body && typeof body === "object" && "features" in body && Array.isArray((body as { features?: unknown }).features) ? (body as { features: unknown[] }).features.filter(isProvinceFeature).filter((feature) => normalize(provinceName(feature)) !== "ZONA NO DELIMITADA") : [];
      if (!features.length) throw new Error("No se pudo cargar la cartografía provincial."); setProvinces(features);
    }).catch(() => setNetworkError((current) => current ?? "No se pudo cargar la cartografía provincial.")).finally(() => setMapLoading(false));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const getData = async () => { setLoading(true); setNetworkError(null); try {
      const response = await fetch("/api/national-demand", { signal: controller.signal }); const body: unknown = await response.json();
      if (!isNationalDemandResponse(body)) throw new Error("La respuesta de demanda no tiene el formato esperado."); setData(body);
      if (!response.ok) setNetworkError(body.error ?? "CENACE no está disponible en este momento.");
    } catch (error) { if (!controller.signal.aborted) setNetworkError(error instanceof Error ? error.message : "No fue posible cargar la demanda nacional."); } finally { if (!controller.signal.aborted) setLoading(false); } };
    void getData(); return () => controller.abort();
  }, [reload]);

  const distributorsById = useMemo(() => new Map((data?.distributors ?? []).map((item) => [item.id, item])), [data]);
  const maximum = useMemo(() => Math.max(0, ...(data?.distributors ?? []).map((item) => item.mw)), [data]);
  const mainland = useMemo(() => provinces.filter((feature) => normalize(provinceName(feature)) !== "GALAPAGOS"), [provinces]);
  const galapagos = useMemo(() => provinces.filter((feature) => normalize(provinceName(feature)) === "GALAPAGOS"), [provinces]);
  const mainlandProject = useMemo(() => mainland.length ? projectorFor(mainland, { x: 120, y: 18, width: 426, height: 526 }) : null, [mainland]);
  const galapagosProject = useMemo(() => galapagos.length ? projectorFor(galapagos, { x: 20, y: 454, width: 76, height: 70 }) : null, [galapagos]);
  const activeName = selectedProvince ?? hoveredProvince;
  const activeFeature = provinces.find((feature) => normalize(provinceName(feature)) === activeName);
  const activeCoverage = activeFeature ? provinceCoverage[normalize(provinceName(activeFeature))] : undefined;
  const activeDemand = activeCoverage?.distributorId ? distributorsById.get(activeCoverage.distributorId) : undefined;
  const metrics = data?.metrics;
  const provincePath = (feature: ProvinceFeature) => pathFor(feature, normalize(provinceName(feature)) === "GALAPAGOS" ? galapagosProject! : mainlandProject!);
  const selectDistributor = (id: string) => {
    const province = Object.entries(provinceCoverage).find(([, coverage]) => coverage.distributorId === id)?.[0]
      ?? (id === "cnel-guayaquil" || id === "cnel-milagro" || id === "cnel-guayas-los-rios" ? "GUAYAS" : null);
    setSelectedProvince(province);
  };

  return <div className="shell py-8 sm:py-10">
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Sistema Nacional Interconectado · CENACE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Demanda nacional</h1><p className="mt-3 max-w-3xl text-[var(--muted)]">Áreas de distribución por provincia y demanda publicada por empresa. Pasa el cursor sobre el mapa para explorar cada área.</p></div><button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading} className="button button-secondary disabled:cursor-wait disabled:opacity-60">{loading ? "Actualizando…" : "Actualizar datos"}</button></div>

    <section className="demand-metrics mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores nacionales de demanda"><MetricCard tone="total" label="Demanda total" value={formatMw(metrics?.nationalDemandMw)} note="Sistema Nacional Interconectado" /><MetricCard tone="change" label="Variación" value={formatChange(metrics?.nationalDemandMw ?? null, metrics?.previousDemandMw ?? null)} note="frente a la lectura anterior" /><MetricCard tone="cnel" label="Demanda CNEL" value={formatMw(metrics?.cnelDemandMw)} note="áreas atendidas por CNEL EP" /><MetricCard tone="company" label="Empresas eléctricas" value={formatMw(metrics?.electricityCompaniesMw)} note="municipales y regionales" /></section>

    <section className="mt-5 grid gap-5 md:grid-cols-[1.28fr_.72fr]">
      <article className="panel demand-map-panel overflow-hidden p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Distribución por área</h2><p className="mt-1 text-sm text-[var(--muted)]">24 provincias · clasificación de área eléctrica.</p></div><span className="source-chip">Snapshot CENACE · MW</span></div>
        <div className="demand-map relative mt-4 overflow-hidden rounded-2xl p-2 sm:p-4">{mapLoading ? <div className="flex h-[530px] items-center justify-center text-sm text-[var(--muted)]">Cargando cartografía provincial…</div> : mainlandProject ? <svg viewBox="0 0 570 550" className="h-auto w-full" role="img" aria-label="Mapa interactivo de Ecuador por provincias y áreas eléctricas"><title>Áreas eléctricas por provincia del Ecuador</title>{mainland.map((feature) => { const name = provinceName(feature); const key = normalize(name); const coverage = provinceCoverage[key] ?? { area: "Área sin clasificar", kind: "isolated" as const }; const demand = coverage.distributorId ? distributorsById.get(coverage.distributorId) : undefined; const active = key === activeName; return <path key={key} d={provincePath(feature)} fill={areaColor(coverage.kind)} fillRule="evenodd" stroke={active ? "var(--province-active)" : "var(--map-border)"} strokeWidth={active ? 3 : 1.15} className="province-shape" role="button" tabIndex={0} aria-label={`${name}. ${coverage.area}. ${formatMw(demand?.mw)}`} onMouseEnter={() => setHoveredProvince(key)} onMouseLeave={() => setHoveredProvince(null)} onFocus={() => setHoveredProvince(key)} onBlur={() => setHoveredProvince(null)} onClick={() => setSelectedProvince((current) => current === key ? null : key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedProvince((current) => current === key ? null : key); } }} />; })}{galapagosProject && <g>{galapagos.map((feature) => { const key = normalize(provinceName(feature)); return <path key={key} d={provincePath(feature)} fill={areaColor("isolated")} fillRule="evenodd" stroke={key === activeName ? "var(--province-active)" : "var(--map-border)"} strokeWidth={key === activeName ? 3 : 1.15} className="province-shape" role="button" tabIndex={0} aria-label="Galápagos. Sistema aislado." onMouseEnter={() => setHoveredProvince(key)} onMouseLeave={() => setHoveredProvince(null)} onFocus={() => setHoveredProvince(key)} onBlur={() => setHoveredProvince(null)} onClick={() => setSelectedProvince((current) => current === key ? null : key)} />; })}</g>}</svg> : <div className="flex h-[530px] items-center justify-center text-sm text-[var(--muted)]">No se pudo cargar la cartografía provincial.</div>}
          <div className="map-tooltip" aria-live="polite">{activeFeature && activeCoverage ? <><strong>{provinceName(activeFeature)}</strong><span className="map-tooltip-area">{activeCoverage.area}</span><span>{activeDemand ? `${activeCoverage.distributorName} · ${formatMw(activeDemand.mw)} · ${decimal.format(activeDemand.percentageOfNationalDemand ?? 0)}% nacional` : activeCoverage.note ?? "Sin demanda individual publicada por CENACE."}</span></> : "Pasa el cursor o selecciona una provincia para ver su área eléctrica y demanda asociada."}</div>
        </div><div className="map-legend" aria-label="Leyenda de áreas eléctricas"><span><i className="legend-cnel" />CNEL EP</span><span><i className="legend-company" />Empresa eléctrica</span><span><i className="legend-isolated" />Sistema aislado / sin dato</span></div><p className="map-disclaimer">Los MW son de la distribuidora publicada por CENACE. Cuando un área cubre más de una provincia, el valor no representa una medición provincial.</p>
      </article>
      <article className="panel demand-ranking-panel p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Mayor demanda</h2><p className="mt-1 text-sm text-[var(--muted)]">Comparación visual de distribuidoras.</p></div><span className="source-chip">MW</span></div>{loading && !data ? <div className="mt-5 space-y-3" aria-label="Cargando demanda nacional">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}</div> : data?.distributors.length ? <ol className="demand-ranking mt-4 max-h-[510px] space-y-2 overflow-y-auto pr-1">{data.distributors.map((item, index) => <RankingItem key={item.id} index={index} item={item} maximum={maximum} active={item.id === activeCoverage?.distributorId} onSelect={() => selectDistributor(item.id)} />)}</ol> : <EmptyState error={networkError ?? data?.error} onRetry={() => setReload((value) => value + 1)} />}</article>
    </section>
  </div>;
}

function MetricCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <article className={`panel demand-metric demand-metric-${tone} p-5`}><p className="text-xs font-black uppercase tracking-[.12em] text-[var(--muted)]">{label}</p><p className="mt-2 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">{note}</p></article>; }
function RankingItem({ index, item, maximum, active, onSelect }: { index: number; item: DistributorDemand; maximum: number; active: boolean; onSelect: () => void }) { const width = maximum > 0 ? Math.max(5, (item.mw / maximum) * 100) : 0; const cnel = item.id.startsWith("cnel-"); return <li><button type="button" onClick={onSelect} className={`ranking-item ${active ? "ranking-item-active" : ""}`}><span className="ranking-number">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{item.name}</span><span className="ranking-track"><i className={cnel ? "ranking-bar ranking-bar-cnel" : "ranking-bar ranking-bar-company"} style={{ width: `${width}%` }} /></span></span><span className="ranking-value">{integer.format(item.mw)}<small>MW · {decimal.format(item.percentageOfNationalDemand ?? 0)}%</small></span></button></li>; }
function EmptyState({ error, onRetry }: { error: string | null | undefined; onRetry: () => void }) { return <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]"><strong className="block text-[var(--ink)]">No hay distribución disponible</strong><p className="mt-2 leading-6">{error ?? "CENACE no publicó el snapshot de demanda esperado."}</p><button type="button" className="mt-4 font-bold text-[var(--accent)]" onClick={onRetry}>Reintentar consulta</button></div>; }
