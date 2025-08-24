
const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const path = require('path');

// Create Express app
const app = express();

// ✅ Middleware
app.use(helmet()); // Secure headers
app.use(xss()); // Prevent XSS
app.use(compression()); // GZIP compression

// Limit repeated requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // 100 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Enable CORS
app.use(cors({
  credentials: true,
  origin: ['https://www.trafficbarriersolutions.com', 'http://localhost:5173']
}));

app.use(express.json()); // JSON parsing

// ✅ Database connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ Database Connected');
    // Optional: call a post-connection function here (e.g., cleanup)
  })
  .catch((err) => console.error('❌ Database Not Connected', err));

// ✅ Routes
app.use('/', require('./routes/autoBollardRoute'))
app.use('/', require('./routes/autoPPERoute'))
app.use('/', require('./routes/autoSignRoute'));
app.use('/', require('./routes/autoControlRoute'));
app.use('/', require('./routes/autoPlanRoute'));
app.use('/', require('./routes/autoApplyNew'));
app.use('/', require('./routes/autoRentalRoute'));
app.use('/', require('./routes/autoContactRoute'));
app.use('/', require('./routes/adminRoute'));

// ✅ Static file routes
app.use('/forms', express.static(path.join(__dirname, 'forms')));
app.use('/resumes', express.static(path.join(__dirname, 'resumes')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ✅ Job cleaner utility (MongoDB cleanup job)
require('./utils/cleanJob');

// ✅ Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
