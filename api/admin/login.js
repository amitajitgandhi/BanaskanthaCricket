const config = require('../../lib/config');
const { issueToken } = require('../../lib/auth');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { username, password } = req.body || {};
  if (username !== config.adminUser || password !== config.adminPass) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  res.status(200).json({ token: issueToken(username) });
};
