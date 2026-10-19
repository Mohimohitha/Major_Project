"""
common.py
---------
Shared plumbing for all three training scripts.

The single most common failure mode in a project like this is *column drift*:
the model is trained on columns in one order, and at serving time the FastAPI
service builds the feature vector in a different order. Scikit-learn will not
complain -- it will happily return confident nonsense.

To stop that, every training script writes a "feature contract" JSON next to the
.pkl file. The inference service reads the contract and builds its feature
vector from it, so the two can never disagree.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import joblib

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]          # ml-service/
DATA_DIR = ROOT / "data"                            # raw CSVs live here
ARTIFACT_DIR = ROOT / "artifacts"                   # .pkl + .json land here

DATA_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42


@dataclass
class FeatureContract:
    """Everything the inference service needs to rebuild a valid input row."""

    model_name: str
    features: list[str]                       # exact column order used in fit()
    target: str
    classes: list[str]                        # human-readable class labels
    numeric_features: list[str] = field(default_factory=list)
    categorical_features: list[str] = field(default_factory=list)
    # Fallback value per feature when OCR/user input does not supply it.
    defaults: dict[str, Any] = field(default_factory=dict)
    notes: str = ""

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(asdict(self), indent=2))
        print(f"  contract -> {path}")

    @staticmethod
    def load(path: Path) -> "FeatureContract":
        return FeatureContract(**json.loads(path.read_text()))


def save_artifact(obj: Any, filename: str) -> Path:
    """joblib.dump with compression, returning the written path."""
    path = ARTIFACT_DIR / filename
    joblib.dump(obj, path, compress=3)
    print(f"  artifact -> {path}")
    return path


def load_csv(filename: str, **kwargs):
    """Read a CSV from data/ with a clear error if the student forgot to add it."""
    import pandas as pd

    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Expected dataset at {path}. Download it and place it in ml-service/data/."
        )
    df = pd.read_csv(path, **kwargs)
    # Kaggle exports frequently carry a trailing unnamed index column.
    df = df.loc[:, ~df.columns.str.match(r"^Unnamed")]
    df.columns = [c.strip() for c in df.columns]
    print(f"Loaded {filename}: {df.shape[0]} rows x {df.shape[1]} cols")
    return df