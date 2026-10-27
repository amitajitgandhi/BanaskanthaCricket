// Tournament details shown on the registration page. Review all event values before launch.
module.exports = {
  tournamentName: 'Banaskantha Yuvak Mandal Cricket Tournament',
  season: 'Banaskantha Yuvak Mandal',

  eventDates: 'To be announced',
  venue: 'To be announced',
  registrationDeadline: 'To be announced',

  fee: 0,

  organizerName: 'Banaskantha Yuvak Mandal',
  organizerPhone: '',

  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'changeme123',
  adminSecret: process.env.ADMIN_SECRET || 'change-this-admin-secret',

  // Safe to expose to the browser — the anon key only has the limited RLS
  // permissions granted in the Supabase policies, never the service-role key.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
};
