/**
 * Types describing the shape of the matches API response and nested structures.
 * These mirror the iddaa.com live event payload enriched with additional data sources.
 */

/** Outcome/odd within a market. */
export interface Outcome {
  /** Outcome number (provider specific id). */
  on?: number | string;
  /** Alternate outcome number key (lowercase). */
  no?: number | string;
  /** Outcome label (e.g., "Üst", "Alt"). */
  n?: string;
  /** Outcome ordinal number (alternative id). */
  No?: number | string;
  /** Decimal odd value (current). */
  odd?: number;
  /** Previous/original odd value (inferred). */
  wodd?: number;
  /** Correct score text (observed on CS markets). */
  cs?: string;
  /** Outcome value/handicap (used in spread/total markets). */
  v?: number | string;
  /** Outcome value/handicap as string (observed). */
  ov?: number | string;
  /** Odd as string (observed sodd/oodd placeholders). */
  sodd?: string;
  /** Additional provider-specific fields. */
  [key: string]: unknown;
}

/** Market definition on an event. */
export interface Market {
  /** Market id (mid). */
  i?: number;
  /** Market type code (part of muk). */
  t?: number;
  /** Market status (id). */
  st?: number | string;
  /** Market name. */
  n?: string;
  /** Market name override (mn) from config. */
  mn?: string;
  /** Market version/update timestamp (observed as v). */
  v?: number;
  /** Market type. */
  mt?: number;
  /** Market group/type code. */
  m?: number | string;
  /** Market state (1=open). */
  s?: number;
  /** Market odds list. */
  o?: Outcome[];
  /** Market line/handicap value. */
  sov?: string | number | null;
  /** Market subtype. */
  mst?: number;
  /** Market unique key `${t}_${st}` (observed as muk). */
  muk?: string;
  /** Minimum/actual bet count (mbc). */
  mbc?: number;
  /** Market number/ordering code (mno) (inferred). */
  mno?: string;
  /** Market display value (mv) (inferred). */
  mv?: string | number;
  /** Additional provider-specific fields. */
  [key: string]: unknown;
}

/** Market config entry returned by market_config endpoint (field meanings partly inferred from usage). */
export interface MarketConfigEntry {
  i: number;
  n: string;
  il: boolean;
  mt: number;
  mmdv: number;
  mmlv: number;
  p: number;
  st: number;
  mst: number;
  mdv: number;
  mlv: number;
  d?: string;
  o?: Record<string, string>;
  sn?: string;
  so?: Record<string, string>;
  in?: boolean;
}

/** Market group definition. */
export interface MarketConfigGroup {
  i: number;
  n: string;
  p: number; // ordering/prioritization (inferred)
  st: number; // sport id (matches events.sid)
  sg: number[]; // subgroup ids
  im: boolean; // include in menu (inferred)
  iv: boolean; // include in view (inferred)
}

/** Market subgroup definition. */
export interface MarketConfigSubGroup {
  i: number;
  n: string;
  p: number; // ordering (inferred)
  mg: number; // parent group id
  m: string[]; // market ids (mst keys)
  im: boolean; // include in menu (inferred)
  iv: boolean; // include in view (inferred)
  il: boolean; // in-live flag (inferred)
  h?: string[][]; // headers/options matrix (observed)
}

/** Sport metadata attached to market config. */
export interface MarketConfigSport {
  i: number;
  n: string;
  p: number;
  ic: string;
  ics: string;
  icc: string;
  sl: string;
}

/** Full payload of get_market_config endpoint. */
export interface MarketConfigData {
  m: Record<string, MarketConfigEntry>;
  mg: Record<string, MarketConfigGroup>;
  msg: Record<string, MarketConfigSubGroup>;
  dmg: Record<string, MarketConfigGroup>;
  dmsg: Record<string, MarketConfigSubGroup>;
  s: Record<string, MarketConfigSport>;
}

export interface MarketConfigResponse {
  isSuccess: boolean;
  message: string;
  data: MarketConfigData;
}

/** Played-event popularity percentages keyed by event id (eventId -> percent). */
export type PlayedEventPercentageMap = Record<string, number>;

/** Response from /sportsbook/played-event-percentage. */
export interface PlayedEventPercentageResponse {
  isSuccess: boolean;
  data: PlayedEventPercentageMap;
  message: string;
}

/** Outcome play percentages: eventId -> marketId (mst) -> outcomeId -> percentage. */
export type OutcomePlayPercentagesMap = Record<string, Record<string, Record<string, number>>>;

/** Response from /sportsbook/outcome-play-percentages. */
export interface OutcomePlayPercentagesResponse {
  isSuccess: boolean;
  data: OutcomePlayPercentagesMap;
  message: string;
}

/** Competition entry returned by /sportsbook/competitions. */
export interface Competition {
  /** Competition id. */
  i: number;
  /** Country/region code (used for flag/icon). */
  cid: string;
  /** Parent competition id or ordering (inferred, always present). */
  p: number;
  /** Icon URL (flag/emblem). */
  ic: string;
  /** Short name. */
  sn?: string;
  /** Sport id (matches events.sid). */
  si: string;
  /** Full display name. */
  n: string;
  /** Reference id (external mapping). */
  cref?: number;
}

export interface CompetitionsResponse {
  isSuccess: boolean;
  data: Competition[];
  message: string;
}

/** Live scores chunk inside events feed. */
export interface EventsScoreSide {
  /** Total goals/points. */
  r?: number;
  /** Corner/shot count (context dependent). */
  c?: number;
  /** Half-time score. */
  ht?: number;
  /** Corners overall. */
  co?: number;
  /** Home corners (for away side it may be opponent corners). */
  hco?: number;
  /** Yellow cards. */
  yc?: number;
  /** Red cards. */
  rc?: number;
}

export interface EventScore {
  sid?: number;
  id?: number;
  t?: number; // server timestamp (observed)
  s?: number; // status code (matches EventsListItem.s)
  ht?: EventsScoreSide; // home side stats (r=score; others inferred: c/co/hco/ht=corner/ht counts, yc/rc=cards)
  at?: EventsScoreSide; // away side stats
  min?: number; // live minute (observed)
  sec?: number; // live seconds (observed)
}

export interface EventsScoreMap {
  [eventId: string]: EventScore;
}

/** Lightweight event entry from /sportsbook/events. */
export interface EventsListItem {
  /** Event id. */
  i?: number;
  /** Betradar id. */
  bri?: number;
  /** Version/timestamp. */
  v?: number;
  /** Home/away names. */
  hn?: string;
  an?: string;
  /** Sport id. */
  sid?: number;
  /** Status code (see StatusLabels below). */
  s?: number;
  /** Bet period/live flag (bp>0 when in-play). */
  bp?: number;
  /** In-live availability flag. */
  il?: boolean;
  /** Markets array (may be empty in events feed). */
  m?: Market[];
  /** Competition id. */
  ci?: number;
  /** Market count (socket `mc`, used for widget updates). */
  oc?: number;
  /** Kickoff timestamp (epoch seconds). */
  d?: number;
  /** Has changes flag (inferred). */
  hc?: boolean; // used in UI to show stats tab; treated as “has statistics/coverage” flag
  /** Rapid market flag (used by hasRapidMarket filter). */
  hr?: boolean;
  /** Minimum bet count (MBS). */
  mbc?: number;
  /** King Odds available (boosted odds badge). */
  kOdd?: boolean;
  /** King MBS available (lower MBS badge). */
  kMbc?: number;
  /** King Live available (iddaa.com live badge). */
  kLive?: boolean;
  /** Duel availability flag (drives “Düello” tooltip). */
  hduel?: boolean;
  /** King bet perks count badge (kOdd/kMbc/kLive). */
  skbet?: number;
  /** King bet perks presence flag (computed as any of kOdd/kMbc/kLive). */
  iskbet?: boolean | number;
  /** Match popularity id link (inferred). */
  mpi?: number | string; // used as path-friendly match id in URLs when present
  /** Score/live data (same shape as EventScore). */
  sc?: EventScore;
}

/** Response from /sportsbook/events. */
export interface EventsResponse {
  isSuccess: boolean;
  data: {
    isdiff?: boolean;
    version?: number;
    events?: EventsListItem[];
    sc?: EventsScoreMap;
    rmi?: unknown[];
  };
  message: string;
}

/** Response from /sportsbook/event/{id}?allMarkets=true (markets may be under m or markets). */
export interface EventDetailResponse {
  isSuccess: boolean;
  data: MatchEvent & {
    markets?: MatchEvent["m"];
    m?: MatchEvent["m"];
  };
  message: string;
}

/** Known sport ids from client bundle (populer-bahisler page). */
export const SportIds = {
  SOCCER: 1,
  BASKETBALL: 2,
  BASEBALL: 3,
  ICE_HOCKEY: 4,
  TENNIS: 5,
  HANDBALL: 6,
  FLOOR_BALL: 7,
  GOLF: 9,
  MOTO_GP: 11,
  RUGBY: 12,
  AUSSIE_RULES: 13,
  WINTER_SPORTS: 14,
  BANDY: 15,
  SNOOKER: 19,
  TABLE_TENNIS: 20,
  DARTS: 22,
  VOLLEYBALL: 23,
  FIELD_HOCKEY: 24,
  WATER_POLO: 26,
  CURLING: 28,
  FUTSAL: 29,
  OLYMPICS: 30,
  BADMINTON: 31,
  BEACH_VOLLEY: 34,
  FORMULA_1: 40,
  BEACH_SOCCER: 60,
  PESAPOLLO: 61,
  CS_GO: 109,
  LOL: 110,
  DOTA: 111,
  STAR_CRAFT: 112,
  HEARTH_STONE: 113,
  MMA: 117,
  CALL_OF_DUTY: 118,
  OVERWATCH: 121,
  DUEL: 998,
  E_FOOTBALL: 137,
  E_BASKETBALL: 153,
} as const;

/** Status labels map from client bundle (populer-bahisler page). */
export const StatusLabels: Record<number, string> = {
  1: "Canlı",
  2: "1.Y",
  3: "2.Y",
  4: "D.A",
  5: "Bitti",
  6: "Bitti",
  7: "UZ 1.Y",
  8: "UZ İY",
  9: "UZ 2.Y",
  10: "UZMS",
  11: "PEN",
  12: "PENMS",
  13: "ERT",
  14: "İPT",
  15: "1.P",
  16: "2.P",
  17: "3.P",
  18: "4.P",
  19: "1.Set",
  20: "2.Set",
  21: "3.Set",
  22: "4.Set",
  23: "5.Set",
  24: "ERT",
  25: "DUR",
  26: "İPT",
  27: "3.UZ",
  28: "4.UZ",
  29: "5.UZ",
  30: "6.UZ",
  31: "7.UZ",
  32: "8.UZ",
  33: "9.UZ",
  34: "CANLI",
  35: "UZ",
  36: "PEN",
  37: "5.P",
  38: "6.P",
  39: "7.P",
  40: "8.P",
  41: "9.P",
  42: "6.S",
  43: "7.S",
  44: "8.S",
  45: "9.S",
  46: "10.S",
  47: "1.D",
  48: "2.D",
  49: "ARA",
  50: "1.G",
  51: "1.GS",
  52: "2.G",
  53: "2.GS",
  54: "3.G",
  55: "3.GS",
  56: "4.G",
  57: "4.GS",
  58: "5.G",
  59: "5.GS",
  60: "UZ",
  61: "MS",
  62: "UZ",
  63: "ARA",
  64: "MBÜ",
  65: "UZA",
  66: "UZS",
  67: "ERT",
  68: "HKMN",
  69: "HKMN",
  70: "HKMN",
  71: "HKMN",
  72: "1.P",
  73: "2.P",
  74: "2.P",
  75: "3.P",
  76: "3.P",
  77: "4.P",
  78: "4.P",
  79: "4.P",
  80: "1.O",
  81: "2.O",
  82: "3.O",
  83: "4.O",
  84: "5.O",
  85: "6.O",
  86: "7.O",
  87: "A.S",
  88: "MS",
  89: "UZ",
  90: "1.D ÜST",
  91: "ÜA D",
  92: "1.D ALT",
  93: "ÜA D",
  94: "2.D ÜST",
  95: "ÜA D",
  96: "2.D ALT",
  97: "ÜA D",
  98: "3.D ÜST",
  99: "ÜA D",
  100: "3.D ALT",
  101: "ÜA D",
  102: "4.D ÜST",
  103: "ÜA D",
  104: "4.D ALT",
  105: "5.D ÜST",
  106: "ÜA D",
  107: "5.D ALT",
  108: "6.D ÜST",
  109: "ÜA D",
  110: "6.D ALT",
  111: "ÜA D",
  112: "7.D ÜST",
  113: "ÜA D",
  114: "7.D ALT",
  115: "ÜA D",
  116: "8.D ÜST",
  117: "ÜA D",
  118: "8.D ALT",
  119: "ÜA D",
  120: "9.D ÜST",
  121: "1.DS",
  122: "2.DS",
  123: "3.DS",
  124: "4.DS",
  125: "5.DS",
  126: "6.DS",
  127: "7.DS",
  128: "8.DS",
  129: "9.DS",
  130: "10.DS",
  131: "3.D",
  132: "4.D",
  133: "UZ.D",
  134: "D.A",
  135: "D.A",
  136: "D.A",
  137: "D.A",
  138: "11.S",
  139: "12.S",
  140: "13.S",
  141: "1.H",
  142: "2.H",
  143: "3.H",
  144: "4.H",
  145: "5.H",
  146: "5.A",
  147: "6.H",
  148: "6.A",
  149: "7.H",
  150: "ÜA D",
  151: "9.D ALT",
  152: "ÜA D",
  153: "UZ.D ÜST",
  154: "ÜA D",
  155: "UZ.D ALT",
  156: "MO",
};
/** Basic team information. */
export interface TeamInfo {
  id?: number;
  name?: string;
  logo?: string;
  mediumName?: string;
  shortName?: string;
}

/** Score totals and card counts. */
export interface ScoreInfo {
  home?: number;
  away?: number;
  homeRedCards?: number;
  awayRedCards?: number;
}

/** Match status details. */
export interface MatchStatusInfo {
  name?: string;
  elapsedTime?: number;
}

/** Period descriptor (e.g., 1st half / 2nd half). */
export interface PeriodInfo {
  name?: string;
}

/** Venue/weather/referee and round information. */
export interface EventPlaceInformation {
  stadiumName?: string;
  refereeName?: string;
  weatherStatus?: string;
  temperatureC?: number;
}

export interface RoundInformation {
  name?: string;
}

/** Incident (goal/card/etc.) item. */
export interface Incident {
  incidentType?: { name?: string };
  incidentTime?: number;
  isHome?: boolean;
  [key: string]: unknown;
}

export interface IncidentsModel {
  incidents?: Incident[];
}

/** Event information for statistics payload. */
export interface EventInformationModel {
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
  score?: ScoreInfo;
  matchStatus?: MatchStatusInfo;
  period?: PeriodInfo;
  eventPlaceInformation?: EventPlaceInformation;
  roundInformation?: RoundInformation;
}

/** Timeline event used by Sportradar/Iddaa event streams. */
export interface TimelineEvent {
  id?: string | number;
  minute?: number;
  min?: number;
  /** Event type code (e.g., 6 goal, 7 pen goal, 8 own goal, 9 missed pen, 1 yellow, 2 second yellow, 3 red, 1000 sub). */
  t?: number;
  /** Match minute. */
  m?: number;
  /** Stoppage time (added minutes). */
  st?: number;
  /** Team id (matches htn/atn.id). */
  tid?: number;
  type?: { shortName?: string; name?: string };
  player?: { knownNameShort?: string; knownName?: string };
  participant?: string;
  team?: number;
  isHome?: boolean;
  /** Primary player name (pn) and secondary player (spn) on assists/second cards). */
  pn?: string;
  spn?: string;
  /** Score after the event (home/away). */
  hs?: number;
  as?: number;
}

/** Recent event used in recent form lists. */
export interface SimpleEvent {
  id?: string | number;
  homeTeam?: { name?: string; score?: number };
  awayTeam?: { name?: string; score?: number };
  hn?: string;
  an?: string;
  homeScore?: number;
  awayScore?: number;
  date?: number;
}

/** Statistics wrapper models returned from statistics endpoints. */
export interface StatisticsModel {
  eventInformationModel?: EventInformationModel;
  incidentsModel?: IncidentsModel;
  soccerMatchEventsAllModel?: { events?: TimelineEvent[] };
  recentEventModel?: { events?: SimpleEvent[] };
  tournamentStandingsModel?: Standings;
  matchStatisticsModel?: Record<string, unknown>;
  soccerIddaaAnalysModel?: {
    generalInformations?: Array<{ text?: string }>;
    bettingAnalysis?: Array<{
      marketName?: string;
      outcomeNo?: string | number;
      text?: string;
    }>;
    homeTeam?: TeamInfo;
    awayTeam?: TeamInfo;
  };
  soccerRefereeStatisticsModel?: Record<string, unknown>;
  soccerRefereePageModel?: Record<string, unknown>;
  lastEventModel?: { events?: SimpleEvent[] };
  statusInformation?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Head-to-head record. */
export interface HeadToHeadScoreLine {
  regular?: number;
  current?: number;
  halfTime?: number;
}

export interface HeadToHeadMatch {
  eventDate?: number;
  homeScore?: number;
  awayScore?: number;
  homeCompetitorId?: number;
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
  homeTeamScore?: HeadToHeadScoreLine;
  awayTeamScore?: HeadToHeadScoreLine;
  tournamentInformation?: { id?: number; name?: string; shortName?: string };
}

export interface HeadToHead {
  headToHeadMatches?: HeadToHeadMatch[];
  overall?: HeadToHeadMatch[];
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
}

/** Last match record. */
export interface LastMatch {
  homeCompetitorId?: number;
  awayCompetitorId?: number;
  homeScore?: number;
  awayScore?: number;
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
  eventDate?: number;
  homeTeamScore?: HeadToHeadScoreLine;
  awayTeamScore?: HeadToHeadScoreLine;
  tournamentInformation?: { id?: number; name?: string; shortName?: string };
}

export interface LastMatches {
  lastMatches?: LastMatch[];
  homeOverAll?: LastMatch[];
  awayOverAll?: LastMatch[];
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
}

/** Missing player info for each team. */
export interface PlayerInfo {
  competitorId?: number;
  playerName?: string;
  position?: string;
  type?: string;
  id?: number;
  name?: string;
  age?: number;
  numberOfMatches?: number;
  lineupCount?: number;
  reason?: string;
  reasonDetail?: string;
  goals?: number;
  assists?: number;
}

export interface MissingPlayers {
  homeTeam?: { id?: number; name?: string; players?: PlayerInfo[] };
  awayTeam?: { id?: number; name?: string; players?: PlayerInfo[] };
  missingPlayers?: PlayerInfo[];
}

/** Referee historical match stats. */
export interface RefereeMatch {
  date?: number;
  tournamentInformation?: { id?: number; name?: string; shortName?: string };
  homeTeam?: TeamInfo & { score?: HeadToHeadScoreLine };
  awayTeam?: TeamInfo & { score?: HeadToHeadScoreLine };
}

export interface RefereeStats {
  refereeName?: string;
  referee?: {
    id?: number;
    name?: string;
    firstName?: string;
    surName?: string;
    age?: number;
    country?: { name?: string; shortName?: string };
  };
  refereeMatches?: RefereeMatch[];
  refereeTournaments?: Array<{ tournament?: { id?: number; name?: string; shortName?: string } }>;
}

/** Standings entry. */
export interface StandingRow {
  competitorId?: number;
  competitorName?: string;
  matchesPlayed?: number;
  scored?: number;
  against?: number;
  homeMatchesPlayed?: number;
  awayMatchesPlayed?: number;
  homeScored?: number;
  awayScored?: number;
  homeScore?: number;
  awayScore?: number;
  average?: number;
  position?: number;
  delta?: number;
  played?: number;
  won?: number;
  draw?: number;
  lost?: number;
  points?: number;
  team?: TeamInfo;
  positionStatus?: { id?: number; name?: string };
  groupingvalue?: { id?: number; parentId?: number };
  nextMatchInfo?: {
    nextMatchTeamId?: number;
    nextMatchTeamName?: string;
    isHome?: boolean;
  };
  formStandings?: Array<number | string>;
}

export interface Standings {
  overAll?: StandingRow[];
  standings?: StandingRow[];
}

/** Sportradar wrapper (only the parts we consume). */
export interface SportradarStats {
  data?: {
    _doc?: string;
    _matchid?: number;
    teams?: { home?: string; away?: string };
    index?: Array<number | string>;
    values?: Record<
      string,
      {
        name?: string;
        value?: Record<string, number | string | Array<string>>;
      }
    >;
    types?: Record<string, string>;
    teamsStats?: {
      home?: { statistics?: Record<string, number> };
      away?: { statistics?: Record<string, number> };
    };
  };
  doc?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/** Top-level match event returned to the client. */
export interface MatchEvent {
  /** Event id. */
  i?: number | string;
  /** Competition id. */
  ci?: number;
  /** Home team name (short). */
  hn?: string;
  /** Away team name (short). */
  an?: string;
  /** Sport id (1 = football). */
  sid?: number;
  /** Match status numeric code. */
  s?: number;
  /** Bet period (live flag). */
  bp?: number;
  /** In-live flag from provider (true when live betting allowed). */
  il?: boolean;
  /** Kickoff timestamp (epoch seconds). */
  d?: number;
  /** Last update timestamp string. */
  v?: number | string;
  /** BetRadar id (for Sportradar fetch). */
  bri?: number;
  /** Markets list. */
  m?: Market[];
  /** Embedded score snapshot (same shape as EventScore). */
  sc?: EventScore;
  /** Statistics payloads from iddaa stats endpoints. */
  statistics?: StatisticsModel;
  /** Head-to-head data. */
  headToHead?: HeadToHead;
  /** Last matches data. */
  lastMatches?: LastMatches;
  /** Iddaa analysis payload. */
  iddaaAnalysis?: Record<string, unknown>;
  /** Missing players info. */
  missingPlayers?: MissingPlayers;
  /** Referee stats info. */
  refereeStats?: RefereeStats;
  /** Standings info. */
  standings?: Standings;
  /** Sportradar enriched data. */
  sportradar?: SportradarStats;
  /** Additional provider fields. */
  [key: string]: unknown;
}

/** Consolidated response returned by /api/matches (v2 payload). */
export interface MatchesApiResponse {
  /** Filtered/enriched event list. */
  data: MatchEvent[];
  /** Map of competition id to parent id. */
  competitions: Record<number, number>;
  /** Competition display names. */
  competitionNames: Record<number, string>;
  /** Competition flag icons. */
  competitionIcons: Record<number, string>;
  /** Play percentages per outcome id. */
  playPercentages: OutcomePlayPercentagesMap;
  /** Popularity percentages per match id. */
  matchPopularity: Record<string, number>;
  /** Market config map keyed by market sub type. */
  marketConfig: Record<string, MarketConfigEntry>;
  /** Original payload passthrough. */
  [key: string]: unknown;
}
