const express = require('express');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');

// Create Express app
const app = express();

// Database connection
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('Database Connected');
        // Call removeDuplicates function after database connection
        
    })
    .catch((err) => console.log('Database Not Connected', err));

// Middleware
app.use(express.json());


// Routes
app.use('/', require('./routes/autoBollardRoute'))
app.use('/', require('./routes/autoPPERoute'))
app.use('/', require('./routes/autoSignRoute'));
app.use('/', require('./routes/autoControlRoute'));
app.use('/', require('./routes/autoPlanRoute'));
app.use('/', require('./routes/autoApplyNew'));
app.use('/', require('./routes/autoRentalRoute'));
app.use('/', require('./routes/autoContactRoute'));
app.use('/', require('./routes/adminRoute'));
app.use('/', require('./routes/autoControlRouteTest'));
require('./utils/cleanJob'); 
const path = require('path');
app.use('/forms', express.static(path.join(__dirname, 'forms')));
app.use('/resumes', express.static(path.join(__dirname, 'resumes')));
app.use('/public', express.static(path.join(__dirname, 'public')));
// Define port
const port = process.env.PORT || 8000;

// Start server
app.listen(port, '0.0.0.0', () => console.log(`Server is running on port ${port}`));
