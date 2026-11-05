// Live scores from ESPN's public scoreboard data (no API key). Kept free of React Native imports
// so CI can check it in Node.

export interface League {
  id: string;
  name: string;
  /** ESPN path: sport/league. */
  path: string;
}

export const LEAGUES: League[] = [
  { id: 'nfl', name: 'NFL', path: 'football/nfl' },
  { id: 'cfb', name: 'College football', path: 'football/college-football' },
  { id: 'nba', name: 'NBA', path: 'basketball/nba' },
  { id: 'mlb', name: 'MLB', path: 'baseball/mlb' },
  { id: 'nhl', name: 'NHL', path: 'hockey/nhl' },
  { id: 'wnba', name: 'WNBA', path: 'basketball/wnba' },
  { id: 'mls', name: 'MLS', path: 'soccer/usa.1' },
];

export interface Team {
  abbr: string;
  name: string;
  logo?: string;
  score: string;
  winner: boolean;
}

export interface Game {
  id: string;
  league: string;
  leagueName: string;
  state: 'pre' | 'in' | 'post';
  /** "Q4 2:11", "Final", "Sun 1:00 PM EST". */
  detail: string;
  start: number;
  home: Team;
  away: Team;
  link?: string;
}

interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  winner?: boolean;
  team?: { abbreviation?: string; shortDisplayName?: string; displayName?: string; logo?: string };
}

interface EspnEvent {
  id: string;
  date: string;
  status?: { type?: { state?: string; shortDetail?: string } };
  competitions?: { competitors?: EspnCompetitor[] }[];
  links?: { href?: string; rel?: string[] }[];
}

const TIMEOUT_MS = 10_000;

function team(c: EspnCompetitor | undefined): Team {
  return {
    abbr: c?.team?.abbreviation ?? '?',
    name: c?.team?.shortDisplayName ?? c?.team?.displayName ?? '',
    logo: c?.team?.logo,
    score: c?.score ?? '',
    winner: !!c?.winner,
  };
}

export async function fetchLeagueGames(league: League): Promise<Game[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { events?: EspnEvent[] };
    return (data.events ?? []).map((e) => {
      const competitors = e.competitions?.[0]?.competitors ?? [];
      const state = e.status?.type?.state;
      return {
        id: `${league.id}:${e.id}`,
        league: league.id,
        leagueName: league.name,
        state: state === 'in' || state === 'post' ? state : 'pre',
        detail: e.status?.type?.shortDetail ?? '',
        start: Date.parse(e.date) || 0,
        home: team(competitors.find((c) => c.homeAway === 'home')),
        away: team(competitors.find((c) => c.homeAway === 'away')),
        link: e.links?.find((l) => l.rel?.includes('summary'))?.href ?? e.links?.[0]?.href,
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

const ORDER = { in: 0, pre: 1, post: 2 } as const;

/**
 * Games across leagues: live first, then upcoming (soonest first), then finished (latest first).
 * Games with a favourite team come first within each group.
 */
export async function fetchGames(favorites: string[] = []): Promise<Game[]> {
  const results = await Promise.allSettled(LEAGUES.map(fetchLeagueGames));
  const fav = (g: Game) => (favorites.some((f) => f === g.home.abbr || f === g.away.abbr) ? 0 : 1);
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort(
      (a, b) =>
        ORDER[a.state] - ORDER[b.state] ||
        fav(a) - fav(b) ||
        (a.state === 'post' ? b.start - a.start : a.start - b.start),
    );
}
