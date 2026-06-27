# Notice & attribution

## Data
This project is built on the **AMR-UTI dataset** (Antimicrobial Resistance in
Urinary Tract Infections), Kanjilal et al., *Science Translational Medicine*, 2020,
distributed via PhysioNet under the **PhysioNet Credentialed Health Data License 1.5.0**.

- The raw dataset is **NOT redistributed** in this repository. It is read only on
  the maintainer's local machine to train the model.
- Only a **derived, de-identified model artifact** (`app/public/model.json`),
  the feature **schema** (`app/public/schema.json`), and aggregate evaluation
  **metrics** (`app/public/metrics.json`) are published. These contain no patient
  records.
- Researchers wishing to reproduce training must obtain the data directly from
  PhysioNet under their own credentialed access.

## Intended use
Trace is a **research and educational prototype** for antimicrobial-stewardship
exploration. It is **not a medical device and not medical advice**. It must not be
used for clinical decision-making without independent validation, urine culture &
sensitivity testing, local antibiogram data, and qualified clinical judgement.

## Project
Created by **Team ARM** (A*STAR Makeathon 2022, 2nd place).
