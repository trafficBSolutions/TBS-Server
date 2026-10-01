const { transporter } = require('../utils/emailConfig');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const myEmail = 'tbsolutions9@gmail.com';
const dasia = 'materialworx2@gmail.com';
const userEmail = 'tbsolutions4@gmail.com';
const mainEmail = 'tbsolutions3@gmail.com';

const generateDirectDepositPDF = (data, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('Direct Deposit / Payroll Form', { align: 'center' }).moveDown(1);
    doc.fontSize(12).text('Traffic & Barrier Solutions, LLC', { align: 'center' });
    doc.text('723 N Wall St, Calhoun, GA 30701', { align: 'center' }).moveDown(2);

    doc.fontSize(14).text(`Full Name: ${data.fullName}`).moveDown(0.5);
    doc.text(`Payment Method: ${data.paymentMethod}`).moveDown(0.5);

    if (data.paymentMethod === 'Direct Deposit') {
      doc.text(`Bank Name: ${data.bankName}`).moveDown(0.5);
      doc.text(`Account Type: ${data.accountType}`).moveDown(0.5);
      doc.text(`Routing Number: ${data.routingNumber}`).moveDown(0.5);
      doc.text(`Account Number: ${data.accountNumber}`).moveDown(0.5);
    }

    doc.moveDown(2).fontSize(11).text(
      'By submitting this form, the employee authorizes Traffic & Barrier Solutions, LLC to deposit pay into the account listed above.',
      { align: 'left' }
    );

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

const submitDirectDeposit = async (req, res) => {
  try {
    const { fullName, paymentMethod, bankName, accountType, routingNumber, accountNumber } = req.body;

    if (!fullName || !paymentMethod) {
      return res.status(400).json({ error: 'Full name and payment method are required.' });
    }

    if (paymentMethod === 'Direct Deposit') {
      if (!bankName || !accountType || !routingNumber || !accountNumber) {
        return res.status(400).json({ error: 'All bank fields are required for Direct Deposit.' });
      }
      if (!/^\d{9}$/.test(routingNumber)) {
        return res.status(400).json({ error: 'Routing number must be exactly 9 digits.' });
      }
    }

    const pdfFilename = `${fullName.replace(/\s+/g, '_')}_DirectDeposit.pdf`;
    const pdfPath = path.join(__dirname, `../files/${pdfFilename}`);

    await generateDirectDepositPDF(
      { fullName, paymentMethod, bankName, accountType, routingNumber, accountNumber },
      pdfPath
    );

    const mailOptions = {
      from: 'Traffic & Barrier Solutions LLC <tbsolutions9@gmail.com>',
      to: myEmail,
      cc: dasia,
      bcc: [
        { name: 'Carson Speer', address: userEmail },
        { name: 'Bryson Davis', address: mainEmail }
      ],
      subject: `DIRECT DEPOSIT FORM — ${fullName}`,
      html: `
<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #e7e7e7;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
      <header style="background-color: #efad76; padding: 15px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Traffic & Barrier Solutions, LLC</h1>
        <h2 style="margin-top: 5px; font-size: 18px;">Direct Deposit / Payroll Form Received</h2>
      </header>

      <p style="margin-top: 20px;"><strong>Full Name:</strong> ${fullName}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod}</p>

      ${paymentMethod === 'Direct Deposit' ? `
      <p><strong>Bank Name:</strong> ${bankName}</p>
      <p><strong>Account Type:</strong> ${accountType}</p>
      <p><strong>Routing Number:</strong> ${routingNumber}</p>
      <p><strong>Account Number:</strong> ${accountNumber}</p>
      ` : ''}

      <p style="margin-top: 30px; color: #555;">The completed PDF is attached to this email.</p>
    </div>
  </body>
</html>`,
      attachments: [{ filename: pdfFilename, path: pdfPath }]
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending direct deposit email:', error);
      } else {
        console.log('Direct deposit email sent:', info.response);
      }
    });

    return res.status(201).json({ message: 'Direct deposit form submitted successfully.' });
  } catch (error) {
    console.error('Error submitting direct deposit:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { submitDirectDeposit };
