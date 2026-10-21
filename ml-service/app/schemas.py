from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

# ---------------------------------------------------------
# 1. PHARMACOLOGICAL ENGINE SCHEMAS
# ---------------------------------------------------------
class DrugPredictionRequest(BaseModel):
    Age: int = Field(..., example=45, description="Patient's age in years")
    Sex: str = Field(..., example="M", description="Patient's biological sex (M/F)")
    BP: str = Field(..., example="HIGH", description="Blood pressure level (HIGH/NORMAL/LOW)")
    Cholesterol: str = Field(..., example="NORMAL", description="Cholesterol level (HIGH/NORMAL)")
    Na: float = Field(..., example=135.5, description="Sodium concentration")
    K: float = Field(..., example=4.2, description="Potassium concentration")

class DrugPredictionResponse(BaseModel):
    recommended_drug_class: str = Field(..., example="DrugY")

# ---------------------------------------------------------
# 2. DIETARY ENGINE SCHEMAS
# ---------------------------------------------------------
class DietRecommendationRequest(BaseModel):
    disease: str = Field(..., example="Diabetes", description="Patient's diagnosed chronic condition")
    preferences: str = Field(..., example="Vegan, Low Sugar", description="Patient's dietary preferences or allergies")

class DietRecommendationResponse(BaseModel):
    Target_Disease: str
    Considered_Preferences: str
    Recommended_Diet: str
    Lifestyle_Advice: str

# ---------------------------------------------------------
# 3. OCR PIPELINE SCHEMAS
# ---------------------------------------------------------
# Since the OCR pipeline outputs a highly nested dynamic dictionary, 
# we can use a flexible schema for its response.
class OCRResponse(BaseModel):
    meta: Dict[str, Any]
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]
    disclaimer: str
    raw_text: str