const { getSupabase } = require('../lib/supabase');

// Public: only QR codes an admin has marked active — and however many they
// chose to show — for the registration page's payment section.
module.exports = async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('clbpl_qr_codes')
      .select('id, label, storage_path')
      .eq('active', true)
      .order('uploaded_at', { ascending: true });

    if (error) throw error;

    const codes = data.map((q) => {
      const { data: pub } = supabase.storage.from('clbpl-qr-codes').getPublicUrl(q.storage_path);
      return { id: q.id, label: q.label, url: pub.publicUrl };
    });

    res.status(200).json(codes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load QR codes.' });
  }
};
