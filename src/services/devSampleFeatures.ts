import type { CustomerFeatureMap } from "./api";
import { FrieApiError } from "./api";

export interface DevSampleMeta {
  sampleId: string;
  age_years: number | null;
  monthly_income: number | null;
  employment_years: number | null;
  occupation: string | null;
}

export interface FrieIndicators {
  incomeStability: number;
  cashflowStability: number;
  paymentDiscipline: number;
  savingsDiscipline: number;
  commitmentAdherence: number;
  debtBurden: number;
  financialStress: number;
  financialResilience: number;
}

const INDICATOR_KEYS: (keyof FrieIndicators)[] = [
  "incomeStability",
  "cashflowStability",
  "paymentDiscipline",
  "savingsDiscipline",
  "commitmentAdherence",
  "debtBurden",
  "financialStress",
  "financialResilience",
];

function toIndicators(value: unknown): FrieIndicators | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const indicators = {} as FrieIndicators;
  for (const key of INDICATOR_KEYS) {
    const entry = source[key];
    if (typeof entry !== "number" || !Number.isFinite(entry)) return null;
    indicators[key] = entry;
  }
  return indicators;
}

export interface DevSampleRecord {
  features: CustomerFeatureMap;
  sampleId?: string;
  indicators?: FrieIndicators | null;
  source?: string;
}

interface SampleListResponse {
  records: DevSampleMeta[];
}

/**
 * Development-only access to complete rows from the existing local FRIE ML test CSV.
 * Production builds do not include these paths.
 * NOTE: the import.meta.env.DEV guard is intentionally inlined in each function
 * so production bundlers can eliminate the dev-only branches entirely.
 */
export async function listDevSampleRecords(): Promise<DevSampleMeta[]> {
  if (!import.meta.env.DEV) {
    throw new FrieApiError("Sample model features are only available in local development.");
  }

  let response: Response;
  try {
    response = await fetch("/__frie_dev/sample-records");
  } catch {
    throw new FrieApiError("Unable to load the local development sample records.");
  }

  if (!response.ok) {
    throw new FrieApiError("No complete local development sample records are available.");
  }

  const body = (await response.json()) as SampleListResponse;
  if (!Array.isArray(body.records)) {
    throw new FrieApiError("The local development sample records are invalid.");
  }
  return body.records.filter(
    (record): record is DevSampleMeta =>
      !!record && typeof record.sampleId === "string" && record.sampleId.length > 0,
  );
}

export async function loadDevSampleRecord(sampleId: string): Promise<DevSampleRecord> {
  if (!import.meta.env.DEV) {
    throw new FrieApiError("Sample model features are only available in local development.");
  }
  if (!sampleId.trim()) {
    throw new FrieApiError("A development sample record must be selected first.");
  }

  let response: Response;
  try {
    response = await fetch(`/__frie_dev/sample-features?sampleId=${encodeURIComponent(sampleId.trim())}`);
  } catch {
    throw new FrieApiError("Unable to load the local development sample row.");
  }

  if (response.status === 404) {
    throw new FrieApiError("The selected development sample record is not available.");
  }
  if (!response.ok) {
    throw new FrieApiError("A complete local development sample row is not available.");
  }

  const body = (await response.json()) as DevSampleRecord;
  if (!body.features || typeof body.features !== "object") {
    throw new FrieApiError("The local development sample row is invalid.");
  }
  return { features: body.features, sampleId: body.sampleId, indicators: toIndicators(body.indicators), source: body.source };
}
