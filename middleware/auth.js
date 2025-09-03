// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const bearer = req.headers.authorization || '';
    const headerToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : null;
    const cookieToken = req.cookies?.token;
    const token = headerToken || cookieToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // must include `email` for requireInvoiceAdmin
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
