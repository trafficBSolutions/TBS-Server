// routes/employeeAuth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');

// optional: rate limit your login route
// const rateLimit = require('express-rate-limit');
// router.use('/login', rateLimit({ windowMs: 15*60*1000, max: 50 }));

// Register (optional seed route — protect/remove in prod)
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Missing fields' });
    }
    const existing = await Employee.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 12);
    const emp = await Employee.create({ firstName, lastName, email, passwordHash, role: 'employee' });
    return res.json({ message: 'Employee registered', id: emp._id });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});
// routes/employeeAuth.js
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const emp = await Employee.findOne({ email, active: true });
    if (!emp) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, emp.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const payload = { id: emp._id, email: emp.email, role: 'employee', name: `${emp.firstName} ${emp.lastName}` };
    console.log('Creating JWT with payload:', payload);
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    
    // Verify the token was created correctly
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('JWT verification after creation:', decoded);

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('empToken', token, {
      httpOnly: true,
      secure: false, // Allow HTTP for local development
      sameSite: 'Lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
      domain: isProd ? '.trafficbarriersolutions.com' : undefined, // No domain restriction for dev
    });

    return res.json({
      message: 'Logged in',
      user: { email: emp.email, name: `${emp.firstName} ${emp.lastName}`, role: 'employee' },
      ...(isProd ? {} : { token })
    });
  } catch (e) {
    console.error('Employee login error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});
// routes/employeeAuth.js
router.post('/logout', (req, res) => {
  res.clearCookie('empToken', { path: '/' });
  res.clearCookie('token', { path: '/' }); // legacy/admin
  return res.json({ message: 'Logged out' });
});


router.get('/me', (req, res) => {
  try {
    const raw = req.cookies?.empToken || req.cookies?.token;
    if (!raw) return res.status(200).json({ authenticated: false });
    const payload = jwt.verify(raw, process.env.JWT_SECRET);
    return res.json({ authenticated: true, user: { email: payload.email, role: payload.role, name: payload.name }});
  } catch { return res.status(200).json({ authenticated: false }); }
});

router.put('/change-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body || {};
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const emp = await Employee.findOne({ email: email.toLowerCase() });
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    emp.passwordHash = await bcrypt.hash(newPassword, 12);
    await emp.save();
    return res.json({ message: 'Password updated successfully' });
  } catch (e) {
    console.error('Change password error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
