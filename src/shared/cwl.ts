export type WarStatus = 'attacked' | 'wo' | 'pending' | 'notSelected';

export type WarEntry = {
  status: WarStatus;
  selected: boolean;
  attacked: boolean;
  mapPosition: number | null;
  effectiveTh: number;
  targetMapPosition: number | null;
  targetTh: number;
  targetEffectiveTh: number;
  stars: number;
  destruction: number;
  defended: boolean;
  enemyMapPosition: number | null;
  enemyTh: number;
  enemyEffectiveTh: number;
  defenseStars: number;
  warTag: string | null;
  source: 'supercell' | 'manual';
  manuallyAdjusted: boolean;
  attackScore?: number;
  defenseScore?: number;
  score?: number;
};

export type CwlPlayer = {
  id: string;
  tag: string;
  name: string;
  th: number;
  source: 'supercell' | 'manual';
  wars: WarEntry[];
};

export type CwlRound = {
  day: number;
  endTime: string | null;
  preparationStartTime: string | null;
  startTime: string | null;
  warTag: string | null;
  state: string;
};

export type PlayerRanking = {
  player: Pick<CwlPlayer, 'id' | 'tag' | 'name' | 'th'>;
  stats: {
    attackScore: number;
    defenseScore: number;
    score: number;
    stars: number;
    destruction: number;
    misses: number;
    attacks: number;
    defenses: number;
  };
};

export type CwlPayload = {
  version: number;
  source: 'supercell';
  fetchedAt: string;
  season: string;
  cwlId: string;
  groupTag: string | null;
  groupState: string;
  config: {
    clanTag: string;
    clanName: string;
    badgeUrl: string;
    league: string;
    format: string;
    teamSize: number;
    warWins: number;
  };
  rounds: CwlRound[];
  players: CwlPlayer[];
  ranking: PlayerRanking[];
  roundRankings: Array<{
    day: number;
    ranking: PlayerRanking[];
  }>;
  warnings: string[];
  persisted?: boolean;
};

export type ClanMember = {
  tag: string;
  name: string;
  th: number;
  expLevel: number;
  role: string;
  clanRank: number;
  trophies: number;
  donations: number;
  donationsReceived: number;
  leagueName: string;
  leagueIconUrl: string;
};

export type PlayerHero = {
  name: string;
  level: number;
  maxLevel: number;
};

export type ClanMemberDetail = {
  fetchedAt: string;
  tag: string;
  name: string;
  th: number;
  townHallWeaponLevel: number;
  expLevel: number;
  role: string;
  warPreference: string;
  trophies: number;
  bestTrophies: number;
  leagueName: string;
  leagueIconUrl: string;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  donations: number;
  donationsReceived: number;
  clanCapitalContributions: number;
  builderHallLevel: number;
  builderBaseTrophies: number;
  heroes: PlayerHero[];
};

export type ClanRosterPayload = {
  fetchedAt: string;
  config: {
    clanTag: string;
    clanName: string;
    badgeUrl: string;
    league: string;
  };
  memberCount: number;
  members: ClanMember[];
};

export type HistoryItem = {
  cwlId: string;
  season: string;
  league: string;
  format: string;
  state: string;
  updatedAt: string;
  sheetName: string;
};
