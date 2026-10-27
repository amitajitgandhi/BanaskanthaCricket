// Tournament details shown on the registration page. Review all event values before launch.
module.exports = {
  tournamentName: 'SBKYM Premier League',
  season: 'Season 4',

  eventDates: '11–13 December 2026',
  venue: 'Tembekar Ground, Bibwewadi, Pune',
  registrationDeadline: '10 November 2026',

  fee: 0,

  organizerName: 'Shri Banaskantha Yuvak Mandal (SBKYM), Pune',
  organizerPhone: '',

  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'changeme123',
  adminSecret: process.env.ADMIN_SECRET || 'change-this-admin-secret',

  // Safe to expose to the browser — the anon key only has the limited RLS
  // permissions granted in the Supabase policies, never the service-role key.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
};
