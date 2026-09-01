import { describe, expect, it } from 'vitest';
import { createDefaultConfig, type MatchConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState } from './flow';

function createRoundOverState(config: MatchConfig = createDefaultConfig()): AppFlowState {
  return {
    ...createFlow(config),
    screen: 'ROUND_OVER',
  };
}

describe('app flow', () => {
  it('starts at TITLE and exposes local mode, disabled cpu, and random as a map tile', () => {
    const state = createFlow(createDefaultConfig());

    expect(state.screen).toBe('TITLE');
    expect(state.modeOptions).toHaveLength(2);
    expect(state.modeOptions[0]).toEqual({ id: 'local', label: '1v1 Local', enabled: true });
    expect(state.modeOptions[1]).toEqual({
      id: 'cpu',
      label: '1 v CPU',
      enabled: false,
      note: 'Task 12',
      cpuTierIds: ['recruit', 'gunner', 'veteran'],
    });
    expect(state.mapOptions).toContain('random');
    expect(state.mapOptions.filter((id) => id === 'random')).toHaveLength(1);
  });

  it('reaches ROUND_INTRO in exactly two quick-start actions', () => {
    const initial = createFlow(createDefaultConfig());

    const afterQuickStart = reduceFlow(initial, { type: 'quickStart' });
    const afterMapPick = reduceFlow(afterQuickStart, { type: 'selectMap', worldId: 'terra' });

    expect(afterQuickStart.screen).toBe('MAP');
    expect(afterQuickStart.config.path).toBe('quick');
    expect(afterQuickStart.config.mode).toBe('local');
    expect(afterMapPick.screen).toBe('ROUND_INTRO');
    expect(afterMapPick.config.selectedWorldId).toBe('terra');
  });

  it('represents MODE while keeping cpu disabled', () => {
    const title = createFlow(createDefaultConfig());

    const mode = reduceFlow(title, { type: 'openMode' });

    expect(mode.screen).toBe('MODE');
    expect(reduceFlow(mode, { type: 'selectMode', mode: 'cpu' })).toBe(mode);

    const local = reduceFlow(mode, { type: 'selectMode', mode: 'local' });
    expect(local.screen).toBe('MAP');
    expect(local.config.mode).toBe('local');
  });

  it('keeps custom setup on one screen and supports how-to back and play', () => {
    const title = createFlow(createDefaultConfig());

    const custom = reduceFlow(title, { type: 'openCustom' });
    const customIntro = reduceFlow(custom, { type: 'startCustom' });
    const howTo = reduceFlow(title, { type: 'openHowTo' });
    const back = reduceFlow(howTo, { type: 'back' });
    const play = reduceFlow(howTo, { type: 'playFromHowTo' });

    expect(custom.screen).toBe('CUSTOM');
    expect(customIntro.screen).toBe('ROUND_INTRO');
    expect(back.screen).toBe('TITLE');
    expect(play.screen).toBe('MAP');
    expect(play.config.path).toBe('quick');
    expect(play.config.mode).toBe('local');
  });

  it('forces all startable task 11 paths back to local mode until task 12', () => {
    const cpuTitle = createFlow({
      ...createDefaultConfig(),
      mode: 'cpu',
    });

    const quickMap = reduceFlow(cpuTitle, { type: 'quickStart' });
    const quickIntro = reduceFlow(quickMap, { type: 'selectMap', worldId: 'terra' });
    const custom = reduceFlow(cpuTitle, { type: 'openCustom' });
    const customIntro = reduceFlow(custom, { type: 'startCustom' });
    const howTo = reduceFlow(cpuTitle, { type: 'openHowTo' });
    const howToMap = reduceFlow(howTo, { type: 'playFromHowTo' });

    expect(quickMap.config.mode).toBe('local');
    expect(quickIntro.config.mode).toBe('local');
    expect(custom.config.mode).toBe('local');
    expect(customIntro.config.mode).toBe('local');
    expect(howToMap.config.mode).toBe('local');
  });

  it('moves from round intro to loadout to match to round over', () => {
    const title = createFlow(createDefaultConfig());
    const roundIntro = reduceFlow(
      reduceFlow(title, { type: 'quickStart' }),
      { type: 'selectMap', worldId: 'terra' },
    );
    const loadout = reduceFlow(roundIntro, { type: 'openLoadout' });
    const match = reduceFlow(loadout, { type: 'deployLoadout' });
    const recap = {
      spentShellIdsByPlayer: [
        ['he', 'mortar'],
        ['he'],
      ],
    } as const;
    const roundOver = reduceFlow(match, { type: 'completeMatch', recap });

    expect(loadout.screen).toBe('LOADOUT');
    expect(loadout.config).toEqual(roundIntro.config);
    expect(match.screen).toBe('MATCH');
    expect(match.config).toEqual(loadout.config);
    expect(roundOver.screen).toBe('ROUND_OVER');
    expect(roundOver.config).toEqual(match.config);
    expect(roundOver.roundOver).toEqual(recap);
  });

  it('rematch changes only seed, change loadout preserves settings, and menu returns title', () => {
    const roundOver = createRoundOverState({
      ...createDefaultConfig(),
      path: 'custom',
      selectedWorldId: 'rust',
      selectedGeneratorId: 'plates',
      seed: 7,
      rounds: 5,
      wind: 'light',
      turnTimer: '30',
    });

    const rematch = reduceFlow(roundOver, { type: 'rematch', seed: 99 });
    const loadout = reduceFlow(roundOver, { type: 'changeLoadout' });
    const menu = reduceFlow(roundOver, { type: 'menu' });

    expect(rematch.screen).toBe('MATCH');
    expect(rematch.config).toEqual({ ...roundOver.config, seed: 99 });
    expect(loadout.screen).toBe('LOADOUT');
    expect(loadout.config).toEqual(roundOver.config);
    expect(menu.screen).toBe('TITLE');
    expect(menu.config).toEqual(roundOver.config);
  });

  it('returns the same state for invalid transitions and invalid rematch seeds', () => {
    const title = createFlow(createDefaultConfig());
    const custom = reduceFlow(title, { type: 'openCustom' });
    const map = reduceFlow(title, { type: 'quickStart' });
    const roundIntro = reduceFlow(map, { type: 'selectMap', worldId: 'terra' });
    const loadout = reduceFlow(roundIntro, { type: 'openLoadout' });
    const match = reduceFlow(loadout, { type: 'deployLoadout' });
    const howTo = reduceFlow(title, { type: 'openHowTo' });
    const roundOver = reduceFlow(match, {
      type: 'completeMatch',
      recap: { spentShellIdsByPlayer: [['he'], ['mortar']] },
    });

    expect(reduceFlow(custom, { type: 'quickStart' })).toBe(custom);
    expect(reduceFlow(map, { type: 'openCustom' })).toBe(map);
    expect(reduceFlow(custom, { type: 'openHowTo' })).toBe(custom);
    expect(reduceFlow(title, { type: 'selectMap', worldId: 'terra' })).toBe(title);
    expect(reduceFlow(custom, { type: 'menu' })).toBe(custom);
    expect(reduceFlow(title, { type: 'changeLoadout' })).toBe(title);
    expect(reduceFlow(title, { type: 'openLoadout' })).toBe(title);
    expect(reduceFlow(roundIntro, { type: 'deployLoadout' })).toBe(roundIntro);
    expect(reduceFlow(loadout, { type: 'completeMatch', recap: { spentShellIdsByPlayer: [] } })).toBe(loadout);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: roundOver.config.seed })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: -1 })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: 0x1_0000_0000 })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: 1.5 })).toBe(roundOver);
    expect(reduceFlow(howTo, { type: 'changeLoadout' })).toBe(howTo);
  });
});
