// Parity test: the browser tree-walker must reproduce Python XGBoost outputs.
// parity.json is emitted by build/train_model.py from the SHIPPED models.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calibratedDrugProb, multiClassProbs } from "./inference";
import type { Drug, Model } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const model: Model = JSON.parse(
  readFileSync(resolve(here, "../../public/model.json"), "utf8"),
);
const parity: {
  x: number[];
  per_drug_final: Record<Drug, number>;
  three_class: number[];
}[] = JSON.parse(
  readFileSync(
    resolve(here, "../../../build/artifacts/parity.json"),
    "utf8",
  ),
);

const TOL = 1e-6;

describe("XGBoost in-browser parity", () => {
  it("has parity vectors of the right width", () => {
    expect(parity.length).toBeGreaterThan(0);
    expect(parity[0].x.length).toBe(model.n_features);
  });

  it("matches Python per-drug calibrated probabilities within 1e-6", () => {
    for (const row of parity) {
      const x = Float64Array.from(row.x);
      for (const drug of model.drugs) {
        const js = calibratedDrugProb(model, drug, x);
        expect(Math.abs(js - row.per_drug_final[drug])).toBeLessThan(TOL);
      }
    }
  });

  it("matches Python 3-class softmax probabilities within 1e-6", () => {
    for (const row of parity) {
      const x = Float64Array.from(row.x);
      const js = multiClassProbs(
        model.three_class.trees,
        model.three_class.num_class,
        model.three_class.base_margin,
        x,
      );
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(js[c] - row.three_class[c])).toBeLessThan(TOL);
      }
    }
  });
});
