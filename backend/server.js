/**
 * server.js
 * ---------
 * Express entry point. Start with: npm run dev
 *
 * Responsibilities kept here rather than in a route file:
 *   - database connection and its failure behaviour
 *   - security middleware (helmet, CORS allow-list, rate limiting)
 *   - authentication endpoints
 *   - one central error handler, so no route leaks a stack trace
 */

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const { User } = require('./models');
const { requireAuth } = require('./middleware/auth');
const analysisRoutes = require('./routes/analysis');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
  })
);

// Uploads are expensive (OCR + three models), so they get a tighter budget
// than ordinary reads.
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

/* ---------------------------- auth ---------------------------------- */
app.post('/api/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { fullName, email, password, gender, dateOfBirth, consent } = req.body;
    if (!fullName || !email || !password || !gender) {
      return res.status(400).json({ error: 'Name, email, password and gender are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Use a password of at least 8 characters.' });
    }
    if (await User.exists({ email: String(email).toLowerCase() })) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const user = new User({
      fullName,
      email,
      gender,
      dateOfBirth,
      consent: consent ? { dataProcessing: true, grantedAt: new Date() } : undefined,
    });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() }).select(
      '+passwordHash'
    );
    // Same message for both failure modes, so the endpoint cannot be used to
    // enumerate which emails have accounts.
    if (!user || !(await user.verifyPassword(password || ''))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    user.lastLoginAt = new Date();
    await user.save();
    return res.json({ token: signToken(user), user });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

/* --------------------------- analysis ------------------------------- */
app.use('/api/analysis', uploadLimiter, analysisRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'down' })
);

/* ------------------------- error handling --------------------------- */
app.use((_req, res) => res.status(404).json({ error: 'That endpoint does not exist.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'That file is larger than 10 MB. Compress it or upload a single page.'
        : 'The file could not be read.';
    return res.status(400).json({ error: message });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: Object.values(err.errors).map((e) => e.message).join(' '),
    });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
});

/* ----------------------------- boot --------------------------------- */
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    // Starting without a database would mean every upload fails after the
    // expensive ML call, so refuse to start at all.
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app; // exported for supertest