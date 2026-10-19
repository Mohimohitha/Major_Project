"""
app/schemas.py
--------------
Pydantic models. These do double duty: they validate what Node.js sends, and
they are the contract the React dashboard renders against. FastAPI publishes
them as OpenAPI at /docs, which is worth a screenshot in the report.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Vitals(BaseModel):
    """Baseline vitals captured in the React form."""

    age: int = Field(..., ge=0, le=120)
    gender: Literal["M", "F", "O"]
    systolic: float | None = Field(None, ge=50, le=300, description="mmHg")
    diastolic: float | None = Field(None, ge=30, le=200, description="mmHg")
    height_cm: float | None = Field(None, ge=50, le=250)
    weight_kg: float | None = Field(None, ge=2, le=400)
    bmi: float | None = Field(None, ge=8, le=80)
    na_to_k: float | None = Field(None, ge=0, le=100)

    @field_validator("gender", mode="before")
    @classmethod
    def normalise_gender(cls, v: str) -> str:
        v = str(v).strip().upper()
        return {"MALE": "M", "FEMALE": "F", "OTHER": "O"}.get(v, v[:1])

    def with_derived_bmi(self) -> "Vitals":
        """Compute BMI when the client sent height and weight but not BMI."""
        if self.bmi is None and self.height_cm and self.weight_kg:
            metres = self.height_cm / 100
            return self.model_copy(update={"bmi": round(self.weight_kg / (metres**2), 2)})
        return self


class BiomarkerReading(BaseModel):
    name: str
    value: float
    unit: str
    status: Literal["low", "normal", "high"]
    reference_range: str
    suspect: bool = False


class Differential(BaseModel):
    disease: str
    confidence: float


class Diagnosis(BaseModel):
    disease: str
    confidence: float
    differentials: list[Differential]
    evidence: dict
    inconclusive: bool


class Medication(BaseModel):
    drug_class: str
    confidence: float
    alternatives: list[dict]
    inputs_used: dict


class FoodItem(BaseModel):
    name: str
    course: str = ""
    diet: str = ""
    region: str = ""
    key_ingredients: str = ""


class DietPlan(BaseModel):
    profile: str
    guidance: str
    recommended: list[FoodItem]
    avoid: list[FoodItem]
    avoid_ingredients: list[str]


class AnalysisResponse(BaseModel):
    ocr_confidence: float
    biomarkers: list[BiomarkerReading]
    diagnosis: Diagnosis
    medication: Medication
    diet: DietPlan
    warnings: list[str] = []
    processing_ms: int
    model_versions: dict[str, str]
    disclaimer: str