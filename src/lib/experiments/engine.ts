/**
 * Experiments Engine
 * Central registry for all experiment algorithms.
 */

import type { ExperimentAlgorithm, Match, AlgoOutput } from './base';
import type { Market, MarketConfigEntry } from '@/types/match';

// Export types for convenience
export type { Match, AlgoOutput };

// Registry of all available experiments
export const experiments: ExperimentAlgorithm[] = [];

// Default experiment
export const defaultExperimentId = experiments[0]?.id || '';

// Utility functions (re-exported from base for backward compatibility)
export { ExperimentAlgorithm } from './base';

/**
 * Helper: Extract score from match
 */
export function extractScore(match: Match): {
  home: number;
  away: number;
  minute: number | null;
  displayMinute: number | null;
  statusLabel: string;
  homeRed: number;
  awayRed: number;
} {
  const stats = match?.statistics?.eventInformationModel;
  const score = stats?.score;
  const home = typeof score?.home === 'number' ? score.home : 0;
  const away = typeof score?.away === 'number' ? score.away : 0;

  let minute: number | null = null;
  let displayMinute: number | null = null;
  let statusLabel = '';

  const matchStatus = stats?.matchStatus?.name || '';
  const period = stats?.period?.name || '';

  if (matchStatus.includes('1st half') || period.includes('1st half')) {
    statusLabel = '1. Yarı';
    const elapsed = stats?.matchStatus?.elapsedTime;
    minute = typeof elapsed === 'number' ? elapsed : null;
    displayMinute = minute;
  } else if (matchStatus.includes('Halftime') || period.includes('Halftime')) {
    statusLabel = 'Devre Arası';
    minute = 45;
    displayMinute = 45;
  } else if (matchStatus.includes('2nd half') || period.includes('2nd half')) {
    statusLabel = '2. Yarı';
    const elapsed = stats?.matchStatus?.elapsedTime;
    minute = typeof elapsed === 'number' ? 45 + elapsed : null;
    displayMinute = typeof elapsed === 'number' ? elapsed : null;
  } else {
    statusLabel = matchStatus || period || '—';
  }

  const homeRed = stats?.score?.homeRedCards || 0;
  const awayRed = stats?.score?.awayRedCards || 0;

  return { home, away, minute, displayMinute, statusLabel, homeRed, awayRed };
}

/**
 * Helper: Find main 1X2 market
 */
export function findMain1X2Market(match: Match, marketConfig?: Record<string, MarketConfigEntry>): Market | null {
  const markets = match?.m || [];
  const isLikely1X2 = (mk: Market): boolean => {
    const config = marketConfig?.[String(mk?.st)];
    const name = normalizeText(String(config?.n || mk?.n || ''));
    if (config?.mst === 1 || config?.mst === 4) return true;
    if (name.includes('mac sonucu')) return true;
    if (Array.isArray(mk?.o) && mk.o.length >= 3) {
      const labels = mk.o.map((o) => normalizeText(String(o?.n || '')));
      const hasHome = labels.some((l) => l === '1' || l.includes('ev'));
      const hasDraw = labels.some((l) => l === '0' || l.includes('beraberlik'));
      const hasAway = labels.some((l) => l === '2' || l.includes('dep'));
      if (hasHome && hasDraw && hasAway) return true;
    }
    return false;
  };

  for (const mk of markets) {
    if (isLikely1X2(mk)) return mk;
  }
  return null;
}

/**
 * Helper: Normalize text
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Helper: Clamp value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Helper: Poisson PMF
 */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0 || k < 0) return 0;
  let prob = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) {
    prob *= lambda / i;
  }
  return prob;
}
