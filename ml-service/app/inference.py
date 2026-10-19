"""
app/inference.py
----------------
Loads the three trained artifacts once at process start and exposes a single
`run_pipeline()` that chains them:

    biomarkers  -> Model 1 (Random Forest)  -> disease
    disease + vitals -> Model 2 (XGBoost)   -> drug class
    disease          -> Model 3 (TF-IDF)    -> foods to eat / avoid

Loading happens in a module-level singleton rather than per request. Unpickling
a 400-tree forest takes ~200 ms; doing that on every upload would dominate the
response time and exhaust memory under concurrency.
"""

from __future__ import annotations

import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
from core.biomarkers import explain_flags, to_flags  # noqa: E402
from training.common import ARTIFACT_DIR, FeatureContract  # noqa: E402

log = logging.getLogger(__name__)

TOP_K_FOODS = 8
LOW_CONFIDENCE = 0.55  # below this the API flags the result as inconclusive


@dataclass
class Registry:
    disease_model: dict
    disease_contract: FeatureContract
    drug_model: dict
    drug_contract: FeatureContract
    diet_engine: dict


_registry: Registry | None = None


def load_models() -> Registry:
    """Called once from FastAPI's lifespan handler. Fails loudly if artifacts are missing."""
    global _registry
    if _registry is not None:
        return _registry

    required = [
        "disease_model.pkl", "disease_contract.json",
        "drug_model.pkl", "drug_contract.json",
        "diet_engine.pkl",
    ]
    missing = [f for f in required if not (ARTIFACT_DIR / f).exists()]
    if missing:
        raise RuntimeError(
            f"Missing artifacts: {missing}. Run the three scripts in training/ first."
        )

    _registry = Registry(
        disease_model=joblib.load(ARTIFACT_DIR / "disease_model.pkl"),
        disease_contract=FeatureContract.load(ARTIFACT_DIR / "disease_contract.json"),
        drug_model=joblib.load(ARTIFACT_DIR / "drug_model.pkl"),
        drug_contract=FeatureContract.load(ARTIFACT_DIR / "drug_contract.json"),
        diet_engine=joblib.load(ARTIFACT_DIR / "diet_engine.pkl"),
    )
    log.info("Artifacts loaded. Disease classes=%d, drug classes=%d",
             len(_registry.disease_contract.classes), len(_registry.drug_contract.classes))
    return _registry


def registry() -> Registry:
    if _registry is None:
        raise RuntimeError("Models not loaded. load_models() runs in the lifespan handler.")
    return _registry


# ---------------------------------------------------------------------------
# Model 1: disease
# ---------------------------------------------------------------------------
def build_disease_row(values: dict[str, float], contract: FeatureContract) -> pd.DataFrame:
    """
    Assemble exactly the columns the model was fitted on, in exactly that order.

    Two paths, decided by how the model was trained (recorded in contract.notes):
      symptom mode - convert lab numbers into binary indicators, rest default 0
      numeric mode - use lab numbers directly, missing ones fall back to the
                     training median stored in the contract
    """
    if "mode=symptom" in contract.notes:
        row = dict.fromkeys(contract.features, 0)
        row.update({k: v for k, v in to_flags(values).items() if k in row})
    else:
        row = {f: values.get(f, contract.defaults.get(f, 0.0)) for f in contract.features}

    return pd.DataFrame([[row[f] for f in contract.features]], columns=contract.features)


def predict_disease(values: dict[str, float]) -> dict:
    reg = registry()
    contract = reg.disease_contract
    pipeline, encoder = reg.disease_model["pipeline"], reg.disease_model["label_encoder"]

    row = build_disease_row(values, contract)
    proba = pipeline.predict_proba(row)[0]
    order = np.argsort(-proba)[:3]

    supplied = [f for f in contract.features if f in values]
    return {
        "disease": str(encoder.inverse_transform([int(order[0])])[0]),
        "confidence": round(float(proba[order[0]]), 4),
        "differentials": [
            {"disease": str(encoder.inverse_transform([int(i)])[0]),
             "confidence": round(float(proba[i]), 4)}
            for i in order[1:]
        ],
        # Honest reporting of how much real evidence went in. A prediction made
        # from one biomarker and nine imputed medians is not the same object as
        # one made from a full panel, and the UI must be able to say so.
        "evidence": {
            "biomarkers_supplied": len(supplied),
            "biomarkers_expected": len(contract.features),
            "imputed": [f for f in contract.features if f not in values][:20],
            "rules_fired": explain_flags(values) if "mode=symptom" in contract.notes else [],
        },
        "inconclusive": bool(proba[order[0]] < LOW_CONFIDENCE or not supplied),
    }


# ---------------------------------------------------------------------------
# Model 2: drug class
# ---------------------------------------------------------------------------
def bp_category(systolic: float | None, diastolic: float | None) -> str:
    """Drug.csv encodes BP as LOW / NORMAL / HIGH, so map the numeric reading."""
    if systolic is None or diastolic is None:
        return "NORMAL"
    if systolic >= 140 or diastolic >= 90:
        return "HIGH"
    if systolic < 90 or diastolic < 60:
        return "LOW"
    return "NORMAL"


def chol_category(total_cholesterol: float | None) -> str:
    if total_cholesterol is None:
        return "NORMAL"
    return "HIGH" if total_cholesterol >= 240 else "NORMAL"


def predict_drug(disease: str, vitals: dict, values: dict[str, float]) -> dict:
    reg = registry()
    contract = reg.drug_contract
    pipeline, encoder = reg.drug_model["pipeline"], reg.drug_model["label_encoder"]

    candidates = {
        "Age": vitals.get("age"),
        "Sex": (vitals.get("gender") or "").strip().upper()[:1] or None,  # M / F
        "BP": bp_category(vitals.get("systolic"), vitals.get("diastolic")),
        "Cholesterol": chol_category(values.get("Cholesterol")),
        "BMI": vitals.get("bmi"),
        "Na_to_K": vitals.get("na_to_k"),
        "Disease": (disease or "").strip().upper(),
    }
    row = {
        f: candidates.get(f) if candidates.get(f) is not None else contract.defaults.get(f)
        for f in contract.features
    }
    frame = pd.DataFrame([[row[f] for f in contract.features]], columns=contract.features)

    proba = pipeline.predict_proba(frame)[0]
    order = np.argsort(-proba)[:3]
    return {
        "drug_class": str(encoder.inverse_transform([int(order[0])])[0]),
        "confidence": round(float(proba[order[0]]), 4),
        "alternatives": [
            {"drug_class": str(encoder.inverse_transform([int(i)])[0]),
             "confidence": round(float(proba[i]), 4)}
            for i in order[1:]
        ],
        "inputs_used": {k: v for k, v in row.items()},
    }


# ---------------------------------------------------------------------------
# Model 3: diet
# ---------------------------------------------------------------------------
def match_profile(disease: str, profiles: dict) -> tuple[str, dict]:
    """Substring match the predicted disease against the profile keys."""
    name = (disease or "").lower()
    for key, profile in profiles.items():
        if key != "default" and key in name:
            return key, profile
    # A couple of common aliases the raw substring test would miss.
    aliases = {"anaemia": "anemia", "hypertensive": "hypertension",
               "cardiac": "heart", "coronary": "heart", "renal": "kidney",
               "hepat": "liver", "jaundice": "liver", "hyperglyc": "diabetes"}
    for alias, key in aliases.items():
        if alias in name:
            return key, profiles[key]
    return "default", profiles["default"]


def recommend_diet(disease: str) -> dict:
    reg = registry()
    engine = reg.diet_engine
    vectorizer, matrix = engine["vectorizer"], engine["matrix"]
    food, documents = engine["food"], engine["documents"]

    key, profile = match_profile(disease, engine["profiles"])

    encourage = (matrix @ vectorizer.transform([profile["encourage"]]).T).toarray().ravel()
    discourage = (matrix @ vectorizer.transform([profile["discourage"]]).T).toarray().ravel()

    # Ranking score: close to what helps, far from what harms.
    score = encourage - 0.6 * discourage

    # Hard safety gate. Applied after scoring so it can never be outranked.
    banned = profile["avoid_ingredients"]
    blocked = np.zeros(len(food), dtype=bool)
    for term in banned:
        blocked |= documents.str.contains(re.escape(term), case=False, na=False).to_numpy()

    eat_idx = np.argsort(-np.where(blocked, -np.inf, score))[:TOP_K_FOODS]
    avoid_idx = np.argsort(-(discourage + blocked.astype(float)))[:TOP_K_FOODS]

    def pack(indices) -> list[dict]:
        rows = food.iloc[indices]
        return [
            {
                "name": str(r.get("name", "")).title(),
                "course": str(r.get("course", "")).title(),
                "diet": str(r.get("diet", "")).title(),
                "region": str(r.get("region", "")).title(),
                "key_ingredients": ", ".join(
                    str(r.get("ingredients", "")).split(",")[:4]
                ).strip(),
            }
            for _, r in rows.iterrows()
        ]

    return {
        "profile": key,
        "guidance": profile["guidance"],
        "recommended": pack(eat_idx),
        "avoid": pack(avoid_idx),
        "avoid_ingredients": banned,
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def run_pipeline(values: dict[str, float], vitals: dict) -> dict:
    disease = predict_disease(values)
    drug = predict_drug(disease["disease"], vitals, values)
    diet = recommend_diet(disease["disease"])
    return {"diagnosis": disease, "medication": drug, "diet": diet}