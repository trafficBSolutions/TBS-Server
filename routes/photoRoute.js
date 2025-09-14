const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Serve work order photos
router.get('/workorder-photos/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const photoPath = path.join(__dirname, '..', 'uploads', 'workorder-photos', filename);
    
    if (!fs.existsSync(photoPath)) {
      return res.status(404).send('Photo not found');
    }
    
    res.sendFile(photoPath);
  } catch (error) {
    console.error('Error serving photo:', error);
    res.status(500).send('Error serving photo');
  }
});

module.exports = router;
