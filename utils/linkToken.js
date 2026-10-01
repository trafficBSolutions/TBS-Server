const crypto = require('crypto');

const LINK_SECRET = process.env.LINK_SECRET || 'dev-link-secret-change-me';

function signQuery(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', LINK_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyQuery(token) {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', LINK_SECRET).update(payload).digest('base64url');
  if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

module.exports = { signQuery, verifyQuery };
