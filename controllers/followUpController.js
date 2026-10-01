const Apply = require("../models/newapply");
const FollowUpSent = require("../models/followUpSent");
const { transporter } = require("../utils/emailConfig");

const dasia = "materialworx2@gmail.com";

/**
 * Sends a one-time follow-up email to all applicants who haven't received one yet.
 * Hit this endpoint once (or on a schedule) to batch-send follow-ups.
 */
const sendFollowUpEmails = async (req, res) => {
  try {
    // Get all applicants
    const allApplicants = await Apply.find({}, "first last email _id");

    // Get emails that have already been sent a follow-up
    const alreadySent = await FollowUpSent.find({}, "email");
    const sentEmails = new Set(alreadySent.map((doc) => doc.email.toLowerCase()));

    // Filter to only applicants who haven't received the follow-up
    const toSend = allApplicants.filter(
      (app) => app.email && !sentEmails.has(app.email.toLowerCase())
    );

    if (toSend.length === 0) {
      return res.json({ message: "All applicants have already received follow-up emails.", sent: 0 });
    }

    let sentCount = 0;
    const errors = [];

    for (const applicant of toSend) {
      const mailOptions = {
        from: "Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>",
        to: applicant.email,
        subject: "Next Steps - Traffic & Barrier Solutions Application",
        html: buildFollowUpHtml(applicant.first, applicant.last),
      };

      try {
        await transporter.sendMail(mailOptions);

        // Record that this applicant was emailed
        await FollowUpSent.create({
          email: applicant.email.toLowerCase(),
          applicantId: applicant._id,
        });

        sentCount++;
        console.log(`✅ Follow-up sent to: ${applicant.email}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${applicant.email}:`, err.message);
        errors.push({ email: applicant.email, error: err.message });
      }
    }

    return res.json({
      message: `Follow-up emails sent successfully.`,
      sent: sentCount,
      failed: errors.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in sendFollowUpEmails:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Builds the follow-up HTML email with the same CSS layout as the application confirmation.
 */
function buildFollowUpHtml(firstName, lastName) {
  const contactInfo = `
    <p style="margin: 0;">Hiring Contact:</p>
    <p style="margin: 0;">Dasia Diskey</p>
    <p style="margin: 0;">Traffic & Barrier Solutions, LLC</p>
    <p style="margin: 0;">723 N Wall St</p>
    <p style="margin: 0;">Calhoun, GA 30701</p>
    <p style="margin: 0;">Email: <a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></p>
    <p style="margin: 0;">Website: <a href="http://www.trafficbarriersolutions.com">www.trafficbarriersolutions.com</a></p>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7;">
    <div style="max-width: 800px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
      <header style="background-color: #efad76; padding: 15px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Traffic & Barrier Solutions, LLC</h1>
        <h2 style="margin-top: 5px; font-size: 22px;">Application Follow-Up</h2>
      </header>

      <p style="margin-top: 20px;">Dear ${firstName},</p>

      <p>Thank you for your interest in <strong>Traffic & Barrier Solutions, LLC</strong>. We appreciate you taking the time to apply with us.</p>

      <p>If you have already submitted a photo ID, you are all set! No further action is needed at this time.</p>

      <h3 style="color: #333; border-bottom: 2px solid #efad76; padding-bottom: 5px;">Next Step in the Application Process</h3>

      <p>The next step is to send a <strong>photo ID (Driver's License)</strong> so we can move forward with your application.</p>

      <p>Please reply to <strong><a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></strong> to send your photo ID.</p>

      <p>If you have any questions or concerns, please email <strong><a href="mailto:materialworx2@gmail.com">materialworx2@gmail.com</a></strong> and we will be happy to assist you.</p>

      <hr style="border: 0; border-top: 2px solid #efad76; margin: 30px 0;">

      <p style="margin-top: 30px;">Best regards,</p>
      ${contactInfo}
    </div>
  </body>
</html>
`;
}

module.exports = { sendFollowUpEmails };
