/**
 * Base class for all experiment algorithms.
 * Each experiment must extend this class and implement the compute() method.
 */

import type { MatchEvent } from '@/types/match';
import type { Market, MarketConfigEntry } from '@/types/match';

export type Match = MatchEvent;

export type AlgoOutput = {
  _probOver: number;
  _probUnder: number;
  probDraw?: number;
  probHome?: number;
  probAway?: number;
  currentGoals: number;
  remainingMinutes: number;
  dataQuality: string;
  parameters: Record<string, unknown>;
  notes: string[];
};

export abstract class ExperimentAlgorithm {
  abstract id: string;
  abstract name: string;
  abstract description: string;

  /**
   * Compute predictions for a given match.
   * @param match - Match data with all enriched statistics
   * @param wMarket - Weight parameter (if applicable)
   * @param context - Additional context like market config
   * @returns Algorithm output with probabilities and metadata
   */
  abstract compute(match: Match, wMarket: number, context?: { marketConfig?: Record<string, MarketConfigEntry> }): AlgoOutput;

  /**
   * Utility: Clamp value between min and max
   */
  protected clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Utility: Normalize text (lowercase, remove diacritics)
   */
  protected normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Utility: Estimate stoppage time based on game events and current period
   */
  protected estimateStoppageTime(minute: number | null, homeRed: number, awayRed: number, currentGoals: number, periodLabel: string): number {
    if (minute === null) return 0;

    // Determine period and relevant events
    const isFirstHalf = minute < 45 || periodLabel.includes('1.');
    const isHalftime = minute === 45 || periodLabel.includes('Devre');
    const isSecondHalf = minute > 45 && !isHalftime;

    // Base stoppage per period
    let baseStoppage = 3; // First half default
    if (isSecondHalf || minute >= 90) {
      baseStoppage = 4; // Second half gets more time
    }

    // For first half: count only recent events (goals/reds in first half)
    // For second half: count second-half events only (avoid double-counting)
    // Approximation: use total events scaled by period
    const eventFactor = isFirstHalf ? 0.5 : 1.0; // Conservative in first half

    const redCardTime = (homeRed + awayRed) * 1.5 * eventFactor;
    const goalTime = currentGoals * 0.5 * eventFactor;

    const estimatedStoppage = Math.min(baseStoppage + redCardTime + goalTime, 12);

    // Don't add stoppage if too early in half
    if (minute < 30) return 0; // Too early to estimate
    if (isSecondHalf && minute < 60) return baseStoppage; // Use base only early in 2nd half

    return estimatedStoppage;
  }

  /**
   * Utility: Extract goal events with timing
   */
  protected extractGoalEvents(match: Match): Array<{ minute: number; team: 'home' | 'away' }> {
    const incidents = match?.statistics?.incidentsModel?.incidents || [];
    return incidents
      .filter((inc) => inc?.incidentType?.name === 'goal')
      .map((inc) => ({
        minute: inc?.incidentTime || 0,
        team: inc?.isHome ? 'home' as const : 'away' as const,
      }))
      .sort((a, b) => (a.minute || 0) - (b.minute || 0));
  }

  /**
   * Utility: Extract current score from match
   */
  protected extractScore(match: Match): {
    home: number;
    away: number;
    minute: number | null;
    displayMinute: number | null;
    statusLabel: string;
    homeRed: number;
    awayRed: number;
    estimatedStoppage: number;
    minutesSinceLastGoal: number | null;
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

    const currentGoals = home + away;
    const estimatedStoppage = this.estimateStoppageTime(minute, homeRed, awayRed, currentGoals, statusLabel);

    // Calculate time since last goal for tempo analysis
    const goalEvents = this.extractGoalEvents(match);
    let minutesSinceLastGoal: number | null = null;
    if (goalEvents.length > 0 && minute !== null) {
      const lastGoalMinute = goalEvents[goalEvents.length - 1].minute;
      minutesSinceLastGoal = minute - lastGoalMinute;
    }

    return { home, away, minute, displayMinute, statusLabel, homeRed, awayRed, estimatedStoppage, minutesSinceLastGoal };
  }

  /**
   * Utility: Poisson PMF (probability mass function)
   */
  protected poissonPmf(lambda: number, k: number): number {
    if (lambda <= 0 || k < 0) return 0;
    let prob = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) {
      prob *= lambda / i;
    }
    return prob;
  }

  /**
   * Utility: Find main 1X2 market
   */
  protected findMain1X2Market(match: Match, marketConfig?: Record<string, MarketConfigEntry>): Market | null {
    const markets = match?.m || [];
    for (const mk of markets) {
      const config = marketConfig?.[String(mk?.st)];
      const name = this.normalizeText(String(config?.n || mk?.n || ''));
      if (config?.mst === 1 || config?.mst === 4) {
        return mk;
      }
      if (name.includes('mac sonucu')) {
        return mk;
      }
      if (Array.isArray(mk?.o) && mk.o.length >= 3) {
        const labels = mk.o.map((o) => this.normalizeText(String(o?.n || '')));
        const hasHome = labels.some((l) => l === '1' || l.includes('ev'));
        const hasDraw = labels.some((l) => l === '0' || l.includes('beraberlik'));
        const hasAway = labels.some((l) => l === '2' || l.includes('dep'));
        if (hasHome && hasDraw && hasAway) {
          return mk;
        }
      }
    }
    return null;
  }
}
