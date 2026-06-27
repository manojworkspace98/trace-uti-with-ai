// Pure-JS XGBoost inference — the correctness-critical engine.
// Walks the exported decision trees in the browser (no server, no WASM) and
// reproduces XGBoost's binary:logistic and multi:softprob outputs.
// A parity test (inference.test.ts) asserts this matches Python within 1e-6.

import type { Drug, Model, Prediction, Tree } from "./types";

function isLeaf(n: Tree[number]): n is { leaf: number } {
  return (n as { leaf?: number }).leaf !== undefined;
}

/** Walk one tree and return its leaf value. */
function walkTree(tree: Tree, x: Float64Array): number {
  let node = tree[0];
  while (!isLeaf(node)) {
    const v = x[node.f];
    let nextId: number;
    if (Number.isNaN(v)) nextId = node.dl ? node.l : node.r;
    else nextId = v < node.t ? node.l : node.r;
    node = tree[nextId];
  }
  return node.leaf;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Raw P(resistant) from a binary booster, before Platt calibration. */
export function rawBinaryProb(trees: Tree[], baseMargin: number, x: Float64Array): number {
  let margin = baseMargin;
  for (const t of trees) margin += walkTree(t, x);
  return sigmoid(margin);
}

/** Raw P from a logistic-regression model (linear w·x + b). */
export function lrProb(weights: number[], bias: number, x: Float64Array): number {
  let z = bias;
  for (let i = 0; i < weights.length; i++) z += weights[i] * x[i];
  return sigmoid(z);
}

/** Raw (pre-calibration) probability for a per-drug model of any strategy. */
export function rawDrugProb(model: Model, drug: Drug, x: Float64Array): number {
  const pd = model.per_drug[drug];
  const xgbRaw = pd.xgb ? rawBinaryProb(pd.xgb.trees, pd.xgb.base_margin, x) : 0;
  const lrRaw = pd.lr ? lrProb(pd.lr.weights, pd.lr.bias, x) : 0;
  if (pd.type === "xgb") return xgbRaw;
  if (pd.type === "lr") return lrRaw;
  return 0.5 * (xgbRaw + lrRaw); // ensemble
}

/** Softmax class probabilities from a multi:softprob booster. */
export function multiClassProbs(
  trees: Tree[],
  numClass: number,
  baseMargin: number,
  x: Float64Array,
): number[] {
  const margins = new Array(numClass).fill(baseMargin);
  for (let i = 0; i < trees.length; i++) {
    margins[i % numClass] += walkTree(trees[i], x);
  }
  const m = Math.max(...margins);
  const exps = margins.map((g) => Math.exp(g - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Calibrated P(resistant) for one drug (raw prob -> Platt scaling). */
export function calibratedDrugProb(model: Model, drug: Drug, x: Float64Array): number {
  const pd = model.per_drug[drug];
  const raw = rawDrugProb(model, drug, x);
  return sigmoid(pd.platt.a * raw + pd.platt.b);
}

const RESIST_THRESHOLD = 0.5;

/**
 * Full prediction: per-drug susceptibility + 3-class probabilities +
 * a narrowest-spectrum-susceptible recommendation.
 */
export function predict(model: Model, x: Float64Array): Prediction {
  const perDrug = {} as Prediction["perDrug"];
  for (const drug of model.drugs) {
    const p = calibratedDrugProb(model, drug, x);
    perDrug[drug] = { drug, pResistant: p, susceptible: p < RESIST_THRESHOLD };
  }
  const threeClass = multiClassProbs(
    model.three_class.trees,
    model.three_class.num_class,
    model.three_class.base_margin,
    x,
  );

  // Prefer the narrowest-spectrum drug predicted susceptible; otherwise fall
  // back to the drug with the lowest predicted resistance.
  let recommendation: Drug | null = null;
  let reason: Prediction["recommendationReason"] = "susceptible-preferred";
  for (const drug of model.preference_order) {
    if (perDrug[drug].susceptible) {
      recommendation = drug;
      break;
    }
  }
  if (!recommendation) {
    reason = "least-resistant-fallback";
    recommendation = model.drugs.reduce((best, d) =>
      perDrug[d].pResistant < perDrug[best].pResistant ? d : best,
    );
  }
  return { perDrug, threeClass, recommendation, recommendationReason: reason };
}
