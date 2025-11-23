'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { experimentsMeta, defaultExperimentId } from '@/lib/experiments/meta';
import { extractScore } from '@/lib/experiments/engine';
import type { MatchEvent, MarketConfigEntry } from '@/types/match';
import type { AlgoOutput } from '@/lib/experiments/base';

type Match = MatchEvent;

type Opportunity = {
  match: Match;
  label: string;
  selection: string;
  edge: number;
  odds: number;
  prob: number;
  minuteLabel: string;
  statusLabel: string;
  expectedValue?: number;
  impliedProb?: number;
  modelProb?: number;
  probDiff?: number;
  confidence?: number;
  kellyFraction?: number;
  dataQuality?: string;
};

type Enriched = { match: Match; algo: AlgoOutput; remaining: number };

function getDataQualityColor(quality?: string) {
  if (!quality) return 'bg-gray-100 text-gray-600';
  if (quality.includes('EXCELLENT')) return 'bg-green-100 text-green-700 border-green-300';
  if (quality.includes('GOOD')) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (quality.includes('FAIR')) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-orange-100 text-orange-700 border-orange-300';
}

type ExperimentApiResponse = {
  experimentId: string;
  meta: { weight: number; calibrationSamples: number; generatedAt: number; matches: number };
  opportunities: Opportunity[];
  enriched: Enriched[];
  marketConfig: Record<string, MarketConfigEntry>;
};

const POLL_MS = 3000;

function useExperimentData(experimentId: string) {
  const [data, setData] = useState<ExperimentApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!experimentId) {
      setData(null);
      setError('No experiments configured.');
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      // Allow upcoming matches for HT/FT model
      if (experimentId === 'htft-strength') {
        params.set('includeUpcoming', '1');
      }
      const res = await fetch(`/api/experiments/${experimentId}?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.statusText);
      const json = (await res.json()) as ExperimentApiResponse;
      setData(json);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fetch failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [experimentId]);

  useEffect(() => {
    setLoading(true);
    fetchOnce();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(fetchOnce, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [experimentId, fetchOnce]);

  return { data, loading, error };
}

export default function ExperimentsClient() {
  const [experimentId, setExperimentId] = useState<string>(defaultExperimentId);
  const { data, loading, error } = useExperimentData(experimentId);

  const activeExperiment = experimentsMeta.find((e) => e.id === experimentId) || experimentsMeta[0];
  const opportunities = data?.opportunities || [];
  const enriched = data?.enriched || [];
  const meta = data?.meta;

  const matchesLabel = useMemo(() => {
    const count = meta?.matches ?? 0;
    if (!count) return 'Maç yok';
    return `${count} maç`;
  }, [meta]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <p className="text-sm text-muted-foreground">Canlı maç verileri yükleniyor...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!activeExperiment) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold">Etkin deney bulunmuyor</h2>
              <p className="text-sm text-muted-foreground mt-2">Şu anda tanımlı bir deney yok.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Experiments</h1>
            <Badge variant="secondary" className="text-xs">
              {activeExperiment?.name}
            </Badge>
            <Badge variant="outline" className="text-[11px]">w_market {meta?.weight?.toFixed(2) ?? '—'}</Badge>
            <Badge variant="outline" className="text-[11px]">kalibrasyon n={meta?.calibrationSamples ?? 0}</Badge>
            <Badge variant="outline" className="text-[11px]">{matchesLabel}</Badge>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-primary transition-colors"
          >
            ← Canlı Maçlar
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="experiment-select">
            Deney seç:
          </label>
          <select
            id="experiment-select"
            value={experimentId}
            onChange={(e) => setExperimentId(e.target.value)}
            className="px-2 py-1 text-sm rounded border border-border bg-card"
          >
            {experimentsMeta.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name}
              </option>
            ))}
          </select>
          {activeExperiment?.description && (
            <span className="text-xs text-muted-foreground truncate max-w-xl" title={activeExperiment.description}>
              {activeExperiment.description}
            </span>
          )}

          <div className="ml-auto text-[11px] text-muted-foreground">
            Canlı veri her {POLL_MS / 1000} saniyede yenilenir
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && enriched.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4 text-center max-w-md">
                <div className="rounded-full bg-muted p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Canlı Maç Yok</h3>
                  <p className="text-sm text-muted-foreground">
                    Şu anda devam eden canlı maç bulunmuyor. Maçlar başladığında otomatik olarak burada görünecek.
                  </p>
                </div>
                <Link
                  href="/"
                  className="text-sm text-primary hover:underline"
                >
                  Ana sayfaya dön →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {opportunities.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{activeExperiment.name} Fırsatlar</CardTitle>
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                  Edge filtresi %3-18
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Maç</TableHead>
                    <TableHead>Skor</TableHead>
                    <TableHead>Dakika</TableHead>
                    <TableHead>Seçim</TableHead>
                    <TableHead>Edge</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Piyasa</TableHead>
                    <TableHead>Fark</TableHead>
                    <TableHead>Oran</TableHead>
                    <TableHead>Kelly %</TableHead>
                    <TableHead>Güven</TableHead>
                    <TableHead>Veri</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((op, idx) => {
                    const stats = op.match?.statistics?.eventInformationModel;
                    const homeName = stats?.homeTeam?.name || op.match?.hn || 'Home';
                    const awayName = stats?.awayTeam?.name || op.match?.an || 'Away';
                    const sc = extractScore(op.match);
                    const minuteText = typeof sc.displayMinute === 'number' ? `${sc.displayMinute}'` : '';
                    const statusText = sc.statusLabel || '—';
                    const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;

                    const kellyPercent = op.kellyFraction ? (op.kellyFraction * 100).toFixed(1) : '0.0';
                    const confidence = op.confidence ?? 0;
                    const confidenceColor =
                      confidence > 0.7 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      confidence > 0.5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';

                    const confidenceLabel = confidence > 0.7 ? 'Yüksek' : confidence > 0.5 ? 'Orta' : 'Düşük';

                    const edgeColor = op.edge > 0.05 ? 'text-green-600 font-bold' : 'text-green-500 font-semibold';
                    const probDiffColor = (op.probDiff ?? 0) > 0.1 ? 'text-green-600 font-medium' : '';

                    return (
                      <TableRow key={`${op.match.i}-${idx}-${op.label}`}>
                        <TableCell className="whitespace-nowrap text-sm font-medium">{homeName} – {awayName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {sc.home}-{sc.away}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {minuteText ? `${statusText} · ${minuteText}` : statusText || '—'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{op.selection}</TableCell>
                        <TableCell className={`text-sm font-mono ${edgeColor}`}>
                          +{(op.edge * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {formatPct(op.modelProb ?? op.prob)}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {formatPct(op.impliedProb ?? (1 / op.odds))}
                        </TableCell>
                        <TableCell className={`text-sm font-mono ${probDiffColor}`}>
                          {op.probDiff !== undefined ? (
                            `${op.probDiff > 0 ? '+' : ''}${formatPct(op.probDiff)}`
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-mono">{op.odds?.toFixed(2)}</TableCell>
                        <TableCell className="text-sm font-mono">{kellyPercent}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${confidenceColor}`}>
                            {confidenceLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${getDataQualityColor(op.dataQuality)}`}>
                            {op.dataQuality?.split('(')[0].trim() || 'BASIC'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : enriched.length > 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4 text-center max-w-lg">
                <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-600 dark:text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">Fırsat Bulunamadı</h3>
                  <p className="text-sm text-muted-foreground">
                    Şu anda <strong>%3-18 edge</strong> aralığında {activeExperiment.name} fırsatı tespit edilemedi.
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">
                    Model canlı verileri analiz ediyor. Yeni fırsatlar her 3 saniyede taranıyor.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span>Canlı tarama aktif</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {enriched.length > 0 && activeExperiment && activeExperiment.id === 'htft-strength' && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base">{activeExperiment.name} - Metodoloji</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">🤝 Beraberlik Dayanıklılığı</p>
                <p>xG pace varsa dakikalık tempo ile kalan süreye Poisson dağıtımı uygular; yoksa lig ortalaması + takım güçleriyle konservatif lambda kullanır.</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium text-foreground mb-1">🟥 Kart ve Geç Oyun Dengelemesi</p>
                <p>Kırmızı kart gören tarafın hücum lambdası çarpılır (1 kart ≈0.78, 2 kart ≈0.55), rakip %12 boost alır. Kalan süre 30 dakikadan azsa varyans kademeli kısılır.</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium text-foreground mb-1">📐 Skellam Tarzı Çakışma</p>
                <p>Kalan goller için ev/dep Poisson PMF hesaplanır; final skorunun eşit bitme olasılığı offsetli çarpımların toplamıyla deterministik hesaplanır.</p>
              </div>
              <Separator />
              <div className="text-xs">
                <p className="font-medium text-foreground mb-1">📊 Veri Kalitesi</p>
                <p>xG varsa <strong>VERY GOOD</strong>; yalnızca sıralama varsa <strong>GOOD</strong>; aksi <strong>BASIC</strong>. Tamamen deterministik, rastgelelik yok.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
