const Apply = require("../models/newapply");
const transporter4 = require("../utils/emailConfig");
const myEmail = "tbsolutions9@gmail.com";

const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';

const fs = require("fs");
const PDFDocument = require("pdfkit");
const path = require("path");
const submitApply = async (req, res) => {
  console.log("Request Body:", req.body);
    console.log("Uploaded Files:", req.files);
  try {
    const {
      first,
      last,
      email,
      phone,
      position,
      languages,
      skills,
      message,
      education,  
      background,  
      workHistory  
    } = req.body;

    // ✅ Corrected file handling
// Ensure req.files exists and contains uploaded files
const resumeFilename = req.files && req.files["resume"] ? req.files["resume"][0].filename : null;
const coverFilename = req.files && req.files["cover"] ? req.files["cover"][0].filename : null;

// Debugging: Log uploaded files to verify
console.log("Uploaded Files:", req.files);
console.log("Resume File:", resumeFilename);
console.log("Cover File:", coverFilename);


    // ✅ Validate required fields
    if (!first || !last || !email || !phone || !position || !languages || !skills || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Ensure the resume is uploaded
    if (!resumeFilename) {
      return res.status(400).json({ error: "Resume file is required." });
    }

    // ✅ Validate email format
    const isValidEmail = /\S+@\S+\.\S+/.test(email);
    if (!isValidEmail) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    let formattedEducation = [];
    let formattedBackground = [];
    let formattedWorkHistory = [];
    
    try {
        formattedEducation = typeof education === "string" ? JSON.parse(education) : Array.isArray(education) ? education : [];
        formattedBackground = typeof background === "string" ? JSON.parse(background) : Array.isArray(background) ? background : [];
        formattedWorkHistory = typeof workHistory === "string" ? JSON.parse(workHistory) : Array.isArray(workHistory) ? workHistory : [];
    } catch (error) {
        console.error("Error parsing JSON data:", error);
        return res.status(400).json({ error: "Invalid JSON format in form data" });
    }
    
    // ✅ Ensure these fields are actually arrays
    if (!Array.isArray(formattedEducation) || !Array.isArray(formattedBackground) || !Array.isArray(formattedWorkHistory)) {
      return res.status(400).json({ error: "Education, Background, and Work History must be arrays." });
    }
    
    // ✅ Create a new application entry
    const newApp = await Apply.create({
      first,
      last,
      email,
      phone,
      education: formattedEducation,
      position,
      background: formattedBackground,
      languages,
      skills,
      workHistory: formattedWorkHistory,
      resume: resumeFilename,
      cover: coverFilename,
      message
    });
            // ✅ Generate PDF
            const pdfFilename = `${first}_${last}_JobApplication.pdf`.replace(/\s+/g, "_");
            const pdfPath = path.join(__dirname, `../files/${pdfFilename}`);
    
            await generatePDF({
                first, last, email, phone, position, languages, skills, message,
                education: formattedEducation,
                background: formattedBackground,
                workHistory: formattedWorkHistory
            }, pdfPath);
    // ✅ Prepare email attachments
    const attachments = [];
    if (resumeFilename) {
      attachments.push({ filename: resumeFilename, path: `./files/${resumeFilename}` });
    }
    if (coverFilename) {
      attachments.push({ filename: coverFilename, path: `./files/${coverFilename}` });
    }
// Attach the generated PDF
attachments.push({ filename: pdfFilename, path: pdfPath });
    const educationHtml = formattedEducation.length
    ? formattedEducation.map(edu => `
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>School:</b> ${edu.school}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Start:</b> ${edu.startMonth} ${edu.startYear}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>End:</b> ${edu.endMonth} ${edu.endYear}</p><br>
    `).join("")
    : `<p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      ">No education history provided.</p>`;
  
  const backgroundHtml = formattedBackground.length
    ? formattedBackground.map(conviction => `
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Charge Type:</b> ${conviction.type}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Charge:</b> ${conviction.charge}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Date:</b> ${conviction.date}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Explanation:</b> ${conviction.explanation}</p><br>
    `).join("")
    : `<p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      ">Applicant has clean background.</p>`;
  
  const employmentHtml = formattedWorkHistory.length
    ? formattedWorkHistory.map(job => `
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Employer:</b> ${job.employerName}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Address:</b> ${job.address}, ${job.city}, ${job.state}, ${job.zip}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Phone:</b> ${job.phone}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Job Duties:</b> ${job.duties}</p>
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Currently Employed:</b> ${job.currentlyEmployed ? "Yes" : "No"}</p>
      ${job.reasonForLeaving ? `<p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>Reason for Leaving:</b> ${job.reasonForLeaving}</p>` : ""}
      <p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      "><b>May We Contact?:</b> ${job.mayContact}</p><br>
    `).join("")
    : `<p style="
      font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
      font-style: normal;
      margin-top: 20px;
      font-size: 40px;
      "> <p style="
      margin-top: 10px;
      font-size: 30px;
      font-family: Arial, Helvetica, sans-serif;
      ">Applicant didn't add employment history.</p>`;


        // Contact details for Carson Speer Traffic and Barrier Solutions, LLC
        const contactInfo = `
            <p>Traffic Control Manager:</p>
            <p>Carson Speer</p>
            <p>Traffic and Barrier Solutions. LLC</p>
            <p>723 N Wall Street</p>
            <p>Calhoun, GA 30701</p>
            <p>Cell: 706-581-4465</p>
            <p>Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
        `;
        
        // Send notification email with attachments and contact details
        const mailOptions = {
            from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
            to: email,
            bcc: [
                { name: 'Traffic & Barrier Solutions, LLC', address: myEmail },
              
                { name: 'Carson Speer', address: userEmail }, // Add the second Gmail address to BCC
                { name: 'Bryson Davis', address: mainEmail },
                { name: 'Jonkell Tolbert', address: foreemail }
                
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
                            >Your Job Application submission has been received successfully! We will be with you as soon as possible!</h1>
                        
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
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Education History: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${educationHtml}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Position: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${position}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Background History: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${backgroundHtml}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Language: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${languages}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Skills: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${skills}</p></p>
                        <p style="
                        font-family: 'Kairos W04 Extended Bold', Arial, Helvetica, sans-serif;
                        font-style: normal;
                        margin-top: 20px;
                        font-size: 40px;
                        ">Employment History: <p style="
                        margin-top: 10px;
                        font-size: 30px;
                        font-family: Arial, Helvetica, sans-serif;
                        ">${employmentHtml}</p></p>
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

    transporter4.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email notification:", error);
      } else {
        console.log("Email notification sent:", info.response);
      }
    });

    return res.json(newApp);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: "Duplicate email or phone",
        message: `Application has already been submitted with this email and/or phone number. Please call (706) 263-0175 if you're a former TBS employee requesting for your job back. Otherwise, please wait until we review your application.`
      });
    }

    console.log(error);
    return res.status(500).json({ error: "Internal Server Error! Please report any submission errors to William Rowell: (706) 879-0106 to fix the issue on your application." });
  }
};
// ✅ Function to generate PDF
const generatePDF = (data, filePath) => {
  return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).text("Job Application Form", { align: "center" }).moveDown(2);
      doc.fontSize(14).text(`First Name: ${data.first}`);
      doc.text(`Last Name: ${data.last}`);
      doc.text(`Email: ${data.email}`);
      doc.text(`Phone: ${data.phone}`);
      doc.text(`Position: ${data.position}`);
      doc.text(`Languages: ${data.languages}`);
      doc.text(`Skills: ${data.skills}`);
      doc.text(`Message: ${data.message}`).moveDown(2);

      // ✅ Education History
      doc.fontSize(16).text("Education History:", { underline: true }).moveDown(1);
      if (data.education.length) {
          data.education.forEach(edu => {
              doc.fontSize(12).text(`School: ${edu.school}`);
              doc.text(`Start: ${edu.startMonth} ${edu.startYear}`);
              doc.text(`End: ${edu.endMonth} ${edu.endYear}`).moveDown(1);
          });
      } else {
          doc.fontSize(12).text("No education history provided.").moveDown(1);
      }

      // ✅ Employment History
      doc.fontSize(16).text("Employment History:", { underline: true }).moveDown(1);
      if (data.workHistory.length) {
          data.workHistory.forEach(job => {
              doc.fontSize(12).text(`Employer: ${job.employerName}`);
              doc.text(`Address: ${job.address}, ${job.city}, ${job.state}, ${job.zip}`);
              doc.text(`Phone: ${job.phone}`);
              doc.text(`Job Duties: ${job.duties}`);
              doc.text(`Currently Employed: ${job.currentlyEmployed ? "Yes" : "No"}`);
              if (job.reasonForLeaving) doc.text(`Reason for Leaving: ${job.reasonForLeaving}`);
              doc.text(`May We Contact?: ${job.mayContact}`).moveDown(1);
          });
      } else {
          doc.fontSize(12).text("Applicate didn't add employment history.").moveDown(1);
      }

      // ✅ Background History
      doc.fontSize(16).text("Background History:", { underline: true }).moveDown(1);
      if (data.background.length) {
          data.background.forEach(conviction => {
              doc.fontSize(12).text(`Charge Type: ${conviction.type}`);
              doc.text(`Charge: ${conviction.charge}`);
              doc.text(`Date: ${conviction.date}`);
              doc.text(`Explanation: ${conviction.explanation}`).moveDown(1);
          });
      } else {
          doc.fontSize(12).text("Applicant has clean background.").moveDown(1);
      }

      doc.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", (err) => reject(err));
  });
};
module.exports = { submitApply };
