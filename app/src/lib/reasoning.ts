// Generates plain-English reasoning + risk flags from the inputs and prediction.
// All statements are derived rules over the entered history — never invented.
import type { Drug, Prediction, Schema } from "./types";
import type { FormState } from "./formState";
import { totalHistoryItems } from "./formState";

const FQ = new Set<Drug>(["CIP", "LVX"]);

export interface RiskFlag {
  level: "info" | "warn" | "danger";
  text: string;
}

export interface Reasoning {
  basis: string;
  points: string[];
  risks: RiskFlag[];
}

function drugName(schema: Schema, d: Drug): string {
  return schema.drug_info[d].name;
}

export function buildReasoning(
  schema: Schema,
  form: FormState,
  pred: Prediction,
): Reasoning {
  const points: string[] = [];
  const risks: RiskFlag[] = [];
  const rec = pred.recommendation;

  // Basis of the prediction.
  const n = totalHistoryItems(form);
  const basis =
    n === 0
      ? "No prior history was entered, so this reflects population-level priors only — treat the confidence as low."
      : `Based on ${n} entered history item${n === 1 ? "" : "s"} across resistance, organisms, prescriptions and comorbidities.`;

  if (rec) {
    const p = Math.round(pred.perDrug[rec].pResistant * 100);
    if (pred.recommendationReason === "susceptible-preferred") {
      points.push(
        `${drugName(schema, rec)} is the narrowest-spectrum agent predicted to remain effective (estimated ${p}% chance of resistance).`,
      );
    } else {
      points.push(
        `No first-line agent was predicted clearly susceptible; ${drugName(schema, rec)} has the lowest estimated resistance (${p}%).`,
      );
    }
  }

  // Per-drug commentary.
  for (const d of schema.drugs) {
    const pd = pred.perDrug[d];
    const pr = Math.round(pd.pResistant * 100);
    if (pd.susceptible) {
      points.push(`${drugName(schema, d)}: predicted susceptible (${pr}% resistance).`);
    } else {
      points.push(`${drugName(schema, d)}: elevated resistance risk (${pr}%).`);
    }
  }

  // Risk flags from entered history.
  const resistantTo = new Set(form.resistances.map((r) => r.code));
  if ([...resistantTo].some((c) => FQ.has(c as Drug))) {
    risks.push({
      level: "warn",
      text: "Prior fluoroquinolone resistance recorded — fluoroquinolones are higher-risk here.",
    });
  }
  if (rec && resistantTo.has(rec)) {
    risks.push({
      level: "danger",
      text: `Recommended agent (${drugName(schema, rec)}) was previously flagged resistant in history — interpret with caution and confirm with culture.`,
    });
  }
  const fqClass = form.prescriptions.some((p) => p.code === "fluoroquinolone");
  if (fqClass) {
    risks.push({
      level: "info",
      text: "Recent fluoroquinolone exposure can select for resistance.",
    });
  }
  if (n === 0) {
    risks.push({
      level: "info",
      text: "Add prior resistance, organisms or antibiotic history to sharpen the prediction.",
    });
  }

  return { basis, points, risks };
}

/** Confidence = blend of the model's top-class certainty and data completeness. */
export function confidenceTier(
  topProb: number,
  dataCompleteness: number,
): { score: number; label: string; tone: "low" | "moderate" | "good" } {
  const score = 0.6 * topProb + 0.4 * dataCompleteness;
  if (score >= 0.62) return { score, label: "Moderate confidence", tone: "good" };
  if (score >= 0.45) return { score, label: "Low–moderate confidence", tone: "moderate" };
  return { score, label: "Low confidence", tone: "low" };
}
