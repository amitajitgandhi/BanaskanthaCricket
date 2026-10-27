const config = require('../lib/config');
const { getSupabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  const supabase = getSupabase();
  const teamNames = {};
  const registrationOpen = true;

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
