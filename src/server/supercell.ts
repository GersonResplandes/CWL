import type {
  ClanMemberDetail,
  ClanRosterPayload,
  CwlPayload,
  CwlPlayer,
  WarEntry
} from '../shared/cwl.js';
import { getRanking } from '../shared/scoring.js';

type ApiAttack = {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order?: number;
};

type ApiMember = {
  tag: string;
  name: string;
  townhallLevel?: number;
  townHallLevel?: number;
  attacks?: ApiAttack[];
};

type ApiWarSide = {
  tag: string;
  name: string;
  stars: number;
  destructionPercentage: number;
  members: ApiMember[];
};

type ApiWar = {
  warTag?: string;
  state: string;
  preparationStartTime?: string;
  startTime?: string;
  endTime?: string;
  teamSize: number;
  clan: ApiWarSide;
  opponent: ApiWarSide;
};

type ApiLeagueGroup = {
  tag?: string;
  state: string;
  season: string;
  clans: Array<{ tag: string; name: string; members: ApiMember[] }>;
  rounds: Array<{ warTags: string[] }>;
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function normalizeTag(value: string) {
  const clean = value.trim().toUpperCase().replace(/^#/, '');
  if (!/^[0289PYLQGRJCUV]{3,15}$/.test(clean)) throw new Error('Tag inválida.');
  return `#${clean}`;
}

function normalizeApiTime(value?: string) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct).toISOString();

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d{3})?Z$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )).toISOString();
}

function thOf(member: ApiMember | undefined, fallback = 3) {
  return member?.townhallLevel ?? member?.townHallLevel ?? fallback;
}

function translateLeague(name: string | undefined) {
  if (!name) return 'Não classificado';
  const divisions: Record<string, string> = {
    'Bronze League': 'Bronze',
    'Silver League': 'Prata',
    'Gold League': 'Ouro',
    'Crystal League': 'Cristal',
    'Master League': 'Mestre',
    'Champion League': 'Campeão',
    'Titan League': 'Titã',
    'Legend League': 'Lenda'
  };
  for (const [english, portuguese] of Object.entries(divisions)) {
    if (name.startsWith(english)) return name.replace(english, portuguese);
  }
  return name;
}

function bestDefenseAttack(enemyMembers: ApiMember[], defenderTag: string) {
  return enemyMembers
    .flatMap(member => member.attacks || [])
    .filter(attack => normalizeTag(attack.defenderTag) === normalizeTag(defenderTag))
    .sort((a, b) =>
      b.stars - a.stars
      || b.destructionPercentage - a.destructionPercentage
      || (a.order || 0) - (b.order || 0)
    )[0];
}

function emptyWarEntry(status: 'pending' | 'notSelected', th: number, warTag: string | null): WarEntry {
  return {
    status,
    selected: status !== 'notSelected',
    attacked: false,
    targetTh: th,
    stars: 0,
    destruction: 0,
    defended: false,
    enemyTh: th,
    defenseStars: 0,
    warTag,
    source: 'supercell',
    manuallyAdjusted: false
  };
}

export function normalizeCwl(
  clan: any,
  group: ApiLeagueGroup,
  wars: Array<ApiWar | null>,
  clanTag: string
): CwlPayload {
  const allowedClanTag = normalizeTag(clanTag);
  const members = new Map<string, { tag: string; name: string; th: number }>();
  const groupClan = group.clans.find(item => normalizeTag(item.tag) === allowedClanTag);

  for (const member of groupClan?.members || []) {
    const tag = normalizeTag(member.tag);
    members.set(tag, { tag, name: member.name, th: thOf(member) });
  }

  const rounds = group.rounds.slice(0, 7).map((_, index) => ({
    day: index + 1,
    endTime: normalizeApiTime(wars[index]?.endTime),
    preparationStartTime: normalizeApiTime(wars[index]?.preparationStartTime),
    startTime: normalizeApiTime(wars[index]?.startTime),
    warTag: wars[index]?.warTag || null,
    state: wars[index]?.state || 'notStarted'
  }));

  const players: CwlPlayer[] = [...members.values()].map(player => ({
    id: player.tag,
    tag: player.tag,
    name: player.name,
    th: player.th,
    source: 'supercell',
    wars: rounds.map((round, index) => {
      const war = wars[index];
      if (!war) return emptyWarEntry('pending', player.th, round.warTag);

      const ours = normalizeTag(war.clan.tag) === allowedClanTag ? war.clan : war.opponent;
      const theirs = ours === war.clan ? war.opponent : war.clan;
      const member = ours.members.find(item => normalizeTag(item.tag) === player.tag);
      if (!member) return emptyWarEntry('notSelected', player.th, round.warTag);

      const attack = (member.attacks || [])[0];
      const target = attack
        ? theirs.members.find(item => normalizeTag(item.tag) === normalizeTag(attack.defenderTag))
        : undefined;
      const defense = bestDefenseAttack(theirs.members, player.tag);
      const attacker = defense
        ? theirs.members.find(item => normalizeTag(item.tag) === normalizeTag(defense.attackerTag))
        : undefined;
      const status = attack ? 'attacked' : war.state === 'warEnded' ? 'wo' : 'pending';

      return {
        status,
        selected: true,
        attacked: Boolean(attack),
        targetTh: thOf(target, player.th),
        stars: attack?.stars || 0,
        destruction: attack?.destructionPercentage || 0,
        defended: Boolean(defense),
        enemyTh: thOf(attacker, player.th),
        defenseStars: defense?.stars || 0,
        warTag: round.warTag,
        source: 'supercell',
        manuallyAdjusted: false
      };
    })
  }));

  const completedWars = wars.filter((war): war is ApiWar => Boolean(war && war.state === 'warEnded'));
  const warWins = completedWars.filter(war => {
    const ours = normalizeTag(war.clan.tag) === allowedClanTag ? war.clan : war.opponent;
    const theirs = ours === war.clan ? war.opponent : war.clan;
    return ours.stars > theirs.stars
      || (ours.stars === theirs.stars && ours.destructionPercentage > theirs.destructionPercentage);
  }).length;
  const reportedTeamSize = wars.find(Boolean)?.teamSize || 0;
  const teamSize = [15, 30].includes(reportedTeamSize) ? reportedTeamSize : 0;

  return {
    version: 5,
    source: 'supercell',
    fetchedAt: new Date().toISOString(),
    season: group.season,
    cwlId: group.season,
    groupTag: group.tag ? normalizeTag(group.tag) : null,
    groupState: group.state,
    config: {
      clanTag: allowedClanTag,
      clanName: clan.name || groupClan?.name || '',
      badgeUrl: clan.badgeUrls?.medium || clan.badgeUrls?.small || '',
      league: translateLeague(clan.warLeague?.name),
      format: teamSize ? `${teamSize}x${teamSize}` : 'A definir',
      teamSize,
      warWins
    },
    rounds,
    players,
    ranking: getRanking(players),
    warnings: [
      ...rounds
        .filter(round => !round.warTag)
        .map(round => `Rodada ${round.day} ainda não possui guerra disponível.`),
      ...(reportedTeamSize && !teamSize
        ? [`Formato ${reportedTeamSize}x${reportedTeamSize} não suportado. Use 15x15 ou 30x30.`]
        : [])
    ]
  };
}

export function createSupercellService(token: string, clanTag: string) {
  const allowedClanTag = normalizeTag(clanTag);

  async function get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`https://api.clashofclans.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error((payload as { message?: string }).message || `Erro ${response.status} na API Supercell.`);
        Object.assign(error, { statusCode: response.status });
        throw error;
      }
      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function roster(): Promise<ClanRosterPayload> {
    const cacheKey = `roster:${allowedClanTag}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as ClanRosterPayload;

    const clan = await get<any>(`/clans/${encodeURIComponent(allowedClanTag)}`);
    const members = (clan.memberList || [])
      .map((member: any) => ({
        tag: normalizeTag(member.tag),
        name: member.name,
        th: member.townHallLevel,
        expLevel: member.expLevel || 0,
        role: member.role,
        clanRank: member.clanRank,
        trophies: member.trophies || 0,
        donations: member.donations || 0,
        donationsReceived: member.donationsReceived || 0,
        leagueName: translateLeague(member.leagueTier?.name || member.league?.name),
        leagueIconUrl:
          member.leagueTier?.iconUrls?.small
          || member.league?.iconUrls?.small
          || member.league?.iconUrls?.tiny
          || ''
      }))
      .sort((a: any, b: any) => b.th - a.th || a.clanRank - b.clanRank);

    const value: ClanRosterPayload = {
      fetchedAt: new Date().toISOString(),
      config: {
        clanTag: allowedClanTag,
        clanName: clan.name,
        badgeUrl: clan.badgeUrls?.medium || clan.badgeUrls?.small || '',
        league: translateLeague(clan.warLeague?.name)
      },
      memberCount: members.length,
      members
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value });
    return value;
  }

  async function playerDetail(playerTag: string): Promise<ClanMemberDetail> {
    const normalizedPlayerTag = normalizeTag(playerTag);
    const rosterData = await roster();
    if (!rosterData.members.some(member => member.tag === normalizedPlayerTag)) {
      const error = new Error('Este jogador não pertence ao clã autorizado.');
      Object.assign(error, { statusCode: 403 });
      throw error;
    }

    const cacheKey = `player:${normalizedPlayerTag}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as ClanMemberDetail;

    const player = await get<any>(`/players/${encodeURIComponent(normalizedPlayerTag)}`);
    if (!player.clan?.tag || normalizeTag(player.clan.tag) !== allowedClanTag) {
      const error = new Error('Este jogador não pertence mais ao clã autorizado.');
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    const value: ClanMemberDetail = {
      fetchedAt: new Date().toISOString(),
      tag: normalizedPlayerTag,
      name: player.name,
      th: player.townHallLevel || 0,
      townHallWeaponLevel: player.townHallWeaponLevel || 0,
      expLevel: player.expLevel || 0,
      role: player.role || 'member',
      warPreference: player.warPreference || 'out',
      trophies: player.trophies || 0,
      bestTrophies: player.bestTrophies || 0,
      leagueName: translateLeague(player.leagueTier?.name || player.league?.name),
      leagueIconUrl:
        player.leagueTier?.iconUrls?.medium
        || player.leagueTier?.iconUrls?.small
        || player.league?.iconUrls?.medium
        || player.league?.iconUrls?.small
        || '',
      warStars: player.warStars || 0,
      attackWins: player.attackWins || 0,
      defenseWins: player.defenseWins || 0,
      donations: player.donations || 0,
      donationsReceived: player.donationsReceived || 0,
      clanCapitalContributions: player.clanCapitalContributions || 0,
      builderHallLevel: player.builderHallLevel || 0,
      builderBaseTrophies: player.builderBaseTrophies || 0,
      heroes: (player.heroes || [])
        .filter((hero: any) => !hero.village || hero.village === 'home')
        .map((hero: any) => ({
          name: String(hero.name || ''),
          level: hero.level || 0,
          maxLevel: hero.maxLevel || 0
        }))
    };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value });
    return value;
  }

  async function currentCwl(options: { bypassCache?: boolean } = {}): Promise<CwlPayload> {
    const cacheKey = `cwl:${allowedClanTag}`;
    const cached = cache.get(cacheKey);
    if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.value as CwlPayload;

    const encoded = encodeURIComponent(allowedClanTag);
    const [clan, group] = await Promise.all([
      get<any>(`/clans/${encoded}`),
      get<ApiLeagueGroup>(`/clans/${encoded}/currentwar/leaguegroup`)
    ]);

    const wars = await Promise.all(group.rounds.slice(0, 7).map(async round => {
      const tags = round.warTags.filter(tag => tag !== '#0');
      const candidates = await Promise.all(tags.map(async tag => ({
        ...(await get<ApiWar>(`/clanwarleagues/wars/${encodeURIComponent(tag)}`)),
        warTag: tag
      })));
      return candidates.find(war =>
        normalizeTag(war.clan.tag) === allowedClanTag
        || normalizeTag(war.opponent.tag) === allowedClanTag
      ) || null;
    }));

    const value = normalizeCwl(clan, group, wars, allowedClanTag);
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, value });
    return value;
  }

  return { allowedClanTag, currentCwl, playerDetail, roster };
}
