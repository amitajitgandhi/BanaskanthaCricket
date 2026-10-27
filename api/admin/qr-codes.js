const crypto = require('crypto');
const { getSupabase } = require('../../lib/supabase');
const { rejectUnlessAdmin } = require('../../lib/auth');

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// The fixed set of placeholder codes the schedule page can show, so the
// admin UI always lists every one of them even before any row exists.
const KNOWN_PLACEHOLDERS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
  'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16',
  'W1', 'W2', 'W3', 'W4',
];

// Team-name mapping lives in this same file (rather than its own function)
// purely to stay under Vercel's serverless-function count limit on the
// Hobby plan — /api/admin/team-names is rewritten here with
// ?resource=team-names in vercel.json.
async function handleTeamNames(req, res, supabase) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('clbpl_team_names')
        .select('placeholder, team_name');
      if (error) throw error;

      const byPlaceholder = {};
      (data || []).forEach((row) => { byPlaceholder[row.placeholder] = row.team_name || ''; });

      const result = KNOWN_PLACEHOLDERS.map((placeholder) => ({
        placeholder,
        teamName: byPlaceholder[placeholder] || '',
      }));
      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not load team names.' });
    }
  }

  if (req.method === 'POST') {
    const { teams } = req.body || {};
    if (!Array.isArray(teams)) {
      return res.status(400).json({ error: 'Expected a list of team name updates.' });
    }

    try {
      const toUpsert = [];
      const placeholdersToClear = [];

      teams.forEach((t) => {
        const placeholder = String((t && t.placeholder) || '').trim();
        if (!placeholder || !KNOWN_PLACEHOLDERS.includes(placeholder)) return;
        const teamName = String((t && t.teamName) || '').trim();
        if (teamName) {
          toUpsert.push({ placeholder, team_name: teamName, updated_at: new Date().toISOString() });
        } else {
          placeholdersToClear.push(placeholder);
        }
      });

      if (toUpsert.length) {
        const { error: upsertErr } = await supabase
          .from('clbpl_team_names')
          .upsert(toUpsert, { onConflict: 'placeholder' });
        if (upsertErr) throw upsertErr;
      }

      if (placeholdersToClear.length) {
        const { error: delErr } = await supabase
          .from('clbpl_team_names')
          .delete()
          .in('placeholder', placeholdersToClear);
        if (delErr) throw delErr;
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not save team names.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}

// Registration on/off switch also lives in this same file for the same
// reason as team names above -- /api/admin/registration-status is
// rewritten here with ?resource=registration-status in vercel.json.
async function handleRegistrationStatus(req, res, supabase) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('clbpl_app_settings')
        .select('registration_open')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return res.status(200).json({ registrationOpen: data ? data.registration_open !== false : true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not load registration status.' });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const { registrationOpen } = req.body || {};
    if (typeof registrationOpen !== 'boolean') {
      return res.status(400).json({ error: 'registrationOpen must be true or false.' });
    }
    try {
      const { error } = await supabase
        .from('clbpl_app_settings')
        .upsert({ id: 1, registration_open: registrationOpen, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) throw error;
      return res.status(200).json({ success: true, registrationOpen });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not update registration status.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}

module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;
  const supabase = getSupabase();

  if (req.query && req.query.resource === 'team-names') {
    return handleTeamNames(req, res, supabase);
  }

  if (req.query && req.query.resource === 'registration-status') {
    return handleRegistrationStatus(req, res, supabase);
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('clbpl_qr_codes')
        .select('*')
        .order('uploaded_at', { ascending: true });
      if (error) throw error;

      const withUrls = data.map((q) => {
        const { data: pub } = supabase.storage.from('clbpl-qr-codes').getPublicUrl(q.storage_path);
        return { ...q, url: pub.publicUrl };
      });
      return res.status(200).json(withUrls);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not load QR codes.' });
    }
  }

  if (req.method === 'POST') {
    const { label, imageBase64, mimeType } = req.body || {};
    if (!imageBase64 || !mimeType || !/^image\//.test(mimeType)) {
      return res.status(400).json({ error: 'Please choose an image file to upload.' });
    }
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: 'Please enter a label for this QR code (e.g. the bank/account name) — registrations are tracked back to it.' });
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      return res.status(400).json({ error: 'Image is too large (max 5MB).' });
    }

    const ext = (mimeType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    const path = `${crypto.randomUUID()}.${ext}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from('clbpl-qr-codes')
        .upload(path, buffer, { contentType: mimeType, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data, error } = await supabase
        .from('clbpl_qr_codes')
        .insert({ storage_path: path, label: String(label).trim(), active: false })
        .select()
        .single();
      if (error) throw error;

      const { data: pub } = supabase.storage.from('clbpl-qr-codes').getPublicUrl(path);
      return res.status(201).json({ ...data, url: pub.publicUrl });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Upload failed.' });
    }
  }

  res.status(405).json({ error: 'Method not allowed.' });
};
