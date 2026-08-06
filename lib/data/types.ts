import type { PlantId } from "./catalog";

/** Compatibilidad con el selector previo. Los nuevos consumidores usan `range`. */
export type Period = "day" | "month" | "year";

export type DataSource = "CELEC" | "CENACE" | "GEOGLOWS" | "INAMHI";
export type SourceAvailability = "available" | "unconfigured" | "unavailable";

export type SourceStatus = {
  source: DataSource;
  availability: SourceAvailability;
  retrievedAt?: string;
  message?: string;
};

export type DateRange = {
  /** Fecha local de Ecuador continental, en formato YYYY-MM-DD e inclusiva. */
  from: string;
  /** Fecha local de Ecuador continental, en formato YYYY-MM-DD e inclusiva. */
  to: string;
  timezone: "America/Guayaquil";
  kind: "current" | "preset" | "custom";
};

export type TelemetryRequest = {
  range: DateRange;
  /** Conservado para clientes previos; la fuente no cambia MWh por MW. */
  period: Period;
};

export type Observation = {
  timestamp: string;
  /** Producción horaria que CELEC etiqueta como energía, no potencia. */
  energyMwh: number | null;
  /**
   * La fuente ORDS documentada no publica potencia MW en esta serie. Se
   * conserva para compatibilidad y siempre es null, en vez de inferir un MW.
   */
  generationMw: number | null;
  flowM3s: number | null;
  activeUnits: number | null;
};

export type TelemetryResponse = {
  plant: PlantId;
  /** Período heredado; `range` define el filtro efectivo. */
  period: Period;
  range: DateRange;
  source: "CELEC";
  sources: SourceStatus[];
  retrievedAt: string;
  units: {
    energy: "MWh";
    power: "MW";
    flow: "m³/s";
    activeUnits: "unidades";
  };
  observations: Observation[];
  /** Sólo CCS: acumulado MWh del snapshot actual de CENACE, no serie horaria. */
  cocaCodoEnergy?: {
    energyMwh: number | null;
    dataAsOf: string | null;
    retrievedAt: string;
    status: "available" | "unavailable";
    preliminary: true;
    message?: string;
  };
  warnings?: string[];
  error?: string;
};

export type ForecastObservation = {
  timestamp: string;
  flowM3s: number | null;
  /** GEOGLOWS `high_res` tiene prioridad; `flow_avg` es el respaldo. */
  series: "high_res" | "flow_avg" | null;
};

export type CcsForecastInputs = {
  h0719: number;
  h0728: number;
  m1124Lag9: number;
  m5247Lag6: number;
  m5124Lag6: number;
};

export type CcsThreeHourForecast = {
  status: "available" | "unconfigured" | "unavailable";
  issuedAt?: string;
  targetAt?: string;
  flowM3s?: number;
  inputs?: CcsForecastInputs;
  missingInputs?: string[];
  message?: string;
  validation: {
    sampleSize: 215;
    maeM3s: 38.63;
    rmseM3s: 64.46;
    biasM3s: -30.7;
    pearsonR: 0.935;
  };
  disclaimer: string;
};

export type ForecastResponse = {
  plant: PlantId;
  range: DateRange;
  retrievedAt: string;
  source: "GEOGLOWS";
  sources: SourceStatus[];
  /** Caudal observado CELEC para contrastar con el pronóstico, sin mezclar fuentes. */
  observed: Array<Pick<Observation, "timestamp" | "flowM3s">>;
  forecasts: ForecastObservation[];
  ccsThreeHour?: CcsThreeHourForecast;
  warnings?: string[];
  error?: string;
};
