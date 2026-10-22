const jwt = require('jsonwebtoken');
const { User } = require('../models');

const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract the token from the Authorization header (e.g., "Bearer eyJhb...")
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify the token using the secret in your .env file
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find the user in the database
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    // 4. Attach the user object to the request for downstream routes to use
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = {
  requireAuth
};