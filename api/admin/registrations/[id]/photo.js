const { getSupabase } = require('../../../../lib/supabase');
const { rejectUnlessAdmin } = require('../../../../lib/auth');

module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const { id } = req.query;
    const supabase = getSupabase();
    const { data: row, error } = await supabase.from('sbkym_registrations')
      .select('photo_path').eq('id', id).single();
    if (error || !row || !row.photo_path) return res.status(404).json({ error: 'No photo on file.' });
    const { data, error: signError } = await supabase.storage.from('sbkym-player-photos')
      .createSignedUrl(row.photo_path, 60);
    if (signError) throw signError;
    return res.status(200).json({ url: data.signedUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load photo.' });
  }
};
