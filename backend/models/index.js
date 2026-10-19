/**
 * models/index.js
 * ---------------
 * Mongoose schemas for the three collections.
 *
 *   User          -> one document per patient account (credentials + profile)
 *   Vitals        -> one document per vitals capture (append-only, time series)
 *   ClinicalRecord-> one document per uploaded report + its full ML output
 *
 * Vitals are kept in their own collection rather than embedded in User because
 * they are time series: a patient records them repeatedly, and the dashboard's
 * trend chart reads them by date range. Embedding would force the whole array
 * into memory on every login and would eventually hit the 16 MB document cap.
 *
 * ClinicalRecord stores the ML output denormalised. That is deliberate: a
 * record is an immutable snapshot of what the model said on that date with that
 * model version. Re-deriving it later from a retrained model would silently
 * rewrite the patient's history.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema, model, Types } = mongoose;

/* ------------------------------------------------------------------ */
/* User                                                                */
/* ------------------------------------------------------------------ */
const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    // select:false keeps the hash out of every query result by default, so it
    // cannot leak through a careless res.json(user).
    passwordHash: { type: String, required: true, select: false },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['M', 'F', 'O'], required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    knownConditions: [{ type: String, trim: true }],
    allergies: [{ type: String, trim: true }],
    consent: {
      // Explicit, timestamped consent to process health data. Required before
      // any upload is accepted.
      dataProcessing: { type: Boolean, default: false },
      grantedAt: { type: Date },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.virtual('age').get(function computeAge() {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

/* ------------------------------------------------------------------ */
/* Vitals                                                              */
/* ------------------------------------------------------------------ */
const vitalsSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    recordedAt: { type: Date, default: Date.now },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, enum: ['M', 'F', 'O'], required: true },
    systolic: { type: Number, min: 50, max: 300 },
    diastolic: { type: Number, min: 30, max: 200 },
    heightCm: { type: Number, min: 50, max: 250 },
    weightKg: { type: Number, min: 2, max: 400 },
    bmi: { type: Number, min: 8, max: 80 },
    naToK: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Derive BMI server-side so the client cannot send an inconsistent value.
vitalsSchema.pre('validate', function deriveBmi(next) {
  if (!this.bmi && this.heightCm && this.weightKg) {
    const metres = this.heightCm / 100;
    this.bmi = Number((this.weightKg / (metres * metres)).toFixed(2));
  }
  next();
});

// Compound index: the dashboard always queries "this user, newest first".
vitalsSchema.index({ user: 1, recordedAt: -1 });

/* ------------------------------------------------------------------ */
/* ClinicalRecord                                                      */
/* ------------------------------------------------------------------ */
const biomarkerSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: Number, required: true },
    unit: String,
    status: { type: String, enum: ['low', 'normal', 'high'] },
    referenceRange: String,
    suspect: { type: Boolean, default: false },
  },
  { _id: false }
);

const clinicalRecordSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    vitals: { type: Types.ObjectId, ref: 'Vitals', required: true },

    report: {
      originalName: String,
      mimeType: String,
      sizeBytes: Number,
      // SHA-256 of the file. Lets us detect a duplicate upload without keeping
      // the file itself, which is the safer default for health data.
      checksum: { type: String, index: true },
      storageKey: String, // populate only if you add S3/GridFS persistence
    },

    ocrConfidence: Number,
    biomarkers: [biomarkerSchema],

    diagnosis: {
      disease: { type: String, index: true },
      confidence: Number,
      differentials: [{ disease: String, confidence: Number, _id: false }],
      evidence: Schema.Types.Mixed,
      inconclusive: { type: Boolean, default: false },
    },

    medication: {
      drugClass: String,
      confidence: Number,
      alternatives: [Schema.Types.Mixed],
      inputsUsed: Schema.Types.Mixed,
    },

    diet: {
      profile: String,
      guidance: String,
      recommended: [Schema.Types.Mixed],
      avoid: [Schema.Types.Mixed],
      avoidIngredients: [String],
    },

    warnings: [String],
    processingMs: Number,
    // Pinning the model versions makes every stored prediction reproducible and
    // auditable, which is the difference between a demo and a system.
    modelVersions: Schema.Types.Mixed,

    reviewedByClinician: { type: Boolean, default: false },
    clinicianNotes: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

clinicalRecordSchema.index({ user: 1, createdAt: -1 });

module.exports = {
  User: model('User', userSchema),
  Vitals: model('Vitals', vitalsSchema),
  ClinicalRecord: model('ClinicalRecord', clinicalRecordSchema),
};