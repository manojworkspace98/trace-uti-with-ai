"""
analyze_features.py — Rigorous feature analysis & selection for Trace with ML.

Goal: find which of the 231 history features actually contribute to predicting
resistance, and drop the rest, so the model is leaner (less overfit) and the UI
form is shorter. We use complementary, leakage-safe techniques:

  1. Permutation importance per target (the efficient, model-agnostic
     equivalent of leave-one-out — measures the validation-score drop when a
     feature is shuffled). Computed on an inner validation split, never the
     locked test set.
  2. XGBoost gain importance (for cross-checking / the dashboard).
  3. Group leave-one-out: literally retrain with each feature GROUP removed and
     measure the validation drop, to see which clinical groups matter.
  4. Reduced-vs-full check: confirm the selected subset matches full-feature
     performance on validation before committing to it.

Selection rule: keep a feature if it has positive permutation importance for at
least one of the 5 targets (4 per-drug + 3-class); always keep demographics/age.
The locked test set (is_train==0) is untouched throughout.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.inspection import permutation_importance
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

ART = Path(__file__).resolve().parent / "artifacts"
DRUGS = ["NIT", "SXT", "CIP", "LVX"]
SEED = 42


def quick_clf(binary: bool, spw: float = 1.0) -> XGBClassifier:
    common = dict(n_estimators=300, max_depth=4, learning_rate=0.05,
                  subsample=0.8, colsample_bytree=0.7, reg_lambda=2.0,
                  min_child_weight=5, tree_method="hist", random_state=SEED,
                  n_jobs=-1)
    if binary:
        return XGBClassifier(objective="binary:logistic", eval_metric="auc",
                             scale_pos_weight=spw, **common)
    return XGBClassifier(objective="multi:softprob", num_class=3,
                         eval_metric="mlogloss", **common)


def score_target(model, X, y, binary):
    if binary:
        return roc_auc_score(y, model.predict_proba(X)[:, 1])
    return f1_score(y, model.predict(X), average="macro")


def main() -> None:
    df = pd.read_parquet(ART / "unified_dataset.parquet")
    meta = json.loads((ART / "dataset_meta.json").read_text())
    features = meta["model_features"]                     # 231, canonical order

    train = df[df.is_train == 1].reset_index(drop=True)   # locked test untouched
    X = train[features]

    # Targets: 4 binary resistance + 1 three-class prescription.
    targets = {d: (train[d].astype(int), True) for d in DRUGS}
    targets["RX3"] = (train["prescription_class"].astype(int), False)

    # Inner train/val split (stratified on the 3-class target for balance).
    idx_tr, idx_va = train_test_split(
        np.arange(len(train)), test_size=0.2, random_state=SEED,
        stratify=train["prescription_class"].astype(int))
    Xtr, Xva = X.iloc[idx_tr], X.iloc[idx_va]

    perm = {}          # target -> {feature: mean importance}
    gain = {}          # target -> {feature: gain}
    full_scores = {}
    for name, (y, binary) in targets.items():
        ytr, yva = y.iloc[idx_tr], y.iloc[idx_va]
        spw = ((ytr == 0).sum() / max((ytr == 1).sum(), 1)) if binary else 1.0
        m = quick_clf(binary, spw).fit(Xtr, ytr)
        full_scores[name] = float(score_target(m, Xva, yva, binary))

        scorer = "roc_auc" if binary else "f1_macro"
        pi = permutation_importance(m, Xva, yva, scoring=scorer, n_repeats=5,
                                    random_state=SEED, n_jobs=-1)
        perm[name] = dict(zip(features, pi.importances_mean.tolist()))
        # XGBoost 2.x keys get_score by the real DataFrame column names.
        g = m.get_booster().get_score(importance_type="gain")
        gain[name] = {f: float(g.get(f, 0.0)) for f in features}
        print(f"[{name:4}] full val {scorer}={full_scores[name]:.4f}  "
              f"(+imp features: {sum(v>0 for v in perm[name].values())}/{len(features)})")

    # ── Aggregate & select ────────────────────────────────────────────────────
    # Keep a feature if permutation importance > eps for ANY target.
    eps = 1e-4
    always_keep = [f for f in features
                   if f.startswith("Age") or f.startswith("demographics")]
    contributes = {f: any(perm[t][f] > eps for t in targets) for f in features}
    selected = [f for f in features if contributes[f] or f in always_keep]
    dropped = [f for f in features if f not in selected]
    print(f"\nselected {len(selected)} / {len(features)} features "
          f"(dropped {len(dropped)})")

    # ── Reduced-vs-full validation check ──────────────────────────────────────
    red_scores = {}
    for name, (y, binary) in targets.items():
        ytr, yva = y.iloc[idx_tr], y.iloc[idx_va]
        spw = ((ytr == 0).sum() / max((ytr == 1).sum(), 1)) if binary else 1.0
        m = quick_clf(binary, spw).fit(Xtr[selected], ytr)
        red_scores[name] = float(score_target(m, Xva[selected], yva, binary))
    print("\nfull vs reduced (val):")
    for name in targets:
        print(f"  {name:4}: full {full_scores[name]:.4f}  reduced {red_scores[name]:.4f}"
              f"  Δ={red_scores[name]-full_scores[name]:+.4f}")

    # ── Group leave-one-out (literal retrain dropping each clinical group) ─────
    def group_of(f: str) -> str:
        if f.startswith("micro - prev resistance"): return "prior_resistance"
        if f.startswith("micro - prev organism"): return "prior_organism"
        if f.startswith("ab class"): return "prior_prescription"
        if f.startswith("comorbidity"): return "comorbidity"
        if f.startswith("Age"): return "age"
        if f.startswith("demographics"): return "demographics"
        return "other"
    groups = sorted(set(map(group_of, features)))
    group_loo = {}
    for g in groups:
        sub = [f for f in features if group_of(f) != g]
        drops = {}
        for name, (y, binary) in targets.items():
            ytr, yva = y.iloc[idx_tr], y.iloc[idx_va]
            spw = ((ytr == 0).sum() / max((ytr == 1).sum(), 1)) if binary else 1.0
            m = quick_clf(binary, spw).fit(Xtr[sub], ytr)
            drops[name] = full_scores[name] - float(score_target(m, Xva[sub], yva, binary))
        group_loo[g] = drops
        print(f"  drop group '{g}': mean Δ={np.mean(list(drops.values())):+.4f}")

    # ── Persist ────────────────────────────────────────────────────────────────
    # Top features per target for the dashboard (by permutation importance).
    top_per_target = {
        t: sorted(({"feature": f, "perm": perm[t][f], "gain": gain[t][f]}
                   for f in features), key=lambda d: d["perm"], reverse=True)[:20]
        for t in targets
    }
    (ART / "selected_features.json").write_text(json.dumps({
        "selected_features": selected,          # canonical order preserved
        "dropped_features": dropped,
        "n_selected": len(selected), "n_total": len(features),
        "eps": eps,
    }, indent=2))
    (ART / "feature_analysis.json").write_text(json.dumps({
        "full_scores": full_scores, "reduced_scores": red_scores,
        "permutation_importance": perm, "gain_importance": gain,
        "group_loo": group_loo, "top_per_target": top_per_target,
        "scoring": {**{d: "roc_auc" for d in DRUGS}, "RX3": "f1_macro"},
    }, indent=2))
    print(f"\nwrote selected_features.json ({len(selected)} feats) and feature_analysis.json")


if __name__ == "__main__":
    main()
