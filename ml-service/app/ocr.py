import os
import re
import datetime
import difflib
import cv2
import numpy as np
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from pdf2image import convert_from_path

# ---------------- Configuration ----------------
PDF_DPI           = 300
MAX_PDF_PAGES     = 10
DEFAULT_SEX       = "M"
PSM_CANDIDATES    = (6, 4, 11, 3)
USE_REPORT_RANGE  = True
CRITICAL_FLAGS    = True

MODEL_NAME        = "google/flan-t5-small"
PROMPT_PREFIX     = "translate to simple english: "
GEN_KWARGS        = dict(max_length=64, num_beams=4, no_repeat_ngram_size=3, early_stopping=True, do_sample=False)

# ---------------- Computer Vision & OCR ----------------
def load_pages(path):
    if path.lower().endswith(".pdf"):
        pil_pages = convert_from_path(path, poppler_path=r'C:\poppler\Library\bin')
        if not pil_pages:
            raise ValueError(f"PDF has no pages: {path}")
        return [cv2.cvtColor(np.array(p.convert("RGB")), cv2.COLOR_RGB2BGR) for p in pil_pages]
    
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {path}")
    return [img]

def preprocess(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    target = 1600 if w < 1600 else min(w, 2600)
    if target != w:
        interp = cv2.INTER_CUBIC if target > w else cv2.INTER_AREA
        gray = cv2.resize(gray, None, fx=target / w, fy=target / w, interpolation=interp)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    block = int(round(35 * target / 1600)) | 1 
    return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, blockSize=block, C=15)

def ocr(bin_img, psm):
    return pytesseract.image_to_string(bin_img, config=f'--psm {psm}')

# ---------------- Data Extraction ----------------
BIOMARKERS = {
    "Hemoglobin":        ["hemoglobin", "haemoglobin", "hgb", "hb"],
    "Hematocrit":        ["hematocrit", "haematocrit", "hct", "pcv"],
    "WBC":               ["white blood cell count", "white blood cells", "wbc count", "wbc", "total leucocyte count", "tlc"],
    "Platelets":         ["platelet count", "platelets", "plt"],
    "Glucose":           ["fasting blood sugar", "fasting glucose", "blood glucose", "glucose", "fbs"],
    "HbA1c":             ["hba1c", "glycated hemoglobin", "glycosylated hemoglobin", "a1c"],
    "Total Cholesterol": ["total cholesterol", "cholesterol total", "cholesterol"],
    "LDL Cholesterol":   ["ldl cholesterol", "ldl"],
    "HDL Cholesterol":   ["hdl cholesterol", "hdl"],
    "Triglycerides":     ["triglycerides", "triglyceride", "tg"],
    "Sodium":            ["sodium"],
    "Potassium":         ["potassium"],
    "Creatinine":        ["serum creatinine", "creatinine"],
    "TSH":               ["thyroid stimulating hormone", "thyrotropin", "tsh"],
    "ALT":               ["alanine aminotransferase", "sgpt", "alt"],
    "AST":               ["aspartate aminotransferase", "sgot", "ast"],
}

IGNORE_ALIASES = ["non-hdl cholesterol", "vldl cholesterol", "vldl", "chol/hdl ratio", "tc/hdl ratio", "ldl/hdl ratio", "total cholesterol/hdl ratio"]

def _norm(s): return re.sub(r"[\s\-_]+", "", s.lower())

ALIAS_TO_CANON = {_norm(a): c for c, al in BIOMARKERS.items() for a in al}
ALIAS_TO_CANON.update({_norm(a): None for a in IGNORE_ALIASES})

def _alias_pattern(a):
    parts = [p for p in re.split(r"[\s\-_]+", a.strip()) if p]
    return r"[\s\-_]*".join(re.escape(p) for p in parts)

_aliases = sorted({a for al in BIOMARKERS.values() for a in al} | set(IGNORE_ALIASES), key=len, reverse=True)
MASTER_RE = re.compile(r"(?<![A-Za-z0-9])(" + "|".join(_alias_pattern(a) for a in _aliases) + r")(?![A-Za-z])", re.I)

NUMBER  = r"(\d{1,6}(?:[.,]\d{1,3})?)"
UNIT_RE = re.compile(r"(mg/dl|g/dl|g/l|mmol/l|mmol/mol|meq/l|miu/l|[uµ]iu/ml|iu/l|u/l|[uµ]mol/l|k/[uµ]l|thou/[uµ]l|x?10\^?\d/[uµ]l|lakhs?/cumm|/cumm|%)", re.I)
SEX_RE  = re.compile(r"\bsex\s*[:\-]?\s*(male|female|m|f)\b", re.I)

UNIT_CONVERSIONS = {
    ("Glucose", "mmol/l"): lambda v: v * 18.016,
    ("Total Cholesterol", "mmol/l"): lambda v: v * 38.67,
    ("LDL Cholesterol", "mmol/l"): lambda v: v * 38.67,
    ("HDL Cholesterol", "mmol/l"): lambda v: v * 38.67,
    ("Triglycerides", "mmol/l"): lambda v: v * 88.57,
    ("Hemoglobin", "g/l"): lambda v: v / 10,
    ("Creatinine", "umol/l"): lambda v: v / 88.4,
    ("HbA1c", "mmol/mol"): lambda v: 0.09148 * v + 2.152,
}

def _f(s): return float(s.replace(",", "."))

def normalize_value(canon, value, unit_raw):
    u = (unit_raw or "").lower().replace("µ", "u")
    if (canon, u) in UNIT_CONVERSIONS:
        return UNIT_CONVERSIONS[(canon, u)](value), True
    if canon in ("WBC", "Platelets"):
        if "lakh" in u:
            return value * 100, True
        if value >= 1000:
            return value / 1000, True
    return value, False

def parse_printed_range(s):
    m = re.search(NUMBER + r"\s*(?:-|–|—|to)\s*" + NUMBER, s)
    if m and _f(m.group(1)) < _f(m.group(2)): return (_f(m.group(1)), _f(m.group(2)))
    m = re.search(r"[<≤]\s*" + NUMBER, s)
    if m: return (None, _f(m.group(1)))
    m = re.search(r"[>≥]\s*" + NUMBER, s)
    if m: return (_f(m.group(1)), None)
    return None

def detect_sex(text):
    m = SEX_RE.search(text)
    return None if not m else ("F" if m.group(1).lower().startswith("f") else "M")

def extract_biomarkers(text):
    found = {}
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        for m in MASTER_RE.finditer(line):
            canon = ALIAS_TO_CANON.get(_norm(m.group(1)))
            if canon is None or canon in found: continue
            tail = re.sub(r"\([^)]*[A-Za-z][^)]*\)", " ", line[m.end():])
            vm = re.match(r"[^\d]{0,40}?" + NUMBER, tail)
            if not vm: continue
            raw_value = _f(vm.group(1))
            rest = tail[vm.end():].lstrip()
            um = UNIT_RE.match(rest)
            unit_raw = um.group(1) if um else None
            rest = rest[um.end():] if um else rest
            value, converted = normalize_value(canon, raw_value, unit_raw)
            found[canon] = {
                "value": value, "raw_value": raw_value, "raw_unit": unit_raw,
                "converted": converted, "printed_range": parse_printed_range(rest),
                "source_line": line
            }
    return found

# ---------------- Expert System ----------------
REFERENCE_RANGES = {
    "Hemoglobin":        {"unit": "g/dL",     "M": (13.5, 17.5), "F": (12.0, 15.5), "crit": (7.0, 20.0)},
    "Hematocrit":        {"unit": "%",        "M": (41.0, 53.0), "F": (36.0, 46.0), "crit": (20.0, 60.0)},
    "WBC":               {"unit": "x10^3/uL", "ALL": (4.0, 11.0),   "crit": (2.0, 30.0)},
    "Platelets":         {"unit": "x10^3/uL", "ALL": (150.0, 450.0), "crit": (50.0, 1000.0)},
    "Glucose":           {"unit": "mg/dL",    "ALL": (70.0, 99.0),   "crit": (40.0, 500.0)},
    "HbA1c":             {"unit": "%",        "ALL": (4.0, 5.6),     "crit": (None, None)},
    "Total Cholesterol": {"unit": "mg/dL",    "ALL": (0.0, 200.0),   "crit": (None, None)},
    "LDL Cholesterol":   {"unit": "mg/dL",    "ALL": (0.0, 100.0),   "crit": (None, None)},
    "HDL Cholesterol":   {"unit": "mg/dL",    "ALL": (40.0, None),   "crit": (None, None)},
    "Triglycerides":     {"unit": "mg/dL",    "ALL": (0.0, 150.0),   "crit": (None, 1000.0)},
    "Sodium":            {"unit": "mmol/L",   "ALL": (135.0, 145.0), "crit": (120.0, 160.0)},
    "Potassium":         {"unit": "mmol/L",   "ALL": (3.5, 5.0),     "crit": (2.5, 6.5)},
    "Creatinine":        {"unit": "mg/dL",    "M": (0.7, 1.3), "F": (0.6, 1.1), "crit": (None, 7.4)},
    "TSH":               {"unit": "mIU/L",    "ALL": (0.4, 4.0),     "crit": (None, None)},
    "ALT":               {"unit": "U/L",      "ALL": (7.0, 56.0),    "crit": (None, None)},
    "AST":               {"unit": "U/L",      "ALL": (10.0, 40.0),   "crit": (None, None)},
}

def classify(value, lo, hi, crit_lo, crit_hi):
    if crit_lo is not None and value <= crit_lo: label = "CRITICAL LOW"
    elif crit_hi is not None and value >= crit_hi: label = "CRITICAL HIGH"
    elif lo is not None and value < lo: label = "LOW"
    elif hi is not None and value > hi: label = "HIGH"
    else: label = "NORMAL"
    if not CRITICAL_FLAGS: label = {"CRITICAL LOW": "LOW", "CRITICAL HIGH": "HIGH"}.get(label, label)
    return label

def fmt_range(lo, hi, unit):
    if lo is not None and lo > 0 and hi is not None: return f"{lo:g} - {hi:g} {unit}"
    if hi is not None: return f"< {hi:g} {unit}"
    if lo is not None: return f"> {lo:g} {unit}"
    return "N/A"

def evaluate(found, sex):
    results, rejected = [], []
    for canon, rec in found.items():
        spec = REFERENCE_RANGES[canon]
        lo, hi = spec.get(sex, spec.get("ALL"))
        std_hi = hi
        source = "standard"
        if USE_REPORT_RANGE and rec["printed_range"] and not rec["converted"]:
            plo, phi = rec["printed_range"]
            lo = plo if plo is not None else lo
            hi = phi if phi is not None else hi
            source = "report"
        v = rec["value"]
        if std_hi is not None and v > std_hi * 25:
            rejected.append({"biomarker": canon, "value": v, "reason": "implausible magnitude"})
            continue
        clo, chi = spec["crit"]
        results.append({
            "biomarker": canon, "page": rec.get("page", 1), "value": round(v, 2), "unit": spec["unit"],
            "reference_range": {"min": lo, "max": hi, "unit": spec["unit"], "display": fmt_range(lo, hi, spec["unit"]), "source": source},
            "status": classify(v, lo, hi, clo, chi),
        })
    return results, rejected

# ---------------- NLP Simplifier ----------------
class T5Simplifier:
    def __init__(self, model_name):
        import torch
        self.model_name = model_name
        use_gpu = torch.cuda.is_available()
        try:
            from transformers import pipeline
            self.pipe = pipeline("text2text-generation", model=model_name, device=0 if use_gpu else -1)
            self.backend = "pipeline"
        except Exception:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            self.tok = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to("cuda" if use_gpu else "cpu").eval()
            self.backend = "generate"

    def __call__(self, prompt):
        if self.backend == "pipeline": return self.pipe(prompt, **GEN_KWARGS)[0]["generated_text"].strip()
        import torch
        enc = self.tok(prompt, return_tensors="pt").to(self.model.device)
        with torch.no_grad(): out = self.model.generate(**enc, **GEN_KWARGS)
        return self.tok.decode(out[0], skip_special_tokens=True).strip()

SIMPLIFIER = T5Simplifier(MODEL_NAME) # Initializes globally when server starts
STATUS_WORDS = {"NORMAL": "NORMAL", "LOW": "LOW", "HIGH": "HIGH", "CRITICAL LOW": "CRITICALLY LOW", "CRITICAL HIGH": "CRITICALLY HIGH"}

def build_prompt(r):
    core = f"The patient's {r['biomarker']} level is {r['value']:g} {r['unit']}. The normal range is {r['reference_range']['display']}. This is {STATUS_WORDS[r['status']]}."
    return PROMPT_PREFIX + core, core

def validate_generation(text, core, status):
    t = text.strip()
    words = re.findall(r"[a-z]+", t.lower())
    if len(words) < 4: return False, "too short"
    if re.search(r"[^\x00-\x7F]", t): return False, "non-English characters"
    if "translate to" in t.lower() or difflib.SequenceMatcher(None, t.lower(), core.lower()).ratio() > 0.95: return False, "echo of the prompt"
    w = set(words)
    HIGH_W = {"high", "higher", "above", "elevated", "increased", "raised"}
    LOW_W  = {"low", "lower", "below", "reduced", "decreased"}
    if status == "NORMAL":
        if w & (HIGH_W | LOW_W | {"abnormal", "critical", "critically"}): return False, "contradicts NORMAL status"
        if not w & {"normal", "healthy", "range"}: return False, "does not state that the result is normal"
    elif "HIGH" in status:
        if w & (LOW_W | {"normal"}) and not w & HIGH_W: return False, "contradicts HIGH status"
        if not w & HIGH_W: return False, "does not state that the result is high"
    else:
        if w & (HIGH_W | {"normal"}) and not w & LOW_W: return False, "contradicts LOW status"
        if not w & LOW_W: return False, "does not state that the result is low"
    return True, ""

def fallback_text(r):
    phrase = {"NORMAL": "within the normal range", "LOW": "lower than the usual range", "HIGH": "higher than the usual range", "CRITICAL LOW": "much lower than the usual range", "CRITICAL HIGH": "much higher than the usual range"}[r["status"]]
    return f"Your {r['biomarker']} result is {r['value']:g} {r['unit']}, which is {phrase} ({r['reference_range']['display']}). Please discuss this result with your doctor."

def simplify(r):
    prompt, core = build_prompt(r)
    raw = SIMPLIFIER(prompt)
    ok, reason = validate_generation(raw, core, r["status"])
    text, source = (raw, "t5") if ok else (fallback_text(r), "fallback_template")
    if "CRITICAL" in r["status"]: text += " Please contact a doctor promptly."
    return {"text": text, "source": source, "model": MODEL_NAME, "prompt": prompt, "raw_generation": raw, "rejected_reason": reason or None}

# ---------------- Main Pipeline Execution ----------------
def run_pipeline(path):
    pages = load_pages(path)
    merged, texts, psms = {}, [], []
    for idx, page in enumerate(pages, 1):
        bin_img = preprocess(page)
        best = None
        for psm in PSM_CANDIDATES:
            text = ocr(bin_img, psm)
            found = extract_biomarkers(text)
            key = (len(found), len(text))
            if best is None or key > best["key"]:
                best = {"key": key, "psm": psm, "text": text, "found": found}
        texts.append(best["text"]); psms.append(best["psm"])
        for canon, rec in best["found"].items():
            if canon not in merged:
                rec["page"] = idx
                merged[canon] = rec
    full_text = "\n".join(texts)
    sex = detect_sex(full_text) or DEFAULT_SEX
    results, rejected = evaluate(merged, sex)
    for r in results:
        r["nlp_simplification"] = simplify(r)
    n_t5 = sum(r["nlp_simplification"]["source"] == "t5" for r in results)
    counts = {s: sum(r["status"] == s for r in results) for s in ("NORMAL", "LOW", "HIGH", "CRITICAL LOW", "CRITICAL HIGH")}
    
    payload = {
        "meta": {
            "pipeline": "OpenCV -> Tesseract -> Regex NLP -> Rule-based expert system",
            "input_type": "pdf" if path.lower().endswith(".pdf") else "image",
            "pages_processed": len(pages), "ocr_psm_per_page": psms, "patient_sex": sex,
            "biomarkers_extracted": len(results), "rejected": rejected,
            "nlp_model": MODEL_NAME,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        },
        "results": results,
        "summary": {
            "counts": counts,
            "nlp": {"t5_accepted": n_t5, "fallback_template": len(results) - n_t5},
            "requires_attention": [r["biomarker"] for r in results if r["status"] != "NORMAL"]
        },
        "disclaimer": "Educational academic prototype. Not medical advice."
    }
    return payload, full_text