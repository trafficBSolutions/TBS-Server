const ContactUser = require('../models/contactuser');
const transporter = require('../utils/emailConfig');
const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const submitContact = async (req, res) => {
    try {
        const { first, last, company, email, phone, message, token } = req.body;

        // Log request body to debug missing fields
        console.log(req.body);

if (!token) {
    return res.status(400).json({ error: 'reCAPTCHA token is missing.' });
}

// ✅ Verify reCAPTCHA with Google
const secretKey = process.env.RECAPTCHA_SECRET_KEY; // <-- store your secret key in .env
const verifyUrl = `https://www.google.com/recaptcha/api/siteverify`;

const { data } = await axios.post(verifyUrl, null, {
    params: {
        secret: secretKey,
        response: token
    }
});

if (!data.success || data.score < 0.4) {
    return res.status(400).json({ error: 'Failed reCAPTCHA verification.' });
}

// Required field check
if (!first || !last || !company || !email || !phone || !message) {
    return res.status(400).json({ error: "All fields are required" });
}

        // Create user record
        const newUser = await ContactUser.create({
            first,
            last,
            company,
            email,
            phone,
            message
        });
       

        // Compose email options
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions LLC', address: myEmail },
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
                { name: 'Jonkell Tolbert', address: foreemail }
            ],
            subject: `TBS CONTACT MESSAGE FROM ${first} ${last}`,
            html: `
           <!DOCTYPE html>
            <html lang="en">
                    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #e7e7e7;">
                <form style="background-color: #e7e7e7; flex-direction: column; align-items: center; justify-content: center;" action="#" method="post">
                    <header style="background-color: #efad76">
                    <h2 style="margin-top: 20px;
                    font-size: 50px;
                    text-align: center;
                    font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                    color:#000000;"
                    >TRAFFIC & BARRIER SOLUTIONS, LLC</h2>
                    </header>
                   
                    <h2 style="margin-top: 20px;
                    font-size: 47px;
                    text-align: center;
                    font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                    color:#000000;"
                    >MESSAGE FROM THE CONTACT FORM</h2>
                            <div style="margin-bottom: 15px;">
                        <h1 style="margin-top: 10px;
                                    font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Dear ${first},</h1>
                        <h1 style="margin-top: 5px;
                            font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Your message has been received successfully! We will be with you as soon as possible!</h1>
                        
                        <h1 style="
                        color:#000000;
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 40px;
                        font-size: 60px;
                        ">Contact Info:</h1>
        
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">First Name: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${first}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Last Name: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${last}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Company: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${company}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Email: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${email}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Phone: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${phone}</p></p>
        
                        <p style="
                        color:#000000;
                        font-family: 'Kairos W04 Extended Bold';
                        font-style: normal;
                        margin-top: 40px;
                        font-size: 60px;
                        ">Message:</p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        "> <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${message}</p></p>
                        <h1 style="
                        margin-top: 80px;
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        line-height: 26px;
                        ">At TBS, we greatly value your concern and are committed to providing you with the best possible service. We understand that your time is valuable, 
                        and we strive to respond to all inquiries promptly and efficiently.
                        </h1>
                        <h1 style="margin-top: 20px;
                                font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                                line-height: 26px;">
                                    Best Regards,</h1>
                        <h1 style="
                        font-size: 30px;
                        margin-top: 20px;
                        font-family: 'Kairos W04 Extended Bold, Arial, Helvetica, sans-serif;
                        line-height: 30px;
                        ">Bryson Davis: 706-263-0175</h1>
                        <div style="padding-top: 10px;">
                            <h3 style="
                            font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                            font-style: normal;
                            margin-top: 20px;
                            font-size: 40px;
                            color:#000000;
                            ">Contact Information:</h3>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Bryson C Davis</h1>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Traffic and Barrier Solutions, LLC/Material WorX</h1>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >723 N Wall Street</h1>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Calhoun, GA 30701</h1>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Cell: 706-263-0175</h1>
                            <h1 style= "font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;">Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></h1>
                        </div>
                        </div>
                        </form>
                        </body>
            </html>`,
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });

        const response = {
            message: 'Message submitted successfully',
            newUser: newUser // Include the newUser object in the response
        };

        res.status(201).json(response);

    } catch (error) {
        console.error('Error submitting Message:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
module.exports = {
    submitContact
};

