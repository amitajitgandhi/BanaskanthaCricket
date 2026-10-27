const crypto = require('crypto');
const config = require('./config');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', config.adminSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', config.adminSecret).update(body).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function issueToken(username) {
  return sign({ u: username, exp: Date.now() + TOKEN_TTL_MS });
}

// Call at the top of any admin-only API route. Returns true (and has already
// sent a 401) if the request should stop; returns false if the caller is
// authenticated and the handler should continue.
function rejectUnlessAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return true;
  }
  return false;
}

module.exports = { issueToken, verifyToken, rejectUnlessAdmin };
