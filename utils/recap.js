const axios = require('axios');

const verifyRecaptcha = async (token) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
      params: {
        secret: secretKey,
        response: token,
      }
    });

    return response.data.success;
  } catch (err) {
    console.error('reCAPTCHA verification error:', err);
    return false;
  }
};

module.exports = verifyRecaptcha;
