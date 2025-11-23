// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Lightweight types for the match data we consume
type Team = {
  name?: string;
  id?: number;
};

type ScoreInfo = {
  home?: number;
  away?: number;
  homeRedCards?: number;
  awayRedCards?: number;
};

type MatchStatus = {
  name?: string;
  elapsedTime?: number;
};

type Period = {
  name?: string;
};

type Incident = {
  incidentType?: { name?: string };
  incidentTime?: number;
  isHome?: boolean;
  [key: string]: unknown;
};

type IncidentModel = {
  incidents?: Incident[];
};

type EventInformationModel = {
  homeTeam?: Team;
  awayTeam?: Team;
  score?: ScoreInfo;
  matchStatus?: MatchStatus;
  period?: Period;
};

type StatisticsModel = Record<string, any>;

type Odd = {
  on?: number | string;
  odd?: number;
  n?: string;
  No?: number | string;
  [key: string]: unknown;
};

type Market = {
  st?: string | number;
  n?: string;
  o?: Odd[];
  s?: number;
  sov?: string | number | null;
  mt?: number;
  mst?: number;
  m?: number | string;
  [key: string]: unknown;
};

type LastMatch = Record<string, any>;
type LastMatches = Record<string, any>;
type HeadToHeadMatch = Record<string, any>;
type HeadToHead = Record<string, any>;
type PlayerInfo = Record<string, any>;
type MissingPlayers = Record<string, any>;
type RefereeMatch = Record<string, any>;
type RefereeStats = Record<string, any>;
type StandingRow = Record<string, any>;
type Standings = Record<string, any>;

type MarketConfig = Record<string, unknown>;

type MatchEvent = Record<string, any>;

type TimelineEvent = {
  id?: string | number;
  minute?: number;
  min?: number;
  type?: { shortName?: string; name?: string };
  player?: { knownNameShort?: string; knownName?: string };
  participant?: string;
  team?: number;
  isHome?: boolean;
};

type SimpleEvent = {
  id?: string | number;
  homeTeam?: { name?: string; score?: number };
  awayTeam?: { name?: string; score?: number };
  hn?: string;
  an?: string;
  homeScore?: number;
  awayScore?: number;
  date?: number;
};

type MatchesResponse = Record<string, any>;

// Visual stat bar component for comparing two values
function StatBar({ label, homeValue, awayValue, showPercentage = false }: {
  label: string,
  homeValue: number,
  awayValue: number,
  showPercentage?: boolean
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-muted-foreground w-[110px] flex-shrink-0">{label}</span>
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

interface OddChipProps {
  matchId: string;
  marketId: string;
  oddNo: number;
  oddValue: number;
  oddName: string;
  betPercentage?: number;
}

// Translate common odds names to more descriptive Turkish
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
    'Olmaz': 'Olmaz',
  };
  return translations[name] || name;
}

function OddChip({ matchId, marketId, oddNo, oddValue, oddName, betPercentage }: OddChipProps) {
  const displayName = translateOddName(oddName);
  const baseClass = 'relative inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono transition-all duration-300 ease-in-out';
  const direction: 'up' | 'down' | null = null;
  const changedClass = 'bg-card border-border';

  return (
    <span
      className={`${baseClass} ${changedClass}`}
      data-match-id={matchId}
      data-market-id={marketId}
      data-odd-no={oddNo}
    >
      {direction && (
        <span className={`absolute -top-1 -right-1 text-[10px] font-bold transition-opacity duration-200 ${direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
          {direction === 'up' ? '↑' : '↓'}
        </span>
      )}
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

type SortMode = 'site' | 'time' | 'league' | 'home' | 'markets';

export default function Home() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('markets');
  const [filterCompetition, setFilterCompetition] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [competitionNames, setCompetitionNames] = useState<Record<number, string>>({});
  const [competitionIcons, setCompetitionIcons] = useState<Record<number, string>>({});
  const [playPercentages, setPlayPercentages] = useState<Record<string, number>>({});
  const [matchPopularity, setMatchPopularity] = useState<Record<string, number>>({});
  const [marketConfig, setMarketConfig] = useState<Record<string, MarketConfig>>({});

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        sort: sortMode,
        competition: filterCompetition,
        status: filterStatus,
      });

      const response = await fetch(`/api/matches?${params}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data: any = await response.json();

      // Extract football events (sid === 1)
      const events = data.data || data.events || (Array.isArray(data) ? data : []);
      const footballEvents = (events as any[]).filter((ev) => {
        const sportId = ev?.sid ?? ev?.sportId ?? ev?.st ?? ev?.si;
        return Number(sportId) === 1;
      });

      setMatches(footballEvents);
      setCompetitionNames(data.competitionNames || {});
      setCompetitionIcons(data.competitionIcons || {});
      setPlayPercentages(data.playPercentages || {});
      setMatchPopularity(data.matchPopularity || {});
      setMarketConfig(data.marketConfig || {});
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [filterCompetition, filterStatus, sortMode]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Get unique competitions for filter
  const uniqueCompetitions = Array.from(new Set(matches.map(m => m?.ci))).filter(Boolean);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Maçlar yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-500">Hata: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                Canlı Maçlar
              </h1>
              <span className="text-muted-foreground" aria-hidden="true">·</span>
              <Link
                href="/experiments"
                className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-primary transition-colors"
              >
                Experiments
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sıralama:</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="px-2 py-1 text-xs rounded border border-border bg-card"
                >
                  <option value="markets">Bahis Sayısı</option>
                  <option value="time">Başlama Saati</option>
                  <option value="league">Lig</option>
                  <option value="home">Ev Sahibi Takım</option>
                </select>
              </div>
              {/* Competition Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Lig:</span>
                <select
                  value={filterCompetition}
                  onChange={(e) => setFilterCompetition(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-border bg-card max-w-[150px]"
                >
                  <option value="all">Tümü</option>
                  {uniqueCompetitions.map(ci => (
                    <option key={ci} value={ci}>{competitionNames[ci as number] || `Lig ${ci}`}</option>
                  ))}
                </select>
              </div>
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Durum:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-border bg-card"
                >
                  <option value="all">Tümü</option>
                  <option value="live">Canlı</option>
                  <option value="ht">Devre Arası</option>
                  <option value="upcoming">Başlamadı</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              {matches.length} maç • Her 3 saniyede güncellenir
            </Badge>
          </div>
        </div>

        {/* Matches Grid */}
        <div className="space-y-8">
          {matches.map((match) => {
            const homeScore = match?.sc?.ht?.r ?? 0;
            const awayScore = match?.sc?.at?.r ?? 0;
            const minute = match?.sc?.min ?? 0;
            const markets: Market[] = Array.isArray(match?.m) ? (match.m as Market[]) : [];

            // Additional match info
            const matchStatus = match?.s ?? 0;
            const kickoffTime = match?.d ? new Date(match.d * 1000) : null;
            const hasCalculator = match?.hc ?? false;
            const competitionId = match?.ci;
            const competitionName = competitionId ? competitionNames[competitionId] : null;
            const competitionIcon = competitionId ? competitionIcons[competitionId] : null;

            // Statistics data
            const stats = match?.statistics;
            const eventInfo = stats?.eventInformationModel;
            const weather = eventInfo?.eventPlaceInformation?.weatherStatus;
            const temperature = eventInfo?.eventPlaceInformation?.temperatureC;
            const stadium = eventInfo?.eventPlaceInformation?.stadiumName;
            const referee = eventInfo?.eventPlaceInformation?.refereeName;
            const round = eventInfo?.roundInformation?.name;

            // Construct full logo URLs
            const constructLogoUrl = (logo: string | number | undefined | null) => {
              if (!logo) return null;

              // Convert to string if number
              const logoStr = String(logo);

              // If already a full URL, return as is
              if (logoStr.startsWith('http://') || logoStr.startsWith('https://')) return logoStr;

              // Remove any leading slashes or path components, get just the filename
              const cleanPath = logoStr.replace(/^\/+/, ''); // Remove leading slashes
              const filename = cleanPath.split('/').pop() || cleanPath;

              // Ensure .png extension
              const finalFilename = filename.includes('.png') ? filename : `${filename}.png`;

              return `https://cdn.broadage.com/images-teams/soccer/256x256/${finalFilename}`;
            };

            const homeTeamLogo = constructLogoUrl(eventInfo?.homeTeam?.logo);
            const awayTeamLogo = constructLogoUrl(eventInfo?.awayTeam?.logo);
            const matchEvents: TimelineEvent[] = Array.isArray(stats?.soccerMatchEventsAllModel?.events)
              ? (stats.soccerMatchEventsAllModel.events as TimelineEvent[])
              : [];
            const recentForm = stats?.recentEventModel as { events?: SimpleEvent[] } | undefined;

            // Additional statistics
            const headToHead = match?.headToHead as HeadToHead | undefined;
            const lastMatches = match?.lastMatches as LastMatches | undefined;
            const iddaaAnalysis = match?.iddaaAnalysis;
            const missingPlayers = match?.missingPlayers as MissingPlayers | undefined;
            const refereeStats = (match?.refereeStats as RefereeStats) || {};
            const standings = (match?.standings as Standings | undefined) || (stats?.tournamentStandingsModel as Standings | undefined);

            // Match status text
            const getStatusText = (status: number) => {
              switch (status) {
                case 0: return 'Başlamadı';
                case 1: return '1. Yarı';
                case 2: return 'Devre Arası';
                case 3: return '2. Yarı';
                case 4: return 'Uzatma 1. Yarı';
                case 5: return 'Uzatma Devre Arası';
                case 6: return 'Uzatma 2. Yarı';
                case 7: return 'Penaltılar';
                default: return 'Canlı';
              }
            };

            // Stats
            const homeStats = match?.sc?.ht ?? {};
            const awayStats = match?.sc?.at ?? {};

            // Get Sportradar stats if available
            const sportradarStats = match.sportradar?.data?.values || {};
            const getSportradarStat = (key: string) => sportradarStats[key]?.value || {};

            const homeYellow = getSportradarStat('40').home ?? homeStats.yc ?? 0;
            const awayYellow = getSportradarStat('40').away ?? awayStats.yc ?? 0;
            const homeRed = getSportradarStat('50').home ?? homeStats.rc ?? 0;
            const awayRed = getSportradarStat('50').away ?? awayStats.rc ?? 0;

            const homeCorners = getSportradarStat('124').home ?? homeStats.co ?? homeStats.c ?? 0;
            const awayCorners = getSportradarStat('124').away ?? awayStats.co ?? awayStats.c ?? 0;
            const homeHalfScore = homeStats.ht ?? 0;
            const awayHalfScore = awayStats.ht ?? 0;

            // Extra stats - merge İddaa and Sportradar data (prioritize Sportradar for live matches)
            const homeShotsOnTarget = getSportradarStat('shotson').home ?? homeStats.sot ?? homeStats.so ?? 0;
            const awayShotsOnTarget = getSportradarStat('shotson').away ?? awayStats.sot ?? awayStats.so ?? 0;
            const homeShots = getSportradarStat('goalattempts').home ?? homeStats.st ?? homeStats.sh ?? homeStats.soff ?? 0;
            const awayShots = getSportradarStat('goalattempts').away ?? awayStats.st ?? awayStats.sh ?? awayStats.soff ?? 0;
            const homeAttacks = getSportradarStat('1126').home ?? homeStats.att ?? homeStats.ta ?? 0;
            const awayAttacks = getSportradarStat('1126').away ?? awayStats.att ?? awayStats.ta ?? 0;
            const homeDanger = getSportradarStat('1029').home ?? homeStats.da ?? homeStats.datt ?? 0;
            const awayDanger = getSportradarStat('1029').away ?? awayStats.da ?? awayStats.datt ?? 0;
            const homePossession = getSportradarStat('110').home ?? homeStats.pos ?? 0;
            const awayPossession = getSportradarStat('110').away ?? awayStats.pos ?? 0;

            // Market type labels (fallback)
            const marketLabels: Record<string, string> = {
              4: 'Maç Sonucu',
              14: 'Alt/Üst',
              34: 'Çifte Şans',
              23: 'Handikap',
              131: 'Karşılıklı Gol',
            };

            // Function to replace placeholders in market names
            const replaceMarketPlaceholders = (marketName: string, sov: string | undefined): string => {
              if (!sov) return marketName;

              // Split sov by "|" to get multiple values
              const values = sov.split('|');

              let result = marketName;
              // Replace {0}, {1}, {2}, etc. with corresponding values
              values.forEach((value, index) => {
                result = result.replace(`{${index}}`, value);
              });

              // Replace {h} with first value (handicap)
              if (values.length > 0) {
                result = result.replace('{h}', values[0]);
              }

              return result;
            };

            // Categorize markets
            const categorizeMarket = (market: Market, marketName: string): string => {
              // Main markets by ID
              if ([4, 14, 34, 23, 131].includes(Number(market.st))) {
                return 'Ana Bahisler';
              }

              // Keywords in Turkish names
              const lowerName = marketName.toLowerCase();

              if (lowerName.includes('korner')) {
                return 'Korner Bahisleri';
              }
              if (lowerName.includes('kart')) {
                return 'Kart Bahisleri';
              }
              if (lowerName.includes('gol') && !lowerName.includes('karşılıklı')) {
                return 'Gol Bahisleri';
              }
              if (lowerName.includes('dk.') || lowerName.includes('aralık') || lowerName.includes('yarı')) {
                return 'Zaman Bazlı';
              }

              return 'Diğer Bahisler';
            };

            // Group markets by category
            const categorizedMarkets: Record<string, Market[]> = {};
            const categoryOrder = ['Ana Bahisler', 'Gol Bahisleri', 'Korner Bahisleri', 'Kart Bahisleri', 'Zaman Bazlı', 'Diğer Bahisler'];

            markets.forEach((market: Market) => {
              const marketKey = String(market.st ?? '');
              const marketConfigEntry = marketConfig[marketKey];
              const marketName =
                (typeof (marketConfigEntry as { n?: unknown })?.n === 'string'
                  ? (marketConfigEntry as { n?: string }).n
                  : undefined) ||
                marketLabels[marketKey] ||
                `M${marketKey}`;
              const displayName = replaceMarketPlaceholders(marketName || '', market.sov ?? undefined);
              const category = categorizeMarket(market, marketName);

              if (!categorizedMarkets[category]) {
                categorizedMarkets[category] = [];
              }
              categorizedMarkets[category].push({ ...market, displayName });
            });

            return (
              <Card key={match.i} className="overflow-hidden gap-0 py-0">
                <CardHeader className="pt-2 pb-1 px-3 space-y-1.5">
                  {/* Top Row: Competition and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {competitionIcon && (
                        <Image
                          src={competitionIcon}
                          alt=""
                          width={16}
                          height={16}
                          className="object-contain"
                          unoptimized
                        />
                      )}
                      {competitionName && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {competitionName}
                        </span>
                      )}
                      {round && (
                        <span className="text-[9px] text-muted-foreground">• {round}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold">
                        {getStatusText(matchStatus)}
                      </Badge>
                      {minute > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                          {minute}&apos;
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Info Row: Compact inline layout */}
                  <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      {stadium && (
                        <span className="flex items-center gap-0.5">
                          📍 <span className="truncate max-w-[120px]">{stadium}</span>
                        </span>
                      )}
                      {(weather || temperature !== undefined) && (
                        <span className="flex items-center gap-0.5">
                          🌤️ {weather}{temperature !== undefined && temperature !== null && `${weather ? ' ' : ''}${temperature}°C`}
                        </span>
                      )}
                      {referee && (
                        <span className="flex items-center gap-0.5">
                          👨‍⚖️ <span className="truncate max-w-[100px]">{referee}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {kickoffTime && (
                        <span>
                          🕐 {kickoffTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <span>#{match?.bri ?? 'N/A'}</span>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  {(matchPopularity[String(match.i)] || hasCalculator) && (
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      {matchPopularity[String(match.i)] && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          🔥 {matchPopularity[String(match.i)].toFixed(1)}%
                        </Badge>
                      )}
                      {hasCalculator && <span>🧮</span>}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-1 pb-2 px-3 space-y-2">

                  {/* Teams and Score */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Home Team */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {homeTeamLogo && (
                          <Image
                            src={homeTeamLogo}
                            alt={match?.hn ?? 'Home'}
                            width={28}
                            height={28}
                            className="object-contain"
                            unoptimized
                          />
                        )}
                        <div className="text-lg font-bold truncate">
                          {match?.hn ?? 'Home'}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-primary-foreground">
                      <div className="text-2xl font-black">{homeScore}</div>
                      <div className="text-sm font-bold opacity-70">-</div>
                      <div className="text-2xl font-black">{awayScore}</div>
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="text-lg font-bold truncate">
                          {match?.an ?? 'Away'}
                        </div>
                        {awayTeamLogo && (
                          <Image
                            src={awayTeamLogo}
                            alt={match?.an ?? 'Away'}
                            width={28}
                            height={28}
                            className="object-contain"
                            unoptimized
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Match Stats - Compact Summary */}
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <span className="text-muted-foreground" title="İlk Yarı Skoru">
                      İY: {homeHalfScore}-{awayHalfScore}
                    </span>
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
                  {(homePossession > 0 || awayPossession > 0 || homeShots > 0 || awayShots > 0 || homeAttacks > 0 || awayAttacks > 0) && (
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

                  {/* Advanced Stats (Sportradar) */}
                  {match.sportradar?.data?.values && (() => {
                    const shotsOff = getSportradarStat('126');
                    const saves = getSportradarStat('127');
                    const blockedShots = getSportradarStat('171');
                    const freeKicks = getSportradarStat('120');
                    const goalKicks = getSportradarStat('121');
                    const throwIns = getSportradarStat('122');
                    const substitutions = getSportradarStat('60');
                    const injuries = getSportradarStat('158');
                    const penalties = getSportradarStat('161');
                    const ballSafe = getSportradarStat('1030');

                    const hasAnyAdvancedStats =
                      (shotsOff.home || shotsOff.away) ||
                      (saves.home || saves.away) ||
                      (blockedShots.home || blockedShots.away) ||
                      (freeKicks.home || freeKicks.away) ||
                      (goalKicks.home || goalKicks.away) ||
                      (throwIns.home || throwIns.away) ||
                      (substitutions.home || substitutions.away) ||
                      (injuries.home || injuries.away) ||
                      (penalties.home || penalties.away) ||
                      (ballSafe.home || ballSafe.away);

                    if (!hasAnyAdvancedStats) return null;

                    return (
                      <>
                        <Separator className="my-1.5" />
                        <Card className="gap-0 py-0">
                          <CardHeader className="py-1.5 px-2.5">
                            <CardTitle className="text-xs font-semibold">Detaylı İstatistikler</CardTitle>
                          </CardHeader>
                          <CardContent className="py-1.5 px-2.5">
                            <div className="space-y-2">
                              {/* Shooting Stats */}
                              {((shotsOff.home || shotsOff.away) || (saves.home || saves.away) || (blockedShots.home || blockedShots.away)) && (
                                <div className="space-y-1">
                                  <div className="text-[9px] font-semibold text-muted-foreground">Şut İstatistikleri</div>
                                  {(shotsOff.home || shotsOff.away) && (
                                    <StatBar
                                      label="İsabetsiz Şutlar"
                                      homeValue={shotsOff.home || 0}
                                      awayValue={shotsOff.away || 0}
                                    />
                                  )}
                                  {(saves.home || saves.away) && (
                                    <StatBar
                                      label="Kaleci Kurtarışları"
                                      homeValue={saves.home || 0}
                                      awayValue={saves.away || 0}
                                    />
                                  )}
                                  {(blockedShots.home || blockedShots.away) && (
                                    <StatBar
                                      label="Bloke Edilen Şutlar"
                                      homeValue={blockedShots.home || 0}
                                      awayValue={blockedShots.away || 0}
                                    />
                                  )}
                                </div>
                              )}

                              {/* Set Pieces */}
                              {((freeKicks.home || freeKicks.away) || (goalKicks.home || goalKicks.away) || (throwIns.home || throwIns.away)) && (
                                <div className="space-y-1">
                                  <div className="text-[9px] font-semibold text-muted-foreground">Duran Toplar</div>
                                  {(freeKicks.home || freeKicks.away) && (
                                    <StatBar
                                      label="Serbest Vuruşlar"
                                      homeValue={freeKicks.home || 0}
                                      awayValue={freeKicks.away || 0}
                                    />
                                  )}
                                  {(goalKicks.home || goalKicks.away) && (
                                    <StatBar
                                      label="Kale Vuruşları"
                                      homeValue={goalKicks.home || 0}
                                      awayValue={goalKicks.away || 0}
                                    />
                                  )}
                                  {(throwIns.home || throwIns.away) && (
                                    <StatBar
                                      label="Taçlar"
                                      homeValue={throwIns.home || 0}
                                      awayValue={throwIns.away || 0}
                                    />
                                  )}
                                </div>
                              )}

                              {/* Game Events */}
                              {((substitutions.home || substitutions.away) || (injuries.home || injuries.away) || (penalties.home || penalties.away)) && (
                                <div className="space-y-1">
                                  <div className="text-[9px] font-semibold text-muted-foreground">Maç Olayları</div>
                                  {(substitutions.home || substitutions.away) && (
                                    <StatBar
                                      label="Değişiklikler"
                                      homeValue={substitutions.home || 0}
                                      awayValue={substitutions.away || 0}
                                    />
                                  )}
                                  {(injuries.home || injuries.away) && (
                                    <StatBar
                                      label="Sakatlıklar"
                                      homeValue={injuries.home || 0}
                                      awayValue={injuries.away || 0}
                                    />
                                  )}
                                  {(penalties.home || penalties.away) && (
                                    <StatBar
                                      label="Penaltılar"
                                      homeValue={penalties.home || 0}
                                      awayValue={penalties.away || 0}
                                    />
                                  )}
                                </div>
                              )}

                              {/* Advanced Metrics */}
                              {(ballSafe.home || ballSafe.away) && (
                                <div className="space-y-1">
                                  <div className="text-[9px] font-semibold text-muted-foreground">Gelişmiş Metrikler</div>
                                  <StatBar
                                    label="Top Güvenli Yerde %"
                                    homeValue={ballSafe.home || 0}
                                    awayValue={ballSafe.away || 0}
                                    showPercentage={true}
                                  />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    );
                  })()}

                  <div className="flex flex-col">
                  {/* Match Events Timeline */}
                  {matchEvents.length > 0 && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">Maç Olayları</CardTitle>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {matchEvents.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-1">
                          {matchEvents
                            .sort((a, b) => (b.minute || 0) - (a.minute || 0))
                            .map((event, idx) => {
                              const minute = event.minute || event.min || '?';
                              const eventType = event.type?.shortName || event.type?.name || 'Olay';
                              const playerName = event.player?.knownNameShort || event.player?.knownName || event.participant || '';
                              const isHomeTeam = event.team === 1 || event.isHome;

                              // Event type icons
                              const getEventIcon = (type: string) => {
                                const lowerType = type.toLowerCase();
                                if (lowerType.includes('gol') || lowerType.includes('goal')) return '⚽';
                                if (lowerType.includes('sarı') || lowerType.includes('yellow')) return '🟨';
                                if (lowerType.includes('kırmızı') || lowerType.includes('red')) return '🟥';
                                if (lowerType.includes('değişiklik') || lowerType.includes('substitution')) return '🔄';
                                if (lowerType.includes('penaltı') || lowerType.includes('penalty')) return '🎯';
                                return '•';
                              };

                              return (
                                <div
                                  key={`${event.id || idx}`}
                                  className={`flex items-center gap-2 text-[10px] py-1 px-2 rounded ${
                                    isHomeTeam ? 'bg-blue-500/10' : 'bg-red-500/10'
                                  }`}
                                >
                                  <span className="font-bold text-muted-foreground min-w-[24px]">
                                    {minute}&apos;
                                  </span>
                                  <span className="text-sm">
                                    {getEventIcon(eventType)}
                                  </span>
                                  <span className="font-medium">
                                    {eventType}
                                  </span>
                                  {playerName && (
                                    <span className="text-muted-foreground truncate">
                                      {playerName}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* Recent Form */}
                  {recentForm && recentForm.events && recentForm.events.length > 0 && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">Son Karşılaşmalar</CardTitle>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {recentForm.events.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-0.5">
                          {recentForm.events.map((event: SimpleEvent, idx: number) => {
                            const homeTeam = event.homeTeam?.name || event.hn;
                            const awayTeam = event.awayTeam?.name || event.an;
                            const homeScore = event.homeScore || event.homeTeam?.score || 0;
                            const awayScore = event.awayScore || event.awayTeam?.score || 0;
                            const eventDate = event.date ? new Date(event.date * 1000) : null;

                            // Determine result from current home team's perspective
                            const isCurrentHome = homeTeam === match?.hn;
                            const won = isCurrentHome ? homeScore > awayScore : awayScore > homeScore;
                            const lost = isCurrentHome ? homeScore < awayScore : awayScore < homeScore;
                            const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                            return (
                              <div key={event.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                  <span className="truncate flex-1">
                                    <span className="font-medium">{homeTeam}</span>
                                    <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                    <span className="font-medium">{awayTeam}</span>
                                  </span>
                                  {eventDate && (
                                    <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                      {eventDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* Head to Head - Full Width */}
                  {headToHead && headToHead.overall && headToHead.overall.length > 0 && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">Karşılıklı Geçmiş</CardTitle>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {headToHead.overall.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-0.5">
                          {headToHead.overall.map((h2hMatch: HeadToHeadMatch, idx: number) => {
                            const homeTeam = h2hMatch.homeTeam?.name || h2hMatch.hn;
                            const awayTeam = h2hMatch.awayTeam?.name || h2hMatch.an;
                            const homeScore = h2hMatch.homeTeamScore?.current ?? h2hMatch.homeScore ?? h2hMatch.homeTeam?.score ?? 0;
                            const awayScore = h2hMatch.awayTeamScore?.current ?? h2hMatch.awayScore ?? h2hMatch.awayTeam?.score ?? 0;
                            const matchDate = h2hMatch.eventDate ? new Date(h2hMatch.eventDate) : (h2hMatch.date ? new Date(h2hMatch.date * 1000) : null);
                            const competition = h2hMatch.tournamentInformation?.name || h2hMatch.competition?.name || h2hMatch.cn;

                            // Determine result from current home team's perspective
                            const isCurrentHome = homeTeam === match?.hn;
                            const won = isCurrentHome ? homeScore > awayScore : awayScore > homeScore;
                            const lost = isCurrentHome ? homeScore < awayScore : awayScore < homeScore;
                            const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                            return (
                              <div key={h2hMatch.id || idx} className="text-[9px] py-1 px-2 rounded bg-muted/40">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                  <div className="flex items-center justify-between gap-2 flex-1">
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium">{homeTeam}</span>
                                      <span className="mx-2 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                      <span className="font-medium">{awayTeam}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
                                      {competition && (
                                        <span className="truncate max-w-[120px]">{competition}</span>
                                      )}
                                      {matchDate && (
                                        <span className="whitespace-nowrap">
                                          {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* Team Form - Dynamic Grid */}
                  {lastMatches && (lastMatches.homeOverAll?.length > 0 || lastMatches.awayOverAll?.length > 0) && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <CardTitle className="text-xs font-semibold">Takım Formu</CardTitle>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className={`grid ${lastMatches.homeOverAll?.length > 0 && lastMatches.awayOverAll?.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                          {/* Home Team Form */}
                          {lastMatches.homeOverAll && lastMatches.homeOverAll.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold text-blue-500 mb-1">
                                {match?.hn}
                              </div>
                              <div className="space-y-0.5">
                                {lastMatches.homeOverAll.map((teamMatch: LastMatch, idx: number) => {
                                  const homeTeam = teamMatch.homeTeam?.name || teamMatch.hn;
                                  const awayTeam = teamMatch.awayTeam?.name || teamMatch.an;
                                  const homeScore = teamMatch.homeTeamScore?.current ?? teamMatch.homeScore ?? 0;
                                  const awayScore = teamMatch.awayTeamScore?.current ?? teamMatch.awayScore ?? 0;
                                  const matchDate = teamMatch.eventDate ? new Date(teamMatch.eventDate) : (teamMatch.date ? new Date(teamMatch.date * 1000) : null);

                                  // Determine result for current team (home team in this case)
                                  const isHome = homeTeam === match?.hn;
                                  const won = isHome ? homeScore > awayScore : awayScore > homeScore;
                                  const lost = isHome ? homeScore < awayScore : awayScore < homeScore;
                                  const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                                  return (
                                    <div key={teamMatch.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                        <span className="truncate flex-1 text-[9px]">
                                          <span className="font-medium">{homeTeam}</span>
                                          <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                          <span className="font-medium">{awayTeam}</span>
                                        </span>
                                        {matchDate && (
                                          <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                            {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Away Team Form */}
                          {lastMatches.awayOverAll && lastMatches.awayOverAll.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-semibold text-red-500 mb-1">
                                {match?.an}
                              </div>
                              <div className="space-y-0.5">
                                {lastMatches.awayOverAll.map((teamMatch: LastMatch, idx: number) => {
                                  const homeTeam = teamMatch.homeTeam?.name || teamMatch.hn;
                                  const awayTeam = teamMatch.awayTeam?.name || teamMatch.an;
                                  const homeScore = teamMatch.homeTeamScore?.current ?? teamMatch.homeScore ?? 0;
                                  const awayScore = teamMatch.awayTeamScore?.current ?? teamMatch.awayScore ?? 0;
                                  const matchDate = teamMatch.eventDate ? new Date(teamMatch.eventDate) : (teamMatch.date ? new Date(teamMatch.date * 1000) : null);

                                  // Determine result for current team (away team in this case)
                                  const isHome = homeTeam === match?.an;
                                  const won = isHome ? homeScore > awayScore : awayScore > homeScore;
                                  const lost = isHome ? homeScore < awayScore : awayScore < homeScore;
                                  const swatchColor = won ? 'bg-green-500' : lost ? 'bg-red-500' : 'bg-yellow-500';

                                  return (
                                    <div key={teamMatch.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-1 h-4 rounded-full ${swatchColor}`} />
                                        <span className="truncate flex-1 text-[9px]">
                                          <span className="font-medium">{homeTeam}</span>
                                          <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                          <span className="font-medium">{awayTeam}</span>
                                        </span>
                                        {matchDate && (
                                          <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                            {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* İddaa Analysis - Full Width */}
                  {iddaaAnalysis && (iddaaAnalysis.homeTeamWinProbability !== undefined || iddaaAnalysis.drawProbability !== undefined || iddaaAnalysis.awayTeamWinProbability !== undefined || iddaaAnalysis.expectedGoals) && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <CardTitle className="text-xs font-semibold">İddaa Analizi</CardTitle>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-1 text-[10px]">
                          {iddaaAnalysis.homeTeamWinProbability !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Ev Sahibi:</span>
                              <span className="font-bold text-blue-500">{iddaaAnalysis.homeTeamWinProbability}%</span>
                            </div>
                          )}
                          {iddaaAnalysis.drawProbability !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Beraberlik:</span>
                              <span className="font-bold text-yellow-500">{iddaaAnalysis.drawProbability}%</span>
                            </div>
                          )}
                          {iddaaAnalysis.awayTeamWinProbability !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Deplasman:</span>
                              <span className="font-bold text-red-500">{iddaaAnalysis.awayTeamWinProbability}%</span>
                            </div>
                          )}
                          {iddaaAnalysis.expectedGoals && (
                            <>
                              <Separator className="my-1" />
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Beklenen Gol (Ev):</span>
                                <span className="font-bold">{iddaaAnalysis.expectedGoals.home?.toFixed(2) || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Beklenen Gol (Dep):</span>
                                <span className="font-bold">{iddaaAnalysis.expectedGoals.away?.toFixed(2) || 'N/A'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* Missing Players - Full Width */}
                  {missingPlayers && (missingPlayers.homeTeam?.players?.length > 0 || missingPlayers.awayTeam?.players?.length > 0) && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">Eksik Oyuncular</CardTitle>
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            {(missingPlayers.homeTeam?.players?.length || 0) + (missingPlayers.awayTeam?.players?.length || 0)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-1.5">
                          {missingPlayers.homeTeam?.players && missingPlayers.homeTeam.players.length > 0 && (
                            <div>
                              <div className="text-[9px] font-semibold text-blue-500 mb-0.5">
                                {match?.hn}
                              </div>
                                  <div className="space-y-0.5">
                                    {missingPlayers.homeTeam.players.map((player: PlayerInfo, idx: number) => (
                                      <div key={player.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-red-500/10">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-medium truncate">{player.name || player.knownName}</span>
                                          <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                            {player.reason || player.type || 'Yok'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                              </div>
                            </div>
                          )}
                          {missingPlayers.awayTeam?.players && missingPlayers.awayTeam.players.length > 0 && (
                            <div>
                              <div className="text-[9px] font-semibold text-red-500 mb-0.5">
                                {match?.an}
                              </div>
                                  <div className="space-y-0.5">
                                    {missingPlayers.awayTeam.players.map((player: PlayerInfo, idx: number) => (
                                      <div key={player.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-red-500/10">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-medium truncate">{player.name || player.knownName}</span>
                                          <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                                            {player.reason || player.type || 'Yok'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* Referee Information - Full Width */}
                  {refereeStats?.refereeMatches?.length > 0 && referee && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">Hakem: {referee}</CardTitle>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {refereeStats.refereeMatches.length} Maç
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div className="space-y-0.5">
                          {refereeStats.refereeMatches.map((refMatch: RefereeMatch, idx: number) => {
                            const homeTeam = refMatch.homeTeam?.name || refMatch.hn || 'Ev Sahibi';
                            const awayTeam = refMatch.awayTeam?.name || refMatch.an || 'Deplasman';
                            const homeScore = refMatch.homeTeam?.score?.current ?? refMatch.homeTeamScore?.current ?? refMatch.homeScore;
                            const awayScore = refMatch.awayTeam?.score?.current ?? refMatch.awayTeamScore?.current ?? refMatch.awayScore;
                            const hasScore = homeScore !== undefined && homeScore !== null && awayScore !== undefined && awayScore !== null;
                            const matchDate = refMatch.date ? new Date(refMatch.date) : (refMatch.eventDate ? new Date(refMatch.eventDate) : null);
                            const yellowCards = (refMatch.homeYellowCards || refMatch.hyc || 0) + (refMatch.awayYellowCards || refMatch.ayc || 0);
                            const redCards = (refMatch.homeRedCards || refMatch.hrc || 0) + (refMatch.awayRedCards || refMatch.arc || 0);

                            return (
                              <div key={refMatch.id || idx} className="text-[9px] py-0.5 px-1 rounded bg-muted/40">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="truncate flex-1">
                                    <span className="font-medium">{homeTeam}</span>
                                    {hasScore && (
                                      <span className="mx-1 font-bold text-[10px]">{homeScore}-{awayScore}</span>
                                    )}
                                    {!hasScore && (
                                      <span className="mx-1 text-muted-foreground">vs</span>
                                    )}
                                    <span className="font-medium">{awayTeam}</span>
                                  </span>
                                  <div className="flex items-center gap-1 text-[8px]">
                                    {(yellowCards > 0 || redCards > 0) && (
                                      <span className="flex items-center gap-0.5">
                                        {yellowCards > 0 && <span className="text-yellow-500">🟨{yellowCards}</span>}
                                        {redCards > 0 && <span className="text-red-500">🟥{redCards}</span>}
                                      </span>
                                    )}
                                    {matchDate && (
                                      <span className="text-muted-foreground whitespace-nowrap">
                                        {matchDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}

                  {/* League Standings */}
                  {standings && (standings.homeTeamStanding || standings.awayTeamStanding || standings.standings) && (
                  <div>
                  <Separator className="my-1.5" />
                    <Card className="gap-0 py-0">
                      <CardHeader className="py-1.5 px-2.5">
                        <CardTitle className="text-xs font-semibold">Puan Durumu</CardTitle>
                      </CardHeader>
                      <CardContent className="py-1.5 px-2.5">
                        <div>
                          {standings.standings && standings.standings.length > 0 ? (
                            <Table>
                              <TableHeader className="sticky top-0 bg-muted">
                                <TableRow className="text-[9px]">
                                  <TableHead className="h-8 px-2 text-center w-8">#</TableHead>
                                  <TableHead className="h-8 px-2">Takım</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">O</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">G</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">B</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">M</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">A</TableHead>
                                  <TableHead className="h-8 px-2 text-center w-8">Y</TableHead>
                                  <TableHead className="h-8 px-2 text-center font-bold w-8">P</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="text-[9px]">
                                {standings.standings.map((team: StandingRow, idx: number) => {
                                  const isHomeTeam = team.teamName === match?.hn || team.team?.name === match?.hn;
                                  const isAwayTeam = team.teamName === match?.an || team.team?.name === match?.an;
                                  const highlightClass = isHomeTeam
                                    ? 'bg-blue-500/10 font-semibold'
                                    : isAwayTeam
                                    ? 'bg-red-500/10 font-semibold'
                                    : '';

                                  return (
                                    <TableRow key={team.id || idx} className={highlightClass}>
                                      <TableCell className="py-1 px-2 text-center">{team.position || team.rank || idx + 1}</TableCell>
                                      <TableCell className="py-1 px-2 truncate max-w-[120px]">{team.teamName || team.team?.name}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.played || team.matchesPlayed || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.won || team.wins || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.draw || team.draws || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.lost || team.losses || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.goalsFor || team.scored || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center">{team.goalsAgainst || team.conceded || 0}</TableCell>
                                      <TableCell className="py-1 px-2 text-center font-bold">{team.points || team.pts || 0}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="space-y-2">
                              {standings.homeTeamStanding && (
                                <div className="text-[10px] p-2 rounded bg-blue-500/10">
                                  <div className="font-semibold mb-1">{match?.hn}</div>
                                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                                    <span>Sıralama: {standings.homeTeamStanding.position || standings.homeTeamStanding.rank}</span>
                                    <span>Puan: {standings.homeTeamStanding.points || standings.homeTeamStanding.pts}</span>
                                    <span>Oynanan: {standings.homeTeamStanding.played || standings.homeTeamStanding.matchesPlayed}</span>
                                    <span>Galibiyet: {standings.homeTeamStanding.won || standings.homeTeamStanding.wins}</span>
                                  </div>
                                </div>
                              )}
                              {standings.awayTeamStanding && (
                                <div className="text-[10px] p-2 rounded bg-red-500/10">
                                  <div className="font-semibold mb-1">{match?.an}</div>
                                  <div className="grid grid-cols-2 gap-1 text-[9px]">
                                    <span>Sıralama: {standings.awayTeamStanding.position || standings.awayTeamStanding.rank}</span>
                                    <span>Puan: {standings.awayTeamStanding.points || standings.awayTeamStanding.pts}</span>
                                    <span>Oynanan: {standings.awayTeamStanding.played || standings.awayTeamStanding.matchesPlayed}</span>
                                    <span>Galibiyet: {standings.awayTeamStanding.won || standings.awayTeamStanding.wins}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  )}
                  </div>

                  {/* Categorized Markets */}
                  {markets.length > 0 && (
                    <>
                      <Separator className="my-1.5" />
                      <div className="space-y-2">
                        {categoryOrder.map((category) => {
                          const categoryMarkets = categorizedMarkets[category];
                          if (!categoryMarkets || categoryMarkets.length === 0) return null;

                          const isMainCategory = category === 'Ana Bahisler';

                          return (
                            <details key={category} open={isMainCategory} className="group">
                              <summary className="cursor-pointer list-none">
                                <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                                  <span className="text-xs font-semibold">{category}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                      {categoryMarkets.length}
                                    </Badge>
                                    <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                                  </div>
                                </div>
                              </summary>
                              <div className="mt-1">
                                <table className="w-full text-xs">
                                  <tbody>
                                    {categoryMarkets.map((market: Market) => {
                                      const marketConfigData = marketConfig[market.st];
                                      const marketDescription = marketConfigData?.d;
                                      const isKeyMarket = market.t === 4; // Type 4 = key/main markets
                                      const marketStatus = market.s; // 1 = active, 0 = suspended
                                      const marketBetCount = market.mbc; // Number of bets on this market

                                      return (
                                        <tr key={market.i} className={`border-b border-border last:border-0 ${marketStatus === 0 ? 'opacity-50' : ''}`}>
                                          <td className="py-1 pr-2 text-[10px] text-muted-foreground font-medium whitespace-nowrap align-top">
                                            <div className="flex items-center gap-1">
                                              {isKeyMarket && <span className="text-yellow-500" title="Ana Piyasa">★</span>}
                                              <span title={marketDescription || undefined}>
                                                {market.displayName}
                                              </span>
                                              {marketStatus === 0 && (
                                                <span className="text-[8px] text-red-500" title="Piyasa Askıda">⏸</span>
                                              )}
                                              {marketBetCount > 1 && (
                                                <span className="text-[8px] text-blue-500 ml-1" title="Bahis Sayısı">
                                                  ({marketBetCount})
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        <td className="py-1">
                                          <div className="flex flex-wrap gap-1">
                                            {market.o?.map((odd: Odd) => {
                                              const matchPercentages = playPercentages[String(match.i)] || {};
                                              const marketPercentages = matchPercentages[String(market.i)] || {};
                                              const betPct = marketPercentages[String(odd.no)];

                                              return (
                                                <OddChip
                                                  key={odd.no}
                                                  matchId={String(match.i)}
                                                  marketId={String(market.i)}
                                                  oddNo={odd.no}
                                                  oddValue={odd.odd}
                                                  oddName={odd.n}
                                                  betPercentage={betPct}
                                                />
                                              );
                                            })}
                                          </div>
                                        </td>
                                      </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {matches.length === 0 && (
          <Card className="p-12 text-center">
            <div className="text-xl text-muted-foreground">
              Şu anda canlı futbol maçı bulunmamaktadır
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
