// Performance tracking for experiment validation
// Stores bet history in IndexedDB for privacy-first local storage

export type BetRecord = {
  id: string;
  timestamp: number;
  matchId: string;
  matchName: string;
  betType: 'OVER_2.5' | 'UNDER_2.5';
  odds: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  stake: number;
  result?: 'WIN' | 'LOSS';
  profit?: number;
  actualGoals?: number;
  confidence?: number;
  kellyFraction?: number;
};

export type PerformanceMetrics = {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  roi: number;
  totalStaked: number;
  totalProfit: number;
  avgEdge: number;
  avgOdds: number;
  calibration: CalibrationBucket[];
  sharpeRatio?: number;
};

export type CalibrationBucket = {
  range: [number, number];
  predictedAvg: number;
  actualRate: number;
  count: number;
};

const DB_NAME = 'iddaa_experiments';
const DB_VERSION = 1;
const STORE_NAME = 'bets';

export class PerformanceTracker {
  private db: IDBDatabase | null = null;
  private bets: BetRecord[] = [];

  // Initialize IndexedDB
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB not available (server-side)'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadAll().then(() => resolve());
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('matchId', 'matchId', { unique: false });
          store.createIndex('result', 'result', { unique: false });
        }
      };
    });
  }

  // Load all bets from IndexedDB
  private async loadAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        this.bets = request.result || [];
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Add a new bet
  async addBet(bet: Omit<BetRecord, 'id' | 'timestamp'>): Promise<string> {
    const record: BetRecord = {
      ...bet,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(record);

      request.onsuccess = () => {
        this.bets.push(record);
        resolve(record.id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Update bet result after match ends
  async updateResult(betId: string, result: 'WIN' | 'LOSS', actualGoals: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(betId);

      getRequest.onsuccess = () => {
        const bet = getRequest.result as BetRecord;
        if (!bet) {
          reject(new Error('Bet not found'));
          return;
        }

        bet.result = result;
        bet.actualGoals = actualGoals;
        bet.profit = result === 'WIN' ? bet.stake * (bet.odds - 1) : -bet.stake;

        const updateRequest = store.put(bet);
        updateRequest.onsuccess = () => {
          // Update in-memory cache
          const idx = this.bets.findIndex((b) => b.id === betId);
          if (idx !== -1) {
            this.bets[idx] = bet;
          }
          resolve();
        };
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Get all bets
  getBets(): BetRecord[] {
    return [...this.bets];
  }

  // Get settled bets only
  getSettledBets(): BetRecord[] {
    return this.bets.filter((b) => b.result);
  }

  // Get pending bets
  getPendingBets(): BetRecord[] {
    return this.bets.filter((b) => !b.result);
  }

  // Calculate performance metrics
  getMetrics(): PerformanceMetrics | null {
    const settled = this.getSettledBets();
    if (settled.length === 0) return null;

    const wins = settled.filter((b) => b.result === 'WIN').length;
    const losses = settled.length - wins;
    const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = settled.reduce((sum, b) => sum + (b.profit || 0), 0);

    const winRate = wins / settled.length;
    const roi = (totalProfit / totalStaked) * 100;
    const avgEdge = settled.reduce((sum, b) => sum + b.edge, 0) / settled.length;
    const avgOdds = settled.reduce((sum, b) => sum + b.odds, 0) / settled.length;

    // Calculate calibration
    const calibration = this.calculateCalibration(settled);

    // Calculate Sharpe ratio (risk-adjusted return)
    const returns = settled.map((b) => ((b.profit || 0) / b.stake) * 100);
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    return {
      totalBets: settled.length,
      wins,
      losses,
      winRate,
      roi,
      totalStaked,
      totalProfit,
      avgEdge,
      avgOdds,
      calibration,
      sharpeRatio,
    };
  }

  // Calibration analysis - are our probabilities accurate?
  private calculateCalibration(bets: BetRecord[]): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = [
      { range: [0.3, 0.4], predictedAvg: 0, actualRate: 0, count: 0 },
      { range: [0.4, 0.5], predictedAvg: 0, actualRate: 0, count: 0 },
      { range: [0.5, 0.6], predictedAvg: 0, actualRate: 0, count: 0 },
      { range: [0.6, 0.7], predictedAvg: 0, actualRate: 0, count: 0 },
      { range: [0.7, 0.8], predictedAvg: 0, actualRate: 0, count: 0 },
    ];

    const bucketData: { [key: number]: { predicted: number[]; actual: number[] } } = {};
    buckets.forEach((_, idx) => {
      bucketData[idx] = { predicted: [], actual: [] };
    });

    bets.forEach((bet) => {
      const bucketIdx = buckets.findIndex((b) => bet.modelProb >= b.range[0] && bet.modelProb < b.range[1]);
      if (bucketIdx !== -1) {
        bucketData[bucketIdx].predicted.push(bet.modelProb);
        bucketData[bucketIdx].actual.push(bet.result === 'WIN' ? 1 : 0);
      }
    });

    return buckets.map((b, idx) => {
      const data = bucketData[idx];
      const count = data.predicted.length;
      const predictedAvg = count > 0 ? data.predicted.reduce((s, v) => s + v, 0) / count : 0;
      const actualRate = count > 0 ? data.actual.reduce((s, v) => s + v, 0) / count : 0;

      return {
        range: b.range,
        predictedAvg,
        actualRate,
        count,
      };
    });
  }

  // Export data as JSON for backup
  exportData(): string {
    return JSON.stringify(this.bets, null, 2);
  }

  // Import data from JSON
  async importData(jsonString: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonString) as BetRecord[];

      if (!Array.isArray(imported)) {
        throw new Error('Invalid data format');
      }

      // Validate structure
      imported.forEach((bet) => {
        if (!bet.id || !bet.timestamp || !bet.matchId || !bet.betType) {
          throw new Error('Invalid bet record structure');
        }
      });

      // Clear existing data and add imported
      await this.clearAll();

      for (const bet of imported) {
        await new Promise<void>((resolve, reject) => {
          if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
          }

          const transaction = this.db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.add(bet);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      await this.loadAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Import failed: ${message}`);
    }
  }

  // Clear all data
  async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.bets = [];
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Delete a specific bet
  async deleteBet(betId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(betId);

      request.onsuccess = () => {
        this.bets = this.bets.filter((b) => b.id !== betId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let trackerInstance: PerformanceTracker | null = null;

export async function getTracker(): Promise<PerformanceTracker> {
  if (!trackerInstance) {
    trackerInstance = new PerformanceTracker();
    await trackerInstance.init();
  }
  return trackerInstance;
}
