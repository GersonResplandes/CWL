import type { CwlPlayer, PlayerRanking, WarEntry } from './cwl.js';

export const DEFAULT_WEIGHTS = {
  star: 10,
  destruction: 0.1,
  uphill: 6,
  downhill: -4,
  wo: -35,
  defenseSuperior: [15, 0, 0, -5],
  defenseEqual: [10, 0, -5, -10],
  defenseInferior: [5, -5, -10, -20]
} as const;

export type ScoringWeights = typeof DEFAULT_WEIGHTS;

function effectivePlayerTh(player: CwlPlayer, entry: WarEntry) {
  return entry.effectiveTh || player.th;
}

function effectiveTargetTh(entry: WarEntry) {
  return entry.targetEffectiveTh || entry.targetTh;
}

function effectiveEnemyTh(entry: WarEntry) {
  return entry.enemyEffectiveTh || entry.enemyTh;
}

function normalizedStars(stars: number) {
  return Math.max(0, Math.min(3, Math.trunc(stars)));
}

export function calculateAttackScore(player: CwlPlayer, entry: WarEntry, weights: ScoringWeights = DEFAULT_WEIGHTS) {
  if (entry.status === 'notSelected') return 0;
  if (entry.status === 'wo') return weights.wo;
  if (!entry.attacked && entry.status !== 'attacked') return 0;

  let total = entry.stars * weights.star;
  total += entry.destruction * weights.destruction;

  const difference = effectiveTargetTh(entry) - effectivePlayerTh(player, entry);
  if (difference > 0 && entry.stars >= 1) total += difference * weights.uphill;
  if (difference < 0) total += Math.abs(difference) * weights.downhill;

  return total;
}

export function calculateDefenseScore(player: CwlPlayer, entry: WarEntry, weights: ScoringWeights = DEFAULT_WEIGHTS) {
  if (entry.status === 'notSelected' || !entry.defended) return 0;

  const stars = normalizedStars(entry.defenseStars);
  const difference = effectiveEnemyTh(entry) - effectivePlayerTh(player, entry);

  if (difference > 0) return weights.defenseSuperior[stars] ?? 0;
  if (difference < 0) return weights.defenseInferior[stars] ?? 0;
  return weights.defenseEqual[stars] ?? 0;
}

export function calculateWarScore(player: CwlPlayer, entry: WarEntry, weights: ScoringWeights = DEFAULT_WEIGHTS) {
  return calculateAttackScore(player, entry, weights) + calculateDefenseScore(player, entry, weights);
}

export function scoreWarEntry(player: CwlPlayer, entry: WarEntry, weights: ScoringWeights = DEFAULT_WEIGHTS): WarEntry {
  const attackScore = calculateAttackScore(player, entry, weights);
  const defenseScore = calculateDefenseScore(player, entry, weights);
  return {
    ...entry,
    attackScore,
    defenseScore,
    score: attackScore + defenseScore
  };
}

function entriesForRanking(player: CwlPlayer, roundIndex?: number) {
  if (roundIndex === undefined) return player.wars;
  const entry = player.wars[roundIndex];
  return entry ? [entry] : [];
}

function buildRanking(players: CwlPlayer[], weights: ScoringWeights, roundIndex?: number) {
  return players
    .map(player => {
      const stats = entriesForRanking(player, roundIndex).reduce<PlayerRanking['stats']>((total, entry) => {
        const attackScore = entry.attackScore ?? calculateAttackScore(player, entry, weights);
        const defenseScore = entry.defenseScore ?? calculateDefenseScore(player, entry, weights);
        const score = entry.score ?? attackScore + defenseScore;

        total.attackScore += attackScore;
        total.defenseScore += defenseScore;
        total.score += score;
        if (entry.status === 'attacked' || entry.attacked) {
          total.stars += entry.stars;
          total.destruction += entry.destruction;
          total.attacks += 1;
        } else if (entry.status === 'wo') {
          total.misses += 1;
        }
        if (entry.defended) total.defenses += 1;
        return total;
      }, { attackScore: 0, defenseScore: 0, score: 0, stars: 0, destruction: 0, misses: 0, attacks: 0, defenses: 0 });

      return {
        player: {
          id: player.id,
          tag: player.tag,
          name: player.name,
          th: player.th
        },
        stats
      };
    })
    .sort((a, b) =>
      b.stats.score - a.stats.score
      || b.stats.stars - a.stats.stars
      || b.stats.destruction - a.stats.destruction
    );
}

export function getRanking(players: CwlPlayer[], weights: ScoringWeights = DEFAULT_WEIGHTS): PlayerRanking[] {
  return buildRanking(players, weights);
}

export function getRoundRanking(
  players: CwlPlayer[],
  roundIndex: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): PlayerRanking[] {
  return buildRanking(
    players.filter(player => player.wars[roundIndex]?.selected),
    weights,
    roundIndex
  );
}
