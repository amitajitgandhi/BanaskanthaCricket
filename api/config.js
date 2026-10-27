const config = require('../lib/config');
const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const supabase = getSupabase();
  let teamNames = {};
  try {
    const { data, error } = await supabase
      .from('clbpl_team_names')
      .select('placeholder, team_name');
    if (!error && data) {
      data.forEach((row) => {
        if (row.team_name && row.team_name.trim()) {
          teamNames[row.placeholder] = row.team_name.trim();
        }
      });
    }
  } catch (err) {
    // Team names are a nice-to-have on top of config — never fail the
    // whole /api/config response just because this lookup had trouble.
    console.error(err);
  }

  // Whether the admin has stopped new registrations (Insight tab's
  // "Registration Control" panel). Defaults open if the settings row is
  // somehow missing, since the server-side check in /api/register is the
  // real gate -- this flag only controls what the public page shows.
  let registrationOpen = true;
  try {
    const { data, error } = await supabase
      .from('clbpl_app_settings')
      .select('registration_open')
      .eq('id', 1)
      .single();
    if (!error && data) registrationOpen = data.registration_open !== false;
  } catch (err) {
    console.error(err);
  }

  res.status(200).json({
    tournamentName: config.tournamentName,
    season: config.season,
    eventDates: config.eventDates,
    venue: config.venue,
    registrationDeadline: config.registrationDeadline,
    fee: config.fee,
    organizerName: config.organizerName,
    organizerPhone: config.organizerPhone,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    teamNames,
    registrationOpen,
  });
};
