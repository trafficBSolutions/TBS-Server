
const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const billingRouter = require('./routes/billing');
const cron = require('node-cron');
const { runInterestReminderCycle } = require('./services/interestBot');
const workOrdersRouter = require('./routes/autoOrderRoute');
const employeeAuth = require('./routes/employeeAuth');
// Create Express app
const app = express();

// ✅ Middleware
app.use(helmet()); // Secure headers
app.use(xss()); // Prevent XSS
app.use(compression()); // GZIP compression
cron.schedule('15 9 * * *', () => runInterestReminderCycle(), {
  timezone: 'America/New_York'
});
// Limit repeated requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // 100 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// server.js / app.js
const cookieParser = require('cookie-parser');
 app.use(express.json());                    // JSON should be before routes
 app.use(cookieParser());
 app.use(cors({
 origin: ['http://localhost:5173','http://127.0.0.1:5173','https://www.trafficbarriersolutions.com'],
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

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
app.use(require('./routes/invoiceRoute'));
app.use(require('./routes/payCard'));  // if using Stripe
app.use('/employee', employeeAuth);
// ✅ Static file routes
app.use('/forms', express.static(path.join(__dirname, 'forms')));
app.use('/resumes', express.static(path.join(__dirname, 'resumes')));
app.use('/public', express.static(path.join(__dirname, 'public')));
// server.js or app.js

// ✅ Job cleaner utility (MongoDB cleanup job)
require('./utils/cleanJob');
app.use('/api/billing', billingRouter);
// ✅ Start server

app.use('/', workOrdersRouter);
const PORT = process.env.PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
