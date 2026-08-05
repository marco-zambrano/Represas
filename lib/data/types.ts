import type { PlantId } from "./catalog";
export type Period = "day" | "month" | "year";
export type Observation = { timestamp: string; generationMw: number | null; flowM3s: number | null; elevationM: number | null; activeUnits: number | null };
export type TelemetryResponse = { plant: PlantId; period: Period; source: "CELEC"; retrievedAt: string; observations: Observation[]; error?: string };
