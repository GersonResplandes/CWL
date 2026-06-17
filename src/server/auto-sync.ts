import type { CwlPayload, CwlRound } from '../shared/cwl.js';

export type AutoSyncDecision = {
  action: 'save' | 'skip';
  finalSnapshot: boolean;
  nextCheckAt: string | null;
  reason: string;
  targetRound: CwlRound | null;
};

function roundEndWithGrace(round: CwlRound, graceMinutes: number) {
  if (!round.endTime) return null;
  const endTime = Date.parse(round.endTime);
  if (Number.isNaN(endTime)) return null;
  return endTime + graceMinutes * 60_000;
}

export function evaluateCwlAutoSync(
  cwl: CwlPayload,
  now = new Date(),
  graceMinutes = 10
): AutoSyncDecision {
  const nowMs = now.getTime();
  const roundsWithWar = cwl.rounds
    .filter(round => Boolean(round.warTag))
    .sort((a, b) => a.day - b.day);
  const endedRounds = roundsWithWar.filter(round => round.state === 'warEnded');
  const latestEndedRound = endedRounds.at(-1) ?? null;
  const finalSnapshot = (
    cwl.groupState === 'ended'
    || (roundsWithWar.length >= 7 && roundsWithWar.every(round => round.state === 'warEnded'))
  );

  if (latestEndedRound) {
    return {
      action: 'save',
      finalSnapshot,
      nextCheckAt: null,
      reason: finalSnapshot
        ? 'A última guerra disponível está encerrada. Salvando o fechamento final da CWL.'
        : `A rodada ${latestEndedRound.day} está encerrada. Salvando o fechamento diário da CWL.`,
      targetRound: latestEndedRound
    };
  }

  const dueRound = roundsWithWar.find(round => {
    const dueAt = roundEndWithGrace(round, graceMinutes);
    return dueAt !== null && nowMs >= dueAt;
  }) ?? null;

  if (dueRound) {
    return {
      action: 'skip',
      finalSnapshot: false,
      nextCheckAt: new Date(nowMs + 5 * 60_000).toISOString(),
      reason: `A rodada ${dueRound.day} já passou do horário final, mas a Supercell ainda não marcou a guerra como encerrada.`,
      targetRound: dueRound
    };
  }

  const nextDueAt = roundsWithWar
    .map(round => roundEndWithGrace(round, graceMinutes))
    .filter((value): value is number => value !== null && value > nowMs)
    .sort((a, b) => a - b)[0] ?? null;

  return {
    action: 'skip',
    finalSnapshot: false,
    nextCheckAt: nextDueAt ? new Date(nextDueAt).toISOString() : null,
    reason: roundsWithWar.length
      ? 'Nenhuma rodada está encerrada ainda. O salvamento automático vai aguardar o fim da guerra.'
      : 'A CWL ainda não possui guerra disponível para este clã.',
    targetRound: roundsWithWar[0] ?? null
  };
}
