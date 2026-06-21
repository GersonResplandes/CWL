import { describe, expect, it } from 'vitest';
import type { CwlPlayer, WarEntry } from '../src/shared/cwl.js';
import { evaluateCwlAutoSync } from '../src/server/auto-sync.js';
import { calculateAttackScore, calculateDefenseScore, calculateWarScore, getRanking, getRoundRanking } from '../src/shared/scoring.js';
import { normalizeCwl, normalizeTag } from '../src/server/supercell.js';

function warEntry(overrides: Partial<WarEntry> = {}): WarEntry {
  return {
    status: 'pending',
    selected: true,
    attacked: false,
    mapPosition: null,
    effectiveTh: 15,
    targetMapPosition: null,
    targetTh: 15,
    targetEffectiveTh: 15,
    stars: 0,
    destruction: 0,
    defended: false,
    enemyMapPosition: null,
    enemyTh: 15,
    enemyEffectiveTh: 15,
    defenseStars: 0,
    warTag: '#WAR',
    source: 'supercell',
    manuallyAdjusted: false,
    ...overrides
  };
}

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

  it('calcula CV efetivo pela ordem do mapa da guerra', () => {
    const allowed = '0289PYLQGRJCUV';
    const tagAt = (index: number) => `#P0Y${allowed[Math.floor(index / allowed.length)]}${allowed[index % allowed.length]}`;
    const realThs = [18, 18, 17, 17, 17, 17, 17, 18, 16, 17, 16, 16, 17, 14, 14, 14, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12];
    const expectedEffectiveThs = [18, 18, 17, 17, 17, 17, 17, 17, 16, 16, 16, 16, 16, 14, 14, 14, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 12];
    const members = realThs.map((th, index) => ({
      tag: tagAt(index),
      name: `Jogador ${index + 1}`,
      townHallLevel: th
    }));
    const group = {
      tag: '#P0Y8G',
      state: 'inWar',
      season: '2026-06',
      clans: [{ tag: '#P0Y8', name: 'Nosso Clã', members }],
      rounds: [{ warTags: ['#WAR1'] }]
    };
    const war = {
      state: 'preparation',
      teamSize: 30,
      clan: {
        tag: '#P0Y8',
        name: 'Nosso Clã',
        stars: 0,
        destructionPercentage: 0,
        members: members.map((member, index) => ({ ...member, mapPosition: index + 1, attacks: [] }))
      },
      opponent: {
        tag: '#Q2G9',
        name: 'Rival',
        stars: 0,
        destructionPercentage: 0,
        members: members.map((member, index) => ({
          ...member,
          tag: `#Q2G${allowed[Math.floor(index / allowed.length)]}${allowed[index % allowed.length]}`,
          mapPosition: index + 1,
          attacks: []
        }))
      },
      warTag: '#WAR1'
    };

    const result = normalizeCwl(
      { name: 'Nosso Clã', warLeague: { name: 'Crystal League III' }, badgeUrls: { medium: 'badge.png' } },
      group,
      [war],
      '#P0Y8'
    );

    expect(result.players.map(player => player.wars[0].effectiveTh)).toEqual(expectedEffectiveThs);
    expect(result.players[7].wars[0].effectiveTh).toBe(17);
    expect(result.players[9].wars[0].effectiveTh).toBe(16);
    expect(result.players[12].wars[0].effectiveTh).toBe(16);
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
      roundRankings: [],
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
    const entry = warEntry({
      status: 'attacked',
      attacked: true,
      targetTh: 16,
      targetEffectiveTh: 16,
      stars: 2,
      destruction: 80,
      warTag: '#WAR1'
    });

    expect(calculateWarScore(player, entry)).toBe(34);
  });

  it('aplica a fórmula base do ataque', () => {
    const entry = warEntry({
      status: 'attacked',
      attacked: true,
      stars: 3,
      destruction: 90
    });

    expect(calculateAttackScore(player, entry)).toBe(39);
  });

  it('não dá bônus de CV acima sem estrela', () => {
    const entry = warEntry({
      status: 'attacked',
      attacked: true,
      targetTh: 16,
      targetEffectiveTh: 16,
      stars: 0,
      destruction: 50
    });

    expect(calculateAttackScore(player, entry)).toBe(5);
  });

  it('penaliza ataque contra CV efetivo abaixo', () => {
    const entry = warEntry({
      status: 'attacked',
      attacked: true,
      targetTh: 14,
      targetEffectiveTh: 14,
      stars: 3,
      destruction: 100
    });

    expect(calculateAttackScore(player, entry)).toBe(36);
  });

  it('aplica W.O. como -35 pontos', () => {
    expect(calculateAttackScore(player, warEntry({ status: 'wo' }))).toBe(-35);
  });

  it('usa a matriz de defesa por relação de CV efetivo', () => {
    const superior = [15, 0, 0, -5];
    const equal = [10, 0, -5, -10];
    const inferior = [5, -5, -10, -20];

    superior.forEach((score, stars) => {
      expect(calculateDefenseScore(player, warEntry({
        defended: true,
        defenseStars: stars,
        enemyTh: 16,
        enemyEffectiveTh: 16
      }))).toBe(score);
    });

    equal.forEach((score, stars) => {
      expect(calculateDefenseScore(player, warEntry({
        defended: true,
        defenseStars: stars,
        enemyTh: 15,
        enemyEffectiveTh: 15
      }))).toBe(score);
    });

    inferior.forEach((score, stars) => {
      expect(calculateDefenseScore(player, warEntry({
        defended: true,
        defenseStars: stars,
        enemyTh: 14,
        enemyEffectiveTh: 14
      }))).toBe(score);
    });

    expect(calculateDefenseScore(player, warEntry({ defended: false }))).toBe(0);
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
    const attack = (stars: number, destruction: number): WarEntry => warEntry({
      status: 'attacked',
      attacked: true,
      stars,
      destruction
    });
    first.wars = [attack(2, 90)];
    second.wars = [attack(2, 80)];

    expect(getRanking([second, first])[0].player.name).toBe('Primeiro');
  });

  it('separa ranking da rodada e ranking geral', () => {
    const first: CwlPlayer = {
      ...player,
      name: 'Primeiro',
      wars: [
        warEntry({ status: 'attacked', attacked: true, stars: 1, destruction: 50 }),
        warEntry({ status: 'attacked', attacked: true, stars: 3, destruction: 100 })
      ]
    };
    const second: CwlPlayer = {
      ...player,
      id: '#P0Y8J',
      tag: '#P0Y8J',
      name: 'Segundo',
      wars: [
        warEntry({ status: 'attacked', attacked: true, stars: 3, destruction: 100 }),
        warEntry({ status: 'attacked', attacked: true, stars: 0, destruction: 10 })
      ]
    };

    expect(getRoundRanking([first, second], 0)[0].player.name).toBe('Segundo');
    expect(getRanking([first, second])[0].player.name).toBe('Primeiro');
  });
});
