"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusLabels,
  type EventInformationModel,
  type EventScore,
  type HeadToHead,
  type HeadToHeadMatch,
  type LastMatches,
  type LastMatch,
  type MissingPlayers,
  type PlayerInfo,
  type RefereeStats,
  type RefereeMatch,
  type Standings,
  type StandingRow,
  type SportradarStats,
  type TimelineEvent,
  type MatchEvent,
} from "@/types/match";

type Outcome = {
  id?: number | string;
  name?: string;
  odd?: number;
  previousOdd?: number;
  value?: number | string | null;
  on?: number | string;
  no?: number | string;
  No?: number | string;
  [key: string]: unknown;
};

type Market = {
  id?: number;
  type?: number;
  subType?: number | string;
  status?: number;
  betCount?: number;
  line?: string | number | null;
  name?: string;
  displayName?: string;
  outcomes: Outcome[];
  [key: string]: unknown;
};

type PlayPercentages = Record<string, Record<string, number>>;

type CompetitionMeta = { id?: number; name?: string; parentId?: number; icon?: string };

type Match = {
  id?: number | string;
  betradarId?: number;
  status?: number;
  betPeriod?: number;
  kickoff?: number;
  sportId?: number;
  hr?: boolean;
  kOdd?: boolean;
  kMbc?: number;
  kLive?: boolean;
  skbet?: number;
  competition?: CompetitionMeta;
  homeTeam?: { name?: string; id?: number; logo?: string };
  awayTeam?: { name?: string; id?: number; logo?: string };
  markets: Market[];
  popularity?: number;
  playPercentages?: PlayPercentages;
  sc?: EventScore;
  statistics?: { eventInformationModel?: EventInformationModel; soccerMatchEventsAllModel?: { events?: TimelineEvent[] }; [key: string]: unknown };
  headToHead?: HeadToHead;
  lastMatches?: LastMatches;
  iddaaAnalysis?: Record<string, unknown>;
  missingPlayers?: MissingPlayers;
  refereeStats?: RefereeStats;
  standings?: Standings;
  sportradar?: SportradarStats;
  [key: string]: unknown;
};

type MatchesResponse = {
  matches: Match[];
  meta: Record<string, unknown>;
};

type FetchState = "idle" | "loading" | "error";
type ViewMode = "live" | "prematch";

const POLL_MS = 5000;

function formatKickoff(kickoff?: number) {
  if (!kickoff) return "—";
  const date = new Date(kickoff * 1000);
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(code?: number) {
  return StatusLabels[code ?? 0] ?? `Durum ${code ?? 0}`;
}

function formatKickoffTime(kickoff?: number) {
  if (!kickoff) return "Planlandı";
  const date = new Date(kickoff * 1000);
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Visual stat bar component for comparing two values
function StatBar({
  label,
  homeValue,
  awayValue,
  showPercentage = false
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  showPercentage?: boolean;
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-[100px] flex-shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1.5">
        <span className="text-[9px] font-medium w-[16px] text-right flex-shrink-0">{homeValue}</span>
        <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-500/40 transition-all"
            style={{ width: `${homePercent}%` }}
          />
          <div
            className="h-full bg-red-500/40 transition-all"
            style={{ width: `${100 - homePercent}%` }}
          />
        </div>
        <span className="text-[9px] font-medium w-[16px] flex-shrink-0">{awayValue}</span>
        {showPercentage && (
          <span className="text-[8px] text-muted-foreground w-[50px] flex-shrink-0">
            {homePercent.toFixed(0)}-{(100 - homePercent).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Translate common odds names
function translateOddName(name: string): string {
  const translations: Record<string, string> = {
    '1': 'Ev Sahibi',
    '0': 'Beraberlik',
    '2': 'Deplasman',
    'X': 'Beraberlik',
    'Alt': 'Alt',
    'Üst': 'Üst',
    'Var': 'Var',
    'Yok': 'Yok',
  };
  return translations[name] || name;
}

function OddChip({
  oddValue,
  oddName,
  betPercentage
}: {
  oddValue: number;
  oddName: string;
  betPercentage?: number
}) {
  const displayName = translateOddName(oddName);

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono bg-card border-border">
      <span className="text-[10px] text-muted-foreground">{displayName}:</span>
      <span className="font-semibold text-xs">{oddValue.toFixed(2)}</span>
      {betPercentage !== undefined && betPercentage > 0 && (
        <span className="text-[9px] text-muted-foreground ml-0.5">
          ({betPercentage}%)
        </span>
      )}
    </span>
  );
}

// Construct full logo URL
const constructLogoUrl = (logo: string | number | undefined | null) => {
  if (!logo) return null;
  const logoStr = String(logo);
  if (logoStr.startsWith('http://') || logoStr.startsWith('https://')) return logoStr;
  const cleanPath = logoStr.replace(/^\/+/, '');
  const filename = cleanPath.split('/').pop() || cleanPath;
  const finalFilename = filename.includes('.png') ? filename : `${filename}.png`;
  return `https://cdn.broadage.com/images-teams/soccer/256x256/${finalFilename}`;
};

function formatMarketLabel(market: Market) {
  const base =
    market.displayName ||
    market.name ||
    (market.id !== undefined ? `Piyasa ${market.id}` : "Piyasa");
  const line = market.line ?? null;
  if (base.includes("{0}")) {
    return base.replace("{0}", line !== null && line !== undefined ? String(line) : "");
  }
  if (line !== null && line !== undefined && line !== "") {
    return `${base} (${line})`;
  }
  return base;
}

// Match List Item Component
function MatchListItem({
  match,
  active,
  onSelect,
}: {
  match: Match;
  active: boolean;
  onSelect: () => void;
}) {
  // Use sc.s for actual period status, fallback to match.status
  const status =
    match.status === 0
      ? formatKickoffTime(match.kickoff ?? (match as MatchEvent)?.d)
      : statusLabel(match.sc?.s ?? match.status);
  const minute = match.sc?.min;
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded border px-2 py-1.5 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
        active ? "border-primary bg-primary/10" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-xs font-bold truncate">
            {match.homeTeam?.name ?? "Ev Sahibi"}
          </span>
          <span className="text-xs font-bold truncate">
            {match.awayTeam?.name ?? "Deplasman"}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            <Badge variant={match.betPeriod ? "default" : "secondary"} className="text-[9px] h-4 px-1 font-semibold">
              {status}
            </Badge>
            {minute && minute > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 font-semibold">
                {minute}&apos;
              </Badge>
            )}
          </div>
        </div>
      </div>
      {match.competition?.name && (
        <p className="mt-1 text-[9px] text-muted-foreground font-medium truncate">{match.competition.name}</p>
      )}
      {match.popularity !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          <Progress value={match.popularity} className="h-0.5" />
          <span className="text-[9px] text-muted-foreground">{match.popularity}%</span>
        </div>
      )}
    </button>
  );
}

export default function LiveMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showTopBets, setShowTopBets] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const selectedIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mq);
    const handler = (e: MediaQueryListEvent) => update(e);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(true);
    } else {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const sortedMatches = useMemo(
    () =>
      [...matches].sort((a, b) => {
        if (viewMode === "live") {
          const aMin = a.sc?.min ?? -1;
          const bMin = b.sc?.min ?? -1;
          return bMin - aMin;
        }
        const aPop = (a.popularity ?? 0);
        const bPop = (b.popularity ?? 0);
        if (aPop !== bPop) return bPop - aPop;
        const aKickoff = a.kickoff ?? (a as MatchEvent)?.d ?? Infinity;
        const bKickoff = b.kickoff ?? (b as MatchEvent)?.d ?? Infinity;
        return aKickoff - bKickoff;
      }),
    [matches, viewMode]
  );

  const selectedMatch = useMemo(
    () => matches.find((m) => String(m.id) === String(selectedId)),
    [matches, selectedId]
  );

  const isLoading = state === "loading";

  const switchMode = (mode: ViewMode) => {
    setViewMode(mode);
    setMatches([]);
    setSelectedId(null);
    selectedIdRef.current = null;
    setError(null);
    setState("loading");
    setShowTopBets(false);
  };

  const topBetPercentages = useMemo(() => {
    const rows: Array<{
      pct: number;
      market: string;
      outcome: string;
      matchLabel: string;
      matchId?: number | string;
    }> = [];

    matches.forEach((match) => {
      const matchLabel = `${match.homeTeam?.name ?? "Ev"} - ${match.awayTeam?.name ?? "Dep"}`;
      const marketPerc = match.playPercentages || {};

      match.markets.forEach((market) => {
        const marketLabel = formatMarketLabel(market);
        const marketId = market.id !== undefined ? String(market.id) : undefined;
        if (!marketId) return;
        const outcomePerc = marketPerc[marketId] || {};
        market.outcomes.forEach((outcome) => {
          const oid = outcome.id ?? outcome.on ?? outcome.no ?? outcome.No;
          const oidStr = oid !== undefined ? String(oid) : undefined;
          if (!oidStr) return;
          const pct = outcomePerc[oidStr];
          if (pct === undefined || pct === null || pct <= 0) return;
          rows.push({
            pct,
            market: marketLabel,
            outcome: outcome.name || outcome.value?.toString() || oidStr,
            matchLabel,
            matchId: match.id,
          });
        });
      });
    });

    return rows
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [matches]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const fetchMatches = async () => {
      try {
        setState("loading");
        const auth = typeof window !== "undefined" ? window.btoa("depyronick:xpt5Tpx2+") : "";
        const params = new URLSearchParams();
        if (viewMode === "live") {
          params.set("status", "live");
          params.set("includeUpcoming", "0");
        } else {
          params.set("status", "upcoming");
          params.set("includeUpcoming", "1");
        }
        const url = `/api/matches${params.size ? `?${params.toString()}` : ""}`;
        const res = await fetch(url, {
          cache: "no-store",
          headers: auth ? { Authorization: `Basic ${auth}` } : undefined,
        });
        if (!res.ok) throw new Error(res.statusText);
        const json = (await res.json()) as MatchesResponse;
        setMatches(json.matches || []);
        setError(null);
        if (!selectedIdRef.current && json.matches?.length) {
          setSelectedId(json.matches[0].id ?? null);
        }
        setHasLoadedOnce(true);
        setState("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fetch failed";
        setError(message);
        setState("error");
      }
    };

    fetchMatches();
    timer = setInterval(fetchMatches, POLL_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [viewMode]);

  if (state === "loading" && matches.length === 0 && !hasLoadedOnce) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Maçlar yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-muted/30 px-3 py-2 flex-shrink-0">
        <div className="mx-auto max-w-[1800px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-2 text-xs lg:hidden"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
            >
              {isSidebarOpen ? "Kapat" : "Menü"}
            </Button>
            <h1 className="text-2xl font-bold">Canlı Maçlar</h1>
            {isLoading && (
              <span
                className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"
                aria-label="Yükleniyor"
              >
                <span className="sr-only">Yükleniyor</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {matches.length} maç • {Math.round(POLL_MS / 1000)} saniyede bir
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTopBets(true)}
              className="h-8 px-2 text-xs"
            >
              Top 10
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {state === "error" && (
        <div className="px-3 pt-3">
          <div className="mx-auto max-w-[1800px]">
            <Alert variant="destructive">
              <AlertDescription>Hata: {error}</AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {showTopBets && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-background shadow-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">En Çok Oynanan 10 Bahis</span>
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                  {topBetPercentages.length} kayıt
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {viewMode === "live" ? "Canlı filtre" : "Maç önü filtre"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTopBets(false)}
                  className="h-8 px-2 text-xs"
                >
                  Kapat
                </Button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-3">
              {isLoading && matches.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : topBetPercentages.length === 0 ? (
                <div className="text-xs text-muted-foreground">Veri yok.</div>
              ) : (
                <div className="space-y-1">
                  {topBetPercentages.map((row, idx) => (
                    <div key={`${row.matchId}-${row.market}-${row.outcome}-${idx}`} className="flex items-center gap-3 rounded border border-border px-2 py-1.5">
                      <div className="w-10 text-right text-xs font-semibold text-primary">{row.pct}%</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold truncate">{row.market}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{row.outcome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{row.matchLabel}</div>
                      </div>
                      <div className="w-20">
                        <Progress value={row.pct} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Flex Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {isMobile && isSidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-black/40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        {/* Match List Sidebar - Sticky / Drawer */}
        <div
          className={`absolute lg:relative inset-y-0 left-0 z-20 w-[280px] flex-shrink-0 border-r flex flex-col bg-background transition-transform duration-200 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3 pb-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Maçlar</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => switchMode("live")}
                  disabled={isLoading}
                  className={`px-2 py-1 text-[11px] rounded border transition ${
                    viewMode === "live"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50"
                  }`}
                >
                  Canlı
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("prematch")}
                  disabled={isLoading}
                  className={`px-2 py-1 text-[11px] rounded border transition ${
                    viewMode === "prematch"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50"
                  }`}
                >
                  Maç Önü
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 pt-2" aria-busy={isLoading}>
            {isLoading && matches.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <Alert className="py-2">
                <AlertDescription className="text-xs">Görüntülenecek maç bulunamadı.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1.5">
                {sortedMatches.map((match) => (
                  <MatchListItem
                    key={match.id ?? Math.random()}
                    match={match}
                    active={String(selectedId) === String(match.id)}
                    onSelect={() => {
                      setSelectedId(match.id ?? null);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Selected Match Content - Scrollable */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] p-3 pt-2 space-y-3">
              {!selectedMatch ? (
                <Card className="border">
                  <CardContent className="py-8 text-center">
                    <div className="text-sm text-muted-foreground">
                      Detayları görüntülemek için soldan bir maç seçin.
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <CardHeader className="pt-2 pb-1 px-3 space-y-1.5">
                    {/* Competition and Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedMatch.competition?.icon && (
                          <Image
                            src={selectedMatch.competition.icon}
                            alt=""
                            width={16}
                            height={16}
                            className="object-contain"
                            unoptimized
                          />
                        )}
                        {selectedMatch.competition?.name && (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {selectedMatch.competition.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold">
                          {statusLabel(selectedMatch.sc?.s ?? selectedMatch.status)}
                        </Badge>
                        {selectedMatch.sc?.min && selectedMatch.sc.min > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-semibold">
                            {selectedMatch.sc.min}&apos;
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Compact Info Row */}
                    <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const eventInfo = selectedMatch.statistics?.eventInformationModel;
                          const stadium = eventInfo?.eventPlaceInformation?.stadiumName;
                          const weather = eventInfo?.eventPlaceInformation?.weatherStatus;
                          const temperature = eventInfo?.eventPlaceInformation?.temperatureC;
                          const referee = eventInfo?.eventPlaceInformation?.refereeName;

                          return (
                            <>
                              {stadium && (
                                <span className="flex items-center gap-0.5">
                                  📍 <span className="truncate max-w-[120px]">{stadium}</span>
                                </span>
                              )}
                              {(weather || temperature !== undefined) && (
                                <span className="flex items-center gap-0.5">
                                  🌤️ {weather}{temperature !== undefined && temperature !== null && ` ${temperature}°C`}
                                </span>
                              )}
                              {referee && (
                                <span className="flex items-center gap-0.5">
                                  👨‍⚖️ <span className="truncate max-w-[100px]">{referee}</span>
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {selectedMatch.kickoff && (
                          <span>🕐 {formatKickoff(selectedMatch.kickoff)}</span>
                        )}
                        <span>#{selectedMatch.betradarId ?? 'N/A'}</span>
                      </div>
                    </div>

                    {/* Metadata */}
                    {selectedMatch.popularity !== undefined && (
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          🔥 {selectedMatch.popularity.toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="pt-1 pb-2 px-3 space-y-2">
                    {(() => {
                      const match = selectedMatch;
                      const eventInfo = match.statistics?.eventInformationModel;
                      const homeScore = eventInfo?.score?.home ?? 0;
                      const awayScore = eventInfo?.score?.away ?? 0;

                      const homeTeamLogo = constructLogoUrl(eventInfo?.homeTeam?.logo);
                      const awayTeamLogo = constructLogoUrl(eventInfo?.awayTeam?.logo);

                      // Get Sportradar stats
                      const sportradarStats = match.sportradar?.data?.values || {};
                      const getSportradarStat = (key: string) => (sportradarStats as Record<string, { name?: string; value?: Record<string, number | string> }>)[key]?.value || {};
                      const toNum = (val: number | string | undefined): number => typeof val === 'number' ? val : Number(val) || 0;

                      const homePossession = toNum(getSportradarStat('110').home);
                      const awayPossession = toNum(getSportradarStat('110').away);
                      const homeShotsOnTarget = toNum(getSportradarStat('shotson').home);
                      const awayShotsOnTarget = toNum(getSportradarStat('shotson').away);
                      const homeShots = toNum(getSportradarStat('goalattempts').home);
                      const awayShots = toNum(getSportradarStat('goalattempts').away);
                      const homeAttacks = toNum(getSportradarStat('1126').home);
                      const awayAttacks = toNum(getSportradarStat('1126').away);
                      const homeDanger = toNum(getSportradarStat('1029').home);
                      const awayDanger = toNum(getSportradarStat('1029').away);
                      const homeCorners = toNum(getSportradarStat('124').home);
                      const awayCorners = toNum(getSportradarStat('124').away);
                      const homeYellow = toNum(getSportradarStat('40').home);
                      const awayYellow = toNum(getSportradarStat('40').away);
                      const homeRed = toNum(getSportradarStat('50').home);
                      const awayRed = toNum(getSportradarStat('50').away);

                      // Timeline events
                      const timeline = match.statistics?.soccerMatchEventsAllModel?.events || [];

                      // Head to head
                      const headToHead = match.headToHead?.overall || match.headToHead?.headToHeadMatches || [];

                      // Last matches
                      const homeMatches = match.lastMatches?.homeOverAll || [];
                      const awayMatches = match.lastMatches?.awayOverAll || [];

                      // Missing players
                      const homeMissing = match.missingPlayers?.homeTeam?.players || [];
                      const awayMissing = match.missingPlayers?.awayTeam?.players || [];

                      // Referee stats
                      const referee = eventInfo?.eventPlaceInformation?.refereeName;
                      const refereeMatches = match.refereeStats?.refereeMatches || [];

                      // Standings
                      const standings = match.standings?.standings || match.standings?.overAll || [];

                      return (
                        <>
                    {/* Teams and Score */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Home Team */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {homeTeamLogo && (
                            <Image
                              src={homeTeamLogo}
                              alt={match.homeTeam?.name ?? 'Home'}
                              width={28}
                              height={28}
                              className="object-contain"
                              unoptimized
                            />
                          )}
                          <div className="text-sm font-bold truncate">
                            {match.homeTeam?.name ?? 'Ev Sahibi'}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-primary-foreground">
                        <div className="text-xl font-black">{homeScore}</div>
                        <div className="text-sm font-bold opacity-70">-</div>
                        <div className="text-xl font-black">{awayScore}</div>
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-sm font-bold truncate">
                            {match.awayTeam?.name ?? 'Deplasman'}
                          </div>
                          {awayTeamLogo && (
                            <Image
                              src={awayTeamLogo}
                              alt={match.awayTeam?.name ?? 'Away'}
                              width={28}
                              height={28}
                              className="object-contain"
                              unoptimized
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      <span className="flex items-center gap-0.5" title="Sarı Kartlar">
                        <div className="h-2.5 w-1.5 rounded-sm bg-yellow-400" />
                        {homeYellow}-{awayYellow}
                      </span>
                      <span className="flex items-center gap-0.5" title="Kırmızı Kartlar">
                        <div className="h-2.5 w-1.5 rounded-sm bg-red-500" />
                        {homeRed}-{awayRed}
                      </span>
                      <span className="text-muted-foreground" title="Kornerler">
                        Korner: {homeCorners}-{awayCorners}
                      </span>
                    </div>

                    {/* Visual Stats Comparison */}
                    {(homePossession > 0 || awayPossession > 0 || homeShots > 0 || awayShots > 0) && (
                      <>
                        <Separator className="my-1.5" />
                        <div className="space-y-2 bg-muted/30 p-2 rounded">
                          {(homePossession > 0 || awayPossession > 0) && (
                            <StatBar
                              label="Top Sahipliği"
                              homeValue={homePossession}
                              awayValue={awayPossession}
                              showPercentage={true}
                            />
                          )}
                          {(homeShotsOnTarget > 0 || awayShotsOnTarget > 0) && (
                            <StatBar
                              label="İsabetli Şutlar"
                              homeValue={homeShotsOnTarget}
                              awayValue={awayShotsOnTarget}
                            />
                          )}
                          {(homeShots > 0 || awayShots > 0) && (
                            <StatBar
                              label="Toplam Şutlar"
                              homeValue={homeShots}
                              awayValue={awayShots}
                            />
                          )}
                          {(homeAttacks > 0 || awayAttacks > 0) && (
                            <StatBar
                              label="Ataklar"
                              homeValue={homeAttacks}
                              awayValue={awayAttacks}
                            />
                          )}
                          {(homeDanger > 0 || awayDanger > 0) && (
                            <StatBar
                              label="Tehlikeli Ataklar"
                              homeValue={homeDanger}
                              awayValue={awayDanger}
                            />
                          )}
                        </div>
                      </>
                    )}

                    {/* Timeline Events */}
                    {timeline.length > 0 && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Maç Olayları</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {timeline.length}
                                </Badge>
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 space-y-1 ">
                            {timeline.map((event: TimelineEvent, idx: number) => {
                              const minute = event.minute || event.min || '?';
                              const eventType = event.type?.shortName || event.type?.name || 'Olay';
                              const playerName = event.player?.knownNameShort || event.player?.knownName || '';
                              const isHomeTeam = event.team === 1 || event.isHome;

                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2 text-[10px] py-1 px-2 rounded ${
                                    isHomeTeam ? 'bg-blue-500/10' : 'bg-red-500/10'
                                  }`}
                                >
                                  <span className="font-bold text-muted-foreground min-w-[24px]">
                                    {minute}&apos;
                                  </span>
                                  <span className="font-medium">{eventType}</span>
                                  {playerName && (
                                    <span className="text-muted-foreground truncate">{playerName}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </>
                    )}

                    {/* Head to Head */}
                    {headToHead.length > 0 && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Karşılıklı Geçmiş</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {headToHead.length}
                                </Badge>
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 space-y-0.5 ">
                            {headToHead.map((h2hMatch: HeadToHeadMatch, idx: number) => {
                              const homeTeam = h2hMatch.homeTeam?.name;
                              const awayTeam = h2hMatch.awayTeam?.name;
                              const homeScore = h2hMatch.homeTeamScore?.regular ?? h2hMatch.homeScore ?? 0;
                              const awayScore = h2hMatch.awayTeamScore?.regular ?? h2hMatch.awayScore ?? 0;

                              // Determine result from current home team's perspective
                              const isCurrentHome = homeTeam === match.homeTeam?.name;
                              const won = isCurrentHome ? homeScore > awayScore : awayScore > homeScore;
                              const lost = isCurrentHome ? homeScore < awayScore : awayScore < homeScore;
                              const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                              return (
                                <div key={idx} className="text-[9px] py-1 px-2 rounded bg-muted/40">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                    <span className="flex-1">
                                      <span className="font-medium">{homeTeam}</span>
                                      <span className="mx-2 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                      <span className="font-medium">{awayTeam}</span>
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </>
                    )}

                    {/* Team Form */}
                    {(homeMatches.length > 0 || awayMatches.length > 0) && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Takım Formu</span>
                              <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                            </div>
                          </summary>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            {homeMatches.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-blue-500">{match.homeTeam?.name}</div>
                                <div className="space-y-0.5 ">
                                  {homeMatches.slice(0, 5).map((m: LastMatch, idx: number) => {
                                    const homeTeam = m.homeTeam?.name;
                                    const awayTeam = m.awayTeam?.name;
                                    const homeScore = m.homeTeamScore?.regular ?? m.homeScore ?? 0;
                                    const awayScore = m.awayTeamScore?.regular ?? m.awayScore ?? 0;

                                    // Determine result for current home team
                                    const isHome = homeTeam === match.homeTeam?.name;
                                    const won = isHome ? homeScore > awayScore : awayScore > homeScore;
                                    const lost = isHome ? homeScore < awayScore : awayScore < homeScore;
                                    const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                                    return (
                                      <div key={idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                          <span className="flex-1">
                                            <span className="font-medium">{homeTeam}</span>
                                            <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                            <span className="font-medium">{awayTeam}</span>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {awayMatches.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[10px] font-semibold text-red-500">{match.awayTeam?.name}</div>
                                <div className="space-y-0.5 ">
                                  {awayMatches.slice(0, 5).map((m: LastMatch, idx: number) => {
                                    const homeTeam = m.homeTeam?.name;
                                    const awayTeam = m.awayTeam?.name;
                                    const homeScore = m.homeTeamScore?.regular ?? m.homeScore ?? 0;
                                    const awayScore = m.awayTeamScore?.regular ?? m.awayScore ?? 0;

                                    // Determine result for current away team
                                    const isHome = homeTeam === match.awayTeam?.name;
                                    const won = isHome ? homeScore > awayScore : awayScore > homeScore;
                                    const lost = isHome ? homeScore < awayScore : awayScore < homeScore;
                                    const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                                    return (
                                      <div key={idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                        <div className="flex items-center gap-1.5">
                                          <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                          <span className="flex-1">
                                            <span className="font-medium">{homeTeam}</span>
                                            <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                            <span className="font-medium">{awayTeam}</span>
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      </>
                    )}

                    {/* Missing Players */}
                    {(homeMissing.length > 0 || awayMissing.length > 0) && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Eksik Oyuncular</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                  {homeMissing.length + awayMissing.length}
                                </Badge>
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 space-y-1.5">
                            {homeMissing.length > 0 && (
                              <div>
                                <div className="text-[9px] font-semibold text-blue-500 mb-0.5">
                                  {match.homeTeam?.name}
                                </div>
                                <div className="space-y-0.5">
                                  {homeMissing.map((player: PlayerInfo, idx: number) => (
                                    <div key={idx} className="text-[9px] py-0.5 px-1 rounded bg-red-500/10">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-medium truncate">{player.name || player.playerName}</span>
                                        <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                          {player.reason || 'Yok'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {awayMissing.length > 0 && (
                              <div>
                                <div className="text-[9px] font-semibold text-red-500 mb-0.5">
                                  {match.awayTeam?.name}
                                </div>
                                <div className="space-y-0.5">
                                  {awayMissing.map((player: PlayerInfo, idx: number) => (
                                    <div key={idx} className="text-[9px] py-0.5 px-1 rounded bg-red-500/10">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-medium truncate">{player.name || player.playerName}</span>
                                        <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                          {player.reason || 'Yok'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      </>
                    )}

                    {/* Referee Stats */}
                    {refereeMatches.length > 0 && referee && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Hakem: {referee}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {refereeMatches.length}
                                </Badge>
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 space-y-0.5 ">
                            {refereeMatches.map((refMatch: RefereeMatch, idx: number) => {
                              const homeTeam = refMatch.homeTeam?.name || 'Ev Sahibi';
                              const awayTeam = refMatch.awayTeam?.name || 'Deplasman';
                              const homeScore = refMatch.homeTeam?.score?.regular;
                              const awayScore = refMatch.awayTeam?.score?.regular;

                              return (
                                <div key={idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                  <span className="font-medium">{homeTeam}</span>
                                  {homeScore !== undefined && awayScore !== undefined && (
                                    <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                  )}
                                  {(homeScore === undefined || awayScore === undefined) && (
                                    <span className="mx-1 text-muted-foreground">vs</span>
                                  )}
                                  <span className="font-medium">{awayTeam}</span>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </>
                    )}

                    {/* Standings */}
                    {standings.length > 0 && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Puan Durumu</span>
                              <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                            </div>
                          </summary>
                          <div className="mt-1 ">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-[9px]">
                                  <TableHead className="h-8 px-2 text-center w-8">#</TableHead>
                                  <TableHead className="h-8 px-2">Takım</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">O</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">G</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">B</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">M</TableHead>
                                  <TableHead className="h-8 px-2 text-center font-bold w-8">P</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-[9px]">
                                {standings.map((team: StandingRow, idx: number) => {
                                  const isHomeTeam = team.team?.name === match.homeTeam?.name;
                                  const isAwayTeam = team.team?.name === match.awayTeam?.name;
                                  const highlightClass = isHomeTeam
                                    ? 'bg-blue-500/10 font-semibold'
                                    : isAwayTeam
                                    ? 'bg-red-500/10 font-semibold'
                                    : '';

                                  return (
                                    <TableRow key={idx} className={highlightClass}>
                                      <TableCell className="py-1 px-2 text-center">{team.position ?? idx + 1}</TableCell>
                                      <TableCell className="py-1 px-2 truncate">{team.team?.name ?? team.competitorName}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.played ?? team.matchesPlayed ?? 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.won ?? 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.draw ?? 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.lost ?? 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center font-bold">{team.points ?? 0}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </details>
                      </>
                    )}

                    {/* Markets */}
                    {match.markets.length > 0 && (
                      <>
                        <Separator className="my-1.5" />
                        <details className="group" open>
                          <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                              <span className="text-xs font-semibold">Bahis Piyasaları</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {match.markets.length}
                                </Badge>
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1">
                            <table className="w-full text-xs">
                              <tbody>
                                {match.markets.map((market) => (
                                  <tr key={market.id} className="border-b border-border last:border-0">
                                    <td className="py-1 pr-2 text-[10px] text-muted-foreground font-medium whitespace-nowrap align-top">
                                      {formatMarketLabel(market)}
                                    </td>
                                    <td className="py-1">
                                      <div className="flex flex-wrap gap-1">
                                        {market.outcomes.map((odd, idx) => {
                                          const matchPercentages = match.playPercentages?.[String(market.id)] || {};
                                          const betPct = matchPercentages[String(odd.id || odd.on || odd.no)];

                                          return (
                                            <OddChip
                                              key={idx}
                                              oddValue={odd.odd || 0}
                                              oddName={odd.name || odd.value?.toString() || String(odd.id)}
                                              betPercentage={betPct}
                                            />
                                          );
                                        })}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </>
                    )}
                    </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
