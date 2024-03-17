const express = require('express');
const router = express.Router();
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const { submitApplication } = require('../controllers/authApplyControl');
const fs = require('fs'); // Import the 'fs' module for file system operations

// Middleware
router.use(
    cors({
        credentials: true,
        origin: 'https://www.trafficbarriersolutions.com'
    })
);

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dest = './files';
        // Check if the directory exists, if not, create it
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true }); // recursive: true creates parent directories if they don't exist
        }
        console.log('Saving to:', dest); 
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        // Get the current date and time
        const currentDate = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, ''); // Remove milliseconds and replace colons with dashes
        // Get the original file extension
        const fileExtension = file.originalname.split('.').pop();
        // Generate a unique filename
        const uniqueFilename = `${currentDate}_${Math.floor(Math.random() * 10000)}.${fileExtension}`;
        console.log('Generated filename:', uniqueFilename);
        cb(null, uniqueFilename);
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 25, // 5MB file size limit
    },
}).fields([
    { name: 'resume', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]);

// Use bodyParser to parse URL-encoded and JSON data
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

// Define routes under /apply path
router.post('/applynow', upload, submitApplication);
    

module.exports = router;
