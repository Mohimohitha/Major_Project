const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema, model } = mongoose;

/* ------------------------------------------------------------------ */
/* User                                                               */
/* ------------------------------------------------------------------ */
const userSchema = new Schema({
  fullName: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 120 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
  },
  passwordHash: { 
    type: String, 
    required: true,
    select: false 
  },
  dateOfBirth: { 
    type: Date, 
    required: true 
  },
  gender: { 
    type: String, 
    required: true,
    enum: ['Male', 'Female', 'M', 'F', 'O']
  },
  bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  knownConditions: [{ type: String, trim: true }],
  allergies: [{ type: String, trim: true }],
  consent: {
    dataProcessing: { type: Boolean, default: false },
    grantedAt: { type: Date }
  },
  lastLoginAt: { 
    type: Date 
  }
}, { timestamps: true });

userSchema.virtual('age').get(function computeAge() {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
});

userSchema.methods.setPassword = async function(password) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(password, salt);
};

userSchema.methods.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
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
/* Vitals                                                             */
/* ------------------------------------------------------------------ */
const vitalsSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

vitalsSchema.pre('validate', function deriveBmi(next) {
  if (!this.bmi && this.heightCm && this.weightKg) {
    const metres = this.heightCm / 100;
    this.bmi = Number((this.weightKg / (metres * metres)).toFixed(2));
  }
  next();
});

vitalsSchema.index({ user: 1, recordedAt: -1 });

/* ------------------------------------------------------------------ */
/* ClinicalRecord                                                     */
/* ------------------------------------------------------------------ */
const biomarkerSchema = new Schema(
  {
    name: { type: String, required: true },
    value: { type: Number, required: true },
    unit: String,
    // Added uppercase and capitalized variants to match Python's output
    status: { 
      type: String, 
      enum: ['low', 'normal', 'high', 'LOW', 'HIGH', 'CRITICAL LOW', 'CRITICAL HIGH', 'Low', 'High', 'Normal'] 
    },
    referenceRange: String,
    suspect: { type: Boolean, default: false },
  },
  { _id: false }
);

const clinicalRecordSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vitals: { type: Schema.Types.ObjectId, ref: 'Vitals', required: true },

    report: {
      originalName: String,
      mimeType: String,
      sizeBytes: Number,
      checksum: { type: String, index: true },
      storageKey: String,
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