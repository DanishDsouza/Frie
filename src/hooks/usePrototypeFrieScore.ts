import { useEffect, useState } from "react";
import { getHealth, predictFrieScore, type CustomerFeatureMap, type ReliabilityLevel } from "../services/api";
import { loadDevSampleRecord, type FrieIndicators } from "../services/devSampleFeatures";

export type PrototypeFrieScoreState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      frieScore: number;
      reliabilityLevel: ReliabilityLevel;
      features: CustomerFeatureMap;
      indicators: FrieIndicators | null;
      sampleId?: string;
    }
  | { status: "error"; message: string };

function publicErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unable to calculate the FRIE Score.";
}

export function usePrototypeFrieScore(sampleId: string | null): PrototypeFrieScoreState {
  const [state, setState] = useState<PrototypeFrieScoreState>({ status: "idle" });

  useEffect(() => {
    if (!sampleId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const health = await getHealth();
        if (!health.model_loaded) {
          throw new Error("FRIE scoring is temporarily unavailable.");
        }
        const record = await loadDevSampleRecord(sampleId);
        const prediction = await predictFrieScore(record.features);
        if (!cancelled) {
          setState({
            status: "ready",
            frieScore: prediction.frie_score,
            reliabilityLevel: prediction.reliability_level,
            features: record.features,
            indicators: record.indicators ?? null,
            sampleId: record.sampleId ?? sampleId,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", message: publicErrorMessage(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  return state;
}
