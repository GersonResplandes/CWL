import type { CwlPlayer, PlayerRanking, WarEntry } from './cwl.js';

export const DEFAULT_WEIGHTS = {
  star: 10,
  destruction: 0.1,
  uphill: 6,
  downhill: -4,
  wo: -35,
  defZero: 15,
  defOne: 10,
  defTwo: 4,
  defThree: -10,
  resist: 20,
  critical: -20
} as const;

export type ScoringWeights = typeof DEFAULT_WEIGHTS;

function fairDefensePoints(stars: number, weights: ScoringWeights) {
  if (stars === 0) return weights.defZero;
  if (stars === 1) return weights.defOne;
  if (stars === 2) return weights.defTwo;
  return weights.defThree;
}

export function calculateWarScore(player: CwlPlayer, entry: WarEntry, weights: ScoringWeights = DEFAULT_WEIGHTS) {
  if (entry.status === 'notSelected' || entry.status === 'pending') return 0;

  let total = 0;
  if (entry.attacked || entry.status === 'attacked') {
    total += entry.stars * weights.star;
    total += entry.destruction * weights.destruction;

    const difference = entry.targetTh - player.th;
    if (difference > 0 && entry.stars >= 1) total += difference * weights.uphill;
    if (difference < 0) total += Math.abs(difference) * weights.downhill;
  } else {
    total += weights.wo;
  }

  if (!entry.defended) return total;

  const defenseDifference = entry.enemyTh - player.th;
  if (defenseDifference > 0) {
    if (entry.defenseStars <= 2) total += weights.resist;
    return total;
  }

  if (defenseDifference === 0) return total + fairDefensePoints(entry.defenseStars, weights);
  if (entry.defenseStars === 3) return total + weights.critical;
  return total + fairDefensePoints(entry.defenseStars, weights);
}

export function getRanking(players: CwlPlayer[], weights: ScoringWeights = DEFAULT_WEIGHTS): PlayerRanking[] {
  return players
    .map(player => {
      const stats = player.wars.reduce<PlayerRanking['stats']>((total, entry) => {
        total.score += calculateWarScore(player, entry, weights);
        if (entry.status === 'attacked' || entry.attacked) {
          total.stars += entry.stars;
          total.destruction += entry.destruction;
          total.attacks += 1;
        } else if (entry.status === 'wo') {
          total.misses += 1;
        }
        if (entry.defended) total.defenses += 1;
        return total;
      }, { score: 0, stars: 0, destruction: 0, misses: 0, attacks: 0, defenses: 0 });

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
