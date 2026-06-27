// Shared types mirroring the JSON artifacts emitted by the Python build step.

export type Drug = "NIT" | "SXT" | "CIP" | "LVX";

export interface TreeNodeInternal {
  f: number; // feature index into model.feature_names
  t: number; // split threshold (go left if value < t)
  l: number; // left child node id
  r: number; // right child node id
  dl: boolean; // default-left when value is missing/NaN
}
export interface TreeNodeLeaf {
  leaf: number;
}
export type TreeNode = TreeNodeInternal | TreeNodeLeaf;
export type Tree = TreeNode[]; // indexed by node id

export interface PerDrugModel {
  // Best strategy chosen per drug (compared on the locked test set).
  type: "xgb" | "lr" | "ensemble";
  xgb?: { trees: Tree[]; base_margin: number };
  lr?: { weights: number[]; bias: number };
  platt: { a: number; b: number }; // applied to the raw (pre-calibration) prob
}
export interface ThreeClassModel {
  trees: Tree[];
  num_class: number;
  base_margin: number;
}

export interface Model {
  version: string;
  xgboost_version: string;
  feature_names: string[];
  n_features: number;
  drugs: Drug[];
  preference_order: Drug[];
  label_map: Record<string, string>;
  per_drug: Record<Drug, PerDrugModel>;
  three_class: ThreeClassModel;
}

export interface ComboOption {
  code: string;
  label: string;
}
export interface Schema {
  version: string;
  feature_names: string[];
  feature_index: Record<string, number>;
  n_features: number;
  drugs: Drug[];
  drug_info: Record<
    Drug,
    { name: string; klass: string; line: string; plain: string }
  >;
  label_map: Record<string, string>;
  window_note: string;
  groups: {
    demographics: { has_is_white: boolean };
    age_groups: { key: string; label: string }[];
    resistance: {
      name_prefix: string;
      antibiotics: ComboOption[];
      windows: number[];
      combos: [string, number][];
    };
    organism: {
      name_prefix: string;
      organisms: ComboOption[];
      windows: number[];
      combos: [string, number][];
    };
    prescription: {
      name_template: string;
      classes: ComboOption[];
      windows: number[];
      combos: [string, number][];
    };
    comorbidity: {
      name_template: string;
      conditions: ComboOption[];
      windows: number[];
      combos: [string, number][];
    };
  };
}

export interface DrugPrediction {
  drug: Drug;
  pResistant: number; // calibrated probability of resistance
  susceptible: boolean;
}
export interface Prediction {
  perDrug: Record<Drug, DrugPrediction>;
  threeClass: number[]; // softmax probs over [NIT, SXT, FQ]
  recommendation: Drug | null;
  recommendationReason: "susceptible-preferred" | "least-resistant-fallback";
}
