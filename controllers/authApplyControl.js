const Application = require('../models/applyuser');
const transporter = require('../utils/emailConfig');
const myEmail = 'tbsolutions9@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';


const submitApplication = async (req, res) => {
    try {
        const {
            first,
            last,
            email,
            phone,
            message
        } = req.body;

        // Extract filenames from req.files
        const resumeFilename = req.files['resume'][0].filename;
        let coverFilename;

        if (req.files['cover']) {
            coverFilename = req.files['cover'][0].filename;
        }

        // Check if the email is valid
        const isValidEmail = /\S+@\S+\.\S+/.test(email);
        if (!isValidEmail) {
            return res.status(400).json({
                error: "Invalid email address"
            });
        }

        // Create a new application entry
        const newApp = await Application.create({
            first,
            last,
            email,
            phone,
            message,
            resume: resumeFilename,
            cover: coverFilename
        });

        // Prepare attachments for email
        const attachments = [{
            filename: resumeFilename,
            path: `./files/${resumeFilename}`
        }];

        if (coverFilename) {
            attachments.push({
                filename: coverFilename,
                path: `./files/${coverFilename}`
            });
        }

        // Contact details for William L Rowell Traffic and Barrier Solutions, LLC
        const contactInfo = `
            <p>Contact Information:</p>
            <p>William L Rowell</p>
            <p>Traffic and Barrier Solutions. LLC</p>
            <p>723 N Wall Street</p>
            <p>Calhoun, GA 30701</p>
            <p>Cell: 706-879-0106</p>
            <p>Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
        `;

        // Send notification email with attachments and contact details
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
            ],
            subject: 'JOB APPLICATION REQUEST',
            html: `
            <!DOCTYPE html>
            <html lang="en">
                    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #e7e7e7;">
                <form style="background-color: #e7e7e7; flex-direction: column; align-items: center; justify-content: center;" action="#" method="post">
                    <header style="background-color: #efad76;">
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
                    >JOB APPLICATION REQUEST</h2>
                            <div style="margin-bottom: 15px;">
                        <h1 style="margin-top: 10px;
                                    font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Dear ${first},</h1>
                        <h1 style="margin-top: 5px;
                            font-family: 'Moveo Sans w00 Regular', Arial, Helvetica, sans-serif;"
                            >Your Job Application submission has been received successfully! We will be with you within 48 hours!</h1>
                        
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
                        ">At TBS, we greatly value your commitment to safety and efficiency on our roadways. We wanted to inform you that your Job Application has been successfully submitted. Thank you for taking proactive steps to ensure smooth traffic flow and the safety of all involved.
                        Our team will now review your resume. If any further information or revisions are needed, we will promptly reach out to you.
                        We appreciate your interest in TBS and look forward to working together to maintain a safe and organized environment.
                        </h1>
                        <h1 style="margin-top: 20px;
                        color: #ff0000;
                                font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                                line-height: 26px;">
                                    WARNING:</h1>
                                    <h1 style="
                                    color: #000000;
                                font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                                line-height: 26px;">
                                    You will not be able to submit again! Once your email and phone number have been submitted,
                                    you won't be able to submit using this email and phone number again!</h1>
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
                            >Traffic and Barrier Solutions, LLC</h1>
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
                        ${contactInfo}
            </html>`
                
            ,
            attachments
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email notification:', error);
            } else {
                console.log('Email notification sent:', info.response);
            }
        });
        
        return res.json(newApp);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                error: "Duplicate email or phone",
                message: "Application has already been submitted with this email, phone number, resume, or cover letter. If you recently worked for TBS, please call 706-263-0175. If you're new and have submitted before, please wait until we review your application."
            });
        }

        console.log(error);
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};

module.exports = {
    submitApplication
};
