/**
 * Catálogo de centrales que publica el portal de Producción e Hidrología de
 * CELEC. Los identificadores y `mrid` se obtuvieron de
 * information/CELEC_ENDPOINTS.md; no se deben deducir a partir del nombre.
 */
export type PlantId =
  | "mazar"
  | "paute-molino"
  | "sopladora"
  | "minas-san-francisco"
  | "coca-codo-sinclair";

export type CelecPointId = {
  activeUnits: string;
  flowM3s: string;
};

export type Plant = {
  id: PlantId;
  name: string;
  river: string;
  /** Fotografía de paisaje hidráulico para la tarjeta de selección. */
  imageUrl: string;
  installedCapacityMw: number;
  turbineType: "Francis" | "Kaplan" | "Pelton" | "No especificado";
  celec: {
    /** Código que forma la ruta /sardom{code}/{code}EnerDia. */
    code: string;
    points: CelecPointId;
  };
};

export const plants: readonly Plant[] = [
  {
    id: "mazar",
    name: "Mazar",
    river: "Paute",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/78/Embalse_Mazar.jpg",
    installedCapacityMw: 170,
    turbineType: "Francis",
    celec: { code: "maz", points: { activeUnits: "30503", flowM3s: "30538" } },
  },
  {
    id: "paute-molino",
    name: "Paute-Molino",
    river: "Paute",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b8/Assuan-Hochdamm_15.JPG",
    installedCapacityMw: 1100,
    turbineType: "Pelton",
    celec: { code: "mol", points: { activeUnits: "44822", flowM3s: "24811" } },
  },
  {
    id: "sopladora",
    name: "Sopladora",
    river: "Paute",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/92/Peechi_Dam_3.jpg",
    installedCapacityMw: 487,
    turbineType: "Francis",
    celec: { code: "sop", points: { activeUnits: "90503", flowM3s: "90537" } },
  },
  {
    id: "minas-san-francisco",
    name: "Minas San Francisco",
    river: "Jubones",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/THOMPSON_FALLS_HYDROELECTRIC_DAM_HISTORIC_DISTRICT%3B_SANDERS_COUNTY.jpg",
    installedCapacityMw: 270,
    turbineType: "Pelton",
    celec: { code: "msf", points: { activeUnits: "650503", flowM3s: "650538" } },
  },
  {
    id: "coca-codo-sinclair",
    name: "Coca Codo Sinclair",
    river: "Coca",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e2/COCACODO_SINCLAIR_006.jpg",
    installedCapacityMw: 1500,
    turbineType: "Pelton",
    celec: { code: "ccs", points: { activeUnits: "100503", flowM3s: "100037" } },
  },
] as const;

const plantsById = new Map<PlantId, Plant>(plants.map((plant) => [plant.id, plant]));

export const isPlantId = (value: string): value is PlantId => plantsById.has(value as PlantId);

export function getPlant(plantId: PlantId): Plant {
  const plant = plantsById.get(plantId);
  if (!plant) {
    throw new Error(`Central CELEC desconocida: ${plantId}`);
  }
  return plant;
}
