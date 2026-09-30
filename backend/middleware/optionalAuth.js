const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'looped_secret_2024';

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    req.userId = null;
    next();
  }
};
