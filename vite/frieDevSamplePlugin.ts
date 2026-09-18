import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";

const DEFAULT_TEST_CSV = String.raw`D:\frie\Model Train\frie_ml_test.csv`;
const DEFAULT_SCORED_CSV = String.raw`D:\frie\Model Train\frie_scored_1000_calibrated.csv`;
const TARGET_COLUMN = "frie_score";

const INDICATOR_COLUMNS = {
  incomeStability: "income_stability_score",
  cashflowStability: "cashflow_stability_score",
  paymentDiscipline: "payment_discipline_score",
  savingsDiscipline: "savings_discipline_score",
  commitmentAdherence: "commitment_adherence_score",
  debtBurden: "debt_burden_score",
  financialStress: "financial_stress_score",
  financialResilience: "financial_resilience_score",
} as const;

type FrieIndicatorKey = keyof typeof INDICATOR_COLUMNS;
type FrieIndicators = Record<FrieIndicatorKey, number>;

interface FeatureContract {
  numeric_features: string[];
  categorical_features: string[];
  target?: string;
  total_input_features?: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function loadContract(configPath: string): FeatureContract {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as FeatureContract;
  if (!Array.isArray(config.numeric_features) || !Array.isArray(config.categorical_features)) {
    throw new Error("FRIE model configuration is missing feature groups.");
  }
  return config;
}

function buildCompleteFeatureRow(
  headers: string[],
  values: string[],
  numericFeatures: Set<string>,
  categoricalFeatures: Set<string>,
): Record<string, number | string> | null {
  const byName = new Map<string, string>();
  headers.forEach((header, index) => {
    byName.set(header, values[index] ?? "");
  });

  const features: Record<string, number | string> = {};

  for (const name of numericFeatures) {
    const raw = (byName.get(name) ?? "").trim();
    if (!raw) return null;
    const numericValue = Number(raw);
    if (!Number.isFinite(numericValue)) return null;
    features[name] = numericValue;
  }

  for (const name of categoricalFeatures) {
    const raw = (byName.get(name) ?? "").trim();
    if (!raw) return null;
    features[name] = raw;
  }

  return features;
}

interface DevSampleRecord {
  features: Record<string, number | string>;
  sampleId: string;
  indicators: FrieIndicators | null;
}

interface DevSampleMeta {
  sampleId: string;
  age_years: number | null;
  monthly_income: number | null;
  employment_years: number | null;
  occupation: string | null;
}

interface CsvTable {
  headers: string[];
  rows: string[][];
}

function readCsvTable(csvPath: string): CsvTable {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("The FRIE ML test dataset does not contain any data rows.");
  }
  return { headers: parseCsvLine(lines[0]), rows: lines.slice(1).map(parseCsvLine) };
}

function findCompleteRecords(
  csvPath: string,
  configPath: string,
  scoredPath: string,
): DevSampleRecord[] {
  const contract = loadContract(configPath);
  if (contract.target && contract.target !== TARGET_COLUMN) {
    throw new Error("FRIE model configuration has an unexpected target name.");
  }

  const numericFeatures = new Set(contract.numeric_features);
  const categoricalFeatures = new Set(contract.categorical_features);
  const expectedCount = numericFeatures.size + categoricalFeatures.size;
  if (expectedCount !== 98) {
    throw new Error("FRIE model configuration must define 98 input features.");
  }

  const { headers, rows } = readCsvTable(csvPath);
  const records: DevSampleRecord[] = [];
  const indicatorMap = loadIndicatorMap(scoredPath, [...numericFeatures, ...categoricalFeatures]);
  rows.forEach((values, index) => {
    const features = buildCompleteFeatureRow(headers, values, numericFeatures, categoricalFeatures);
    if (features && Object.keys(features).length === expectedCount && !(TARGET_COLUMN in features)) {
      const fingerprint = fingerprintOf(headers, values, numericFeatures, categoricalFeatures, contract);
      records.push({
        features,
        sampleId: `frie-test-record-${index}`,
        indicators: fingerprint ? indicatorMap.get(fingerprint) ?? null : null,
      });
    }
  });
  return records;
}

function fingerprintOf(
  headers: string[],
  values: string[],
  numericFeatures: Set<string>,
  categoricalFeatures: Set<string>,
  contract: FeatureContract,
): string | null {
  const byName = new Map<string, string>();
  headers.forEach((header, index) => {
    byName.set(header, values[index] ?? "");
  });
  const parts: string[] = [];
  for (const name of [...contract.numeric_features, ...contract.categorical_features]) {
    if (!numericFeatures.has(name) && !categoricalFeatures.has(name)) return null;
    parts.push(byName.get(name) ?? "");
  }
  return parts.join("");
}

function loadIndicatorMap(scoredPath: string, orderedFeatureNames: string[]): Map<string, FrieIndicators> {
  try {
    const { headers, rows } = readCsvTable(scoredPath);
    const indexByName = new Map(headers.map((header, index) => [header, index] as [string, number]));
    const map = new Map<string, FrieIndicators>();
    for (const values of rows) {
      const parts: string[] = [];
      let usable = true;
      for (const name of orderedFeatureNames) {
        const at = indexByName.get(name);
        if (at === undefined) {
          usable = false;
          break;
        }
        parts.push(values[at] ?? "");
      }
      if (!usable) return new Map();
      const indicators = {} as FrieIndicators;
      for (const [key, column] of Object.entries(INDICATOR_COLUMNS)) {
        const at = indexByName.get(column);
        const raw = at === undefined ? "" : (values[at] ?? "").trim();
        const numericValue = raw ? Number(raw) : NaN;
        if (!Number.isFinite(numericValue)) {
          usable = false;
          break;
        }
        indicators[key as FrieIndicatorKey] = Math.round(numericValue * 100) / 100;
      }
      if (!usable) continue;
      const fingerprint = parts.join("");
      if (!map.has(fingerprint)) {
        map.set(fingerprint, indicators);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function toMeta(record: DevSampleRecord): DevSampleMeta {
  const numeric = (key: string): number | null => {
    const value = record.features[key];
    return typeof value === "number" ? value : null;
  };
  const text = (key: string): string | null => {
    const value = record.features[key];
    return typeof value === "string" ? value : null;
  };
  return {
    sampleId: record.sampleId,
    age_years: numeric("age_years"),
    monthly_income: numeric("monthly_income"),
    employment_years: numeric("employment_years"),
    occupation: text("occupation"),
  };
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export function frieDevSamplePlugin(rootDir: string): Plugin {
  const csvPath = process.env.FRIE_ML_TEST_CSV?.trim() || DEFAULT_TEST_CSV;
  const scoredPath = process.env.FRIE_SCORED_CSV?.trim() || DEFAULT_SCORED_CSV;
  const configPath = path.resolve(rootDir, "backend/models/frie_model_config.json");

  return {
    name: "frie-dev-sample-features",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__frie_dev/sample-records", (_request, response) => {
        try {
          const records = findCompleteRecords(csvPath, configPath, scoredPath);
          sendJson(response, 200, {
            records: records.map(toMeta),
            source: "local-ml-test-csv",
          });
        } catch {
          sendJson(response, 503, { error: "sample_list_unavailable" });
        }
      });

      server.middlewares.use("/__frie_dev/sample-features", (request, response) => {
        try {
          const records = findCompleteRecords(csvPath, configPath, scoredPath);
          if (records.length === 0) {
            throw new Error("The FRIE ML test dataset has no complete 98-feature row.");
          }
          const url = new URL(request.url ?? "", "http://localhost");
          const wanted = url.searchParams.get("sampleId")?.trim();
          const record = wanted ? records.find((entry) => entry.sampleId === wanted) ?? null : records[0];
          if (!record) {
            sendJson(response, 404, { error: "sample_not_found" });
            return;
          }
          sendJson(response, 200, {
            features: record.features,
            sampleId: record.sampleId,
            indicators: record.indicators,
            source: "local-ml-test-csv",
          });
        } catch {
          sendJson(response, 503, { error: "sample_unavailable" });
        }
      });
    },
  };
}
