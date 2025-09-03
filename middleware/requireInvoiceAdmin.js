// server/middleware/requireInvoiceAdmin.js
const allowed = new Set([
  'tbsolutions9@gmail.com',
  'tbsolutions1999@gmail.com',
  'trafficandbarriersolutions.ap@gmail.com',
]);

module.exports = function requireInvoiceAdmin(req, res, next) {
  const email = (req.user?.email || '').toLowerCase();
  if (!allowed.has(email)) {
    return res.status(403).json({ message: 'Forbidden: invoice admins only.' });
  }
  next();
};

