const { getSupabase } = require('../../lib/supabase');
const { rejectUnlessAdmin } = require('../../lib/auth');

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sbkym_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const columns = [
      'id', 'created_at', 'form_number', 'full_name', 'gotra', 'mobile_number', 'dob', 'skillset', 'bowling_arm',
      'batting_style', 'cricheroes_link', 'jersey_name', 'jersey_number', 'jersey_size',
      'photo_path', 'status', 'admin_notes', 'updated_at',
    ];
    const lines = [columns.join(',')];
    for (const row of data) {
      lines.push(columns.map((c) => csvEscape(row[c])).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sbkym-registrations.csv"');
    res.status(200).send(lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not export registrations.' });
  }
};
