"""
train_model.py — Maximise per-drug performance with multiple strategies, then
ship the best (per drug) as a browser-runnable model.

Strategies compared per antibiotic (selected by 5-fold CV AUROC on TRAIN only):
  • XGBoost          — Optuna-tuned gradient boosting
  • LogReg (L2)      — class-weighted logistic regression (linear, complements trees)
  • Ensemble         — mean of the two calibrated probabilities

We also compare the 98-feature pruned space vs the full 231-feature space and
keep whichever gives the better mean CV AUROC. A fast augmentation comparison
(none / SMOTEN / ROS / GaussianCopula) is reported for the dashboard.

The native is_train==0 temporal split is the locked test set, evaluated once.
Everything that ships (model.json) is exportable to a pure-JS scorer; a parity
test guarantees the browser reproduces these numbers within 1e-6.

Env: N_TRIALS (default 70)   QUICK (1 = smoke)
"""
from __future__ import annotations

import json, os, warnings
from pathlib import Path

import numpy as np
import pandas as pd
import optuna
import xgboost as xgb
from sklearn.calibration import calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_recall_fscore_support, roc_auc_score,
                             roc_curve)
from sklearn.model_selection import StratifiedKFold, train_test_split
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTEN, RandomOverSampler

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)

ART = Path(__file__).resolve().parent / "artifacts"
APP_PUBLIC = Path(__file__).resolve().parents[1] / "app" / "public"
APP_PUBLIC.mkdir(parents=True, exist_ok=True)
DRUGS = ["NIT", "SXT", "CIP", "LVX"]
PREF_ORDER = ["NIT", "SXT", "CIP", "LVX"]
SEED = 42
QUICK = os.environ.get("QUICK") == "1"
N_TRIALS = 6 if QUICK else int(os.environ.get("N_TRIALS", 70))
LABEL_MAP = {"0": "Nitrofurantoin", "1": "Trimethoprim-Sulfamethoxazole",
             "2": "Fluoroquinolone (CIP/LVX)"}


# ── model builders ──────────────────────────────────────────────────────────
def xgb_binary(params, spw):
    return XGBClassifier(objective="binary:logistic", eval_metric="auc",
                         scale_pos_weight=spw, tree_method="hist",
                         random_state=SEED, n_jobs=-1, **params)


def xgb_multi(params):
    return XGBClassifier(objective="multi:softprob", num_class=3,
                         eval_metric="mlogloss", tree_method="hist",
                         random_state=SEED, n_jobs=-1, **params)


def lr_model(C=1.0):
    return LogisticRegression(penalty="l2", C=C, class_weight="balanced",
                              solver="lbfgs", max_iter=3000)


def suggest(trial):
    return dict(
        n_estimators=trial.suggest_int("n_estimators", 150, 800),
        max_depth=trial.suggest_int("max_depth", 2, 6),
        learning_rate=trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        min_child_weight=trial.suggest_int("min_child_weight", 1, 15),
        subsample=trial.suggest_float("subsample", 0.6, 1.0),
        colsample_bytree=trial.suggest_float("colsample_bytree", 0.5, 1.0),
        reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
        reg_alpha=trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
        gamma=trial.suggest_float("gamma", 0.0, 5.0),
    )


SKF = StratifiedKFold(5, shuffle=True, random_state=SEED)


def cv_auc_xgb_family(params, X, Y):
    scores = []
    for d in DRUGS:
        y = Y[d].values
        fold = []
        for tr, va in SKF.split(X, y):
            spw = (y[tr] == 0).sum() / max((y[tr] == 1).sum(), 1)
            m = xgb_binary(params, spw).fit(X.iloc[tr], y[tr])
            fold.append(roc_auc_score(y[va], m.predict_proba(X.iloc[va])[:, 1]))
        scores.append(np.mean(fold))
    return float(np.mean(scores))


def cv_auc_strategies(params, lrC, X, y):
    """Return CV AUROC for xgb, lr, ensemble for one binary target."""
    xa, la, ea = [], [], []
    for tr, va in SKF.split(X, y):
        spw = (y[tr] == 0).sum() / max((y[tr] == 1).sum(), 1)
        mx = xgb_binary(params, spw).fit(X.iloc[tr], y[tr])
        ml = lr_model(lrC).fit(X.iloc[tr], y[tr])
        px = mx.predict_proba(X.iloc[va])[:, 1]
        pl = ml.predict_proba(X.iloc[va])[:, 1]
        xa.append(roc_auc_score(y[va], px))
        la.append(roc_auc_score(y[va], pl))
        ea.append(roc_auc_score(y[va], 0.5 * (px + pl)))
    return {"xgb": float(np.mean(xa)), "lr": float(np.mean(la)),
            "ensemble": float(np.mean(ea))}


def best_lrC(X, y):
    best, bestC = -1, 1.0
    for C in ([1.0] if QUICK else [0.05, 0.2, 1.0, 5.0]):
        s = []
        for tr, va in SKF.split(X, y):
            m = lr_model(C).fit(X.iloc[tr], y[tr])
            s.append(roc_auc_score(y[va], m.predict_proba(X.iloc[va])[:, 1]))
        if np.mean(s) > best:
            best, bestC = np.mean(s), C
    return bestC


def cv_macro_f1(params, X, y):
    s = [f1_score(y[va], xgb_multi(params).fit(X.iloc[tr], y[tr]).predict(X.iloc[va]),
                  average="macro") for tr, va in SKF.split(X, y)]
    return float(np.mean(s)), float(np.std(s))


# ── tree export ──────────────────────────────────────────────────────────────
def export_trees(booster):
    tdf = booster.trees_to_dataframe()
    fidx = {f: i for i, f in enumerate(booster.feature_names)}
    trees = []
    for _, g in tdf.groupby("Tree", sort=True):
        nodes = {}
        for _, r in g.iterrows():
            n = int(r["Node"])
            if r["Feature"] == "Leaf":
                nodes[n] = {"leaf": float(r["Gain"])}
            else:
                yes, no, miss = (int(r[k].split("-")[1]) for k in ("Yes", "No", "Missing"))
                nodes[n] = {"f": fidx[r["Feature"]], "t": float(r["Split"]),
                            "l": yes, "r": no, "dl": miss == yes}
        trees.append([nodes[i] for i in range(len(nodes))])
    return trees


def logit(p):
    return float(np.log(p / (1 - p)))


def base_margin(model):
    return logit(float(json.loads(model.get_booster().save_config())
                       ["learner"]["learner_model_param"]["base_score"]))


def platt_fit(raw, y):
    lr = LogisticRegression(C=1e6).fit(np.asarray(raw).reshape(-1, 1), y)
    return float(lr.coef_[0][0]), float(lr.intercept_[0])


def platt_apply(raw, a, b):
    return 1.0 / (1.0 + np.exp(-(a * np.asarray(raw) + b)))


# ── augmentation arms (fast; for the dashboard) ──────────────────────────────
def fit_arm(arm, params, Xtr, ytr):
    spw = (ytr == 0).sum() / max((ytr == 1).sum(), 1)
    if arm == "none":
        return xgb_binary(params, spw).fit(Xtr, ytr)
    if arm in ("SMOTEN", "ROS"):
        samp = SMOTEN(random_state=SEED) if arm == "SMOTEN" else RandomOverSampler(random_state=SEED)
        Xr, yr = samp.fit_resample(Xtr.astype(int), ytr)
        return xgb_binary(params, 1.0).fit(Xr.astype(float), yr)
    # GaussianCopula generative
    from sdv.metadata import Metadata
    from sdv.single_table import GaussianCopulaSynthesizer
    real = Xtr.copy(); real["__y__"] = ytr
    md = Metadata.detect_from_dataframe(real)
    syn = GaussianCopulaSynthesizer(md); syn.fit(real)
    extra = int((ytr == 0).sum() - (ytr == 1).sum())
    s = syn.sample(max(extra, 0))
    Xs = (s[Xtr.columns] >= 0.5).astype(float); ys = s["__y__"].astype(int).values
    Xc = pd.concat([Xtr, Xs], ignore_index=True); yc = np.concatenate([ytr, ys])
    return xgb_binary(params, (yc == 0).sum() / max((yc == 1).sum(), 1)).fit(Xc, yc)


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    df = pd.read_parquet(ART / "unified_dataset.parquet")
    meta = json.loads((ART / "dataset_meta.json").read_text())
    selected = json.loads((ART / "selected_features.json").read_text())["selected_features"]
    full = meta["model_features"]
    train = df[df.is_train == 1].reset_index(drop=True)
    test = df[df.is_train == 0].reset_index(drop=True)
    Ytr, Yte = train[DRUGS].astype(int), test[DRUGS].astype(int)
    rx_tr = train["prescription_class"].astype(int).values
    rx_te = test["prescription_class"].astype(int).values

    base_params = dict(n_estimators=400, max_depth=3, learning_rate=0.05,
                       subsample=0.8, colsample_bytree=0.7, reg_lambda=2.0,
                       min_child_weight=5)

    # 1) Feature-set comparison (quick, fixed params) ─────────────────────────
    fs_scores = {}
    for name, feats in [("selected_98", selected), ("full_231", full)]:
        fs_scores[name] = cv_auc_xgb_family(base_params, train[feats], Ytr)
        print(f"[feature-set] {name}: mean CV AUROC = {fs_scores[name]:.4f}")
    # tie-break to the smaller (cleaner UI) set unless full clearly wins
    FEATS = full if fs_scores["full_231"] > fs_scores["selected_98"] + 0.003 else selected
    chosen_fs = "full_231" if FEATS is full else "selected_98"
    print(f"  -> using {chosen_fs} ({len(FEATS)} features)")
    Xtr, Xte = train[FEATS], test[FEATS]
    (ART / "chosen_features.json").write_text(json.dumps(FEATS))

    # 2) Optuna tune XGB (per-drug family + 3-class) ──────────────────────────
    print(f"[tuning] per-drug XGB — {N_TRIALS} trials")
    s1 = optuna.create_study(direction="maximize",
                             sampler=optuna.samplers.TPESampler(seed=SEED),
                             pruner=optuna.pruners.MedianPruner())
    s1.optimize(lambda t: cv_auc_xgb_family(suggest(t), Xtr, Ytr), n_trials=N_TRIALS)
    drug_params = s1.best_params
    print(f"  best per-drug CV AUROC = {s1.best_value:.4f}")

    print(f"[tuning] 3-class XGB — {N_TRIALS} trials")
    s2 = optuna.create_study(direction="maximize",
                             sampler=optuna.samplers.TPESampler(seed=SEED),
                             pruner=optuna.pruners.MedianPruner())
    s2.optimize(lambda t: cv_macro_f1(suggest(t), Xtr, rx_tr)[0], n_trials=N_TRIALS)
    rx_params = s2.best_params
    rx_cv_mean, rx_cv_std = cv_macro_f1(rx_params, Xtr, rx_tr)
    print(f"  best 3-class CV macro-F1 = {rx_cv_mean:.4f} (±{rx_cv_std:.4f})")

    # 3) Per-drug: pick best strategy by CV AUROC, then fit + calibrate + test ─
    cfit, ccal = train_test_split(np.arange(len(train)), test_size=0.2,
                                  random_state=SEED, stratify=rx_tr)
    per_drug_export, per_drug_metrics, model_comparison = {}, {}, {}
    shipped_models = {}
    for d in DRUGS:
        y = Ytr[d].values
        lrC = best_lrC(Xtr, y)
        cv = cv_auc_strategies(drug_params, lrC, Xtr, y)
        chosen = max(cv, key=cv.get)
        model_comparison[d] = {**cv, "chosen": chosen, "lrC": lrC}

        # Fit on cfit, calibrate chosen strategy's raw prob on ccal.
        spw = (y[cfit] == 0).sum() / max((y[cfit] == 1).sum(), 1)
        mx = xgb_binary(drug_params, spw).fit(Xtr.iloc[cfit], y[cfit])
        ml = lr_model(lrC).fit(Xtr.iloc[cfit], y[cfit])

        def raw_of(strategy, X):
            px = mx.predict_proba(X)[:, 1]
            pl = ml.predict_proba(X)[:, 1]
            return {"xgb": px, "lr": pl, "ensemble": 0.5 * (px + pl)}[strategy]

        a, b = platt_fit(raw_of(chosen, Xtr.iloc[ccal]), y[ccal])
        cal_te = platt_apply(raw_of(chosen, Xte), a, b)
        auc = float(roc_auc_score(Yte[d].values, cal_te))
        fpr, tpr, _ = roc_curve(Yte[d].values, cal_te)
        fp, mp = calibration_curve(Yte[d].values, cal_te, n_bins=10, strategy="quantile")

        export = {"type": chosen, "platt": {"a": a, "b": b}}
        if chosen in ("xgb", "ensemble"):
            export["xgb"] = {"trees": export_trees(mx.get_booster()),
                             "base_margin": base_margin(mx)}
        if chosen in ("lr", "ensemble"):
            export["lr"] = {"weights": ml.coef_[0].tolist(), "bias": float(ml.intercept_[0])}
        per_drug_export[d] = export
        per_drug_metrics[d] = {
            "auc": auc, "strategy": chosen, "prevalence": float(Yte[d].mean()),
            "roc": {"fpr": fpr.round(4).tolist(), "tpr": tpr.round(4).tolist()},
            "calibration": {"pred": mp.round(4).tolist(), "obs": fp.round(4).tolist()},
        }
        shipped_models[d] = (mx, ml, chosen, a, b)
        print(f"  [{d}] {chosen:8} test AUROC={auc:.4f}  "
              f"(xgb {cv['xgb']:.3f} / lr {cv['lr']:.3f} / ens {cv['ensemble']:.3f})")

    # 4) 3-class final ────────────────────────────────────────────────────────
    m_rx = xgb_multi(rx_params).fit(Xtr, rx_tr)
    rx_pred = m_rx.predict(Xte)
    cm = confusion_matrix(rx_te, rx_pred, labels=[0, 1, 2])
    p, r, f1, supp = precision_recall_fscore_support(rx_te, rx_pred, labels=[0, 1, 2])
    rx_export = {"trees": export_trees(m_rx.get_booster()), "num_class": 3,
                 "base_margin": base_margin(m_rx)}
    base_rate = float(pd.Series(rx_tr).value_counts(normalize=True).max())
    mean_auc = float(np.mean([per_drug_metrics[d]["auc"] for d in DRUGS]))
    print(f"\n[RESULT] mean per-drug test AUROC = {mean_auc:.4f}  |  "
          f"3-class test acc={accuracy_score(rx_te, rx_pred):.4f} "
          f"macroF1={f1_score(rx_te, rx_pred, average='macro'):.4f}")

    # 5) Augmentation comparison (fast arms) on inner split ───────────────────
    arms = ["none", "SMOTEN", "ROS"] + ([] if QUICK else ["GaussianCopula"])
    itr, iva = train_test_split(np.arange(len(train)), test_size=0.2,
                                random_state=SEED, stratify=rx_tr)
    aug = {}
    for arm in arms:
        aucs = [roc_auc_score(Ytr[d].values[iva],
                fit_arm(arm, drug_params, Xtr.iloc[itr], Ytr[d].values[itr])
                .predict_proba(Xtr.iloc[iva])[:, 1]) for d in DRUGS]
        aug[arm] = {"per_drug_auc": dict(zip(DRUGS, map(float, aucs))),
                    "mean_auc": float(np.mean(aucs))}
        print(f"  [aug] {arm:14} mean AUROC={aug[arm]['mean_auc']:.4f}")
    best_arm = max(aug, key=lambda a: aug[a]["mean_auc"])
    aug_improved = aug[best_arm]["mean_auc"] > aug["none"]["mean_auc"] + 1e-3

    # 6) Learning curve (3-class) ─────────────────────────────────────────────
    lc = []
    for frac in ([0.5, 1.0] if QUICK else [0.2, 0.4, 0.6, 0.8, 1.0]):
        n = int(len(Xtr) * frac)
        mm = xgb_multi(rx_params).fit(Xtr.iloc[:n], rx_tr[:n])
        lc.append({"frac": frac,
                   "train_f1": float(f1_score(rx_tr[:n], mm.predict(Xtr.iloc[:n]), average="macro")),
                   "test_f1": float(f1_score(rx_te, mm.predict(Xte), average="macro"))})

    # 7) Write model.json ─────────────────────────────────────────────────────
    model = {
        "version": "2.0.0", "xgboost_version": xgb.__version__,
        "feature_names": FEATS, "n_features": len(FEATS),
        "drugs": DRUGS, "preference_order": PREF_ORDER, "label_map": LABEL_MAP,
        "per_drug": per_drug_export, "three_class": rx_export,
    }
    (APP_PUBLIC / "model.json").write_text(json.dumps(model, separators=(",", ":")))

    feat_analysis = json.loads((ART / "feature_analysis.json").read_text())
    metrics = {
        "cohort": {"train": len(train), "test": len(test),
                   "split": "native is_train (temporal holdout)"},
        "baseline_3class": base_rate,
        "old_model": {"train_acc": 0.87, "val_acc": 0.44,
                      "note": "previous overfit model (max_depth=200, lr=1)"},
        "per_drug": per_drug_metrics, "mean_auc": mean_auc,
        "per_drug_cv_mean_auc": s1.best_value,
        "model_comparison": model_comparison,
        "feature_set_comparison": fs_scores, "chosen_feature_set": chosen_fs,
        "three_class": {
            "train_acc": float(accuracy_score(rx_tr, m_rx.predict(Xtr))),
            "test_acc": float(accuracy_score(rx_te, rx_pred)),
            "macro_f1": float(f1_score(rx_te, rx_pred, average="macro")),
            "cv_macro_f1_mean": rx_cv_mean, "cv_macro_f1_std": rx_cv_std,
            "confusion_matrix": cm.tolist(),
            "per_class": {LABEL_MAP[str(i)]: {"precision": float(p[i]), "recall": float(r[i]),
                          "f1": float(f1[i]), "support": int(supp[i])} for i in range(3)},
        },
        "augmentation": {"arms": aug, "shipped_arm": "none",
                         "verdict": ("augmentation improved validation AUROC"
                                     if aug_improved else
                                     "augmentation did NOT beat the class-weighted baseline; not used")},
        "tuning": {"per_drug_best_params": drug_params, "rx3_best_params": rx_params,
                   "per_drug_trials": [{"n": t.number, "v": t.value} for t in s1.trials if t.value],
                   "rx3_trials": [{"n": t.number, "v": t.value} for t in s2.trials if t.value]},
        "learning_curve": lc,
        "feature_selection": {"n_selected": len(FEATS), "n_total": meta["n_model_features"],
                              "group_loo": feat_analysis["group_loo"],
                              "top_per_target": feat_analysis["top_per_target"]},
    }
    (APP_PUBLIC / "metrics.json").write_text(json.dumps(metrics, indent=2))

    # 8) Parity vectors — full calibrated pipeline ────────────────────────────
    rng = np.random.RandomState(SEED)
    samples = [np.zeros(len(FEATS))]
    for i in range(0, len(FEATS), 9):
        v = np.zeros(len(FEATS)); v[i] = 1; samples.append(v)
    for idx in rng.choice(len(Xte), 12, replace=False):
        samples.append(Xte.iloc[idx].values.astype(float))

    def final_prob(d, xrow):
        mx, ml, strat, a, b = shipped_models[d]
        px = mx.predict_proba(xrow)[:, 1]; pl = ml.predict_proba(xrow)[:, 1]
        raw = {"xgb": px, "lr": pl, "ensemble": 0.5 * (px + pl)}[strat]
        return float(platt_apply(raw, a, b)[0])

    parity = []
    for v in samples[:45]:
        xr = pd.DataFrame([v], columns=FEATS)
        parity.append({"x": v.astype(int).tolist(),
                       "per_drug_final": {d: final_prob(d, xr) for d in DRUGS},
                       "three_class": m_rx.predict_proba(xr)[0].round(8).tolist()})
    (ART / "parity.json").write_text(json.dumps(parity))
    print(f"\nwrote model.json (v2), metrics.json, parity.json ({len(parity)} vectors)")


if __name__ == "__main__":
    main()
