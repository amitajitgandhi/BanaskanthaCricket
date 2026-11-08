const { getSupabase } = require('../lib/supabase');
const config = require('../lib/config');

function isValidMobile(mobile) {
  return /^[0-9]{10}$/.test(String(mobile || '').trim());
}

const VALID_SKILLSET = ['Batsman', 'Bowler', 'All Rounder'];
const VALID_BOWLING_ARM = ['Left Arm', 'Right Arm', 'Does Not Bowl'];
const VALID_BOWLING_STYLE = ['Fast Bowler', 'Spinner', 'Does Not Bowl'];
const VALID_BATTING_STYLE = ['Left Handed', 'Right Handed'];
const VALID_WICKET_KEEPER = ['Yes', 'No'];

module.exports = async (req, res) => {
  // Reuse this function for the pre-upload Form Number check so the
  // Hobby deployment stays within its Serverless Function limit.
  if (req.method === 'GET') {
    const formNumber = String((req.query || {}).formNumber || '').trim();
    if (!formNumber) return res.status(400).json({ error: 'Please enter a Form Number.' });
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
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const b = req.body || {};
  const required = [
    'formNumber', 'fullName', 'gotra', 'mobileNumber', 'dob', 'skillset', 'bowlingArm', 'bowlingStyle', 'wicketKeeper', 'battingStyle',
    'photoPath', 'jerseyName', 'jerseyNumber', 'jerseySize', 'trackPantSize',
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
  if (![28,30,32,34,36,38,40].includes(Number(b.trackPantSize))) return res.status(400).json({ error: 'Please select a valid track pant size.' });
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
  if (!VALID_WICKET_KEEPER.includes(b.wicketKeeper)) {
    return res.status(400).json({ error: 'Please select whether you are a wicket keeper.' });
  }
  if (!VALID_BATTING_STYLE.includes(b.battingStyle)) {
    return res.status(400).json({ error: 'Please select a valid batting style.' });
  }
  if (b.confirmCorrect !== true) {
    return res.status(400).json({ error: 'Please confirm your details are correct.' });
  }
  if (b.agreeTC !== true) {
    return res.status(400).json({ error: 'You must agree to the terms & conditions to register.' });
  }

  try {
    const supabase = getSupabase();
    const formNumber = String(b.formNumber).trim();

    // Friendly duplicate check; the database unique index is the final
    // protection against simultaneous submissions.
    const { data: existing, error: lookupError } = await supabase
      .from('sbkym_registrations')
      .select('id')
      .eq('form_number', formNumber)
      .limit(1);

    if (lookupError) throw lookupError;
    if (existing && existing.length) {
      return res.status(409).json({ error: 'This Form Number is already registered. Please check the number and try again.' });
    }

    const { data, error } = await supabase
      .from('sbkym_registrations')
      .insert({
        form_number: formNumber,
        full_name: String(b.fullName).trim(),
        gotra: String(b.gotra).trim(),
        mobile_number: String(b.mobileNumber).trim(),
        dob: String(b.dob).trim(),
        skillset: String(b.skillset).trim(),
        bowling_arm: String(b.bowlingArm).trim(),
        bowling_style: String(b.bowlingStyle).trim(),
        wicket_keeper: String(b.wicketKeeper).trim(),
        batting_style: String(b.battingStyle).trim(),
        photo_path: String(b.photoPath).trim(),
        jersey_name: String(b.jerseyName).trim(),
        jersey_number: String(b.jerseyNumber).trim(),
        jersey_size: String(b.jerseySize).trim(),
        track_pant_size: String(b.trackPantSize).trim(),
        status: 'Pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This Form Number is already registered. Please check the number and try again.' });
    }
    console.error('Registration insert failed:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    });
    // Return the database error message temporarily so registration failures
    // can be diagnosed from the browser without guessing at schema issues.
    res.status(500).json({
      error: 'Registration could not be saved.',
      diagnostic: err.message || 'Unknown database error',
      code: err.code || null,
      hint: err.hint || null,
    });
  }
};
