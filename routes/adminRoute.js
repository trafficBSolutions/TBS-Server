const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register Admin
const bcrypt = require('bcryptjs');

router.post('/admin/register', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const exists = await Admin.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Admin already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt); // ✅ Hash it

    const newAdmin = new Admin({
      firstName,
      lastName,
      email,
      password: hashedPassword // ✅ Save hashed
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

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ token, email: admin.email, firstName: admin.firstName });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
