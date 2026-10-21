import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
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

app = FastAPI(title="Aegis Diagnostics ML API", version="1.0")

# Allow your Node.js/React frontend to communicate with this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, change to your exact frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Aegis ML Service is running."}

# ---------------------------------------------------------
# 1. OCR ENDPOINT
# ---------------------------------------------------------
@app.post("/extract", response_model=OCRResponse)
async def extract_clinical_data(file: UploadFile = File(...)):
    """
    Accepts a lab report (PDF/Image), saves it temporarily, 
    runs the OpenCV/Tesseract/T5 pipeline, and returns extracted biomarkers.
    """
    temp_file_path = f"temp_{file.filename}"
    try:
        # Save the uploaded file to disk temporarily
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run your massive Colab extraction pipeline
        payload, raw_text = run_pipeline(temp_file_path)
        
        # Add the raw text to the payload for the frontend to display if needed
        payload["raw_text"] = raw_text
        
        return payload
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR Processing failed: {str(e)}")
    finally:
        # Always clean up the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# ---------------------------------------------------------
# 2. PHARMACOLOGICAL ENDPOINT
# ---------------------------------------------------------
@app.post("/predict/drugs", response_model=DrugPredictionResponse)
def get_drug_prediction(data: DrugPredictionRequest):
    """
    Passes patient vitals and biomarkers to the LightGBM drug engine.
    """
    try:
        result = predict_drugs(data.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# 3. DIETARY ENDPOINT
# ---------------------------------------------------------
@app.post("/predict/diet", response_model=DietRecommendationResponse)
def get_diet_recommendation(data: DietRecommendationRequest):
    """
    Passes disease and preferences to the TF-IDF recommendation engine.
    """
    try:
        result = predict_diet(disease=data.disease, preferences=data.preferences)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))