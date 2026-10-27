const { getSupabase } = require('../../../lib/supabase');
const { rejectUnlessAdmin } = require('../../../lib/auth');

module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  const supabase = getSupabase();
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const active = !!(req.body && req.body.active);
    try {
      const { data, error } = await supabase
        .from('clbpl_qr_codes')
        .update({ active })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'QR code not found.' });
      return res.status(200).json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not update QR code.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('clbpl_qr_codes')
        .select('storage_path')
        .eq('id', id)
        .single();
      if (fetchErr || !existing) return res.status(404).json({ error: 'QR code not found.' });

      const { error: delRowErr } = await supabase.from('clbpl_qr_codes').delete().eq('id', id);
      if (delRowErr) throw delRowErr;

      await supabase.storage.from('clbpl-qr-codes').remove([existing.storage_path]);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not delete QR code.' });
    }
  }

  res.status(405).json({ error: 'Method not allowed.' });
};
