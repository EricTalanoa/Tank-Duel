import { describe, expect, it } from 'vitest';
import { createDefaultConfig, withCrewName, type MatchConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState } from './flow';

function createRoundOverState(config: MatchConfig = createDefaultConfig()): AppFlowState {
  return {
    ...createFlow(config),
    screen: 'ROUND_OVER',
  };
}

function named(state: AppFlowState): AppFlowState {
  return { ...state, config: withCrewName(withCrewName(state.config, 0, 'Ash'), 1, 'Vale') };
}

/** The quick-start path walked as far as CREW: TITLE -> MODE -> CREW. */
function quickStartToCrew(): AppFlowState {
  const mode = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
  return reduceFlow(mode, { type: 'confirmMode' });
}

/** The quick-start path walked as far as MAP: TITLE -> MODE -> CREW -> MAP. */
function quickStartToMap(): AppFlowState {
  return reduceFlow(quickStartToCrew(), { type: 'confirmCrews' });
}

describe('app flow', () => {
  it('starts at TITLE with enabled CPU mode and the active map rotation', () => {
    const state = createFlow(createDefaultConfig());

    expect(state.screen).toBe('TITLE');
    expect(state.modeOptions).toHaveLength(2);
    expect(state.modeOptions[0]).toMatchObject({ id: 'local', label: '1v1 Local', enabled: true });
    expect(state.modeOptions[1]).toMatchObject({
      id: 'cpu',
      label: '1 v CPU',
      enabled: true,
      cpuTierIds: ['recruit', 'gunner', 'veteran'],
    });
    // Both cards say what the mode is; the MODE screen is now the first step, not a detour.
    expect(state.modeOptions.every((option) => (option.note?.length ?? 0) > 0)).toBe(true);
    expect(state.mapOptions).toEqual(['terra', 'rust', 'selene', 'ferrum']);
  });

  it('reaches LOADOUT in four quick-start actions, mode first and names optional', () => {
    const initial = createFlow(createDefaultConfig());

    const afterQuickStart = reduceFlow(initial, { type: 'quickStart' });
    const afterMode = reduceFlow(afterQuickStart, { type: 'confirmMode' });
    const afterCrews = reduceFlow(afterMode, { type: 'confirmCrews' });
    const afterMapPick = reduceFlow(afterCrews, { type: 'selectMap', worldId: 'terra' });

    // Mode is chosen before the crews are, so the CREW screen already knows whether crew 2
    // is a person.
    expect(afterQuickStart.screen).toBe('MODE');
    expect(afterQuickStart.config.path).toBe('quick');
    expect(afterMode.screen).toBe('CREW');
    // Nothing was typed, and Continue still advances.
    expect(afterCrews.config.crews.map((crew) => crew.name)).toEqual(['', '']);
    expect(afterCrews.screen).toBe('MAP');
    // Deploy opens the loadout directly — there is no briefing screen in between.
    expect(afterMapPick.screen).toBe('LOADOUT');
    expect(afterMapPick.config.selectedWorldId).toBe('terra');
  });

  it('advances CREW with no names, one name, or two, and swaps a taken colour', () => {
    const crew = quickStartToCrew();
    const [first, second] = crew.config.crews.map((each) => each.color);

    expect(reduceFlow(crew, { type: 'confirmCrews' }).screen).toBe('MAP');
    const halfNamed = { ...crew, config: withCrewName(crew.config, 0, 'Ash') };
    expect(reduceFlow(halfNamed, { type: 'confirmCrews' }).screen).toBe('MAP');
    expect(reduceFlow(named(crew), { type: 'confirmCrews' }).config.crews[1].name).toBe('Vale');

    // Taking the other crew's colour swaps rather than being refused, so the two stay
    // distinct and no swatch ever has to be disabled.
    const swapped = reduceFlow(crew, { type: 'selectCrewColor', player: 0, color: second! });
    expect(swapped.config.crews.map((each) => each.color)).toEqual([second, first]);
    expect(reduceFlow(crew, { type: 'selectCrewColor', player: 0, color: '#123456' })).toBe(crew);
  });

  it('selects mode and tier on MODE without advancing, then Continue opens CREW', () => {
    const mode = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });

    const cpu = reduceFlow(mode, { type: 'selectMode', mode: 'cpu' });
    const veteran = reduceFlow(cpu, { type: 'selectCpuTier', cpuTierId: 'veteran' });

    expect(mode.screen).toBe('MODE');
    // A card selects; it does not navigate. The difficulty is on this screen, and a card
    // that advanced on click would carry the player straight past it.
    expect(cpu.screen).toBe('MODE');
    expect(cpu.config.mode).toBe('cpu');
    expect(veteran.screen).toBe('MODE');
    expect(veteran.config.cpuTierId).toBe('veteran');

    const crew = reduceFlow(veteran, { type: 'confirmMode' });
    expect(crew.screen).toBe('CREW');
    expect(crew.config).toMatchObject({ mode: 'cpu', cpuTierId: 'veteran' });

    const local = reduceFlow(mode, { type: 'selectMode', mode: 'local' });
    expect(local.screen).toBe('MODE');
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
    expect(customIntro.screen).toBe('LOADOUT');
    expect(back.screen).toBe('TITLE');
    // Play drops into the same first step Quick Start does, rather than assuming local.
    expect(play.screen).toBe('MODE');
    expect(play.config.path).toBe('quick');
  });

  it('backs out through every pre-match screen without discarding configuration', () => {
    const title = createFlow(createDefaultConfig());
    const mode = reduceFlow(title, { type: 'quickStart' });
    const crew = named(quickStartToCrew());
    const quickMap = reduceFlow(crew, { type: 'confirmCrews' });
    const custom = reduceFlow(title, { type: 'openCustom' });
    const quickLoadout = reduceFlow(quickMap, { type: 'selectMap', worldId: 'terra' });
    const customLoadout = reduceFlow(custom, { type: 'startCustom' });

    expect(reduceFlow(mode, { type: 'back' }).screen).toBe('TITLE');
    // CREW steps back into MODE, which is now the step before it.
    expect(reduceFlow(crew, { type: 'back' }).screen).toBe('MODE');
    expect(reduceFlow(crew, { type: 'back' }).config).toEqual(crew.config);
    // MAP steps back into CREW, so the names are one Back away rather than gone.
    expect(reduceFlow(quickMap, { type: 'back' }).screen).toBe('CREW');
    expect(reduceFlow(quickMap, { type: 'back' }).config).toEqual(quickMap.config);
    expect(reduceFlow(custom, { type: 'back' }).screen).toBe('TITLE');
    // The loadout goes back to whichever screen opened it, which is what the briefing
    // screen used to do on its behalf.
    expect(reduceFlow(quickLoadout, { type: 'back' }).screen).toBe('MAP');
    expect(reduceFlow(quickLoadout, { type: 'back' }).config).toEqual(quickLoadout.config);
    expect(reduceFlow(customLoadout, { type: 'back' }).screen).toBe('CUSTOM');
  });

  it('carries a CPU selection through crew, map, custom, round-over, and rematch', () => {
    const title = createFlow(createDefaultConfig());
    const quickMap = quickStartToMap();
    const mode = reduceFlow(title, { type: 'quickStart' });
    const cpuMode = reduceFlow(mode, { type: 'selectMode', mode: 'cpu' });
    const gunnerMap = reduceFlow(
      reduceFlow(reduceFlow(cpuMode, { type: 'selectCpuTier', cpuTierId: 'gunner' }), { type: 'confirmMode' }),
      { type: 'confirmCrews' },
    );
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

    expect(quickMap.config.mode).toBe('local');
    expect(gunnerMap.screen).toBe('MAP');
    expect(cpuRoundIntro.config).toMatchObject({ mode: 'cpu', cpuTierId: 'gunner' });
    expect(cpuCustomTier).toMatchObject({ screen: 'CUSTOM', config: { mode: 'cpu', cpuTierId: 'recruit' } });
    expect(rematch.config).toMatchObject({ mode: 'cpu', cpuTierId: 'gunner', seed: 8 });
  });

  it('moves from map to loadout to match to round over', () => {
    const loadout = reduceFlow(quickStartToMap(), { type: 'selectMap', worldId: 'terra' });
    const match = reduceFlow(loadout, { type: 'deployLoadout' });
    const recap = {
      spentShellIdsByPlayer: [
        ['he', 'mortar'],
        ['he'],
      ],
    } as const;
    const roundOver = reduceFlow(match, { type: 'completeMatch', recap });

    expect(loadout.screen).toBe('LOADOUT');
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
    const map = quickStartToMap();
    const loadout = reduceFlow(map, { type: 'selectMap', worldId: 'terra' });
    const match = reduceFlow(loadout, { type: 'deployLoadout' });
    const howTo = reduceFlow(title, { type: 'openHowTo' });
    const roundOver = reduceFlow(match, {
      type: 'completeMatch',
      recap: { spentShellIdsByPlayer: [['he'], ['mortar']] },
    });

    expect(reduceFlow(custom, { type: 'quickStart' })).toBe(custom);
    expect(reduceFlow(title, { type: 'confirmMode' })).toBe(title);
    expect(reduceFlow(title, { type: 'confirmCrews' })).toBe(title);
    expect(reduceFlow(map, { type: 'openCustom' })).toBe(map);
    expect(reduceFlow(custom, { type: 'openHowTo' })).toBe(custom);
    expect(reduceFlow(title, { type: 'selectMap', worldId: 'terra' })).toBe(title);
    expect(reduceFlow(custom, { type: 'menu' })).toBe(custom);
    expect(reduceFlow(title, { type: 'changeLoadout' })).toBe(title);
    expect(reduceFlow(map, { type: 'deployLoadout' })).toBe(map);
    expect(reduceFlow(loadout, { type: 'completeMatch', recap: { spentShellIdsByPlayer: [] } })).toBe(loadout);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: roundOver.config.seed })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: -1 })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: 0x1_0000_0000 })).toBe(roundOver);
    expect(reduceFlow(roundOver, { type: 'rematch', seed: 1.5 })).toBe(roundOver);
    expect(reduceFlow(howTo, { type: 'changeLoadout' })).toBe(howTo);
  });
});
