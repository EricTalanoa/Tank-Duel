import { describe, expect, it } from 'vitest';
import { createDefaultConfig, withCrewColor, withCrewName, type MatchConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState } from './flow';

function createRoundOverState(config: MatchConfig = namedConfig()): AppFlowState {
  return {
    ...createFlow(config),
    screen: 'ROUND_OVER',
  };
}

/** Both crews named, which is what Crew setup asks for before it will hand over to MAP. */
function namedConfig(config: MatchConfig = createDefaultConfig()): MatchConfig {
  return withCrewName(withCrewName(config, 0, 'Hammer'), 1, 'Anvil');
}

/** TITLE through Crew setup to the battlefield, the way Quick Start now runs. */
function quickStartToMap(config: MatchConfig = createDefaultConfig()): AppFlowState {
  const crew = reduceFlow(createFlow(config), { type: 'quickStart' });
  return reduceFlow(
    { ...crew, config: namedConfig(crew.config) },
    { type: 'confirmCrews' },
  );
}

describe('app flow', () => {
  it('starts at TITLE with enabled CPU mode and the active map rotation', () => {
    const state = createFlow(createDefaultConfig());

    expect(state.screen).toBe('TITLE');
    expect(state.modeOptions).toHaveLength(2);
    expect(state.modeOptions[0]).toEqual({ id: 'local', label: '1v1 Local', enabled: true });
    expect(state.modeOptions[1]).toEqual({
      id: 'cpu',
      label: '1 v CPU',
      enabled: true,
      cpuTierIds: ['recruit', 'gunner', 'veteran'],
    });
    expect(state.mapOptions).toEqual(['terra', 'rust', 'selene', 'ferrum']);
  });

  it('reaches ROUND_INTRO through crew setup in the two numbered quick-start steps', () => {
    const initial = createFlow(createDefaultConfig());

    const afterQuickStart = reduceFlow(initial, { type: 'quickStart' });
    const named = { ...afterQuickStart, config: namedConfig(afterQuickStart.config) };
    const afterCrews = reduceFlow(named, { type: 'confirmCrews' });
    const afterMapPick = reduceFlow(afterCrews, { type: 'selectMap', worldId: 'terra' });

    expect(afterQuickStart.screen).toBe('CREW');
    expect(afterQuickStart.config.path).toBe('quick');
    expect(afterQuickStart.config.mode).toBe('local');
    expect(afterCrews.screen).toBe('MAP');
    expect(afterCrews.config.crews.map((crew) => crew.name)).toEqual(['Hammer', 'Anvil']);
    expect(afterMapPick.screen).toBe('ROUND_INTRO');
    expect(afterMapPick.config.selectedWorldId).toBe('terra');
  });

  it('holds Continue until both crews are named, and lets the CPU name itself', () => {
    // Break caught: the gate opening on an unnamed crew, so the HUD and recap fall back to
    // "Player 1" on a screen whose whole job was to replace it.
    const crew = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
    const onlyFirst = { ...crew, config: withCrewName(crew.config, 0, 'Hammer') };
    const both = { ...crew, config: namedConfig(crew.config) };
    const cpu = reduceFlow(onlyFirst, { type: 'selectMode', mode: 'cpu' });

    expect(reduceFlow(crew, { type: 'confirmCrews' })).toBe(crew);
    expect(reduceFlow(onlyFirst, { type: 'confirmCrews' })).toBe(onlyFirst);
    expect(reduceFlow(both, { type: 'confirmCrews' }).screen).toBe('MAP');
    expect(cpu.screen).toBe('CREW');
    expect(cpu.config.mode).toBe('cpu');
    expect(reduceFlow(cpu, { type: 'confirmCrews' }).screen).toBe('MAP');
  });

  it('keeps the two chosen tank colours distinct by swapping rather than refusing', () => {
    // Break caught: both crews ending up the same colour, which `validatePresentation`
    // rejects for exactly the reason it would be unplayable here.
    const config = createDefaultConfig();
    const [first, second] = config.crews.map((crew) => crew.color);
    const swapped = withCrewColor(config, 0, second!);

    expect(swapped.crews.map((crew) => crew.color)).toEqual([second, first]);
    expect(withCrewColor(config, 1, '#7BD389').crews.map((crew) => crew.color))
      .toEqual([first, '#7BD389']);
  });

  it('selects CPU mode and tier through the existing mode and map screens', () => {
    const title = createFlow(createDefaultConfig());

    const mode = reduceFlow(title, { type: 'openMode' });

    const cpuMap = reduceFlow(mode, { type: 'selectMode', mode: 'cpu' });
    const veteranMap = reduceFlow(cpuMap, {
      type: 'selectCpuTier',
      cpuTierId: 'veteran',
    });

    expect(mode.screen).toBe('MODE');
    expect(cpuMap.screen).toBe('MAP');
    expect(cpuMap.config.mode).toBe('cpu');
    expect(veteranMap.screen).toBe('MAP');
    expect(veteranMap.config.cpuTierId).toBe('veteran');
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
    // How to Play joins the quick-start path at its first step, not partway down it.
    expect(play.screen).toBe('CREW');
    expect(play.config.path).toBe('quick');
    expect(play.config.mode).toBe('local');
  });

  it('backs out through every pre-match screen without discarding configuration', () => {
    const title = createFlow(createDefaultConfig());
    const mode = reduceFlow(title, { type: 'openMode' });
    const quickCrew = reduceFlow(title, { type: 'quickStart' });
    const quickMap = quickStartToMap();
    const custom = reduceFlow(title, { type: 'openCustom' });
    const quickIntro = reduceFlow(quickMap, { type: 'selectMap', worldId: 'terra' });
    const customIntro = reduceFlow(custom, { type: 'startCustom' });
    const loadout = reduceFlow(quickIntro, { type: 'openLoadout' });

    expect(reduceFlow(mode, { type: 'back' }).screen).toBe('TITLE');
    expect(reduceFlow(quickCrew, { type: 'back' }).screen).toBe('TITLE');
    expect(reduceFlow(quickMap, { type: 'back' }).screen).toBe('CREW');
    expect(reduceFlow(quickMap, { type: 'back' }).config).toEqual(quickMap.config);
    expect(reduceFlow(custom, { type: 'back' }).screen).toBe('TITLE');
    expect(reduceFlow(quickIntro, { type: 'back' }).screen).toBe('MAP');
    expect(reduceFlow(customIntro, { type: 'back' }).screen).toBe('CUSTOM');
    expect(reduceFlow(loadout, { type: 'back' }).screen).toBe('ROUND_INTRO');
    expect(reduceFlow(loadout, { type: 'back' }).config).toEqual(loadout.config);
  });

  it('keeps Quick Start local while CPU selection persists through map, custom, round-over, and rematch', () => {
    const title = createFlow(createDefaultConfig());
    const quickCrew = reduceFlow(title, { type: 'quickStart' });
    const mode = reduceFlow(title, { type: 'openMode' });
    const cpuMap = reduceFlow(mode, { type: 'selectMode', mode: 'cpu' });
    const gunnerMap = reduceFlow(cpuMap, {
      type: 'selectCpuTier',
      cpuTierId: 'gunner',
    });
    const cpuRoundIntro = reduceFlow(gunnerMap, { type: 'selectMap', worldId: 'terra' });
    const cpuCustom = reduceFlow(reduceFlow(title, { type: 'openCustom' }), { type: 'selectMode', mode: 'cpu' });
    const cpuCustomTier = reduceFlow(cpuCustom, {
      type: 'selectCpuTier',
      cpuTierId: 'recruit',
    });
    const roundOver = createRoundOverState({
      ...gunnerMap.config,
      path: 'quick',
      mode: 'cpu',
      cpuTierId: 'gunner',
      seed: 7,
    });
    const rematch = reduceFlow(roundOver, { type: 'rematch', seed: 8 });

    expect(quickCrew.config.mode).toBe('local');
    expect(cpuRoundIntro.config).toMatchObject({ mode: 'cpu', cpuTierId: 'gunner' });
    expect(cpuCustomTier).toMatchObject({ screen: 'CUSTOM', config: { mode: 'cpu', cpuTierId: 'recruit' } });
    expect(rematch.config).toMatchObject({ mode: 'cpu', cpuTierId: 'gunner', seed: 8 });
  });

  it('moves from round intro to loadout to match to round over', () => {
    const roundIntro = reduceFlow(quickStartToMap(), { type: 'selectMap', worldId: 'terra' });
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
    // Leaving mid-match is what the too-narrow-screen wall offers instead of a page reload.
    expect(reduceFlow({ ...roundOver, screen: 'MATCH' }, { type: 'menu' }).screen).toBe('TITLE');
    expect(loadout.screen).toBe('LOADOUT');
    expect(loadout.config).toEqual(roundOver.config);
    expect(menu.screen).toBe('TITLE');
    expect(menu.config).toEqual(roundOver.config);
  });

  it('returns the same state for invalid transitions and invalid rematch seeds', () => {
    const title = createFlow(createDefaultConfig());
    const custom = reduceFlow(title, { type: 'openCustom' });
    const map = quickStartToMap();
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
