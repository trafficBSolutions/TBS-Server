const Apply = require("../models/newapply");
const transporter4 = require("../utils/emailConfig");
const myEmail = "tbsolutions9@gmail.com";

const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';
const foreemail = 'tbsolutions55@gmail.com';
const formanmail = 'tbsolutions77@gmail.com';
const damienemail = 'tbsolutions14@gmail.com';

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
    <p><strong>School:</strong> ${edu.school}<br>
    <strong>Start:</strong> ${edu.startMonth} ${edu.startYear}<br>
    <strong>End:</strong> ${edu.endMonth} ${edu.endYear}</p>
  `).join("")
  : `<p>No education history provided.</p>`;

  const backgroundHtml = formattedBackground.length
  ? formattedBackground.map(conviction => `
    <p><strong>Charge Type:</strong> ${conviction.type}<br>
    <strong>Charge:</strong> ${conviction.charge}<br>
    <strong>Date:</strong> ${conviction.date}<br>
    <strong>Explanation:</strong> ${conviction.explanation}</p>
  `).join("")
  : `<p>Applicant has a clean background.</p>`;

  
  const employmentHtml = formattedWorkHistory.length
  ? formattedWorkHistory.map(job => `
    <p><strong>Employer:</strong> ${job.employerName}<br>
    <strong>Address:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}<br>
    <strong>Phone:</strong> ${job.phone}<br>
    <strong>Job Duties:</strong> ${job.duties}<br>
    <strong>Currently Employed:</strong> ${job.currentlyEmployed ? "Yes" : "No"}<br>
    ${job.reasonForLeaving ? `<strong>Reason for Leaving:</strong> ${job.reasonForLeaving}<br>` : ""}
    <strong>May We Contact?:</strong> ${job.mayContact}</p>
  `).join("")
  : `<p>No employment history provided.</p>`;
        // Contact details for Carson Speer Traffic and Barrier Solutions, LLC
        const contactInfo = `
            <p>Traffic Control Manager:</p>
            <p>Carson Speer</p>
            <p>Traffic & Barrier Solutions, LLC</p>
            <p>1995 Dews Pond Rd SE</p>
            <p>Calhoun, GA 30701</p>
            <p>Cell: (706) 581-4465</p>
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
                { name: 'Jonkell Tolbert', address: foreemail },
                { name: 'Salvador Gonzalez', address: foremanmail },
                { name: 'Damien Diskey', address: damienemail}
            ],
            subject: 'JOB APPLICATION REQUEST',
         html: `
<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7;">
    <div style="max-width: 800px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
      <header style="background-color: #efad76; padding: 15px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Traffic & Barrier Solutions, LLC</h1>
        <h2 style="margin-top: 5px; font-size: 22px;">Job Application Received</h2>
      </header>

      <p>Dear ${first},</p>
      <p>Thank you for applying for the <strong>${position}</strong> position. We have received your application and will review it shortly.</p>

      <h3>Applicant Details</h3>
      <p><strong>Name:</strong> ${first} ${last}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Languages:</strong> ${languages}</p>
      <p><strong>Skills:</strong> ${skills}</p>

      <h3>Education History</h3>
      ${formattedEducation.length ? formattedEducation.map(edu => `
        <p><strong>School:</strong> ${edu.school}</p>
        <p><strong>Start:</strong> ${edu.startMonth} ${edu.startYear} | <strong>End:</strong> ${edu.endMonth} ${edu.endYear}</p>
        <hr style="border: 0; border-top: 1px solid #ccc;">
      `).join('') : '<p>No education history provided.</p>'}

      <h3>Background History</h3>
      ${formattedBackground.length ? formattedBackground.map(bg => `
        <p><strong>Charge Type:</strong> ${bg.type}</p>
        <p><strong>Charge:</strong> ${bg.charge}</p>
        <p><strong>Date:</strong> ${bg.date}</p>
        <p><strong>Explanation:</strong> ${bg.explanation}</p>
        <hr style="border: 0; border-top: 1px solid #ccc;">
      `).join('') : '<p>Applicant has a clean background.</p>'}

      <h3>Employment History</h3>
      ${formattedWorkHistory.length ? formattedWorkHistory.map(job => `
        <p><strong>Employer:</strong> ${job.employerName}</p>
        <p><strong>Address:</strong> ${job.address}, ${job.city}, ${job.state} ${job.zip}</p>
        <p><strong>Phone:</strong> ${job.phone}</p>
        <p><strong>Job Duties:</strong> ${job.duties}</p>
        <p><strong>Currently Employed:</strong> ${job.currentlyEmployed ? 'Yes' : 'No'}</p>
        ${job.reasonForLeaving ? `<p><strong>Reason for Leaving:</strong> ${job.reasonForLeaving}</p>` : ''}
        <p><strong>May We Contact:</strong> ${job.mayContact}</p>
        <hr style="border: 0; border-top: 1px solid #ccc;">
      `).join('') : '<p>No work history provided.</p>'}

      <h3>Message</h3>
      <p>${message}</p>

      <h4 style="margin-top: 30px; color: red;">⚠️ Warning:</h4>
      <p>You cannot re-apply using the same email and phone number. Please contact us at (706) 263-0175 for updates.</p>

      <p style="margin-top: 30px;">Best regards,</p>
      ${contactInfo}
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
