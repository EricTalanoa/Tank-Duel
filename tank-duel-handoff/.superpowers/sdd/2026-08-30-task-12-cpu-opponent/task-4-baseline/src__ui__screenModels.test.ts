import { describe, expect, it } from 'vitest';
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
  it('keeps Random in the MAP tile grid and CPU visible but unavailable', () => {
    const state = createFlow(createDefaultConfig());
    const title = buildTitleScreenModel();
    const mode = buildModeScreenModel(state);
    const map = buildMapScreenModel(state);

    expect(title.buttons.map((button) => button.label)).toEqual([
      'Quick Start',
      'Custom Game',
      'How to Play',
    ]);
    expect(title.corner).toEqual(['Settings']);
    expect(title.buttons.some((button) => button.label === 'Random')).toBe(false);
    expect(mode.options.find((option) => option.id === 'cpu')).toMatchObject({
      label: '1 v CPU',
      disabled: true,
      note: 'Task 12',
    });
    expect(map.tiles.filter((tile) => tile.id === 'random')).toHaveLength(1);
    expect(map.tiles.at(-1)).toMatchObject({ id: 'random', name: 'Random' });
    expect(map.modeOptions.find((option) => option.id === 'cpu')).toMatchObject({
      label: '1 v CPU',
      disabled: true,
      note: 'Task 12',
    });
  });

  it('pairs every Custom shell row with its icon and locks HE on unlimited', () => {
    const model = buildCustomScreenModel(createDefaultConfig());

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
      },
      {
        id: 'he',
        name: config.shells.he!.name,
        icon: config.shells.he!.icon,
      },
      {
        id: 'cluster',
        name: config.shells.cluster!.name,
        icon: config.shells.cluster!.icon,
      },
    ]);
  });

  it('uses the three spec-backed bracketing examples in short, long, hit order', () => {
    expect(buildHowToScreenModel().shots).toEqual([
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
