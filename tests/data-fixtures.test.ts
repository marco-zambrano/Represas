import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { hasUnpublishedCcsEnergy, normalizeCcsEnergy } from "../lib/data/ccs-energy";
import { parseCenaceCocaCodoProduction } from "../lib/data/cenace";

const fixture = (...segments: string[]) => path.join(process.cwd(), "lib", "data", "__fixtures__", ...segments);

test("el fixture ORDS conserva timestamps UTC y valores nulos sin convertirlos a cero", async () => {
  const source = await readFile(fixture("celec-point-values.json"), "utf8");
  const payload = JSON.parse(source) as { items: Array<{ loctimestamp: string; valueedit: number | null }> };

  assert.equal(payload.items.length, 3);
  assert.match(payload.items[0].loctimestamp, /Z$/);
  assert.equal(payload.items[1].valueedit, null);
  assert.notEqual(payload.items[2].valueedit, 0);
});

test("el fixture CENACE declara tarjetas MW y etiquetas de distribuidora parseables", async () => {
  const source = await readFile(fixture("cenace-demand.html"), "utf8");

  assert.match(source, /DEMANDA TOTAL/);
  assert.match(source, /DEMANDA CNEL/);
  assert.match(source, /E\.E\. QUITO/);
  assert.match(source, /"orientation": "h"/);
});

test("CCS no convierte una jornada completa de ceros de CELEC en generación real", () => {
  const source = [
    { timestamp: "2026-07-15T06:00:00Z", value: 0 },
    { timestamp: "2026-07-15T07:00:00Z", value: 0 },
  ];

  assert.equal(hasUnpublishedCcsEnergy(source.map((row) => row.value)), true);
  assert.deepEqual(normalizeCcsEnergy(source).map((row) => row.value), [null, null]);
  assert.equal(hasUnpublishedCcsEnergy([0, 12]), false);
});

test("el snapshot de CENACE entrega la energía de Coca Codo como acumulado MWh separado", async () => {
  const source = await readFile(path.join(process.cwd(), "public", "data", "cenace-operating-snapshot.html"), "utf8");
  const production = parseCenaceCocaCodoProduction(source, "2026-08-05T00:00:00.000Z");

  assert.equal(production.status, "available");
  assert.ok(production.energyMwh && production.energyMwh > 0);
  assert.equal(production.preliminary, true);
});
