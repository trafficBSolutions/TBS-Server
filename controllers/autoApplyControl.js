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
    <div style="background-color: #efad76; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 32px;">TRAFFIC & BARRIER SOLUTIONS, LLC</h1>
    </div>

    <div style="padding: 20px;">
      <h2 style="font-size: 26px; text-align: center;">✅ JOB APPLICATION RECEIVED</h2>
      <p style="font-size: 16px;">Dear ${first},</p>
      <p style="font-size: 16px;">Thank you for submitting your application. Our team will review your submission and reach out if needed.</p>

      <h3 style="margin-top: 20px; font-size: 20px;">Contact Info:</h3>
      <p><strong>First Name:</strong> ${first}</p>
      <p><strong>Last Name:</strong> ${last}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>

      <h3 style="margin-top: 20px; font-size: 20px;">Position & Skills</h3>
      <p><strong>Position:</strong> ${position}</p>
      <p><strong>Languages:</strong> ${languages}</p>
      <p><strong>Skills:</strong> ${skills}</p>

      <h3 style="margin-top: 20px; font-size: 20px;">Education History</h3>
      ${educationHtml}

      <h3 style="margin-top: 20px; font-size: 20px;">Background History</h3>
      ${backgroundHtml}

      <h3 style="margin-top: 20px; font-size: 20px;">Employment History</h3>
      ${employmentHtml}

      <h3 style="margin-top: 20px; font-size: 20px;">Message</h3>
      <p>${message}</p>

      <h3 style="margin-top: 20px; font-size: 20px; color: red;">⚠️ WARNING</h3>
      <p style="font-size: 16px;">You will not be able to submit again using the same email or phone number.</p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #aaa;">

      <h3 style="font-size: 20px;">Contact Information</h3>
      <p style="font-size: 16px;"><strong>Carson Speer</strong><br>
      Traffic and Barrier Solutions, LLC<br>
      1995 Dews Pond Rd SE<br>
      Calhoun, GA 30701<br>
      Cell: 706-581-4465<br>
      Website: <a href="http://www.trafficbarriersolutions.com">trafficbarriersolutions.com</a></p>
    </div>
  </body>
</html>
`,
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
