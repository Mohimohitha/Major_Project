"""
app/ocr.py
----------
Turn an uploaded lab report (image or PDF) into a structured biomarker dict.

Pipeline
    bytes -> page images -> OpenCV preprocessing -> PyTesseract -> regex parse

The preprocessing chain is the part that decides whether this works on a real
phone photo of a printed report:

    grayscale            drop colour, which carries no signal in a lab printout
    upscale to 300 DPI   Tesseract is trained near 300 DPI and degrades sharply below it
    denoise              removes JPEG and sensor noise that becomes phantom punctuation
    deskew               a 3-degree tilt is enough to break line segmentation
    adaptive threshold   handles uneven lighting far better than a global cutoff

We run OCR twice, with two page-segmentation modes, and keep whichever parse
finds more biomarkers. PSM 6 ("a single uniform block") wins on clean scans;
PSM 4 ("variable-sized columns") wins on the two-column layouts most Indian
diagnostic labs print.
"""

from __future__ import annotations

import io
import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parents[1]))
from core.biomarkers import BIOMARKERS, PATTERNS, normalise, status  # noqa: E402

log = logging.getLogger(__name__)

TESSERACT_CONFIGS = [
    r"--oem 3 --psm 6 -c preserve_interword_spaces=1",
    r"--oem 3 --psm 4 -c preserve_interword_spaces=1",
]
TARGET_HEIGHT = 1800  # roughly 300 DPI for an A4 page


@dataclass
class Extraction:
    values: dict[str, float]          # canonical name -> canonical-unit value
    statuses: dict[str, str]          # canonical name -> low / normal / high
    suspect: list[str]                # values outside plausible bounds
    raw_text: str
    ocr_confidence: float             # mean Tesseract word confidence, 0-100


# ---------------------------------------------------------------------------
# Image handling
# ---------------------------------------------------------------------------
def load_pages(content: bytes, content_type: str) -> list[np.ndarray]:
    """Decode the upload into a list of BGR page images."""
    if "pdf" in (content_type or "").lower():
        try:
            from pdf2image import convert_from_bytes
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "PDF support needs pdf2image and the poppler-utils system package."
            ) from exc
        pages = convert_from_bytes(content, dpi=300)
        return [cv2.cvtColor(np.array(p.convert("RGB")), cv2.COLOR_RGB2BGR) for p in pages]

    image = Image.open(io.BytesIO(content)).convert("RGB")
    return [cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)]


def deskew(gray: np.ndarray) -> np.ndarray:
    """Rotate the page so text lines sit horizontal. Skips large angles as unsafe."""
    inverted = cv2.bitwise_not(gray)
    _, binary = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(binary > 0))
    if coords.size == 0:
        return gray

    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    # A page is never genuinely tilted more than ~15 degrees; a larger estimate
    # means minAreaRect locked onto a table border, so leave the page alone.
    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray

    h, w = gray.shape
    matrix = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(
        gray, matrix, (w, h),
        flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess(page: np.ndarray) -> np.ndarray:
    """Full OpenCV chain. Returns a binary image ready for Tesseract."""
    gray = cv2.cvtColor(page, cv2.COLOR_BGR2GRAY)

    if gray.shape[0] < TARGET_HEIGHT:
        scale = TARGET_HEIGHT / gray.shape[0]
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
    gray = deskew(gray)

    # CLAHE lifts faint dot-matrix print without blowing out the background.
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)

    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=35, C=15,
    )
    # Close 1px gaps inside characters that thresholding opened up.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def run_tesseract(binary: np.ndarray, config: str) -> tuple[str, float]:
    """Return (text, mean word confidence). Confidence is our upstream quality signal."""
    text = pytesseract.image_to_string(binary, config=config)
    data = pytesseract.image_to_data(binary, config=config, output_type=pytesseract.Output.DICT)
    confidences = [float(c) for c in data["conf"] if str(c) not in ("-1", "")]
    return text, float(np.mean(confidences)) if confidences else 0.0


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def clean_text(text: str) -> str:
    """Collapse whitespace so a label and its value survive on one line."""
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    text = re.sub(r"[ \t]+", " ", text)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def parse_biomarkers(text: str) -> tuple[dict[str, float], list[str]]:
    """
    Apply each biomarker regex to the OCR text.

    Where a label appears more than once (common: a summary table plus a
    detailed table), the first match wins, because lab reports print the
    patient's result before the reference range.
    """
    values: dict[str, float] = {}
    suspect: list[str] = []

    for name, pattern in PATTERNS.items():
        match = pattern.search(text)
        if not match:
            continue
        raw_number, raw_unit = match.group(1), match.group(2)
        try:
            number = float(raw_number.replace(",", "."))
        except ValueError:
            continue

        value, plausible = normalise(name, number, raw_unit)
        if not plausible:
            # Keep it, but tell the caller not to trust it. Discarding silently
            # would hide OCR failure behind a confident prediction.
            suspect.append(name)
            log.warning("%s=%s %s is outside plausible bounds", name, value, BIOMARKERS[name].unit)
        values[name] = value

    return values, suspect


def extract(content: bytes, content_type: str) -> Extraction:
    """Public entry point used by main.py."""
    pages = load_pages(content, content_type)

    best_text, best_conf, best_values, best_suspect = "", 0.0, {}, []

    for page in pages:
        binary = preprocess(page)
        for config in TESSERACT_CONFIGS:
            text, confidence = run_tesseract(binary, config)
            text = clean_text(text)
            values, suspect = parse_biomarkers(text)
            # Rank by biomarkers found first, OCR confidence second.
            better = (len(values), confidence) > (len(best_values), best_conf)
            if better:
                best_text, best_conf, best_values, best_suspect = text, confidence, values, suspect

    return Extraction(
        values=best_values,
        statuses={k: status(k, v) for k, v in best_values.items()},
        suspect=best_suspect,
        raw_text=best_text,
        ocr_confidence=round(best_conf, 2),
    )