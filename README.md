# Trace — UTI antibiotic guidance

A static, browser-only clinical-decision-support **research prototype** that predicts
a urinary-tract-infection patient's likelihood of resistance to each first-line oral
antibiotic and suggests the **narrowest-spectrum effective agent** — to support
antimicrobial stewardship.

> ⚠️ **Not medical advice.** Research/educational use only. See [NOTICE.md](NOTICE.md).

Built by **Team ARM** (A*STAR Makeathon 2022, 2nd place).

## How it works

- **Model** — per-antibiotic resistance classifiers (NIT, SXT, CIP, LVX). For each
  drug the best of {tuned XGBoost, L2 logistic regression, their calibrated ensemble}
  is shipped, chosen by cross-validated AUROC. A 3-class prescription model is kept for
  comparison. Trained on the MIT/PhysioNet **AMR-UTI** cohort (≈15.8k uncomplicated
  UTIs) with the dataset's native temporal train/test split as a locked test set.
- **Honest performance** — mean per-drug AUROC ≈ 0.60 on the locked test set. This is a
  genuinely hard problem with a real signal ceiling; numbers are reported without
  inflation. Full evaluation (ROC, calibration, confusion matrix, learning curve,
  augmentation comparison, Optuna search, feature importance) is in the app's
  **Model performance** tab.
- **Runs entirely in the browser** — the trained trees + linear weights are exported to
  JSON and scored by a pure-TypeScript engine ([app/src/lib/inference.ts](app/src/lib/inference.ts)).
  No backend, no data leaves the page. A parity test asserts the browser reproduces the
  Python model within 1e-6.

## Repository layout

```
build/            # LOCAL-ONLY Python pipeline (reads raw data; never run in CI)
  build_dataset.py     # reconstruct the unified cohort from raw PhysioNet CSVs
  analyze_features.py  # permutation importance + group leave-one-out → feature selection
  train_model.py       # tune, compare strategies, evaluate, export model/metrics/parity
  export_schema.py     # emit the form schema
app/              # Vite + React + TypeScript + Tailwind frontend
  public/         # SHIPPED artifacts: model.json, schema.json, metrics.json (+ team photos)
  src/            # UI + in-browser inference
.github/workflows/deploy.yml   # build + deploy to GitHub Pages
```

## Develop

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm test         # parity test (needs build/artifacts from a local training run)
npm run build    # static build → app/dist
```

## Rebuild the model (requires local AMR-UTI data)

```bash
python build/build_dataset.py
python build/analyze_features.py
python build/train_model.py      # N_TRIALS=70 by default
python build/export_schema.py
```

## Deploy

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which builds the Vite app and publishes `app/dist` to GitHub Pages.

## Team

**Active:** Liyana Ow Yong (Co-founder · CEO) · Kimberly Su (Co-founder · COO) ·
Manoj Itharajula (Co-founder · CTO · AI Scientist). With thanks to former teammates and
advisors. [Team story](https://www.linkedin.com/pulse/team-arm-our-journey-through-astar-makeathon-2022-kimberly-su/)
· [A*STAR Makeathon 2022](https://www.co11ab.sg/astar-makeathon-2022/)
