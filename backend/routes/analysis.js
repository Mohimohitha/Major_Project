/**
 * routes/analysis.js
 * ------------------
 * POST /api/analysis        upload a report, get and store the full analysis
 * GET  /api/analysis        paginated history for the signed-in patient
 * GET  /api/analysis/trends biomarker time series for the dashboard chart
 * GET  /api/analysis/:id    one record
 *
 * The upload handler is the integration point between the three services, so
 * it carries the most defensive code in the project:
 *
 *   - the Vitals document and the ClinicalRecord are written in one transaction,
 *     so a crash can never leave a record pointing at vitals that do not exist;
 *   - the FastAPI call has an explicit timeout, because OCR on a large scan can
 *     take several seconds and a hung socket would otherwise pin a Node worker;
 *   - FastAPI's own error messages are passed through rather than flattened
 *     into a generic 500, so the patient is told what to fix.
 */

const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const mongoose = require('mongoose');

const { Vitals, ClinicalRecord } = require('../models');
const { requireAuth, requireConsent, upload } = require('../middleware/auth');

const router = express.Router();

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
    biomarkers: analysis.biomarkers.map((b) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      status: b.status,
      referenceRange: b.reference_range,
      suspect: b.suspect,
    })),
    diagnosis: {
      disease: analysis.diagnosis.disease,
      confidence: analysis.diagnosis.confidence,
      differentials: analysis.diagnosis.differentials,
      evidence: analysis.diagnosis.evidence,
      inconclusive: analysis.diagnosis.inconclusive,
    },
    medication: {
      drugClass: analysis.medication.drug_class,
      confidence: analysis.medication.confidence,
      alternatives: analysis.medication.alternatives,
      inputsUsed: analysis.medication.inputs_used,
    },
    diet: {
      profile: analysis.diet.profile,
      guidance: analysis.diet.guidance,
      recommended: analysis.diet.recommended,
      avoid: analysis.diet.avoid,
      avoidIngredients: analysis.diet.avoid_ingredients,
    },
    warnings: analysis.warnings || [],
    processingMs: analysis.processing_ms,
    modelVersions: analysis.model_versions,
  };
}

function parseVitals(body, user) {
  const num = (v) => (v === undefined || v === '' || v === null ? undefined : Number(v));
  return {
    age: num(body.age) ?? user.age,
    gender: (body.gender || user.gender || '').toUpperCase().slice(0, 1),
    systolic: num(body.systolic),
    diastolic: num(body.diastolic),
    heightCm: num(body.heightCm),
    weightKg: num(body.weightKg),
    bmi: num(body.bmi),
    naToK: num(body.naToK),
  };
}

/* ------------------------------------------------------------------ */
/* POST /api/analysis                                                  */
/* ------------------------------------------------------------------ */
router.post(
  '/',
  requireAuth,
  requireConsent,
  upload.single('report'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Attach a lab report to analyse.' });
    }

    const vitalsInput = parseVitals(req.body, req.user);
    if (!vitalsInput.age || !vitalsInput.gender) {
      return res.status(400).json({ error: 'Age and gender are required.' });
    }

    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // ---- 1. Forward to the ML service ------------------------------------
    let analysis;
    try {
      // The field name must be `file`: it matches FastAPI's parameter name.
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

      const { data } = await mlClient.post('/v1/analyze', payload, {
        headers: payload.getHeaders(),
      });
      analysis = data;
    } catch (err) {
      // Surface the microservice's own message; it is written for the patient.
      if (err.response) {
        const detail = err.response.data?.detail || 'The report could not be analysed.';
        return res.status(err.response.status === 401 ? 502 : err.response.status).json({
          error: typeof detail === 'string' ? detail : 'The report could not be analysed.',
        });
      }
      if (err.code === 'ECONNABORTED') {
        return res.status(504).json({
          error: 'Analysis timed out. Try a smaller or clearer file.',
        });
      }
      if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'The analysis service is offline. Try again shortly.',
        });
      }
      return next(err);
    }

    // ---- 2. Persist vitals + record atomically ---------------------------
    const session = await mongoose.startSession();
    try {
      let record;
      await session.withTransaction(async () => {
        const [vitalsDoc] = await Vitals.create(
          [{ user: req.user._id, ...vitalsInput }],
          { session }
        );

        const [created] = await ClinicalRecord.create(
          [
            {
              user: req.user._id,
              vitals: vitalsDoc._id,
              report: {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
                checksum,
              },
              ...toRecordFields(analysis),
            },
          ],
          { session }
        );
        record = created;
      });

      return res.status(201).json({
        record,
        disclaimer: analysis.disclaimer,
      });
    } catch (err) {
      return next(err);
    } finally {
      await session.endSession();
    }
  }
);

/* ------------------------------------------------------------------ */
/* GET /api/analysis                                                   */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* GET /api/analysis/trends                                            */
/* ------------------------------------------------------------------ */
router.get('/trends', requireAuth, async (req, res, next) => {
  try {
    // Aggregate rather than fetching whole records: the chart needs four fields,
    // not the full diet plan attached to every historical record.
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
      { $project: { _id: 0, name: '$_id', unit: 1, points: 1 } },
      { $sort: { name: 1 } },
    ]);

    return res.json({ series });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/analysis/:id                                               */
/* ------------------------------------------------------------------ */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'That record id is not valid.' });
    }
    // Scope by user as well as id, so an id guessed from another account 404s.
    const record = await ClinicalRecord.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('vitals');

    if (!record) return res.status(404).json({ error: 'Record not found.' });
    return res.json({ record });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;