// Tournament details shown on the registration page. These are hardcoded
// directly in code (not read from Vercel environment variables) — edit the
// values below and redeploy to change them.
module.exports = {
  tournamentName: 'Cricket Lover Boys Premier League',
  season: 'Season 12',

  eventDates: '11-13 December 2026',
  venue: 'Pushpa Sports Arena',
  registrationDeadline: '10 October 2026',

  fee: 1500,

  organizerName: 'Amit Gandhi',
  organizerPhone: '+91 7276319578',

  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'changeme123',
  adminSecret: process.env.ADMIN_SECRET || 'change-this-admin-secret',

  // Safe to expose to the browser — the anon key only has the limited RLS
  // permissions granted in the Supabase policies (see README), never the
  // service-role key.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
};
