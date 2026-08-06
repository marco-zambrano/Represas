import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("la cartografía provincial contiene las 24 provincias del Ecuador", async () => {
  const source = await readFile(path.join(process.cwd(), "public", "data", "ecuador-provinces.geojson"), "utf8");
  const map = JSON.parse(source) as { features: Array<{ properties?: { dpa_despro?: string } }> };
  const provinces = new Set(map.features.map((feature) => feature.properties?.dpa_despro).filter((name) => name && name !== "ZONA NO DELIMITADA"));

  assert.equal(provinces.size, 24);
  assert.ok(provinces.has("PICHINCHA"));
  assert.ok(provinces.has("GALAPAGOS"));
});
