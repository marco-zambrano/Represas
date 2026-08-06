export type NationalDemandStatus = "available" | "partial" | "unavailable";

export type DistributorDemand = {
  /** Stable identifier used to join CENACE labels to the display map. */
  id: string;
  name: string;
  mw: number;
  percentageOfNationalDemand: number | null;
};

export type NationalDemandMetrics = {
  nationalDemandMw: number | null;
  previousDemandMw: number | null;
  cnelDemandMw: number | null;
  electricityCompaniesMw: number | null;
};

/**
 * Current CENACE operating-board snapshot. CENACE does not expose a historical
 * demand API at this source, so `dataAsOf` is a label published in its HTML.
 */
export type NationalDemandResponse = {
  source: "CENACE";
  sourceUrl: string;
  retrievedAt: string;
  dataAsOf: string | null;
  unit: "MW";
  preliminary: true;
  status: NationalDemandStatus;
  metrics: NationalDemandMetrics;
  distributors: DistributorDemand[];
  error?: string;
};
