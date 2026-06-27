// The form's state shape and the schema-driven mapping to the 98-feature vector.
import type { Schema } from "./types";

export interface HistoryItem {
  code: string;
  window: number;
}
export interface FormState {
  ageGroup: string | null; // schema age key, e.g. "Age_Adult(20-49)"
  isWhite: boolean | null; // null = not specified
  resistances: HistoryItem[];
  organisms: HistoryItem[];
  prescriptions: HistoryItem[]; // antibiotic class
  comorbidities: HistoryItem[];
}

export const emptyForm: FormState = {
  ageGroup: null,
  isWhite: null,
  resistances: [],
  organisms: [],
  prescriptions: [],
  comorbidities: [],
};

/** Build the model input vector (all zeros, then set selected feature bits). */
export function buildFeatureVector(schema: Schema, form: FormState): Float64Array {
  const x = new Float64Array(schema.n_features);
  const set = (name: string) => {
    const i = schema.feature_index[name];
    if (i !== undefined) x[i] = 1;
  };
  if (form.isWhite) set("demographics - is_white");
  if (form.ageGroup) set(form.ageGroup);
  for (const r of form.resistances) set(`micro - prev resistance ${r.code} ${r.window}`);
  for (const o of form.organisms) set(`micro - prev organism ${o.code} ${o.window}`);
  for (const p of form.prescriptions) set(`ab class ${p.window} - ${p.code}`);
  for (const c of form.comorbidities) set(`comorbidity ${c.window} - ${c.code}`);
  return x;
}

/** A 0..1 "data completeness" score used to temper confidence framing. */
export function completeness(form: FormState): number {
  let filled = 0;
  const total = 5;
  if (form.ageGroup) filled++;
  if (form.isWhite !== null) filled++;
  if (form.resistances.length) filled++;
  if (form.organisms.length) filled++;
  if (form.prescriptions.length || form.comorbidities.length) filled++;
  return filled / total;
}

export function totalHistoryItems(form: FormState): number {
  return (
    form.resistances.length +
    form.organisms.length +
    form.prescriptions.length +
    form.comorbidities.length
  );
}
