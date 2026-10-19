/**
 * middleware/auth.js
 * ------------------
 * JWT verification and the multer configuration used by the upload route.
 *
 * Files are held in memory (multer.memoryStorage) and streamed straight to the
 * FastAPI service. Nothing touches the server's disk. For patient reports that
 * is the right default: no temp file to forget to delete, no stale PHI sitting
 * in /tmp. The trade-off is memory pressure, which the 10 MB cap bounds.
 */

const jwt = require('jsonwebtoken');
const multer = require('multer');
const { User } = require('../models');

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'application/pdf',
]);

/** Verify the bearer token and attach the user document to req.user. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Sign in to continue.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'This account no longer exists.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Your session expired. Sign in again.' : 'Invalid session.',
    });
  }
}

/** Block uploads from accounts that have not granted data-processing consent. */
function requireConsent(req, res, next) {
  if (!req.user?.consent?.dataProcessing) {
    return res.status(403).json({
      error: 'Grant consent to process your health data before uploading a report.',
    });
  }
  return next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Upload a PNG, JPEG or PDF.`));
    }
    return cb(null, true);
  },
});

module.exports = { requireAuth, requireConsent, upload };