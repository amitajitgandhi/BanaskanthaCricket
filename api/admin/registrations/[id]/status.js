const { getSupabase } = require('../../../../lib/supabase');
const { rejectUnlessAdmin } = require('../../../../lib/auth');

const VALID_STATUSES = ['Pending', 'Confirmed'];
const VALID_CATEGORIES = ['Platinum+', 'Platinum', 'Gold', 'Silver'];
const VALID_PAYMENT_COLLECTION_STATUSES = ['Pending', 'Paid Online', 'Paid Cash to Amit', 'Paid Cash to Bhavesh'];
const VALID_SKILLSET = ['Batsman', 'Bowler', 'All Rounder'];
const VALID_BOWLING_ARM = ['Left Arm', 'Right Arm'];
const VALID_BATTING_STYLE = ['Left Handed', 'Right Handed'];

// Editable registration-detail fields an admin can correct after the fact
// (e.g. a typo in the name or mobile number) -- maps the request body key to
// its DB column. Fields in REQUIRED_EDITABLE must not be blanked out.
const EDITABLE_FIELD_MAP = {
  fullName: 'full_name',
  mobileNumber: 'mobile_number',
  dob: 'dob',
  skillset: 'skillset',
  bowlingArm: 'bowling_arm',
  battingStyle: 'batting_style',
  jerseyName: 'jersey_name',
  jerseyNumber: 'jersey_number',
  jerseySize: 'jersey_size',
  cricheroesLink: 'cricheroes_link',
  paymentId: 'payment_id',
  qrLabel: 'qr_label',
};
const REQUIRED_EDITABLE = [
  'fullName', 'mobileNumber', 'dob', 'skillset', 'bowlingArm', 'battingStyle',
  'jerseyName', 'jerseyNumber', 'jerseySize',
];

// Handles the Confirmations tab's row-level admin actions for a single
// registration:
//   PATCH  -- update status, paymentCollectionStatus, and/or any of the
//             editable fields above (the admin's Edit button)
//   DELETE -- permanently remove the registration (the admin's Delete
//             button), best-effort cleaning up its uploaded photo/screenshot
// Both live on this one route rather than being split into more serverless
// functions, since the Vercel Hobby plan caps a deployment at 12.
module.exports = async (req, res) => {
  if (rejectUnlessAdmin(req, res)) return;

  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      const supabase = getSupabase();
      const { data: existing, error: fetchError } = await supabase
        .from('clbpl_registrations')
        .select('photo_path, screenshot_path')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase
        .from('clbpl_registrations')
        .delete()
        .eq('id', id);
      if (deleteError) throw deleteError;

      // Best-effort: also remove the uploaded files. A failure here doesn't
      // undo the row deletion -- an orphaned storage object is a much
      // smaller problem than a registration the admin can't get rid of.
      if (existing) {
        const removals = [];
        if (existing.photo_path) {
          removals.push(supabase.storage.from('clbpl-photos').remove([existing.photo_path]));
        }
        if (existing.screenshot_path) {
          removals.push(supabase.storage.from('clbpl-screenshots').remove([existing.screenshot_path]));
        }
        await Promise.allSettled(removals);
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not delete registration.' });
    }
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const updates = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    updates.status = body.status;
  }

  if (body.category !== undefined) {
    if (body.category === null || body.category === '') {
      updates.category = null;
    } else if (typeof body.category !== 'string' || !VALID_CATEGORIES.includes(body.category)) {
      return res.status(400).json({ error: `Category must be empty or one of: ${VALID_CATEGORIES.join(', ')}` });
    } else {
      updates.category = body.category;
    }
  }

  if (body.paymentCollectionStatus !== undefined) {
    if (!VALID_PAYMENT_COLLECTION_STATUSES.includes(body.paymentCollectionStatus)) {
      return res.status(400).json({ error: `Payment must be one of: ${VALID_PAYMENT_COLLECTION_STATUSES.join(', ')}` });
    }
    updates.payment_collection_status = body.paymentCollectionStatus;
  }

  for (const [bodyKey, column] of Object.entries(EDITABLE_FIELD_MAP)) {
    if (body[bodyKey] === undefined) continue;
    const value = String(body[bodyKey]).trim();
    if (!value && REQUIRED_EDITABLE.includes(bodyKey)) {
      return res.status(400).json({ error: `${bodyKey} cannot be empty.` });
    }
    if (bodyKey === 'skillset' && value && !VALID_SKILLSET.includes(value)) {
      return res.status(400).json({ error: `Skillset must be one of: ${VALID_SKILLSET.join(', ')}` });
    }
    if (bodyKey === 'bowlingArm' && value && !VALID_BOWLING_ARM.includes(value)) {
      return res.status(400).json({ error: `Bowling arm must be one of: ${VALID_BOWLING_ARM.join(', ')}` });
    }
    if (bodyKey === 'battingStyle' && value && !VALID_BATTING_STYLE.includes(value)) {
      return res.status(400).json({ error: `Batting style must be one of: ${VALID_BATTING_STYLE.join(', ')}` });
    }
    updates[column] = value;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('clbpl_registrations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Registration not found.' });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update registration.' });
  }
};