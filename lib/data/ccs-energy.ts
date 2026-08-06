/**
 * CELEC puede publicar una jornada completa de CCS con ceros aunque CENACE
 * reporte producción. `CELEC_ENDPOINTS.md` documenta esa discrepancia y
 * prohíbe sustituirla por una cifra de CENACE. Por ello, sólo la serie
 * completa de ceros se considera no publicada; un cero aislado se conserva.
 */
export function hasUnpublishedCcsEnergy(rows: ReadonlyArray<number | null>) {
  const published = rows.filter((value): value is number => value !== null);
  return published.length > 0 && published.every((value) => value === 0);
}

export function normalizeCcsEnergy(rows: ReadonlyArray<{ timestamp: string; value: number | null }>) {
  if (!hasUnpublishedCcsEnergy(rows.map((row) => row.value))) return [...rows];

  return rows.map((row) => ({ ...row, value: null }));
}
