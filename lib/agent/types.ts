import type { PlantId } from "@/lib/data/catalog";
import type { SourceStatus } from "@/lib/data/types";

export type AgentMessageRole = "user" | "assistant";

export type AgentConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentObservation = {
  timestamp: string;
  energyMwh: number | null;
  flowM3s: number | null;
  activeUnits: number | null;
};

export type AgentForecastSample = {
  timestamp: string;
  flowM3s: number | null;
  series: "high_res" | "flow_avg" | null;
};

export type AgentForecastSummary = {
  targetAt: string | null;
  flowM3s: number | null;
  direction: "increasing" | "decreasing" | "stable" | "unknown";
  changePercent: number | null;
  series: "high_res" | "flow_avg" | null;
};

export type AgentPlantEvidence = {
  id: PlantId;
  name: string;
  river: string;
  installedCapacityMw: number;
  observedRange: { from: string; to: string; timezone: "America/Guayaquil" };
  latest: AgentObservation | null;
  previous: AgentObservation | null;
  recentObservations: AgentObservation[];
  forecast: AgentForecastSummary;
  forecastHorizon: AgentForecastSample[];
  ccsThreeHourForecast?: {
    status: "available" | "unconfigured" | "unavailable";
    issuedAt?: string;
    targetAt?: string;
    flowM3s?: number;
    message?: string;
    disclaimer: string;
  };
  notableChanges: string[];
  sources: SourceStatus[];
  warnings: string[];
};

export type AgentDemandEvidence = {
  status: "available" | "partial" | "unavailable";
  dataAsOf: string | null;
  retrievedAt: string;
  nationalDemandMw: number | null;
  previousDemandMw: number | null;
  cnelDemandMw: number | null;
  electricityCompaniesMw: number | null;
  topDistributors: Array<{ name: string; mw: number; percentageOfNationalDemand: number | null }>;
  message?: string;
};

export type AgentEvidence = {
  generatedAt: string;
  modelContextVersion: 1;
  plants: AgentPlantEvidence[];
  /** Centrales relacionadas con la pregunta y la respuesta. Ausente en historial anterior. */
  focusPlantIds?: PlantId[];
  nationalDemand: AgentDemandEvidence;
  sourceSummary: SourceStatus[];
};

export type AgentMessage = {
  id: string;
  conversationId: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
  evidence: AgentEvidence | null;
};

export type AgentChatResponse = {
  conversation: AgentConversation;
  userMessage: AgentMessage;
  assistantMessage: AgentMessage;
};
