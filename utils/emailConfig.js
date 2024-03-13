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
        user: 'tbsolutions9@gmail.com',
        pass: 'mbkf hftd sorz xvbo'
    },
    tls: {
        rejectUnauthorized: true
    }
});

module.exports = transporter;