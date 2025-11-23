export interface Match {
  id: string;
  betradarId: number | null;
  league: string;
  home: string;
  away: string;
  score: {
    home: number;
    away: number;
  };
  clock: {
    minutes: number;
    seconds: number;
    phase: string;
  };
  stats: {
    corners?: { home: number; away: number };
    cards?: {
      home: { yellow: number; red: number };
      away: { yellow: number; red: number };
    };
    extra?: Array<{
      key: string;
      label: string;
      home: number | string;
      away: number | string;
    }>;
  };
}

export interface SportradarToken {
  token?: string;
  emsg?: string;
}
