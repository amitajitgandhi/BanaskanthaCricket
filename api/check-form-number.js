const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const formNumber = String((req.body || {}).formNumber || '').trim();
  if (!formNumber) {
    return res.status(400).json({ error: 'Please enter a Form Number.' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sbkym_registrations')
      .select('id')
      .eq('form_number', formNumber)
      .limit(1);

    if (error) throw error;
    const exists = Boolean(data && data.length);
    return res.status(200).json({
      exists,
      error: exists ? 'This Form Number is already registered. Please check the number and try again.' : null,
    });
  } catch (err) {
    console.error('Form Number check failed:', { message: err.message, code: err.code });
    return res.status(500).json({ error: 'Could not verify the Form Number. Please try again.' });
  }
};
