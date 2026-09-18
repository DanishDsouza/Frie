export type ReliabilityLevel = "Poor" | "Average" | "Good" | "Excellent";

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model: string;
}

export type CustomerFeatureMap = Record<string, number | string>;

export interface PredictionResponse {
  frie_score: number;
  reliability_level: ReliabilityLevel;
}

export class FrieApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FrieApiError";
    this.status = status;
  }
}

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configured) {
    throw new FrieApiError("The FRIE API base URL is not configured.");
  }
  return configured.replace(/\/$/, "");
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new FrieApiError("The FRIE service returned an unreadable response.", response.status);
  }
}

function publicApiFailure(status: number): FrieApiError {
  if (status === 422) {
    return new FrieApiError("The scoring request was rejected.", status);
  }
  if (status === 503) {
    return new FrieApiError("FRIE scoring is temporarily unavailable.", status);
  }
  return new FrieApiError("Unable to complete FRIE scoring.", status);
}

export async function getHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/health`);
  } catch {
    throw new FrieApiError("Unable to reach the FRIE scoring service.");
  }

  const body = await readJson<HealthResponse>(response);
  if (!response.ok) {
    throw new FrieApiError("FRIE scoring is temporarily unavailable.", response.status);
  }
  return body;
}

export async function predictFrieScore(features: CustomerFeatureMap): Promise<PredictionResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    });
  } catch {
    throw new FrieApiError("Unable to reach the FRIE scoring service.");
  }

  if (!response.ok) {
    throw publicApiFailure(response.status);
  }

  const body = await readJson<PredictionResponse>(response);
  if (!Number.isFinite(body.frie_score) || !body.reliability_level) {
    throw new FrieApiError("The FRIE service returned an incomplete score.");
  }
  return body;
}
