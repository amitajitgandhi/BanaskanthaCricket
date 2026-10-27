const { getSupabase } = require('../../../../lib/supabase');
const { rejectUnlessAdmin } = require('../../../../lib/auth');

// Payment screenshots are personal, so they live in a private Supabase Storage
// bucket. This mints a short-lived signed URL rather than exposing them
// publicly — only an authenticated admin can reach this endpoint at all.
module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;

  const { id } = req.query;

  try {
    const supabase = getSupabase();
    const { data: reg, error } = await supabase
      .from('clbpl_registrations')
      .select('screenshot_path')
      .eq('id', id)
      .single();

    if (error || !reg || !reg.screenshot_path) {
      return res.status(404).json({ error: 'No screenshot on file.' });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('clbpl-screenshots')
      .createSignedUrl(reg.screenshot_path, 60); // 60 seconds — just enough to open it

    if (signErr) throw signErr;

    res.status(200).json({ url: signed.signedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load screenshot.' });
  }
};
