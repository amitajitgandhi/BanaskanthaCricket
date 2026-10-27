const { getSupabase } = require('../../lib/supabase');
const { rejectUnlessAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('clbpl_registrations')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load registrations.' });
  }
};
