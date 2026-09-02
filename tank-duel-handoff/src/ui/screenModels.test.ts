import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { SHELLS } from '../sim/shells';
import { createDefaultConfig, withCrewName, type MatchConfig } from './config';
import { createFlow, type AppFlowState } from './flow';
import {
  buildCrewScreenModel,
  buildCustomScreenModel,
  buildHowToScreenModel,
  buildMapScreenModel,
  buildModeScreenModel,
  buildRoundIntroScreenModel,
  buildRoundOverScreenModel,
  buildTitleScreenModel,
} from './screenModels';

/** Both crews named, which is what Crew setup asks for before it hands over to MAP. */
function namedConfig(config: MatchConfig = createDefaultConfig()): MatchConfig {
  return withCrewName(withCrewName(config, 0, 'Hammer'), 1, 'Anvil');
}

function crewState(config: MatchConfig = createDefaultConfig()): AppFlowState {
  return { ...createFlow(config), screen: 'CREW', config };
}

describe('screen models', () => {
  it('keeps Random in the MAP tile grid and renders enabled spec-backed CPU tiers', () => {
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
      disabled: false,
    });
    expect(mode.cpuTiers.map(({ id, label }) => ({ id, label })))
      .toEqual(CPU_TIERS.map(({ id, name }) => ({ id, label: name })));
    expect(map.tiles.filter((tile) => tile.id === 'random')).toHaveLength(1);
    expect(map.tiles.at(-1)).toMatchObject({ id: 'random', name: 'Random' });
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

  it('names both crews, mirrors the second, and gates Continue on the pair', () => {
    const empty = buildCrewScreenModel(crewState());
    const named = buildCrewScreenModel(crewState(namedConfig()));

    expect(empty.step).toBe('Step 01 / 02');
    expect(empty.kicker).toBe('Quick start · 1v1 Local');
    expect(empty.ready).toBe(false);
    expect(empty.status).toBe('Name both crews to continue');
    expect(empty.crews.map((crew) => crew.name)).toEqual(['', '']);
    expect(empty.crews.map((crew) => crew.placeholder)).toEqual(['Player 1', 'Player 2']);
    expect(empty.crews.map((crew) => crew.tag)).toEqual(['P1', 'P2']);
    expect(empty.crews.map((crew) => crew.colorLabel)).toEqual(['#4DA3FF', '#FF5CA8']);
    // Facing each other: P1 aims right from the left, P2 aims left from the right, and both
    // angles are stored absolute.
    expect(empty.crews.map((crew) => crew.previewDirection)).toEqual([1, -1]);
    expect(empty.crews.map((crew) => crew.previewAngleDeg)).toEqual([52, 128]);
    expect(empty.crews[0]!.swatches.filter((swatch) => swatch.selected)
      .map((swatch) => swatch.value)).toEqual(['#4DA3FF']);
    expect(named.ready).toBe(true);
    expect(named.status).toBe('HAMMER VS ANVIL');
    expect(named.continueAction).toEqual({ type: 'confirmCrews' });
  });

  it('locks crew two to the CPU without discarding the name it had in local play', () => {
    // Break caught: the CPU panel offering an editable field, or a mode switch wiping the
    // human name so switching back loses it.
    const local = namedConfig();
    const cpu = { ...local, mode: 'cpu' as const };
    const model = buildCrewScreenModel(crewState(cpu));

    expect(model.kicker).toBe('Quick start · 1 v CPU');
    expect(model.crews[1]).toMatchObject({ label: 'CPU', name: 'CPU', nameDisabled: true });
    expect(model.crews[0]!.nameDisabled).toBe(false);
    expect(model.ready).toBe(true);
    expect(cpu.crews[1]!.name).toBe('Anvil');
  });

  it('carries the crew names into the briefing and the round-over recap', () => {
    const config = namedConfig();
    const intro = buildRoundIntroScreenModel(config);
    const roundOver = buildRoundOverScreenModel({
      ...createFlow(config),
      screen: 'ROUND_OVER',
      roundOver: { spentShellIdsByPlayer: [['he'], ['he']], result: 1 },
    });

    expect(intro.briefing[0]).toEqual({ term: 'Crews', value: 'Hammer vs Anvil' });
    expect(roundOver.players.map((player) => player.label)).toEqual(['Hammer', 'Anvil']);
    expect(roundOver.headline.flat().map((span) => span.text).join('')).toBe('Anvil winsthe round');
    expect(roundOver.accentColor).toBe(config.crews[1]!.color);
  });

  it('reflects the selected map after a flow transition', () => {
    const mapState = crewState(namedConfig());
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
