const { getSupabase } = require('../lib/supabase');

// Masks a mobile number down to its first digit and last 3 digits, e.g.
// "9876543210" -> "9XXXX XX210" — enough to help a player recognise their
// own entry without publishing a usable phone number to anyone with the
// (unauthenticated) /players link.
function maskMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return 'X'.repeat(digits.length);
  const visibleStart = 1;
  const visibleEnd = 3;
  const maskLen = Math.max(digits.length - visibleStart - visibleEnd, 0);
  const masked = digits.slice(0, visibleStart) + 'X'.repeat(maskLen) + digits.slice(digits.length - visibleEnd);
  if (masked.length > 6) {
    const mid = Math.ceil(masked.length / 2);
    return masked.slice(0, mid) + ' ' + masked.slice(mid);
  }
  return masked;
}

// Public: confirmed players only, and only non-sensitive fields — never the
// raw mobile number, DOB, payment info, or photo on a public endpoint.
// Mobile number is sent only in masked form (see above). The Cric Heroes
// link is included as-is — it's the player's own public profile link.
module.exports = async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sbkym_registrations')
      .select('form_number, full_name, mobile_number, cricheroes_link, jersey_name, jersey_number, jersey_size')
      .eq('status', 'Approved')
      .order('full_name', { ascending: true });

    if (error) throw error;

    const players = data.map((p) => ({
      form_number: p.form_number,
      full_name: p.full_name,
      category: null,
      mobile_masked: maskMobile(p.mobile_number),
      cricheroes_link: p.cricheroes_link,
      jersey_name: p.jersey_name,
      jersey_number: p.jersey_number,
      jersey_size: p.jersey_size,
    }));

    res.status(200).json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load players.' });
  }
};