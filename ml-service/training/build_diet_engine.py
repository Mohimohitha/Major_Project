"""
build_diet_engine.py
--------------------
Model 3: content-based diet recommendation.

Input : ml-service/data/indian_food.csv
        ml-service/data/Personalized_Diet_Recommendations.csv  (optional)
Output: ml-service/artifacts/diet_engine.pkl

How it works
------------
This is classical content-based filtering, not a classifier and not an LLM.

  1. Every dish in indian_food.csv is turned into a document by concatenating
     its name, ingredients, diet type, flavour profile, course and region.
  2. TF-IDF vectorises those documents into a dish-term matrix.
  3. Each condition gets a *profile*: a short "encourage" query and a short
     "discourage" query, built from the curated table below and enriched, where
     available, from Personalized_Diet_Recommendations.csv.
  4. Recommending = cosine similarity between the condition's encourage query
     and every dish, minus a penalty for similarity to the discourage query.
  5. Hard exclusions run last as a non-negotiable filter. A dish containing
     `sugar` is removed for diabetes regardless of what the cosine score says.
     Similarity is a ranking signal; safety rules are a gate.

Step 5 is the part that makes this defensible. A pure similarity score will
eventually surface gulab jamun for a diabetic patient, because it is textually
close to other milk-based dishes. Rules catch what vectors cannot.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.append(str(Path(__file__).resolve().parents[1]))
from training.common import DATA_DIR, load_csv, save_artifact  # noqa: E402

# ---------------------------------------------------------------------------
# Curated condition profiles
# ---------------------------------------------------------------------------
# Keys are matched case-insensitively against a substring of the predicted
# disease name, so "Type 2 Diabetes" and "Diabetes Mellitus" both hit "diabetes".
# `avoid_ingredients` is the hard gate; everything else is a ranking signal.
PROFILES: dict[str, dict] = {
    "diabetes": {
        "encourage": "whole wheat bajra jowar ragi millet spinach methi fenugreek "
                     "green gram dal legumes bitter gourd karela curd yoghurt nuts "
                     "steamed roasted high fibre low glycaemic",
        "discourage": "sugar jaggery honey condensed milk white rice maida deep fried sweet",
        "avoid_ingredients": ["sugar", "jaggery", "gur", "honey", "condensed milk",
                              "khoya", "mawa", "maida", "sugar syrup"],
        "guidance": "Keep refined carbohydrate low and fibre high; eat at regular "
                    "intervals rather than in large single meals.",
    },
    "anemia": {
        "encourage": "spinach palak amaranth methi jaggery sesame til ragi bajra "
                     "green gram rajma chana dates beetroot iron rich lemon vitamin c",
        "discourage": "tea coffee tannin excess milk calcium with meal",
        "avoid_ingredients": [],
        "guidance": "Pair iron-rich foods with a vitamin C source; keep tea and "
                    "coffee away from mealtimes because tannins reduce iron uptake.",
    },
    "hypertension": {
        "encourage": "banana coconut water spinach low salt steamed idli oats "
                     "vegetables curd potassium rich boiled",
        "discourage": "pickle papad salt fried namkeen processed",
        "avoid_ingredients": ["pickle", "papad", "baking soda", "salt"],
        "guidance": "Reduce added salt and packaged snacks; prefer potassium-rich "
                    "vegetables and fruit.",
    },
    "heart": {
        "encourage": "oats barley flaxseed walnut almond mustard oil fish vegetables "
                     "steamed grilled whole grain legumes",
        "discourage": "ghee butter cream deep fried coconut milk red meat vanaspati",
        "avoid_ingredients": ["vanaspati", "butter", "cream", "deep fried"],
        "guidance": "Favour unsaturated fats and soluble fibre; limit fried food "
                    "and full-fat dairy.",
    },
    "kidney": {
        "encourage": "rice bottle gourd lauki ash gourd apple cabbage low protein "
                     "low potassium boiled",
        "discourage": "banana tomato potato spinach coconut dal high protein salt",
        "avoid_ingredients": ["salt", "banana", "tomato", "potato"],
        "guidance": "Protein, potassium and phosphorus limits must be set by the "
                    "treating nephrologist; this list is a starting point only.",
    },
    "liver": {
        "encourage": "boiled rice khichdi bottle gourd papaya curd light steamed "
                     "turmeric vegetables",
        "discourage": "fried oil ghee alcohol spicy red meat",
        "avoid_ingredients": ["deep fried", "vanaspati"],
        "guidance": "Keep meals light and low in fat; avoid alcohol entirely.",
    },
    "thyroid": {
        "encourage": "curd egg fish nuts brazil selenium iodised salt millet dal",
        "discourage": "raw cabbage cauliflower soy goitrogen",
        "avoid_ingredients": ["soy"],
        "guidance": "Cook cruciferous vegetables rather than eating them raw; "
                    "separate any supplement from thyroid medication by four hours.",
    },
    "default": {
        "encourage": "vegetables dal whole grain fruit curd steamed balanced",
        "discourage": "deep fried sugar maida processed",
        "avoid_ingredients": [],
        "guidance": "A balanced plate: half vegetables, a quarter whole grain, "
                    "a quarter protein.",
    },
}

TEXT_COLUMNS = ["name", "ingredients", "diet", "flavor_profile", "course", "region", "state"]


def build_documents(food: pd.DataFrame) -> pd.Series:
    """Concatenate the descriptive columns of each dish into one searchable string."""
    present = [c for c in TEXT_COLUMNS if c in food.columns]
    if not present:
        raise KeyError(f"indian_food.csv has none of {TEXT_COLUMNS}; got {list(food.columns)}")
    docs = food[present].map(str)
    # The dataset uses -1 as its missing marker; drop it so it is not tokenised.
    docs = docs.replace({"-1": "", "nan": "", "NaN": ""})
    return docs.agg(" ".join, axis=1).str.lower().str.replace(r"[^a-z\s]", " ", regex=True)


def enrich_from_personalized(profiles: dict) -> dict:
    """
    Fold in vocabulary from Personalized_Diet_Recommendations.csv if present.

    That dataset's schema varies between releases, so we look for any column
    naming a disease and any column naming a recommendation, then append the
    recommendation text to the matching profile's `encourage` query. If the file
    is absent, the curated profiles are used unchanged.
    """
    path = DATA_DIR / "Personalized_Diet_Recommendations.csv"
    if not path.exists():
        print("Personalized_Diet_Recommendations.csv not found; using curated profiles only.")
        return profiles

    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]
    disease_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ("disease", "condition", "diagnos"))),
        None,
    )
    rec_cols = [c for c in df.columns
                if any(k in c.lower() for k in ("recommend", "diet", "food", "suggest"))]
    if not disease_col or not rec_cols:
        print(f"Could not locate disease/recommendation columns in {path.name}; skipping.")
        return profiles

    added = 0
    for key in profiles:
        if key == "default":
            continue
        rows = df[df[disease_col].astype(str).str.lower().str.contains(key, na=False)]
        if rows.empty:
            continue
        text = " ".join(rows[rec_cols].astype(str).values.ravel()).lower()
        text = pd.Series([text]).str.replace(r"[^a-z\s]", " ", regex=True).iat[0]
        profiles[key]["encourage"] += " " + " ".join(dict.fromkeys(text.split()))[:2000]
        added += 1
    print(f"Enriched {added} profile(s) from {path.name}")
    return profiles


def main() -> None:
    food = load_csv("indian_food.csv")
    food.columns = [c.strip().lower() for c in food.columns]
    food = food.reset_index(drop=True)

    documents = build_documents(food)

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
    )
    matrix = vectorizer.fit_transform(documents)
    print(f"TF-IDF matrix: {matrix.shape[0]} dishes x {matrix.shape[1]} terms")

    profiles = enrich_from_personalized(PROFILES)

    # Sanity check: every profile must retrieve something.
    for key, profile in profiles.items():
        q = vectorizer.transform([profile["encourage"]])
        sim = (matrix @ q.T).toarray().ravel()
        top = food.loc[np.argsort(-sim)[:3], "name"].tolist()
        print(f"  {key:<13} top matches -> {top}")

    engine = {
        "vectorizer": vectorizer,
        "matrix": matrix,
        # Keep only the columns the API returns, so the pickle stays small.
        "food": food[[c for c in
                      ["name", "ingredients", "diet", "course", "region", "flavor_profile"]
                      if c in food.columns]],
        "documents": documents,
        "profiles": profiles,
    }
    save_artifact(engine, "diet_engine.pkl")


if __name__ == "__main__":
    main()