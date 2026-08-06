import { plants, type PlantId } from "@/lib/data/catalog";

import type { AgentEvidence } from "./types";

const aliases: Record<PlantId, string[]> = {
  mazar: ["mazar"],
  "paute-molino": ["paute molino", "paute"],
  sopladora: ["sopladora"],
  "minas-san-francisco": ["minas san francisco", "minas"],
  "coca-codo-sinclair": ["coca codo sinclair", "coca codo", "ccs"],
};

const allPlantIds = plants.map((plant) => plant.id);

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * La vista de evidencia no debe sugerir que el agente comparó las cinco
 * centrales cuando la pregunta y la respuesta sólo tratan unas pocas.
 */
export function findFocusedPlantIds(question: string, answer: string): PlantId[] {
  const text = normalize(`${question} ${answer}`);
  const focused = allPlantIds.filter((plantId) => aliases[plantId].some((alias) => text.includes(alias)));
  return focused.length ? focused : allPlantIds;
}

export function withFocusedPlants(evidence: AgentEvidence, question: string, answer: string): AgentEvidence {
  return { ...evidence, focusPlantIds: findFocusedPlantIds(question, answer) };
}
