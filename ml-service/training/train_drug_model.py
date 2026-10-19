"""
train_drug_model.py
-------------------
Model 2: pharmacological-class recommendation.

Input : ml-service/data/Drug.csv
Output: ml-service/artifacts/drug_model.pkl
        ml-service/artifacts/drug_contract.json

Inputs to the model: the disease predicted by Model 1 plus the baseline vitals
the patient entered (age, sex, BP category, BMI, and cholesterol category when
available). Output: a *drug class*, never a specific product or dose.

Two engineering points worth defending in the viva
--------------------------------------------------
1. The target is deliberately coarse. A model trained on a few thousand rows
   cannot justify naming a molecule, let alone a dose. Predicting a class keeps
   the claim proportionate to the evidence.
2. Rare classes are dropped below MIN_CLASS_COUNT. XGBoost will happily fit a
   class with two examples and then predict it confidently on unseen data; a
   class that cannot be validated should not be servable.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from xgboost import XGBClassifier

sys.path.append(str(Path(__file__).resolve().parents[1]))
from training.common import (  # noqa: E402
    RANDOM_STATE,
    ARTIFACT_DIR,
    FeatureContract,
    load_csv,
    save_artifact,
)

MIN_CLASS_COUNT = 10

# Column aliases: the public Drug.csv variants disagree on capitalisation.
ALIASES = {
    "Age": ["Age", "age", "AGE"],
    "Sex": ["Sex", "sex", "Gender", "gender"],
    "BP": ["BP", "Blood Pressure", "blood_pressure", "bp"],
    "Cholesterol": ["Cholesterol", "cholesterol", "Chol"],
    "Na_to_K": ["Na_to_K", "NatoK", "Na_to_k", "sodium_potassium_ratio"],
    "Disease": ["Disease", "disease", "Condition", "prognosis"],
    "BMI": ["BMI", "bmi"],
    "Drug": ["Drug", "drug", "DrugClass", "drug_class", "Recommended_Drug"],
}


def resolve(df: pd.DataFrame, canonical: str) -> str | None:
    for candidate in ALIASES[canonical]:
        if candidate in df.columns:
            return candidate
    return None


def main() -> None:
    raw = load_csv("Drug.csv")

    target_col = resolve(raw, "Drug")
    if target_col is None:
        raise KeyError(f"No drug/target column found. Columns present: {list(raw.columns)}")

    # Rename whatever the CSV calls things into our canonical vocabulary.
    rename = {}
    for canonical in ALIASES:
        found = resolve(raw, canonical)
        if found:
            rename[found] = canonical
    df = raw.rename(columns=rename)
    df = df.dropna(subset=["Drug"])
    df["Drug"] = df["Drug"].astype(str).str.strip()

    # Drop classes too rare to validate honestly.
    counts = df["Drug"].value_counts()
    keep = counts[counts >= MIN_CLASS_COUNT].index
    dropped = sorted(set(counts.index) - set(keep))
    if dropped:
        print(f"Dropping {len(dropped)} class(es) with < {MIN_CLASS_COUNT} rows: {dropped}")
    df = df[df["Drug"].isin(keep)]

    candidate_features = ["Age", "Sex", "BP", "Cholesterol", "Na_to_K", "BMI", "Disease"]
    features = [c for c in candidate_features if c in df.columns]
    print(f"Feature columns: {features}")

    X = df[features].copy()
    numeric = [c for c in features if pd.api.types.is_numeric_dtype(X[c])]
    categorical = [c for c in features if c not in numeric]
    for c in categorical:
        X[c] = X[c].astype(str).str.strip().str.upper()

    encoder = LabelEncoder()
    y = encoder.fit_transform(df["Drug"])
    print(f"{len(encoder.classes_)} drug classes: {list(encoder.classes_)}")

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", SimpleImputer(strategy="median"), numeric),
            (
                "cat",
                Pipeline([
                    ("impute", SimpleImputer(strategy="most_frequent")),
                    # handle_unknown='ignore' matters: Model 1 can predict a
                    # disease that never appeared in Drug.csv. We want an
                    # all-zero encoding, not a crash in production.
                    ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                ]),
                categorical,
            ),
        ],
        remainder="drop",
    )

    model = XGBClassifier(
        n_estimators=350,
        learning_rate=0.08,
        max_depth=5,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.5,
        objective="multi:softprob" if len(encoder.classes_) > 2 else "binary:logistic",
        num_class=len(encoder.classes_) if len(encoder.classes_) > 2 else None,
        eval_metric="mlogloss" if len(encoder.classes_) > 2 else "logloss",
        tree_method="hist",
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    pipe = Pipeline([("prep", preprocessor), ("clf", model)])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="f1_macro", n_jobs=-1)
    print(f"5-fold CV macro-F1: {scores.mean():.4f} (+/- {scores.std():.4f})")

    pipe.fit(X_train, y_train)
    print("\nHeld-out classification report")
    print(classification_report(
        y_test, pipe.predict(X_test), target_names=encoder.classes_, zero_division=0
    ))

    pipe.fit(X, y)

    save_artifact({"pipeline": pipe, "label_encoder": encoder}, "drug_model.pkl")
    FeatureContract(
        model_name="drug_xgboost",
        features=features,
        target="Drug",
        classes=encoder.classes_.tolist(),
        numeric_features=numeric,
        categorical_features=categorical,
        defaults={
            **{c: float(np.nanmedian(X[c])) for c in numeric},
            **{c: X[c].mode().iat[0] for c in categorical},
        },
        notes=(
            "Predicts a pharmacological class only. Never a molecule, never a dose. "
            "Unseen disease labels are one-hot encoded as all-zero by design."
        ),
    ).save(ARTIFACT_DIR / "drug_contract.json")


if __name__ == "__main__":
    main()