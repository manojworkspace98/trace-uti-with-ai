import { useEffect, useState } from "react";
import type { Model, Schema } from "../lib/types";
import type { Metrics } from "../lib/metrics";

const BASE = import.meta.env.BASE_URL;

interface Assets {
  schema: Schema;
  model: Model;
  metrics: Metrics;
}

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; assets: Assets };

export function useAssets(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([
      fetch(`${BASE}schema.json`).then((r) => r.json()),
      fetch(`${BASE}model.json`).then((r) => r.json()),
      fetch(`${BASE}metrics.json`).then((r) => r.json()),
    ])
      .then(([schema, model, metrics]) => {
        if (!cancelled)
          setState({ status: "ready", assets: { schema, model, metrics } });
      })
      .catch((e) => {
        if (!cancelled)
          setState({ status: "error", error: String(e?.message ?? e) });
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { ...state, retry: () => setTick((t) => t + 1) };
}
