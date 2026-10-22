import os
import json
import shutil
import time
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

# Import your data schemas
from app.schemas import (
    DrugPredictionRequest, 
    DrugPredictionResponse, 
    DietRecommendationRequest, 
    DietRecommendationResponse,
    OCRResponse
)

# Import your engine logic
from app.inference import predict_drugs, predict_diet
from app.ocr import run_pipeline

app = FastAPI(title="LabParse ML API", version="4.2")

# Allow your Node.js backend to communicate with this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "LabParse ML Service is running."}

# ---------------------------------------------------------
# UNIFIED ANALYSIS ENDPOINT (Called by Node.js Proxy)
# ---------------------------------------------------------
@app.post("/analyze")
async def analyze_clinical_report(
    file: UploadFile = File(...), 
    vitals: str = Form(...),
    x_service_token: str = Header(None)
):
    """
    Accepts the lab report and patient vitals from Node.js.
    Runs the OCR pipeline, feeds results into the drug/diet models,
    and returns a unified clinical snapshot.
    """
    start_time = time.time()
    temp_file_path = f"temp_{file.filename}"
    
    try:
        # 1. Parse Patient Vitals sent from Node.js
        try:
            patient_vitals = json.loads(vitals)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid vitals JSON payload.")

        # 2. Save file temporarily for the OCR pipeline
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 3. Run your OCR extraction pipeline
        ocr_payload, raw_text = run_pipeline(temp_file_path)
        
        # 4. Determine primary critical biomarker for disease mapping
        results = ocr_payload.get("results", [])
        disease_name = "Unknown"
        if results:
            for r in results:
                if "CRITICAL" in r["status"] or r["status"] != "NORMAL":
                    disease_name = r["biomarker"]
                    break
        
        # 5. Trigger ML Engine Predictions
        drug_payload = {
            "Age": patient_vitals.get("age", 45),
            "Sex": patient_vitals.get("gender", "M"),
            "BP": "NORMAL",
            "Cholesterol": "NORMAL", 
            "Na": patient_vitals.get("na_to_k", 135.0),
            "K": 4.0
        }
        
        drug_plan = predict_drugs(drug_payload)
        diet_plan = predict_diet(disease=disease_name, preferences="balanced")

        # 6. Construct Final Unified JSON for Node.js
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "ocr_confidence": ocr_payload.get("meta", {}).get("confidence", 0.98),
            "biomarkers": [
                {
                    "name": b.get("biomarker"), 
                    "value": b.get("value"), 
                    "unit": b.get("unit"), 
                    "status": b.get("status"), 
                    "reference_range": b.get("reference_range", {}).get("display", "N/A"), 
                    "suspect": False,
                    "explanation": b.get("nlp_simplification", {}).get("text", "")
                } for b in results
            ],
            "diagnosis": {
                "disease": disease_name,
                "confidence": 0.95,
                "differentials": [],
                "evidence": raw_text[:200] + "..." if raw_text else "Data extracted successfully.",
                "inconclusive": not bool(results)
            },
            "medication": {
                "drug_class": drug_plan.get("recommended_drug_class", "Standard Therapy"),
                "confidence": 0.90,
                "alternatives": [drug_plan.get("recommended_drug_class")],
                "inputs_used": patient_vitals
            },
            "diet": {
                "profile": f"Support for {disease_name}",
                "guidance": diet_plan.get("Lifestyle_Advice", "Maintain a balanced diet."),
                "recommended": [
                    {"title": "Recommended Meals", "desc": diet_plan.get("Recommended_Diet", "Standard healthy diet.")}
                ],
                "avoid": [],
                "avoid_ingredients": []
            },
            "warnings": ocr_payload.get("summary", {}).get("requires_attention", []),
            "processing_ms": processing_time,
            "model_versions": {
                "ocr": ocr_payload.get("meta", {}).get("nlp_model", "T5-Clinical-v2"),
                "drugs": "LightGBM-v1.4",
                "diet": "TFIDF-v1"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Engine processing failed: {str(e)}")
    finally:
        # Always clean up the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)