"""
export_schema.py — Emit schema.json that drives the entire frontend form.

The schema is the single source of truth: the React app builds every selector,
window option and the 98-element feature vector from it, looking features up by
exact name (this structurally prevents the original Gradio app's silent
name-mismatch bug). Plain-language clinical labels make the UI readable.

feature_index aligns 1:1 with model.json's feature_names (the selected order),
so the browser tree-walker reads the vector at the right positions.
"""
from __future__ import annotations

import json, re
from pathlib import Path

ART = Path(__file__).resolve().parent / "artifacts"
APP_PUBLIC = Path(__file__).resolve().parents[1] / "app" / "public"
APP_PUBLIC.mkdir(parents=True, exist_ok=True)

# ── curated clinical vocabulary (codes -> human labels) ────────────────────────
ANTIBIOTICS = {
    "AMC": "Amoxicillin-clavulanate", "AMP": "Ampicillin", "AMK": "Amikacin",
    "AMX": "Amoxicillin", "ATM": "Aztreonam", "CAZ": "Ceftazidime",
    "CFZ": "Cefazolin", "CHL": "Chloramphenicol", "CIP": "Ciprofloxacin",
    "CLI": "Clindamycin", "CRO": "Ceftriaxone", "CTT": "Cefotetan",
    "DOX": "Doxycycline", "ERT": "Ertapenem", "ERY": "Erythromycin",
    "FEP": "Cefepime", "FOX": "Cefoxitin", "GEN": "Gentamicin",
    "GENS": "Gentamicin (synergy)", "IPM": "Imipenem", "LVX": "Levofloxacin",
    "LZD": "Linezolid", "MXF": "Moxifloxacin", "NAL": "Nalidixic acid",
    "NIT": "Nitrofurantoin", "OXA": "Oxacillin", "PEN": "Penicillin",
    "PIP": "Piperacillin", "QUD": "Quinupristin-dalfopristin", "RIF": "Rifampin",
    "SAM": "Ampicillin-sulbactam", "STRS": "Streptomycin", "SXT": "TMP-SMX",
    "TET": "Tetracycline", "TIC": "Ticarcillin", "TOB": "Tobramycin",
    "TZP": "Piperacillin-tazobactam", "VAN": "Vancomycin",
}
ORGANISMS = {
    "Escherichia": "E. coli", "Klebsiella": "Klebsiella",
    "Enterococcus": "Enterococcus", "Staphylococcus": "Staphylococcus",
    "Staph_coag_neg": "Coagulase-negative staph", "Proteus": "Proteus",
    "Enterobacter": "Enterobacter", "Citrobacter": "Citrobacter",
    "Streptococcus": "Streptococcus", "Pseudomonas": "Pseudomonas",
    "Acinetobacter": "Acinetobacter", "Providencia": "Providencia",
    "Serratia": "Serratia", "Morganella": "Morganella",
}
AB_CLASSES = {
    "fluoroquinolone": "Fluoroquinolone", "beta_lactam": "Beta-lactam",
    "folate_inhibitor": "Folate inhibitor (e.g. TMP-SMX)",
    "nitrofuran": "Nitrofuran (e.g. nitrofurantoin)", "tetracycline": "Tetracycline",
    "macrolide_lincosamide": "Macrolide / lincosamide", "nitroimidazole": "Nitroimidazole",
    "aminoglycoside": "Aminoglycoside", "glycopeptides": "Glycopeptide",
    "antifungal": "Antifungal", "ansamycin": "Ansamycin", "monobactam": "Monobactam",
    "fosfomycin": "Fosfomycin", "oxazolidinones": "Oxazolidinone",
    "polymyxin": "Polymyxin", "mixed": "Mixed / multiple",
}
COMORBIDITIES = {"HTN": "Hypertension", "DM": "Diabetes mellitus",
                 "Depression": "Depression"}
DRUG_INFO = {
    "NIT": {"name": "Nitrofurantoin", "klass": "Nitrofuran", "line": "First-line",
            "plain": "First-line oral agent for uncomplicated cystitis."},
    "SXT": {"name": "Trimethoprim-sulfamethoxazole", "klass": "Folate inhibitor",
            "line": "First-line",
            "plain": "First-line where local resistance is low."},
    "CIP": {"name": "Ciprofloxacin", "klass": "Fluoroquinolone", "line": "Reserve",
            "plain": "Broad-spectrum; reserve to limit resistance."},
    "LVX": {"name": "Levofloxacin", "klass": "Fluoroquinolone", "line": "Reserve",
            "plain": "Broad-spectrum fluoroquinolone; reserve agent."},
}


def main() -> None:
    # Prefer the feature set the trained model actually shipped with.
    chosen = ART / "chosen_features.json"
    if chosen.exists():
        sel = json.loads(chosen.read_text())
    else:
        sel = json.loads((ART / "selected_features.json").read_text())["selected_features"]
    feature_index = {name: i for i, name in enumerate(sel)}

    res_re = re.compile(r"^micro - prev resistance (\w+) (\d+)$")
    org_re = re.compile(r"^micro - prev organism (\w+) (\d+)$")
    abc_re = re.compile(r"^ab class (\d+) - (\w+)$")
    com_re = re.compile(r"^comorbidity (\d+) - (\w+)$")

    res_combos, org_combos, abc_combos, com_combos = [], [], [], []
    res_codes, org_codes, abc_codes, com_codes = set(), set(), set(), set()
    age_groups = []
    has_is_white = False

    for f in sel:
        if m := res_re.match(f):
            res_combos.append([m[1], int(m[2])]); res_codes.add(m[1])
        elif m := org_re.match(f):
            org_combos.append([m[1], int(m[2])]); org_codes.add(m[1])
        elif m := abc_re.match(f):
            abc_combos.append([m[2], int(m[1])]); abc_codes.add(m[2])
        elif m := com_re.match(f):
            com_combos.append([m[2], int(m[1])]); com_codes.add(m[2])
        elif f.startswith("Age"):
            age_groups.append(f)
        elif f == "demographics - is_white":
            has_is_white = True

    def opts(codes, label_map):
        return [{"code": c, "label": label_map.get(c, c)} for c in sorted(codes)]

    age_label = {
        "Age_Infant (0-1)": "Infant (0–1)", "Age_Toddler(2-3)": "Toddler (2–3)",
        "Age_Kid(4-12)": "Child (4–12)", "Age_Teen(13-19)": "Teen (13–19)",
        "Age_Adult(20-49)": "Adult (20–49)", "Age_Old(50-79)": "Older adult (50–79)",
        "Age_SuperOld(80-110)": "Elderly (80+)",
    }

    schema = {
        "version": "1.0.0",
        "feature_names": sel,
        "feature_index": feature_index,
        "n_features": len(sel),
        "drugs": ["NIT", "SXT", "CIP", "LVX"],
        "drug_info": DRUG_INFO,
        "label_map": {"0": "Nitrofurantoin", "1": "Trimethoprim-Sulfamethoxazole",
                      "2": "Fluoroquinolone (CIP/LVX)"},
        "window_note": "Time windows count days before the current visit "
                       "(e.g. 90 = within the prior ~90 days).",
        "groups": {
            "demographics": {"has_is_white": has_is_white},
            "age_groups": [{"key": a, "label": age_label.get(a, a)} for a in age_groups],
            "resistance": {
                "name_prefix": "micro - prev resistance",
                "antibiotics": opts(res_codes, ANTIBIOTICS),
                "windows": sorted({w for _, w in res_combos}),
                "combos": sorted(res_combos, key=lambda x: (x[0], x[1])),
            },
            "organism": {
                "name_prefix": "micro - prev organism",
                "organisms": opts(org_codes, ORGANISMS),
                "windows": sorted({w for _, w in org_combos}),
                "combos": sorted(org_combos, key=lambda x: (x[0], x[1])),
            },
            "prescription": {
                "name_template": "ab class {window} - {code}",
                "classes": opts(abc_codes, AB_CLASSES),
                "windows": sorted({w for _, w in abc_combos}),
                "combos": sorted(abc_combos, key=lambda x: (x[0], x[1])),
            },
            "comorbidity": {
                "name_template": "comorbidity {window} - {code}",
                "conditions": opts(com_codes, COMORBIDITIES),
                "windows": sorted({w for _, w in com_combos}),
                "combos": sorted(com_combos, key=lambda x: (x[0], x[1])),
            },
        },
    }
    (APP_PUBLIC / "schema.json").write_text(json.dumps(schema, indent=2))
    print(f"wrote schema.json — {len(sel)} features")
    print(f"  resistance: {len(res_codes)} antibiotics, {len(res_combos)} combos")
    print(f"  organism:   {len(org_codes)} organisms, {len(org_combos)} combos")
    print(f"  prescription: {len(abc_codes)} classes, {len(abc_combos)} combos")
    print(f"  comorbidity: {len(com_codes)} conditions, {len(com_combos)} combos")
    print(f"  age groups: {len(age_groups)}  is_white: {has_is_white}")


if __name__ == "__main__":
    main()
