const { getSupabase } = require('../lib/supabase');
const config = require('../lib/config');

function isValidMobile(mobile) {
  return /^[0-9]{10}$/.test(String(mobile || '').trim());
}

function isValidCricheroesLink(url) {
  return !String(url || '').trim() || /^https:\/\/chshare\.link\/player\/[A-Za-z0-9_-]+\/?(\?.*)?$/i.test(String(url || '').trim());
}

const VALID_SKILLSET = ['Batsman', 'Bowler', 'All Rounder', 'Wicket-Keeper'];
const VALID_BOWLING_ARM = ['Left Arm', 'Right Arm'];
const VALID_BATTING_STYLE = ['Left Handed', 'Right Handed'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const b = req.body || {};
  const required = [
    'formNumber', 'fullName', 'gotra', 'mobileNumber', 'dob', 'skillset', 'bowlingArm', 'battingStyle',
    'photoPath', 'cricheroesLink', 'jerseyName', 'jerseyNumber', 'jerseySize',
  ];
  const missing = required.filter((f) => !String(b[f] || '').trim());
  if (missing.length) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const birth = new Date(String(b.dob || '') + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  if (Number.isNaN(birth.getTime()) || age < 17) return res.status(400).json({ error: 'Age criteria not met. Players must be at least 17 years old on the date of registration. Your registration cannot be submitted.' });
  if (!isValidMobile(b.mobileNumber)) {
    return res.status(400).json({ error: 'Please enter a valid mobile number.' });
  }
  if (!VALID_SKILLSET.includes(b.skillset)) {
    return res.status(400).json({ error: 'Please select a valid skillset.' });
  }
  if (!VALID_BOWLING_ARM.includes(b.bowlingArm)) {
    return res.status(400).json({ error: 'Please select a valid bowling arm.' });
  }
  if (!VALID_BATTING_STYLE.includes(b.battingStyle)) {
    return res.status(400).json({ error: 'Please select a valid batting style.' });
  }
  if (!isValidCricheroesLink(b.cricheroesLink)) {
    return res.status(400).json({ error: 'Please enter a valid Cric Heroes link, e.g. https://chshare.link/player/nhh1FI' });
  }
  if (b.confirmCorrect !== true) {
    return res.status(400).json({ error: 'Please confirm your details are correct.' });
  }
  if (b.agreeTC !== true) {
    return res.status(400).json({ error: 'You must agree to the terms & conditions to register.' });
  }

  try {
    const supabase = getSupabase();

    // Belt-and-suspenders: the public /register page hides the form and
    // shows a "Registration is full" message once the admin stops
    // registrations, but that's only client-side -- re-check here so a
    // direct POST to this endpoint can't slip a registration in while
    // registrations are stopped.
    const { data: settings, error: settingsError } = await supabase
      .from('clbpl_app_settings')
      .select('registration_open')
      .eq('id', 1)
      .single();
    if (!settingsError && settings && settings.registration_open === false) {
      return res.status(403).json({ error: 'Registration is currently closed. Please contact the committee.' });
    }

    const { data, error } = await supabase
      .from('clbpl_registrations')
      .insert({
        form_number: String(b.formNumber).trim(),
        full_name: String(b.fullName).trim(),
        gotra: String(b.gotra).trim(),
        mobile_number: String(b.mobileNumber).trim(),
        dob: String(b.dob).trim(),
        skillset: String(b.skillset).trim(),
        bowling_arm: String(b.bowlingArm).trim(),
        batting_style: String(b.battingStyle).trim(),
        photo_path: String(b.photoPath).trim(),
        cricheroes_link: String(b.cricheroesLink || '').trim() || null,
        jersey_name: String(b.jerseyName).trim(),
        jersey_number: String(b.jerseyNumber).trim(),
        jersey_size: String(b.jerseySize).trim(),
        payment_id: paymentMethod === 'qr' ? String(b.paymentId).trim() : null,
        // Which QR code (by label) or 'Cash' this registrant paid through —
        // lets the admin dashboard show which rotation a payment belongs to.
        qr_label: String(b.qrLabel).trim(),
        fee_paid: config.fee,
        screenshot_path: paymentMethod === 'qr' ? String(b.screenshotPath).trim() : null,
        // Whether the payment ID above was auto-detected by OCR (true), left
        // for manual entry (false), or not applicable for a Cash payment
        // (null) -- surfaced in the admin dashboard's Confirmations tab.
        payment_id_auto_detected: paymentMethod === 'qr' ? (b.paymentIdAutoDetected === true) : null,
        status: 'Pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
