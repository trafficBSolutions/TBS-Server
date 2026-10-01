const axios = require('axios');

module.exports = async function verifyRecaptcha(req, res, next) {
  try {
    const token =
      req.body?.recaptchaToken ||
      req.headers['x-recaptcha-token'] ||
      req.query?.recaptchaToken;

    if (!token) {
      return res.status(400).json({ message: 'Missing reCAPTCHA token.' });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY; // make sure this env var exists!
    const resp = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      { params: { secret: secretKey, response: token } }
    );

    if (!resp.data?.success) {
      return res.status(400).json({ message: 'reCAPTCHA verification failed.' });
    }

    return next();
  } catch (err) {
    console.error('reCAPTCHA verification error:', err);
    return res.status(500).json({ message: 'reCAPTCHA verification error.' });
  }
};
