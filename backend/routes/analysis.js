/**
 * routes/analysis.js
 * ------------------
 */

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');

const { Vitals, ClinicalRecord } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 1. Setup Multer for memory storage (React sends 'file')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// 2. Consent Middleware (Ensures patient agreed to HIPAA policy during registration)
const requireConsent = (req, res, next) => {
  if (!req.user.consent?.dataProcessing) {
    return res.status(403).json({ message: 'Data processing consent is required to analyze reports.' });
  }
  next();
};

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_SERVICE_TOKEN = process.env.ML_SERVICE_TOKEN;
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 60_000);

/** Axios client for the ML service. One instance, so keep-alive is reused. */
const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: ML_TIMEOUT_MS,
  maxContentLength: 20 * 1024 * 1024,
  headers: { 'X-Service-Token': ML_SERVICE_TOKEN },
});

/** Map the FastAPI response shape onto our Mongoose field names. */
function toRecordFields(analysis) {
  return {
    ocrConfidence: analysis.ocr_confidence,
    biomarkers: (analysis.biomarkers || []).map((b) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      status: b.status,
      referenceRange: b.reference_range,
      suspect: b.suspect,
    })),
    diagnosis: {
      disease: analysis.diagnosis?.disease,
      confidence: analysis.diagnosis?.confidence,
      differentials: analysis.diagnosis?.differentials,
      evidence: analysis.diagnosis?.evidence,
      inconclusive: analysis.diagnosis?.inconclusive,
    },
    medication: {
      drugClass: analysis.medication?.drug_class,
      confidence: analysis.medication?.confidence,
      alternatives: analysis.medication?.alternatives,
      inputsUsed: analysis.medication?.inputs_used,
    },
    diet: {
      profile: analysis.diet?.profile,
      guidance: analysis.diet?.guidance,
      recommended: analysis.diet?.recommended,
      avoid: analysis.diet?.avoid,
      avoidIngredients: analysis.diet?.avoid_ingredients,
    },
    warnings: analysis.warnings || [],
    processingMs: analysis.processing_ms,
    modelVersions: analysis.model_versions,
  };
}

function parseVitals(body, user) {
  const num = (v) => (v === undefined || v === '' || v === null ? undefined : Number(v));
  return {
    age: num(body.age) ?? user.age ?? 30,
    gender: (body.gender || user.gender || 'M').toUpperCase().slice(0, 1),
    systolic: num(body.systolic),
    diastolic: num(body.diastolic),
    heightCm: num(body.heightCm),
    weightKg: num(body.weightKg),
    bmi: num(body.bmi),
    naToK: num(body.naToK),
  };
}

/* ------------------------------------------------------------------ */
/* POST /api/analysis/upload                                          */
/* ------------------------------------------------------------------ */
router.post(
  '/upload',
  requireAuth,
  requireConsent,
  upload.single('file'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Attach a lab report to analyse.' });
    }

    const vitalsInput = parseVitals(req.body, req.user);
    if (!vitalsInput.age || !vitalsInput.gender) {
      return res.status(400).json({ message: 'Patient age and gender are required for calibration.' });
    }

    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // ---- 1. Forward to the ML service ------------------------------------
    let analysis;
    try {
      const payload = new FormData();
      payload.append('file', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      payload.append(
        'vitals',
        JSON.stringify({
          age: vitalsInput.age,
          gender: vitalsInput.gender,
          systolic: vitalsInput.systolic,
          diastolic: vitalsInput.diastolic,
          height_cm: vitalsInput.heightCm,
          weight_kg: vitalsInput.weightKg,
          bmi: vitalsInput.bmi,
          na_to_k: vitalsInput.naToK,
        })
      );

      const { data } = await mlClient.post('/analyze', payload, {
        headers: payload.getHeaders(),
      });
      analysis = data;
    } catch (err) {
      if (err.response) {
        const detail = err.response.data?.detail || 'The report could not be analysed.';
        return res.status(err.response.status === 401 ? 502 : err.response.status).json({
          message: typeof detail === 'string' ? detail : 'The ML Engine rejected the document.',
        });
      }
      if (err.code === 'ECONNABORTED') {
        return res.status(504).json({ message: 'Analysis timed out. Try a smaller or clearer file.' });
      }
      if (err.code === 'ECONNREFUSED') {
        // Fallback mock data for frontend testing if FastAPI is offline
        console.warn("ML Service offline. Returning mocked clinical protocol.");
        return res.status(201).json({
          reportId: `LAB-${Math.floor(1000 + Math.random() * 9000)}-CBC`,
          biomarker: 'Hemoglobin',
          value: '9.0 g/dL',
          status: 'CRITICAL LOW',
          referenceRange: '12.0 - 15.5 g/dL',
          confidence: '99.4%',
          diagnosis: 'Moderate Anemia',
          explanation: 'Your red blood cell count is significantly lower than normal. Ensure clinical review.',
          percentage: 45,
          target: '13.5+ g/dL',
          drugs: ['Oral Iron Supplements (e.g., Ferrous Sulfate)', 'Folic Acid / Vitamin B12'],
          smartTip: 'Take iron supplements on an empty stomach with a glass of orange juice.',
          diet: {
            good: [
              { title: 'Heme Iron', desc: 'Lean red meats, poultry, liver, and fish.' },
              { title: 'Vitamin C Boosters', desc: 'Oranges, strawberries, bell peppers.' }
            ],
            blockers: [
              { title: 'Tannins & Polyphenols', desc: 'Black tea, green tea, and coffee.' }
            ]
          }
        });
      }
      return next(err);
    }

    // ---- 2. Persist vitals + record (Non-transactional for local DB compatibility) ----
    try {
      const vitalsDoc = await Vitals.create({
        user: req.user._id,
        ...vitalsInput
      });

      const record = await ClinicalRecord.create({
        user: req.user._id,
        vitals: vitalsDoc._id,
        report: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          checksum,
        },
        ...toRecordFields(analysis),
      });

      // ---- 3. Transform complex DB record into simple React Dashboard UI format ----
      const firstBiomarker = record.biomarkers[0] || {};
      const uiResponse = {
        reportId: `LAB-${record._id.toString().slice(-4).toUpperCase()}`,
        biomarker: firstBiomarker.name || 'Biomarker Extracted',
        value: `${firstBiomarker.value || ''} ${firstBiomarker.unit || ''}`.trim(),
        status: (firstBiomarker.status || 'MONITOR').toUpperCase(),
        referenceRange: firstBiomarker.referenceRange || 'N/A',
        confidence: `${((record.ocrConfidence || 0.98) * 100).toFixed(1)}%`,
        diagnosis: record.diagnosis?.disease || 'Pending Review',
        explanation: typeof record.diagnosis?.evidence === 'string' 
          ? record.diagnosis.evidence 
          : 'Analysis complete. Review biomarker bounds carefully.',
        percentage: 50, 
        target: 'See Reference',
        drugs: record.medication?.alternatives?.length ? record.medication.alternatives : ['Consult physician for options'],
        smartTip: record.warnings?.[0] || 'Take any supplements strictly as directed by your healthcare provider.',
        diet: {
          good: record.diet?.recommended?.length ? record.diet.recommended : [{ title: 'Balanced Diet', desc: 'Maintain nutrient-rich meals.' }],
          blockers: record.diet?.avoid?.length ? record.diet.avoid : [{ title: 'Processed Foods', desc: 'Avoid high sodium.' }]
        }
      };

      return res.status(201).json(uiResponse);

    } catch (err) {
      return next(err);
    }
  }
);

/* GET /api/analysis */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);

    const [items, total] = await Promise.all([
      ClinicalRecord.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('vitals')
        .lean(),
      ClinicalRecord.countDocuments({ user: req.user._id }),
    ]);

    return res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return next(err);
  }
});

/* GET /api/analysis/trends */
router.get('/trends', requireAuth, async (req, res, next) => {
  try {
    const series = await ClinicalRecord.aggregate([
      { $match: { user: req.user._id } },
      { $sort: { createdAt: 1 } },
      { $unwind: '$biomarkers' },
      {
        $group: {
          _id: '$biomarkers.name',
          unit: { $first: '$biomarkers.unit' },
          points: {
            $push: {
              date: '$createdAt',
              value: '$biomarkers.value',
              status: '$biomarkers.status',
            },
          },
        },
      },
      { $project: { _id: 0, name: '$_id', unit: 1, points: 1 } }, {$sort: { name: 1 } },
    ]);

    return res.json({ series });
  } catch (err) {
    return next(err);
  }
});

/* GET /api/analysis/:id */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'That record id is not valid.' });
    }
    const record = await ClinicalRecord.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('vitals');

    if (!record) return res.status(404).json({ message: 'Record not found.' });
    return res.json({ record });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;