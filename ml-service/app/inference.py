import os
import joblib
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

# Define paths to your accurate Colab models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")

DRUG_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "clinical_drug_engine.pkl")
DIET_TFIDF_PATH = os.path.join(ARTIFACTS_DIR, "diet_tfidf_vectorizer.pkl")
DIET_DATA_PATH = os.path.join(ARTIFACTS_DIR, "diet_dataframe.pkl")

# Global variables for models
drug_engine = None
diet_vectorizer = None
diet_df = None
diet_tfidf_matrix = None

# ---------------------------------------------------------
# 1. LOAD MODELS INTO MEMORY (Runs once when server starts)
# ---------------------------------------------------------
try:
    print("Loading predictive models from artifacts...")
    
    # Load the LightGBM drug model[cite: 8]
    drug_engine = joblib.load(DRUG_MODEL_PATH)
    
    # Load the Dietary Recommender models[cite: 9]
    diet_vectorizer = joblib.load(DIET_TFIDF_PATH)
    diet_df = pd.read_pickle(DIET_DATA_PATH)
    
    # Pre-compute the TF-IDF matrix for the dataset to speed up inference[cite: 9]
    diet_tfidf_matrix = diet_vectorizer.transform(diet_df['Hybrid_Profile'])
    
    print("Models loaded successfully.")
except FileNotFoundError as e:
    print(f"CRITICAL ERROR: Model artifact missing. {e}")
except Exception as e:
    print(f"Error loading models: {e}")


# ---------------------------------------------------------
# 2. PHARMACOLOGICAL INFERENCE (Drug Engine)
# ---------------------------------------------------------
def predict_drugs(patient_data: dict):
    """
    Passes extracted OCR biomarkers into the LightGBM drug engine.
    Maps string categorical values back to the integers expected by the model.
    """
    # Standard LabelEncoder alphabetical sorting logic applied to your categories[cite: 8]
    sex_map = {"F": 0, "M": 1}
    bp_map = {"HIGH": 0, "LOW": 1, "NORMAL": 2}
    chol_map = {"HIGH": 0, "NORMAL": 1}
    
    # Extract values with safe defaults
    age = patient_data.get("Age", 45)
    sex = sex_map.get(str(patient_data.get("Sex", "M")).upper(), 1)
    bp = bp_map.get(str(patient_data.get("BP", "NORMAL")).upper(), 2)
    chol = chol_map.get(str(patient_data.get("Cholesterol", "NORMAL")).upper(), 1)
    na = patient_data.get("Na", 135.0)
    k = patient_data.get("K", 4.0)
    
    # Structure exactly as the model was trained[cite: 8]
    features = pd.DataFrame(
        [[age, sex, bp, chol, na, k]], 
        columns=['Age', 'Sex', 'BP', 'Cholesterol', 'Na', 'K']
    )
    
    prediction = drug_engine.predict(features)
    return {"recommended_drug_class": str(prediction[0])}


# ---------------------------------------------------------
# 3. DIETARY INFERENCE (Diet Engine)
# ---------------------------------------------------------
def predict_diet(disease: str, preferences: str):
    """
    Uses the TF-IDF vectorizer and Diet DataFrame to recommend meals
    based on the patient's diagnosed conditions[cite: 9].
    """
    # Create a profile for the incoming patient[cite: 9]
    patient_profile = f"{disease} {preferences}"
    
    # Vectorize the new patient's profile[cite: 9]
    patient_vector = diet_vectorizer.transform([patient_profile])
    
    # Calculate similarity[cite: 9]
    similarity_scores = cosine_similarity(patient_vector, diet_tfidf_matrix)
    
    # Find the best match[cite: 9]
    best_match_idx = similarity_scores.argmax()
    best_match = diet_df.iloc[best_match_idx]
    
    return {
        "Target_Disease": disease,
        "Considered_Preferences": preferences,
        "Recommended_Diet": str(best_match['Recommended_Meal_Plan']),
        "Lifestyle_Advice": str(best_match['Exercise_Frequency'])
    }