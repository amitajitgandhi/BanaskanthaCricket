const { getSupabase } = require('../../../../lib/supabase');
const { rejectUnlessAdmin } = require('../../../../lib/auth');
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];
const VALID_SKILLSET = ['Batsman', 'Bowler', 'All Rounder', 'Wicket-Keeper'];
const VALID_BOWLING_ARM = ['Left Arm', 'Right Arm'];
const VALID_BATTING_STYLE = ['Left Handed', 'Right Handed'];
const FIELD_MAP = {
  formNumber: 'form_number', fullName: 'full_name', gotra: 'gotra',
  mobileNumber: 'mobile_number', dob: 'dob', skillset: 'skillset',
  bowlingArm: 'bowling_arm', battingStyle: 'batting_style',
  jerseyName: 'jersey_name', jerseyNumber: 'jersey_number',
  jerseySize: 'jersey_size', cricheroesLink: 'cricheroes_link',
};
module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  const { id } = req.query;
  const supabase = getSupabase();
  if (req.method === 'DELETE') {
    try {
      const { data: row, error: readError } = await supabase.from('sbkym_registrations').select('photo_path').eq('id', id).single();
      if (readError) throw readError;
      const { error } = await supabase.from('sbkym_registrations').delete().eq('id', id);
      if (error) throw error;
      if (row && row.photo_path) await supabase.storage.from('sbkym-player-photos').remove([row.photo_path]);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not delete registration.' });
    }
  }
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed.' });
  const body = req.body || {};
  if (body.category !== undefined || body.paymentCollectionStatus !== undefined) {
    return res.status(400).json({ error: 'Category and payment tracking are not used for SBKYM registrations.' });
  }
  const updates = {};
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) return res.status(400).json({ error: 'Status must be Pending, Approved, or Rejected.' });
    updates.status = body.status;
  }
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] === undefined) continue;
    const value = String(body[key] ?? '').trim();
    if (['formNumber','fullName','gotra','mobileNumber','dob','skillset','bowlingArm','battingStyle','jerseyName','jerseyNumber','jerseySize'].includes(key) && !value) {
      return res.status(400).json({ error: key + ' cannot be empty.' });
    }
    if (key === 'skillset' && !VALID_SKILLSET.includes(value)) return res.status(400).json({ error: 'Please select a valid skillset.' });
    if (key === 'bowlingArm' && !VALID_BOWLING_ARM.includes(value)) return res.status(400).json({ error: 'Please select a valid bowling arm.' });
    if (key === 'battingStyle' && !VALID_BATTING_STYLE.includes(value)) return res.status(400).json({ error: 'Please select a valid batting style.' });
    if (key === 'dob') {
      const birth = new Date(value + 'T00:00:00');
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
      if (Number.isNaN(birth.getTime()) || age < 17) return res.status(400).json({ error: 'Players must be at least 17 years old.' });
    }
    updates[column] = key === 'cricheroesLink' && !value ? null : value;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update.' });
  try {
    const { data, error } = await supabase.from('sbkym_registrations')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not update registration.' });
  }
};
