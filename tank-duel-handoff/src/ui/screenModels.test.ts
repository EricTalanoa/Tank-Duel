import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { SHELLS } from '../sim/shells';
import { createDefaultConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState } from './flow';
import {
  buildCustomScreenModel,
  buildHowToScreenModel,
  buildMapScreenModel,
  buildModeScreenModel,
  buildRoundIntroScreenModel,
  buildRoundOverScreenModel,
  buildTitleScreenModel,
} from './screenModels';

describe('screen models', () => {
  it('builds the MAP tile grid from the shipped rotation and renders enabled spec-backed CPU tiers', () => {
    const state = createFlow(createDefaultConfig());
    const title = buildTitleScreenModel();
    const mode = buildModeScreenModel(state);
    const map = buildMapScreenModel(state);

    expect(title.buttons.map((button) => button.label)).toEqual([
      'Quick Start',
      'How to Play',
    ]);
    expect(title.corner).toEqual(['Settings']);
    expect(title.buttons.some((button) => button.label === 'Random')).toBe(false);
    expect(mode.options.find((option) => option.id === 'cpu')).toMatchObject({
      label: '1 v CPU',
      disabled: false,
    });
    expect(mode.cpuTiers.map(({ id, label }) => ({ id, label })))
      .toEqual(CPU_TIERS.map(({ id, name }) => ({ id, label: name })));
    expect(map.tiles.map((tile) => tile.id)).toEqual(['terra', 'rust', 'selene', 'ferrum']);
    expect(map.tiles.at(-1)).toMatchObject({ id: 'ferrum', name: 'Ferrum' });
    expect(map.modeOptions.find((option) => option.id === 'cpu')).toMatchObject({
      label: '1 v CPU',
      disabled: false,
    });
  });

  it('pairs every Custom shell row with its icon and locks HE on unlimited', () => {
    const model = buildCustomScreenModel(createFlow(createDefaultConfig()));

    expect(model.shells).toHaveLength(SHELLS.length);
    expect(model.shells.every((row) => row.name.length > 0 && row.icon.endsWith('.svg'))).toBe(true);
    expect(model.shells.find((row) => row.id === 'he')).toMatchObject({
      enabled: true,
      locked: true,
      ammo: 'inf',
      ammoLabel: '∞',
      toggleDisabled: true,
      countDisabled: true,
    });
  });

  it('pairs each enabled deploy-summary shell with its stable spec icon', () => {
    const config = createDefaultConfig();
    const model = buildRoundIntroScreenModel(config);

    expect(model.shells.map((shell) => shell.id)).toEqual(config.enabledShellIds);
    expect(model.shells).toEqual(config.enabledShellIds.map((id) => ({
      id,
      name: config.shells[id]!.name,
      icon: config.shells[id]!.icon,
      ammo: config.shells[id]!.ammo,
      ammoLabel: config.shells[id]!.ammo === 'inf' ? '∞' : String(config.shells[id]!.ammo),
    })));
  });

  it('builds an icon-bearing round-over recap from spent shell ids', () => {
    const config = createDefaultConfig();
    const state: AppFlowState = {
      ...createFlow(config),
      screen: 'ROUND_OVER',
      roundOver: {
        spentShellIdsByPlayer: [
          ['mortar', 'he'],
          ['cluster'],
        ],
      },
    };
    const model = buildRoundOverScreenModel(state);

    expect(model.players).toHaveLength(2);
    expect(model.players.flatMap((player) => player.shells)).toEqual([
      {
        id: 'mortar',
        name: config.shells.mortar!.name,
        icon: config.shells.mortar!.icon,
        count: 1,
      },
      {
        id: 'he',
        name: config.shells.he!.name,
        icon: config.shells.he!.icon,
        count: 1,
      },
      {
        id: 'cluster',
        name: config.shells.cluster!.name,
        icon: config.shells.cluster!.icon,
        count: 1,
      },
    ]);
  });

  it('counts repeated shells instead of one row per shot', () => {
    // Break caught: the recap going back to a row per shot, which makes a long round
    // unreadable, or losing duplicates upstream so every count reads as one.
    const config = createDefaultConfig();
    const state: AppFlowState = {
      ...createFlow(config),
      screen: 'ROUND_OVER',
      roundOver: {
        spentShellIdsByPlayer: [['he', 'mortar', 'he', 'he'], []],
        result: 0,
        turns: 7,
      },
    };
    const model = buildRoundOverScreenModel(state);

    expect(model.players[0]!.shells.map(({ id, count }) => ({ id, count }))).toEqual([
      { id: 'he', count: 3 },
      { id: 'mortar', count: 1 },
    ]);
    expect(model.players[0]!.summary).toBe('4 shots');
    expect(model.players[0]!.winner).toBe(true);
    expect(model.headline.flat().map((span) => span.text).join('')).toBe('Player 1 winsthe round');
    expect(model.kicker).toContain('7 turns');
  });

  it('uses the three spec-backed bracketing examples in short, long, hit order', () => {
    expect(buildHowToScreenModel().shots.map(({ result, power }) => ({ result, power }))).toEqual([
      { result: 'short', power: 69 },
      { result: 'long', power: 82 },
      { result: 'hit', power: 76 },
    ]);
  });

  it('reflects the selected map after a flow transition', () => {
    const mapState = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
    const selectedState = {
      ...mapState,
      config: {
        ...mapState.config,
        selectedWorldId: 'rust' as const,
      },
    };

    expect(buildMapScreenModel(selectedState).tiles.find((tile) => tile.id === 'rust')?.selected).toBe(true);
  });
});
