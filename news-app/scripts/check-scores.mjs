// Fetches today's games from every league the way the app does, so a change to ESPN's scoreboard
// shows up in the CI log.
import { LEAGUES, fetchGames, fetchLeagueGames } from '../src/services/scores.ts';

for (const league of LEAGUES) {
  try {
    const games = await fetchLeagueGames(league);
    const g = games[0];
    console.log(`${league.name.padEnd(18)} ${String(games.length).padStart(3)} games${g ? `  e.g. ${g.away.abbr} ${g.away.score} @ ${g.home.abbr} ${g.home.score} (${g.state}: ${g.detail})` : ''}`);
  } catch (err) {
    console.log(`::warning::${league.name} scoreboard failed: ${err instanceof Error ? err.message : err}`);
  }
}
const all = await fetchGames(['TB']);
console.log(`\n${all.length} games in all; first: ${all[0] ? `${all[0].leagueName} ${all[0].away.abbr} @ ${all[0].home.abbr} ${all[0].detail}` : 'none'}`);
