// mailer.js
const nodemailer = require('nodemailer');

function assertCreds(labelUser, labelPass) {
  const user = process.env[labelUser];
  const pass = process.env[labelPass];
  if (!user || !pass) {
    const missing = [!user && labelUser, !pass && labelPass].filter(Boolean).join(', ');
    throw new Error(`Email credentials missing: ${missing}`);
  }
  return { user, pass };
}

function makeTransport(labelUser, labelPass) {
  const { user, pass } = assertCreds(labelUser, labelPass);
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,           // 465 + TLS
    auth: { user, pass },   // pass SHOULD be a Gmail App Password (16 chars)
    // optional:
    logger: true,
    debug: true,
  });
}

const transporter  = makeTransport('EMAIL_USER',   'EMAIL_PASS');
const transporter2 = makeTransport('EMAIL_USER_2', 'EMAIL_PASS_2');
const transporter3 = makeTransport('EMAIL_USER_3', 'EMAIL_PASS_3');
const transporter4 = makeTransport('EMAIL_USER_4', 'EMAIL_PASS_4');
const transporter5 = makeTransport('EMAIL_USER_5', 'EMAIL_PASS_5');
const transporter6 = makeTransport('EMAIL_USER_6', 'EMAIL_PASS_6');
const transporter7 = makeTransport('EMAIL_USER_7', 'EMAIL_PASS_7'); // trafficandbarriersolutions.ap@gmail.com

module.exports = {
  transporter,
  transporter2,
  transporter3,
  transporter4,
  transporter5,
  transporter6,
  transporter7,
};
