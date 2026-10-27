const { createClient } = require('@supabase/supabase-js');

// Server-side client using the service-role key — full access, bypasses RLS.
// NEVER expose SUPABASE_SERVICE_ROLE_KEY to the browser; it only ever lives
// in Vercel's server-side environment variables.
let client = null;

function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { getSupabase };
