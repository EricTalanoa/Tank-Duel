import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { SHELLS } from '../sim/shells';
import { CREW_COLOR_OPTIONS, createDefaultConfig, withCrewName } from './config';
import { createFlow, reduceFlow, type AppFlowState } from './flow';
import {
  buildCrewScreenModel,
  buildCustomScreenModel,
  buildHowToScreenModel,
  buildMapScreenModel,
  buildModeScreenModel,
  buildRoundOverScreenModel,
  buildTitleScreenModel,
} from './screenModels';

/** TITLE -> MODE, which is where mode is now chosen. */
function modeState(): AppFlowState {
  return reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
}

/** TITLE -> MODE -> CREW. */
function crewState(): AppFlowState {
  return reduceFlow(modeState(), { type: 'confirmMode' });
}

describe('screen models', () => {

  it('builds two mirrored crew panels with every colour offered and no naming gate', () => {
    const state = crewState();
    const model = buildCrewScreenModel(state);
    const [first, second] = model.panels;

    // CREW is the second of three steps now: mode is settled before the crews are.
    expect(model.step).toBe('Step 02 / 03');
    expect(model.kicker).toBe('Quick start · 1v1 Local');
    // Names are optional, so the footer shows the matchup as it stands rather than a demand.
    expect(model.status).toBe('PLAYER 1 VS PLAYER 2');

    expect([first.tag, second.tag]).toEqual(['P1', 'P2']);
    expect([first.label, second.label]).toEqual(['Player 1', 'Player 2']);
    expect([first.placeholder, second.placeholder]).toEqual(['Player 1', 'Player 2']);
    // The two tanks face each other: player 2 is mirrored, and its stored angle is the
    // 0-180 absolute one, not a negative mirror of player 1's.
    expect([first.mirrored, second.mirrored]).toEqual([false, true]);
    expect([first.direction, second.direction]).toEqual([1, -1]);
    expect([first.angleDeg, second.angleDeg]).toEqual([52, 128]);
    expect([first.nameEditable, second.nameEditable]).toEqual([true, true]);
    expect([first.colorEditable, second.colorEditable]).toEqual([true, true]);

    for (const panel of model.panels) {
      expect(panel.swatches.map((swatch) => swatch.color)).toEqual(CREW_COLOR_OPTIONS);
      expect(panel.swatches.filter((swatch) => swatch.selected)).toHaveLength(1);
      expect(panel.colorLabel).toBe(panel.color.toUpperCase());
    }
  });

  it('names the crews in the footer, and strips the CPU panel of both controls', () => {
    const crew = crewState();
    const named = {
      ...crew,
      config: withCrewName(withCrewName(crew.config, 0, 'Ash'), 1, 'Vale'),
    };
    const model = buildCrewScreenModel(named);

    expect(model.status).toBe('ASH VS VALE');

    const cpu = buildCrewScreenModel(reduceFlow(named, { type: 'selectMode', mode: 'cpu' }));
    expect(cpu.panels[1].label).toBe('CPU');
    // Nothing to type and nothing to pick: the machine's colour is rolled by the controller.
    expect(cpu.panels[1].nameEditable).toBe(false);
    expect(cpu.panels[1].colorEditable).toBe(false);
    expect(cpu.panels[1].swatches).toEqual([]);
    expect(cpu.panels[1].note).toBeTruthy();
    // A field still showing the human's name would read as the CPU's own.
    expect(cpu.panels[1].name).toBe('');
    expect(cpu.status).toBe('ASH VS CPU');
    // Player 1 keeps a full picker in CPU mode; only crew 2 loses one.
    expect(cpu.panels[0].colorEditable).toBe(true);
    expect(cpu.panels[0].swatches.map((swatch) => swatch.color)).toEqual(CREW_COLOR_OPTIONS);
  });

  it('puts mode first, with its own footer status naming the CPU tier', () => {
    const local = buildModeScreenModel(modeState());
    expect(local).toMatchObject({
      step: 'Step 01 / 03',
      kicker: 'Quick start',
      status: '1V1 LOCAL SELECTED',
      continueAction: { type: 'confirmMode' },
    });
    expect(local.options.map((option) => option.selected)).toEqual([true, false]);
    expect(local.cpuTiers.every((tier) => tier.disabled)).toBe(true);

    const cpu = buildModeScreenModel(reduceFlow(modeState(), { type: 'selectMode', mode: 'cpu' }));
    expect(cpu.status).toBe('1 V CPU · GUNNER');
    expect(cpu.cpuTiers.every((tier) => tier.disabled)).toBe(false);
  });

  it('carries the crew names into the round-over headline', () => {
    const crew = crewState();
    const config = withCrewName(withCrewName(crew.config, 0, 'Ash'), 1, 'Vale');

    const roundOver = buildRoundOverScreenModel({
      ...crew,
      config,
      screen: 'ROUND_OVER',
      roundOver: { spentShellIdsByPlayer: [['he'], ['he']], result: 1 },
    });
    expect(roundOver.headline[0]?.map((span) => span.text)).toEqual(['Vale ', 'wins']);
    expect(roundOver.accentColor).toBe(config.crews[1].color);
    expect(roundOver.players.map((player) => player.label)).toEqual(['Ash', 'Vale']);
  });

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
    // Mode is reported on this screen, not offered: it is chosen on MODE, and a toggle here
    // could flip crew 2 between a person and the machine after the crews were set up.
    expect(map).not.toHaveProperty('modeOptions');
    expect(map.kicker).toBe('Quick start · 1v1 Local');
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
