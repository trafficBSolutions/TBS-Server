// middleware/authJwt.js
const jwt = require('jsonwebtoken');

module.exports = function authJwt(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize email from common places; force lowercase/trim
    const email =
      (payload.email ||
       payload.user?.email ||
       payload.preferred_username ||
       '').toString().trim().toLowerCase();

    req.user = { ...payload, email };
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
