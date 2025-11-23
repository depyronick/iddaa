import { NextResponse } from "next/server";
import { matchesService } from "@/lib/services/matches";
import type {
  MatchEvent,
  Market,
  Outcome,
  MatchesApiResponse,
  MarketConfigEntry,
} from "@/types/match";

type OutcomeV2 = {
  id?: number | string;
  name?: string;
  odd?: number;
  previousOdd?: number;
  value?: number | string | null;
};

type MarketV2 = {
  id?: number;
  type?: number;
  subType?: number | string;
  status?: number;
  betCount?: number;
  line?: string | number | null;
  name?: string;
  displayName?: string;
  outcomes: OutcomeV2[];
};

type MatchV2 = {
  id?: number | string;
  betradarId?: number;
  status?: number;
  betPeriod?: number;
  kickoff?: number;
  sportId?: number;
  competition?: {
    id?: number;
    name?: string;
    parentId?: number;
    icon?: string;
  };
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  markets: MarketV2[];
  popularity?: number;
  playPercentages?: MatchesApiResponse["playPercentages"][string];
  sc?: MatchEvent["sc"];
  statistics?: MatchEvent["statistics"];
  headToHead?: MatchEvent["headToHead"];
  lastMatches?: MatchEvent["lastMatches"];
  iddaaAnalysis?: MatchEvent["iddaaAnalysis"];
  missingPlayers?: MatchEvent["missingPlayers"];
  refereeStats?: MatchEvent["refereeStats"];
  standings?: MatchEvent["standings"];
  sportradar?: MatchEvent["sportradar"];
};

function mapOutcome(outcome: Outcome): OutcomeV2 {
  return {
    id: outcome.no ?? outcome.on ?? outcome.No,
    name: outcome.n,
    odd: outcome.odd,
    previousOdd: outcome.wodd,
    value: outcome.v ?? outcome.ov ?? outcome.cs ?? null,
  };
}

function mapMarket(
  market: Market,
  marketConfig: Record<string, MarketConfigEntry>
): MarketV2 {
  const configKey = market.st ? String(market.st) : undefined;
  const altKey =
    market.t !== undefined && market.st !== undefined
      ? `${market.t}_${market.st}`
      : undefined;
  const config: MarketConfigEntry | undefined =
    ((configKey && marketConfig[configKey]) ||
      (altKey && marketConfig[altKey])) as MarketConfigEntry | undefined;

  return {
    id: market.i,
    type: market.t,
    subType: market.st,
    status: market.s,
    betCount: market.mbc,
    line: market.sov ?? null,
    name: market.n,
    displayName: config?.n ?? config?.sn ?? market.n,
    outcomes: (market.o || []).map(mapOutcome),
  };
}

function mapMatch(
  event: MatchEvent,
  payload: MatchesApiResponse
): MatchV2 {
  const competitionId = event.ci;
  const eventId = event.i ? String(event.i) : "";
  const mappedMarkets = (event.m || []).map((m) =>
    mapMarket(m, payload.marketConfig)
  );

  return {
    id: event.i,
    betradarId: event.bri,
    status: event.s,
    betPeriod: event.bp,
    kickoff: event.d,
    sportId: event.sid,
    competition: competitionId
      ? {
          id: competitionId,
          name: payload.competitionNames[competitionId],
          parentId: payload.competitions[competitionId],
          icon: payload.competitionIcons[competitionId],
        }
      : undefined,
    homeTeam: { name: event.hn },
    awayTeam: { name: event.an },
    markets: mappedMarkets,
    popularity: payload.matchPopularity[eventId],
    playPercentages: payload.playPercentages[eventId],
    sc: event.sc,
    statistics: event.statistics,
    headToHead: event.headToHead,
    lastMatches: event.lastMatches,
    iddaaAnalysis: event.iddaaAnalysis,
    missingPlayers: event.missingPlayers,
    refereeStats: event.refereeStats,
    standings: event.standings,
    sportradar: event.sportradar,
  };
}

function buildCompetitionsMeta(payload: MatchesApiResponse) {
  const meta: Record<number, { name?: string; parentId?: number; icon?: string }> = {};
  Object.keys(payload.competitionNames).forEach((key) => {
    const id = Number(key);
    meta[id] = {
      name: payload.competitionNames[id],
      parentId: payload.competitions[id],
      icon: payload.competitionIcons[id],
    };
  });
  return meta;
}

export async function GET(request: Request) {
  try {
    const payload = await matchesService.getPayload(request);
    const matches = payload.data.map((ev) => mapMatch(ev, payload));

    return NextResponse.json({
      matches,
      meta: {
        competitions: buildCompetitionsMeta(payload),
        playPercentages: payload.playPercentages,
        matchPopularity: payload.matchPopularity,
        marketConfig: payload.marketConfig,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
