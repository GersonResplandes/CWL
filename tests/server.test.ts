import { describe, expect, it } from 'vitest';
import type { CwlPlayer, WarEntry } from '../src/shared/cwl.js';
import { evaluateCwlAutoSync } from '../src/server/auto-sync.js';
import { calculateWarScore, getRanking } from '../src/shared/scoring.js';
import { normalizeCwl, normalizeTag } from '../src/server/supercell.js';

describe('normalização da integração CWL', () => {
  it('normaliza e valida tags', () => {
    expect(normalizeTag(' p0y8 ')).toBe('#P0Y8');
    expect(() => normalizeTag('#INVALIDA')).toThrow();
  });

  it('distingue ataque, W.O., pendente e reserva', () => {
    const members = [
      { tag: '#P0Y8C', name: 'Atacou', townHallLevel: 15 },
      { tag: '#P0Y8J', name: 'Reserva', townHallLevel: 14 }
    ];
    const group = {
      tag: '#P0Y8G',
      state: 'inWar',
      season: '2026-06',
      clans: [{ tag: '#P0Y8', name: 'Nosso Clã', members }],
      rounds: [{ warTags: ['#WAR1'] }, { warTags: ['#WAR2'] }, { warTags: ['#0'] }]
    };
    const side = {
      tag: '#P0Y8',
      name: 'Nosso Clã',
      stars: 20,
      destructionPercentage: 90,
      members: [{ ...members[0], attacks: [{ attackerTag: '#P0Y8C', defenderTag: '#Q2G9C', stars: 2, destructionPercentage: 80 }] }]
    };
    const enemy = {
      tag: '#Q2G9',
      name: 'Rival',
      stars: 19,
      destructionPercentage: 89,
      members: [{ tag: '#Q2G9C', name: 'Alvo', townhallLevel: 16, attacks: [] }]
    };
    const ended = {
      state: 'warEnded',
      preparationStartTime: '20260616T184435.000Z',
      startTime: '20260616T194435.000Z',
      endTime: '20260617T194435.000Z',
      teamSize: 15,
      clan: side,
      opponent: enemy,
      warTag: '#WAR1'
    };
    const active = {
      state: 'inWar',
      startTime: '20260617T194435.000Z',
      endTime: '20260618T194435.000Z',
      teamSize: 15,
      clan: { ...side, members: [{ ...members[0], attacks: [] }] },
      opponent: enemy,
      warTag: '#WAR2'
    };
    const result = normalizeCwl(
      { name: 'Nosso Clã', warLeague: { name: 'Gold League III' }, badgeUrls: { medium: 'badge.png' } },
      group,
      [ended, active, null],
      '#P0Y8'
    );

    expect(result.config.league).toBe('Ouro III');
    expect(result.config.format).toBe('15x15');
    expect(result.config.warWins).toBe(1);
    expect(result.cwlId).toBe('2026-06');
    expect(result.rounds[0]?.endTime).toBe('2026-06-17T19:44:35.000Z');
    expect(result.players[0].wars.map(entry => entry.status)).toEqual(['attacked', 'pending', 'pending']);
    expect(result.players[1].wars.map(entry => entry.status)).toEqual(['notSelected', 'notSelected', 'pending']);
  });

  it('decide quando o fechamento automatico pode salvar', () => {
    const base = {
      version: 5,
      source: 'supercell' as const,
      fetchedAt: '2026-06-17T20:00:00.000Z',
      season: '2026-06-16',
      cwlId: '2026-06-16',
      groupTag: '#GROUP',
      groupState: 'inWar',
      config: {
        clanTag: '#P0Y8',
        clanName: 'Nosso Clã',
        badgeUrl: '',
        league: 'Cristal III',
        format: '30x30',
        teamSize: 30,
        warWins: 0
      },
      players: [],
      ranking: [],
      warnings: []
    };

    const waiting = evaluateCwlAutoSync({
      ...base,
      rounds: [{
        day: 1,
        endTime: '2026-06-17T19:44:35.000Z',
        preparationStartTime: null,
        startTime: null,
        state: 'inWar',
        warTag: '#WAR1'
      }]
    }, new Date('2026-06-17T20:00:00.000Z'), 10);

    const ready = evaluateCwlAutoSync({
      ...base,
      rounds: [{
        day: 1,
        endTime: '2026-06-17T19:44:35.000Z',
        preparationStartTime: null,
        startTime: null,
        state: 'warEnded',
        warTag: '#WAR1'
      }]
    }, new Date('2026-06-17T20:00:00.000Z'), 10);

    expect(waiting.action).toBe('skip');
    expect(waiting.reason).toContain('ainda não marcou');
    expect(ready.action).toBe('save');
    expect(ready.targetRound?.day).toBe(1);
  });
});

describe('pontuação', () => {
  const player: CwlPlayer = {
    id: '#P0Y8C',
    tag: '#P0Y8C',
    name: 'Jogador',
    th: 15,
    source: 'supercell',
    wars: []
  };

  it('calcula ataque contra CV superior', () => {
    const entry: WarEntry = {
      status: 'attacked',
      selected: true,
      attacked: true,
      targetTh: 16,
      stars: 2,
      destruction: 80,
      defended: false,
      enemyTh: 15,
      defenseStars: 0,
      warTag: '#WAR1',
      source: 'supercell',
      manuallyAdjusted: false
    };

    expect(calculateWarScore(player, entry)).toBe(34);
  });

  it('usa score, estrelas e destruição como desempate', () => {
    const first: CwlPlayer = { ...player, name: 'Primeiro', wars: [] };
    const second: CwlPlayer = {
      ...player,
      id: '#P0Y8J',
      tag: '#P0Y8J',
      name: 'Segundo',
      wars: []
    };
    const attack = (stars: number, destruction: number): WarEntry => ({
      status: 'attacked',
      selected: true,
      attacked: true,
      targetTh: 15,
      stars,
      destruction,
      defended: false,
      enemyTh: 15,
      defenseStars: 0,
      warTag: '#WAR',
      source: 'supercell',
      manuallyAdjusted: false
    });
    first.wars = [attack(2, 90)];
    second.wars = [attack(2, 80)];

    expect(getRanking([second, first])[0].player.name).toBe('Primeiro');
  });
});
