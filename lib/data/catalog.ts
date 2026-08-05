export type PlantId = "mazar" | "paute-molino" | "sopladora" | "minas-san-francisco" | "agoyan" | "coca-codo-sinclair";
export const plants: { id: PlantId; name: string; river: string }[] = [
  { id: "mazar", name: "Mazar", river: "Paute" }, { id: "paute-molino", name: "Paute-Molino", river: "Paute" },
  { id: "sopladora", name: "Sopladora", river: "Paute" }, { id: "minas-san-francisco", name: "Minas San Francisco", river: "Jubones" },
  { id: "agoyan", name: "Agoyán", river: "Pastaza" }, { id: "coca-codo-sinclair", name: "Coca Codo Sinclair", river: "Coca" },
];
export const isPlantId = (value: string): value is PlantId => plants.some((plant) => plant.id === value);
