// Types for metrics.json (the evaluation dashboard's data source).
import type { Drug } from "./types";

export interface RocPoints {
  fpr: number[];
  tpr: number[];
}
export interface CalibrationPoints {
  pred: number[];
  obs: number[];
}
export interface PerDrugMetric {
  auc: number;
  prevalence: number;
  roc: RocPoints;
  calibration: CalibrationPoints;
}
export interface PerClassMetric {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}
export interface TrialPoint {
  n: number;
  v: number;
}

export interface Metrics {
  generated_features: number;
  n_total_features: number;
  cohort: { train: number; test: number; split: string };
  baseline_3class: number;
  old_model: { train_acc: number; val_acc: number; note: string };
  per_drug: Record<Drug, PerDrugMetric>;
  per_drug_cv_mean_auc: number;
  three_class: {
    train_acc: number;
    test_acc: number;
    macro_f1: number;
    cv_macro_f1_mean: number;
    cv_macro_f1_std: number;
    confusion_matrix: number[][];
    per_class: Record<string, PerClassMetric>;
  };
  augmentation: {
    arms: Record<string, { per_drug_auc: Record<Drug, number>; mean_auc: number }>;
    shipped_arm: string;
    verdict: string;
  };
  tuning: {
    per_drug_best_params: Record<string, number>;
    rx3_best_params: Record<string, number>;
    per_drug_trials: TrialPoint[];
    rx3_trials: TrialPoint[];
  };
  learning_curve: { frac: number; train_f1: number; test_f1: number }[];
  feature_selection: {
    n_selected: number;
    n_total: number;
    group_loo: Record<string, Record<string, number>>;
    top_per_target: Record<
      string,
      { feature: string; perm: number; gain: number }[]
    >;
  };
}
