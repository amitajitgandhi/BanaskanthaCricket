const { rejectUnlessAdmin } = require('../../lib/auth');

// SBKYM no longer uses payment QR codes or CLBPL settings tables.
module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  if (req.query && req.query.resource === 'registration-status') {
    if (req.method === 'GET') return res.status(200).json({ registrationOpen: true });
    return res.status(410).json({ error: 'Registration control has not been configured in the SBKYM database.' });
  }
  if (req.query && req.query.resource === 'team-names') {
    if (req.method === 'GET') return res.status(200).json([]);
    return res.status(410).json({ error: 'Team-name management is not configured for this tournament.' });
  }
  if (req.method === 'GET') return res.status(200).json([]);
  return res.status(410).json({ error: 'Payment QR management is not used for SBKYM registrations.' });
};
