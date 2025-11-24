import type {
  MatchEvent,
  MatchesApiResponse,
  MarketConfigEntry,
  MarketConfigResponse,
  PlayedEventPercentageResponse,
  OutcomePlayPercentagesResponse,
  CompetitionsResponse,
  EventDetailResponse,
  EventsResponse,
  StandingRow,
  EventsScoreMap,
} from "@/types/match";

type DataResponse<T> = {
  data?: T;
  [key: string]: unknown;
};

type CacheEntry<T> = {
  value: T;
  expires: number;
};

const emptyPromise = Promise.resolve(null);

export class MatchesService {
  private sportradarToken: string | null = null;
  private tokenExpiry = 0;
  private cache = new Map<string, CacheEntry<unknown>>();

  private generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  private makeHeaders() {
    return {
      accept: "application/json, text/plain, */*",
      "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      "client-transaction-id": this.generateUUID(),
      origin: "https://www.iddaa.com",
      platform: "web",
      pragma: "no-cache",
      referer: "https://www.iddaa.com/",
      timestamp: Date.now().toString(),
    };
  }

  private async fetchJson<T>(url: string, ttlMs?: number): Promise<T | null> {
    if (ttlMs && ttlMs > 0) {
      const cached = this.cache.get(url) as CacheEntry<T> | undefined;
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
    }

    const res = await fetch(url, { headers: this.makeHeaders() });
    if (!res.ok) return null;
    const json = (await res.json()) as T;

    if (ttlMs && ttlMs > 0) {
      this.cache.set(url, { value: json, expires: Date.now() + ttlMs });
    }

    return json;
  }

  private getEventId(event: MatchEvent | { id?: number | string }): string {
    const rawId = (event as MatchEvent)?.i ?? (event as { id?: number | string }).id;
    return rawId ? String(rawId) : "";
  }

  private async fetchSportradarToken() {
    try {
      const envToken = process.env.SPORTRADAR_TOKEN;
      if (envToken) {
        if (
          this.sportradarToken === envToken &&
          this.tokenExpiry > Date.now()
        ) {
          return this.sportradarToken;
        }
        const expMatch = envToken.match(/exp=(\d+)/);
        if (expMatch) {
          this.tokenExpiry = parseInt(expMatch[1]) * 1000;
        }
        this.sportradarToken = envToken;
        return this.sportradarToken;
      }

      if (this.sportradarToken && this.tokenExpiry > Date.now()) {
        return this.sportradarToken;
      }

      const hardcodedToken =
        "exp=1763848591~acl=/*~data=eyJvIjoiaHR0cHM6Ly93d3cuaWRkYWEuY29tIiwiYSI6IjAyN2Q4MDhhZWI2MDBmOTMwYmFhMDBjNDU4M2U3OGFlIiwiYWN0Ijoib3JpZ2luY2hlY2siLCJvc3JjIjoib3JpZ2luIn0~hmac=2d419e8100f0783eb12173768417abfd4118c19e69619bc1915653b2f2084a3c";

      const expMatch = hardcodedToken.match(/exp=(\d+)/);
      if (expMatch) {
        this.tokenExpiry = parseInt(expMatch[1]) * 1000;
      }

      this.sportradarToken = hardcodedToken;
      return this.sportradarToken;
    } catch {
      return null;
    }
  }

  private async fetchSportradarStats(
    betradarId: number | string,
    token: string
  ) {
    try {
      const url = `https://lmt.fn.sportradar.com/common/tr/Etc:UTC/gismo/match_detailsextended/${betradarId}?T=${token}`;
      const response = await fetch(url, {
        headers: {
          accept: "*/*",
          "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
          origin: "https://www.iddaa.com",
          referer: "https://www.iddaa.com/",
        },
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async getPayload(request: Request): Promise<MatchesApiResponse> {
    const { searchParams } = new URL(request.url);
    const sortMode = searchParams.get("sort") || "markets";
    const filterCompetition = searchParams.get("competition") || "all";
    const filterStatus = searchParams.get("status") || "all";
    const includeUpcoming =
      searchParams.get("includeUpcoming") === "1" ||
      searchParams.get("includeUpcoming") === "true";

    const marketConfigPromise = this.fetchJson<MarketConfigResponse>(
      "https://sportsbookv2.iddaa.com/sportsbook/get_market_config",
      10 * 60 * 1000 // cache for 10 minutes
    );
    const [
      matchesData,
      competitionsData,
      playPercentagesData,
      matchPopularityData,
      marketConfigData,
    ] = await Promise.all([
      this.fetchJson<EventsResponse>(
        "https://sportsbookv2.iddaa.com/sportsbook/events?st=1&type=1&version=0"
      ),
      this.fetchJson<CompetitionsResponse>(
        "https://sportsbookv2.iddaa.com/sportsbook/competitions",
        60 * 60 * 1000 // cache for 1 hour
      ),
      this.fetchJson<OutcomePlayPercentagesResponse>(
        "https://sportsbookv2.iddaa.com/sportsbook/outcome-play-percentages?sportType=1",
        30 * 1000 // cache for 30 seconds
      ),
      this.fetchJson<PlayedEventPercentageResponse>(
        "https://sportsbookv2.iddaa.com/sportsbook/played-event-percentage?sportType=1",
        30 * 1000 // cache for 30 seconds
      ),
      marketConfigPromise,
    ]);

    const competitions = competitionsData?.data || [];
    const competitionsMap: Record<number, number> = {};
    const competitionNames: Record<number, string> = {};
    const competitionIcons: Record<number, string> = {};
    competitions.forEach((comp) => {
      if (comp.i) {
        if (comp.p) competitionsMap[comp.i] = comp.p;
        if (comp.n) competitionNames[comp.i] = comp.n;
        if (comp.cid) {
          competitionIcons[
            comp.i
          ] = `https://www.iddaa.com/images/country-flags/${comp.cid.toLowerCase()}.png`;
        }
      }
    });

    const marketConfigs: Record<string, MarketConfigEntry> =
      marketConfigData?.data?.m || {};
    const marketConfigMap: Record<string, MarketConfigEntry> = {};
    const storeConfig = (config: MarketConfigEntry) => {
      if (!config.mst) return;
      const keys = [String(config.mst)];
      if (config.mt) keys.push(`${config.mt}_${config.mst}`);
      keys.forEach((k) => {
        if (!marketConfigMap[k]) {
          marketConfigMap[k] = config;
        }
      });
    };
    Object.values(marketConfigs).forEach((config: MarketConfigEntry) => {
      if (config.mt === 4) storeConfig(config);
    });
    Object.values(marketConfigs).forEach((config: MarketConfigEntry) => {
      storeConfig(config);
    });

    const scoreMap = (matchesData?.data?.sc || {}) as EventsScoreMap;
    const allEvents: MatchEvent[] = (matchesData?.data?.events || []) as MatchEvent[];
    allEvents.forEach((ev) => {
      const key = ev?.i ? String(ev.i) : undefined;
      if (key && !ev.sc && scoreMap[key]) {
        ev.sc = scoreMap[key];
      }
    });
    const events = allEvents.filter((ev) => {
      const status = ev.s ?? 0;
      if (includeUpcoming && status === 0) return true;
      return status > 0;
    });

    const sportradarTokenValue = await this.fetchSportradarToken();

    const enrichedMatches: MatchEvent[] = [];
    for (let i = 0; i < events.length; i += 5) {
      const batch = events.slice(i, i + 5);
      const detailsPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId) return emptyPromise as Promise<EventDetailResponse | null>;
        return this.fetchJson<EventDetailResponse>(
          `https://sportsbookv2.iddaa.com/sportsbook/event/${eventId}?allMarkets=true`
        );
      });
      const statisticsPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["statistics"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["statistics"]>>(
          `https://statisticsv2.iddaa.com/statistics/eventsummary/1/${eventId}`
        );
      });
      const headToHeadPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["headToHead"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["headToHead"]>>(
          `https://statisticsv2.iddaa.com/statistics/headtohead/1/${eventId}/10`
        );
      });
      const lastMatchesPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["lastMatches"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["lastMatches"]>>(
          `https://statisticsv2.iddaa.com/statistics/lastmatches/1/${eventId}/10`
        );
      });
      const analysisPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["iddaaAnalysis"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["iddaaAnalysis"]>>(
          `https://statisticsv2.iddaa.com/statistics/socceriddaaanalys/${eventId}`
        );
      });
      const missingPlayersPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["missingPlayers"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["missingPlayers"]>>(
          `https://statisticsv2.iddaa.com/statistics/missingplayerandstats/1/${eventId}`
        );
      });
      const refereeStatsPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["refereeStats"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["refereeStats"]>>(
          `https://statisticsv2.iddaa.com/statistics/soccerrefereepage/${eventId}/10`
        );
      });
      const standingsPromises = batch.map((event) => {
        const eventId = this.getEventId(event);
        if (!eventId)
          return emptyPromise as Promise<DataResponse<MatchEvent["standings"]> | null>;
        return this.fetchJson<DataResponse<MatchEvent["standings"]>>(
          `https://statisticsv2.iddaa.com/statistics/standing/1/${eventId}`
        );
      });

      const sportradarPromises = batch.map((event) => {
        const betradarId = (event as MatchEvent)?.bri;
        if (betradarId && sportradarTokenValue) {
          return this.fetchSportradarStats(betradarId, sportradarTokenValue);
        }
        return emptyPromise;
      });

      const [
        batchDetails,
        batchStatistics,
        batchHeadToHead,
        batchLastMatches,
        batchAnalysis,
        batchMissingPlayers,
        batchRefereeStats,
        batchStandings,
        batchSportradar,
      ] = await Promise.all([
        Promise.all(detailsPromises),
        Promise.all(statisticsPromises),
        Promise.all(headToHeadPromises),
        Promise.all(lastMatchesPromises),
        Promise.all(analysisPromises),
        Promise.all(missingPlayersPromises),
        Promise.all(refereeStatsPromises),
        Promise.all(standingsPromises),
        Promise.all(sportradarPromises),
      ]);

      batch.forEach((event, idx) => {
        const details = batchDetails[idx];
        const stats = batchStatistics[idx];
        const h2h = batchHeadToHead[idx];
        const lastMatches = batchLastMatches[idx];
        const analysis = batchAnalysis[idx];
        const missingPlayers = batchMissingPlayers[idx];
        const refereeStats = batchRefereeStats[idx];
        const standings = batchStandings[idx];
        const sportradarData = batchSportradar[idx];

        const enrichedEvent: MatchEvent = {
          ...event,
          m: event.m || [],
        };

        if (details?.data) {
          Object.assign(enrichedEvent, details.data);
          const detailMarkets = details.data.m || details.data.markets;
          enrichedEvent.m = detailMarkets || event.m || [];
        }

        if (stats?.data) {
          enrichedEvent.statistics = stats.data;
          const ts = (stats.data as { tournamentStandingsModel?: unknown })?.tournamentStandingsModel;
          if (!enrichedEvent.standings && ts) {
            enrichedEvent.standings = { overAll: ts as unknown as StandingRow[] };
          }
        }
        if (h2h?.data) {
          enrichedEvent.headToHead = h2h.data;
        }
        if (lastMatches?.data) {
          enrichedEvent.lastMatches = lastMatches.data;
        }
        if (analysis?.data) {
          enrichedEvent.iddaaAnalysis = analysis.data;
        }
        if (missingPlayers?.data) {
          enrichedEvent.missingPlayers = missingPlayers.data;
        }
        if (refereeStats?.data) {
          enrichedEvent.refereeStats = refereeStats.data;
        }
        if (standings?.data) {
          enrichedEvent.standings = standings.data;
        }
        if (sportradarData) {
          const sportradarDoc =
            (
              sportradarData as {
                doc?: Array<Record<string, unknown>>;
                data?: unknown;
              }
            )?.doc?.[0] ||
            (sportradarData as { data?: unknown })?.data ||
            sportradarData;
          if (sportradarDoc) {
            enrichedEvent.sportradar =
              sportradarDoc as unknown as MatchEvent["sportradar"];
          }
        }

        enrichedMatches.push(enrichedEvent);
      });
    }

    const playPercentages =
      playPercentagesData?.data || {};
    const matchPopularity: Record<string, number> =
      matchPopularityData?.data || {};

    let filteredMatches = enrichedMatches;
    if (filterCompetition !== "all") {
      filteredMatches = filteredMatches.filter(
        (m) => String(m.ci) === filterCompetition
      );
    }
    if (filterStatus !== "all") {
      filteredMatches = filteredMatches.filter((m) => {
        const status = m.s ?? 0;
        if (filterStatus === "live") return status > 0 && status !== 2;
        if (filterStatus === "ht") return status === 2;
        if (filterStatus === "upcoming") return status === 0;
        return true;
      });
    }

    filteredMatches.sort((a, b) => {
      switch (sortMode) {
        case "time":
          return (a?.d ?? 0) - (b?.d ?? 0);
        case "league":
          return (a?.ci ?? 0) - (b?.ci ?? 0);
        case "home":
          return (a?.hn ?? "").localeCompare(b?.hn ?? "");
        case "markets":
        default:
          return (b?.m?.length ?? 0) - (a?.m?.length ?? 0);
      }
    });

    return {
      ...(matchesData || {}),
      data: filteredMatches,
      competitions: competitionsMap,
      competitionNames,
      competitionIcons,
      playPercentages,
      matchPopularity,
      marketConfig: marketConfigMap,
    };
  }
}

export const matchesService = new MatchesService();
