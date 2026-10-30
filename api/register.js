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
const VALID_BOWLING_STYLE = ['Fast Bowler', 'Spinner', 'Does Not Bowl'];
const VALID_BATTING_STYLE = ['Left Handed', 'Right Handed'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const b = req.body || {};
  const required = [
    'formNumber', 'fullName', 'gotra', 'mobileNumber', 'dob', 'skillset', 'bowlingArm', 'bowlingStyle', 'battingStyle',
    'photoPath', 'jerseyName', 'jerseyNumber', 'jerseySize',
  ];
  const missing = required.filter((f) => !String(b[f] || '').trim());
  if (missing.length) {
    return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
  }

  const dob = String(b.dob || '').trim();
  const birth = new Date(dob + 'T00:00:00');
  if (Number.isNaN(birth.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob > '2009-12-10') {
    return res.status(400).json({ error: 'Date of birth criteria not met. Players must have been born on or before 10 December 2009. Your registration cannot be submitted.' });
  }
  if (!isValidMobile(b.mobileNumber)) {
    return res.status(400).json({ error: 'Please enter a valid mobile number.' });
  }
  if (!VALID_SKILLSET.includes(b.skillset)) {
    return res.status(400).json({ error: 'Please select a valid skillset.' });
  }
  if (!VALID_BOWLING_ARM.includes(b.bowlingArm)) {
    return res.status(400).json({ error: 'Please select a valid bowling arm.' });
  }
  if (!VALID_BOWLING_STYLE.includes(b.bowlingStyle)) {
    return res.status(400).json({ error: 'Please select a valid bowling style.' });
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

    const { data, error } = await supabase
      .from('sbkym_registrations')
      .insert({
        form_number: String(b.formNumber).trim(),
        full_name: String(b.fullName).trim(),
        gotra: String(b.gotra).trim(),
        mobile_number: String(b.mobileNumber).trim(),
        dob: String(b.dob).trim(),
        skillset: String(b.skillset).trim(),
        bowling_arm: String(b.bowlingArm).trim(),
        bowling_style: String(b.bowlingStyle).trim(),
        batting_style: String(b.battingStyle).trim(),
        photo_path: String(b.photoPath).trim(),
        cricheroes_link: String(b.cricheroesLink || '').trim() || null,
        jersey_name: String(b.jerseyName).trim(),
        jersey_number: String(b.jerseyNumber).trim(),
        jersey_size: String(b.jerseySize).trim(),
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
