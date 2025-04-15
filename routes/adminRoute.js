const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);
router.post('/admin/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Admin already exists' });
    async function hashPassword(password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      console.log('Hashed password:', hash);
    }
    
    hashPassword('your-new-password');

    const newAdmin = new Admin({
      firstName,
      lastName,
      email,
      password
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login Admin
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'];

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const sessionToken = uuid.v4(); // unique per login
    const jwtToken = jwt.sign({ id: admin._id, sessionToken }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Save the session
    admin.sessions.push({ token: sessionToken, userAgent });
    await admin.save();

    res.status(200).json({ token: jwtToken, email: admin.email, firstName: admin.firstName });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/admin/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    admin.password = hashedPassword;
    await admin.save();
    
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post('/admin/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    // Remove the specific session
    admin.sessions = admin.sessions.filter(s => s.token !== decoded.sessionToken);
    await admin.save();

    res.status(200).json({ message: 'Logged out from this device' });
  } catch (err) {
    res.status(500).json({ message: 'Error during logout' });
  }
});
module.exports = router;
