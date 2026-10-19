"""
train_disease_model.py
----------------------
Model 1: disease classification from lab biomarkers.

Usage
    python training/train_disease_model.py                 # auto-detect schema
    python training/train_disease_model.py --mode numeric   # force numeric panel
    python training/train_disease_model.py --mode symptom   # force binary symptoms

Input : ml-service/data/Training.csv
Output: ml-service/artifacts/disease_model.pkl
        ml-service/artifacts/disease_contract.json

Design notes
------------
* The whole thing is a Pipeline (impute -> scale -> RandomForest). Serving code
  therefore calls `.predict()` on raw values and cannot forget a preprocessing
  step.
* Missingness is expected: OCR will not always find every biomarker. Median
  imputation is fitted on the training set and travels inside the pipeline.
* We report stratified cross-validated macro-F1, not accuracy. These datasets
  are usually perfectly balanced and synthetic, so accuracy reads ~1.00 and
  tells you nothing. Say this in your report rather than claiming 100% accuracy.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

sys.path.append(str(Path(__file__).resolve().parents[1]))
from core.biomarkers import CANONICAL_ORDER  # noqa: E402
from training.common import (  # noqa: E402
    RANDOM_STATE,
    ARTIFACT_DIR,
    FeatureContract,
    load_csv,
    save_artifact,
)

TARGET_CANDIDATES = ["prognosis", "Disease", "disease", "target", "Outcome"]


def detect_target(df: pd.DataFrame) -> str:
    for col in TARGET_CANDIDATES:
        if col in df.columns:
            return col
    return df.columns[-1]  # fall back to the last column


def detect_mode(df: pd.DataFrame, target: str) -> str:
    """Binary 0/1 columns everywhere => symptom dataset. Otherwise numeric panel."""
    features = df.drop(columns=[target])
    binary_ratio = np.mean([
        set(pd.unique(features[c].dropna())) <= {0, 1} for c in features.columns
    ])
    return "symptom" if binary_ratio > 0.9 else "numeric"


def select_numeric_features(df: pd.DataFrame, target: str) -> list[str]:
    """
    Prefer the canonical biomarkers we can actually extract by OCR. Any numeric
    column not in the canonical list is kept only if the canonical overlap is
    too small to train on.
    """
    numeric = df.drop(columns=[target]).select_dtypes(include="number").columns.tolist()
    canonical = [c for c in CANONICAL_ORDER if c in numeric]
    if len(canonical) >= 3:
        print(f"Using canonical OCR-extractable biomarkers: {canonical}")
        return canonical
    print(
        "WARNING: fewer than 3 canonical biomarkers present. Falling back to all "
        "numeric columns -- the OCR module will have to supply defaults for the "
        "extras, which weakens the prediction. Prefer a dataset whose columns "
        "match core/biomarkers.py."
    )
    return numeric


def build_pipeline(n_classes: int) -> Pipeline:
    return Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=400,
                    max_depth=None,
                    min_samples_leaf=2,
                    max_features="sqrt",
                    # Guards against the long tail of rare diagnoses.
                    class_weight="balanced_subsample",
                    n_jobs=-1,
                    random_state=RANDOM_STATE,
                ),
            ),
        ]
    )


def main(mode_arg: str | None) -> None:
    df = load_csv("Training.csv")
    target = detect_target(df)
    df = df.dropna(subset=[target])

    mode = mode_arg or detect_mode(df, target)
    print(f"Target column: {target!r} | schema mode: {mode}")

    if mode == "numeric":
        features = select_numeric_features(df, target)
        notes = "Trained on raw numeric lab values; OCR output maps 1:1 to features."
    else:
        features = df.drop(columns=[target]).columns.tolist()
        notes = (
            "Trained on binary symptom indicators. At inference, numeric lab values "
            "are converted by core.biomarkers.to_flags(); unmapped columns default "
            "to 0. This mapping is rule-based and lossy -- document it."
        )

    X = df[features].apply(pd.to_numeric, errors="coerce")
    encoder = LabelEncoder()
    y = encoder.fit_transform(df[target].astype(str).str.strip())
    print(f"{len(encoder.classes_)} classes, {len(X)} samples, {len(features)} features")

    # Stratify so every disease appears in both splits.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    pipe = build_pipeline(len(encoder.classes_))

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="f1_macro", n_jobs=-1)
    print(f"5-fold CV macro-F1: {scores.mean():.4f} (+/- {scores.std():.4f})")

    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    print("\nHeld-out classification report")
    print(classification_report(y_test, y_pred, target_names=encoder.classes_, zero_division=0))
    print("Confusion matrix shape:", confusion_matrix(y_test, y_pred).shape)

    importances = pd.Series(
        pipe.named_steps["clf"].feature_importances_, index=features
    ).sort_values(ascending=False)
    print("\nTop 10 features by Gini importance:")
    print(importances.head(10).to_string())

    # Refit on the full dataset before shipping -- the test split has done its job.
    pipe.fit(X, y)

    save_artifact({"pipeline": pipe, "label_encoder": encoder}, "disease_model.pkl")
    FeatureContract(
        model_name="disease_random_forest",
        features=features,
        target=target,
        classes=encoder.classes_.tolist(),
        numeric_features=features,
        # Median of the training data: a sane stand-in when OCR misses a marker.
        defaults={c: float(X[c].median()) for c in features},
        notes=f"mode={mode}. {notes}",
    ).save(ARTIFACT_DIR / "disease_contract.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["numeric", "symptom"], default=None)
    main(parser.parse_args().mode)