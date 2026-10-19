"""
core/biomarkers.py
------------------
The single source of truth for "what is a biomarker" in this system.

Both the training scripts and the FastAPI service import from here, so a change
to a reference range or a unit conversion propagates everywhere at once.

Three things live in this module:

1. BIOMARKERS  - canonical name, canonical unit, adult reference interval,
                 accepted alternate units with conversion factors.
2. PATTERNS    - the regex used to pull each biomarker out of noisy OCR text,
                 including common OCR confusions (O/0, l/1, S/5).
3. to_flags()  - the "bridge" that turns numeric lab values into the binary
                 indicator columns that symptom-style datasets expect.

--------------------------------------------------------------------------
Why the bridge exists (read this before you touch the disease model)
--------------------------------------------------------------------------
The widely-used `Training.csv` disease dataset is *symptom-based*: 132 binary
columns like `itching`, `fatigue`, `excessive_hunger`, and a `prognosis` label.
Our OCR module produces *numeric lab values* instead. Those two feature spaces
are not interchangeable, and pretending otherwise is the most common silent bug
in projects of this shape.

There are two legitimate ways to close the gap, and `train_disease_model.py`
supports both:

  MODE "numeric"  - train directly on a numeric lab-panel dataset (preferred,
                    and what you should use if your Training.csv holds columns
                    like Glucose / Hemoglobin / Cholesterol).
  MODE "symptom"  - train on the binary symptom dataset, and at inference time
                    convert lab values into the subset of binary indicators
                    they can justify, via `to_flags()`. This is a lossy,
                    rule-based mapping and must be documented as such in the
                    report: the model never sees the raw number.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Biomarker:
    name: str                       # canonical feature name
    unit: str                       # canonical unit
    low: float                      # lower bound of adult reference interval
    high: float                     # upper bound of adult reference interval
    plausible: tuple[float, float]  # hard sanity bounds; outside this = OCR error
    alt_units: dict[str, float]     # alternate unit -> multiplier to canonical


# Reference intervals below are typical adult ranges used for teaching purposes.
# Real ranges are laboratory- and assay-specific and are printed on the report
# itself; a production system would parse the per-report range instead.
BIOMARKERS: dict[str, Biomarker] = {
    "Glucose": Biomarker(
        name="Glucose", unit="mg/dL", low=70, high=99,
        plausible=(20, 800), alt_units={"mmol/l": 18.0182},
    ),
    "Hemoglobin": Biomarker(
        name="Hemoglobin", unit="g/dL", low=12.0, high=17.0,
        plausible=(2, 25), alt_units={"g/l": 0.1},
    ),
    "Cholesterol": Biomarker(
        name="Cholesterol", unit="mg/dL", low=125, high=200,
        plausible=(50, 500), alt_units={"mmol/l": 38.67},
    ),
    "Triglycerides": Biomarker(
        name="Triglycerides", unit="mg/dL", low=50, high=150,
        plausible=(20, 1200), alt_units={"mmol/l": 88.57},
    ),
    "HbA1c": Biomarker(
        name="HbA1c", unit="%", low=4.0, high=5.6,
        plausible=(2, 20), alt_units={},
    ),
    "Creatinine": Biomarker(
        name="Creatinine", unit="mg/dL", low=0.6, high=1.3,
        plausible=(0.1, 20), alt_units={"umol/l": 0.0113},
    ),
    "WBC": Biomarker(
        name="WBC", unit="10^3/uL", low=4.0, high=11.0,
        plausible=(0.1, 100), alt_units={"/ul": 0.001, "cells/cumm": 0.001},
    ),
    "Platelets": Biomarker(
        name="Platelets", unit="10^3/uL", low=150, high=450,
        plausible=(5, 2000), alt_units={"/ul": 0.001},
    ),
}

CANONICAL_ORDER: list[str] = list(BIOMARKERS.keys())

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------
# Every pattern follows the same shape:
#   <label alternatives>  <noise: colons, dots, dashes, spaces>  <number>  <optional unit>
# `[O0]` style character classes absorb the classic OCR confusions.
_NUM = r"(\d{1,4}(?:[.,]\d{1,2})?)"
_GAP = r"[\s:.\-–—|]{0,12}"
_UNIT = r"\s*(mg\s*/\s*d[lI]|g\s*/\s*d[lI]|g\s*/\s*[lI]|mmo[lI]\s*/\s*[lI]|%|" \
        r"10\^?3\s*/\s*u[lI]|cells\s*/\s*cumm|/\s*u[lI])?"

PATTERNS: dict[str, re.Pattern] = {
    "Glucose": re.compile(
        rf"(?:fasting\s+)?(?:blood\s+)?g[lI]uc[o0]se(?:\s*\(?f\)?)?{_GAP}{_NUM}{_UNIT}", re.I),
    "Hemoglobin": re.compile(
        rf"(?:ha?em[o0]g[lI][o0]bin|hb|hgb)\b{_GAP}{_NUM}{_UNIT}", re.I),
    "Cholesterol": re.compile(
        rf"(?:t[o0]ta[lI]\s+)?ch[o0][lI]ester[o0][lI]{_GAP}{_NUM}{_UNIT}", re.I),
    "Triglycerides": re.compile(
        rf"trig[lI]ycerides?{_GAP}{_NUM}{_UNIT}", re.I),
    "HbA1c": re.compile(
        rf"(?:hba1c|g[lI]ycated\s+ha?em[o0]g[lI][o0]bin){_GAP}{_NUM}{_UNIT}", re.I),
    "Creatinine": re.compile(
        rf"creatinine{_GAP}{_NUM}{_UNIT}", re.I),
    "WBC": re.compile(
        rf"(?:wbc|tota[lI]\s+[lI]euc[o0]cyte\s+c[o0]unt|t[lI]c)\b{_GAP}{_NUM}{_UNIT}", re.I),
    "Platelets": re.compile(
        rf"(?:p[lI]ate[lI]ets?(?:\s+c[o0]unt)?|p[lI]t)\b{_GAP}{_NUM}{_UNIT}", re.I),
}


def normalise(name: str, value: float, unit: str | None) -> tuple[float, bool]:
    """
    Convert `value` into the biomarker's canonical unit.

    Returns (converted_value, is_plausible). `is_plausible` is False when the
    result falls outside hard sanity bounds, which almost always means the OCR
    misread a digit. The API surfaces that flag rather than silently trusting it.
    """
    bm = BIOMARKERS[name]
    if unit:
        key = re.sub(r"\s+", "", unit.lower()).replace("i", "l")
        for alt, factor in bm.alt_units.items():
            if re.sub(r"\s+", "", alt.lower()) == key:
                value *= factor
                break
    lo, hi = bm.plausible
    return round(value, 3), lo <= value <= hi


def status(name: str, value: float) -> str:
    """Classify a canonical value as low / normal / high for UI display."""
    bm = BIOMARKERS[name]
    if value < bm.low:
        return "low"
    if value > bm.high:
        return "high"
    return "normal"


# ---------------------------------------------------------------------------
# Numeric -> binary symptom bridge
# ---------------------------------------------------------------------------
# Each rule maps a lab finding to symptom columns that the finding genuinely
# supports. Keep this table small and defensible; every entry is an assumption
# you will have to justify in your viva.
FLAG_RULES: list[tuple[str, str, str, list[str]]] = [
    # (biomarker, direction, clinical finding, symptom columns it activates)
    ("Glucose",     "high", "hyperglycaemia",  ["excessive_hunger", "polyuria", "increased_appetite"]),
    ("Glucose",     "low",  "hypoglycaemia",   ["dizziness", "sweating"]),
    ("Hemoglobin",  "low",  "anaemia",         ["fatigue", "lethargy", "dizziness"]),
    ("Cholesterol", "high", "hypercholesterolaemia", ["chest_pain"]),
    ("Creatinine",  "high", "renal impairment", ["swelling_of_stomach", "puffy_face_and_eyes"]),
    ("Platelets",   "low",  "thrombocytopenia", ["bruising", "red_spots_over_body"]),
    ("WBC",         "high", "leucocytosis",     ["high_fever", "fatigue"]),
]


def to_flags(values: dict[str, float]) -> dict[str, int]:
    """
    Turn canonical biomarker values into binary symptom indicators.

    Only used when the disease model was trained in "symptom" mode. The caller
    is responsible for expanding this dict to the model's full column list
    (missing columns default to 0).
    """
    flags: dict[str, int] = {}
    for marker, direction, _finding, columns in FLAG_RULES:
        if marker not in values:
            continue
        if status(marker, values[marker]) == direction:
            for col in columns:
                flags[col] = 1
    return flags


def explain_flags(values: dict[str, float]) -> list[str]:
    """Human-readable list of the findings that drove the flags. Shown in the UI."""
    out = []
    for marker, direction, finding, _cols in FLAG_RULES:
        if marker in values and status(marker, values[marker]) == direction:
            out.append(f"{marker} {values[marker]} {BIOMARKERS[marker].unit} -> {finding}")
    return out