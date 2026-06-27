"""
build_dataset.py — Reconstruct a unified, leakage-free modelling dataset for
"Trace with ML" from the raw PhysioNet AMR-UTI files.

Why this exists
---------------
The team's `numerical_coi_1804.csv` is only a 1,804-row subset and lacks
`example_id` / `is_train`, so it can't support the canonical temporal split or
per-drug resistance labels. We instead rebuild from the raw dataset:

  * Cohort      : the full UNCOMPLICATED UTI cohort (~15,806 rows) — 8.7x more data.
  * Features    : the team's curated 235-name set, but used WITHOUT the 4
                  current-resistance columns (NIT/SXT/CIP/LVX) as inputs, because
                  for the per-drug model those ARE the targets (no leakage).
                  => 231 history features = 224 native + 7 derived age one-hots.
  * Labels      : per-drug resistance (NIT/SXT/CIP/LVX, binary) AND the 3-class
                  prescription target (0=NIT, 1=SXT, 2=Fluoroquinolone CIP/LVX).
  * Split       : the dataset's native `is_train` flag (temporal holdout).

Raw data is read locally and NEVER copied into the repo. Outputs (derived,
de-identified aggregates only) go to build/artifacts/ which is git-ignored.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

# ── paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]          # …/UTI_project
DATA_DIR = PROJECT_ROOT / "PhysioNet Data" / (
    "amr-uti-antimicrobial-resistance-in-urinary-tract-infections-1.0.0"
)
COI_CSV = PROJECT_ROOT / "Makeathon_workspace" / "numerical_coi_1804.csv"
OUT_DIR = Path(__file__).resolve().parent / "artifacts"
OUT_DIR.mkdir(exist_ok=True)

AGE_SRC = "demographics - age"
DRUGS = ["NIT", "SXT", "CIP", "LVX"]
# Age bins exactly mirror the team's labels in numerical_coi / Deploy.ipynb.
AGE_BINS = [-1, 1, 3, 12, 19, 49, 79, 10_000]
AGE_LABELS = [
    "Age_Infant (0-1)", "Age_Toddler(2-3)", "Age_Kid(4-12)", "Age_Teen(13-19)",
    "Age_Adult(20-49)", "Age_Old(50-79)", "Age_SuperOld(80-110)",
]
# Prescription string -> 3-class target.
PRESCRIPTION_TO_CLASS = {"NIT": 0, "SXT": 1, "CIP": 2, "LVX": 2}


def main() -> None:
    # 1) Canonical feature names + order, taken from the team's curated matrix. ──
    coi_cols = list(pd.read_csv(COI_CSV, nrows=1).columns)
    curated = coi_cols[:-1]                                   # 235 feature names
    assert len(curated) == 235, f"expected 235 curated features, got {len(curated)}"

    age_names = [c for c in curated if c.startswith("Age")]
    curres_names = [c for c in curated if c in DRUGS]
    native_names = [c for c in curated if c not in age_names and c not in curres_names]
    assert len(age_names) == 7 and len(curres_names) == 4 and len(native_names) == 224

    # Model feature order = curated order with the 4 current-resistance cols removed.
    model_features = [c for c in curated if c not in curres_names]   # 231, ordered
    assert len(model_features) == 231

    # 2) Load raw files. ──────────────────────────────────────────────────────
    feats = pd.read_csv(DATA_DIR / "all_uti_features.csv")
    labels = pd.read_csv(DATA_DIR / "all_uti_resist_labels.csv")
    pres = pd.read_csv(DATA_DIR / "all_prescriptions.csv")

    missing = [c for c in native_names if c not in feats.columns]
    assert not missing, f"curated native features missing from raw data: {missing[:5]}"
    assert AGE_SRC in feats.columns

    # 3) Cohort = uncomplicated; keep id, split, native features, age source. ──
    keep = ["example_id", "is_train", AGE_SRC] + native_names
    feats_unc = feats.loc[feats["uncomplicated"] == 1, keep].copy()

    lab_unc = labels.loc[labels["uncomplicated"] == 1,
                         ["example_id"] + DRUGS].copy()
    lab_unc[DRUGS] = (lab_unc[DRUGS] > 0).astype(int)          # binarise resistance

    df = feats_unc.merge(lab_unc, on="example_id", how="inner")
    df = df.merge(pres[["example_id", "prescription"]], on="example_id", how="left")

    # 4) Derived age one-hot (exactly one bin per patient). ───────────────────
    age_bin = pd.cut(df[AGE_SRC].clip(lower=0), bins=AGE_BINS, labels=AGE_LABELS)
    age_oh = pd.get_dummies(age_bin)
    for a in age_names:                                        # guarantee all 7 cols
        if a not in age_oh.columns:
            age_oh[a] = 0
    age_oh = age_oh[age_names].astype(int)
    df = pd.concat([df.drop(columns=[AGE_SRC]), age_oh], axis=1)

    # 5) Targets. ─────────────────────────────────────────────────────────────
    df["prescription_class"] = df["prescription"].map(PRESCRIPTION_TO_CLASS)
    # 3-class model needs a prescription among NIT/SXT/CIP/LVX:
    df_has_pres = df["prescription_class"].notna()

    # Cast native + age feature matrix to clean numeric 0/1 (they already are).
    for c in native_names:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    feat_matrix = df[model_features].astype(float)

    # 6) Persist. ─────────────────────────────────────────────────────────────
    out = pd.concat(
        [df[["example_id", "is_train"]], feat_matrix,
         df[DRUGS], df["prescription_class"]],
        axis=1,
    )
    out.to_parquet(OUT_DIR / "unified_dataset.parquet", index=False)

    meta = {
        "n_rows": int(len(out)),
        "n_model_features": len(model_features),
        "model_features": model_features,            # 231, canonical order
        "curated_235": curated,                      # for reference / schema vocab
        "native_names": native_names,
        "age_names": age_names,
        "current_resistance_names": curres_names,    # labels, NOT model inputs
        "drug_labels": DRUGS,
        "prescription_to_class": PRESCRIPTION_TO_CLASS,
        "class_label_map": {0: "Nitrofurantoin", 1: "Trimethoprim-Sulfamethoxazole",
                            2: "Fluoroquinolone (CIP/LVX)"},
        "age_source": AGE_SRC, "age_bins": AGE_BINS, "age_labels": AGE_LABELS,
    }
    (OUT_DIR / "dataset_meta.json").write_text(json.dumps(meta, indent=2))

    # 7) Report. ──────────────────────────────────────────────────────────────
    tr, te = out["is_train"] == 1, out["is_train"] == 0
    print(f"cohort rows: {len(out)}  (train {tr.sum()} / test {te.sum()})")
    print(f"model features: {len(model_features)} history features (no leakage)")
    print(f"rows with prescription label: {int(df_has_pres.sum())}")
    print("\nper-drug resistance prevalence (train):")
    for d in DRUGS:
        print(f"  {d}: {df.loc[tr, d].mean():.3f}  (test {df.loc[te, d].mean():.3f})")
    print("\n3-class prescription distribution (train):")
    print(out.loc[tr, "prescription_class"].value_counts(dropna=False).sort_index().to_dict())
    base = out.loc[tr, "prescription_class"].value_counts(normalize=True).max()
    print(f"3-class majority baseline (train): {base:.3f}")
    print(f"\nwrote {OUT_DIR/'unified_dataset.parquet'} and dataset_meta.json")


if __name__ == "__main__":
    main()
