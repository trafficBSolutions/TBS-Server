const nodemailer = require('nodemailer');

/*
Go to the settings for your Google Account in the application or device you are trying to set up. 
Replace your password with the 16-character password shown above.
Just like your normal password, this app password grants complete access to your Google Account. 
You won't need to remember it, so don't write it down or share it with anyone.
*/

const transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: true
    }
});

const transporter2 = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER_2,
        pass: process.env.EMAIL_PASS_2
    },
    tls: {
        rejectUnauthorized: true
    }
});

const transporter3 = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER_3,
        pass: process.env.EMAIL_PASS_3
    },
    tls: {
        rejectUnauthorized: true
    }
});

const transporter4 = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER_4,
        pass: process.env.EMAIL_PASS_4
    },
    tls: {
        rejectUnauthorized: true
    }
});
const transporter5 = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER_5,
        pass: process.env.EMAIL_PASS_5
    },
    tls: {
        rejectUnauthorized: true
    }
});
const transporter6 = nodemailer.createTransport({
    service: 'gmail',
    secure: true,
    logger: true,
    debug: true,
    secureConnection: false,
    auth: {
        user: process.env.EMAIL_USER_6,
        pass: process.env.EMAIL_PASS_6
    },
    tls: {
        rejectUnauthorized: true
    }
});
module.exports = 
    transporter,
    transporter2,
    transporter3,
    transporter4,
    transporter5,
    transporter6;
