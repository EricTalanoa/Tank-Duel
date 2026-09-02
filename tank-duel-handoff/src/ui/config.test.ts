import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { createRng } from '../sim/rng';
import { HE_SHELL, SHELLS } from '../sim/shells';
import { PLAYABLE_SHELL_IDS } from '../sim/weapons';
import { SHIPPED_WORLDS, worldById } from '../sim/worlds';
import { PRESENTATION } from '../render/presentation';
import * as configModule from './config';
import {
  MATCH_AMMO_BOUNDS,
  CREATE_DEFAULT_CPU_TIER_ID,
  MATCH_ROUND_OPTIONS,
  MATCH_SCREEN_IDS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WORLD_OPTIONS,
  MATCH_WIND_OPTIONS,
  CPU_CREW_NAME,
  CREW_COLOR_OPTIONS,
  CREW_NAME_MAX_LENGTH,
  createDefaultConfig,
  crewDisplayName,
  withRolledCpuColor,
  resolveMatchConfig,
  validateConfig,
  withCrewColor,
  withCrewName,
} from './config';

describe('match config', () => {
  it('exposes the strict CPU registry as the only ordered tier-option source', () => {
    const { CPU_TIER_OPTIONS } = configModule;

    expect(CPU_TIER_OPTIONS).toBe(CPU_TIERS);
    expect(CPU_TIER_OPTIONS.map(({ id, name }) => [id, name])).toEqual([
      ['recruit', 'Recruit'],
      ['gunner', 'Gunner'],
      ['veteran', 'Veteran'],
    ]);
  });

  it('builds defaults from shipped registries and keeps HE locked on', () => {
    const config = createDefaultConfig();

    expect(MATCH_SCREEN_IDS).toContain('MAP');
    expect(MATCH_SCREEN_IDS).toContain('CUSTOM');
    expect(MATCH_AMMO_BOUNDS).toEqual({ min: 1, max: 9 });
    expect(config).toMatchObject({
      path: 'quick',
      mode: 'local',
      cpuTierId: CREATE_DEFAULT_CPU_TIER_ID,
      selectedWorldId: 'ferrum',
      selectedGeneratorId: null,
      rounds: MATCH_ROUND_OPTIONS[1],
      wind: MATCH_WIND_OPTIONS.at(-1),
      turnTimer: MATCH_TURN_TIMER_OPTIONS[0],
    });
    expect(config.shells.he).toEqual({
      ammo: 'inf',
      defaultAmmo: 'inf',
      enabled: true,
      icon: HE_SHELL.icon,
      locked: true,
      name: HE_SHELL.name,
    });
    expect(SHELLS.every((shell) =>
      config.shells[shell.id]?.icon === shell.icon &&
      config.shells[shell.id]?.name === shell.name &&
      config.shells[shell.id]?.defaultAmmo === shell.ammo,
    )).toBe(true);
    expect(config.enabledShellIds).toEqual(PLAYABLE_SHELL_IDS);
    expect(PLAYABLE_SHELL_IDS.every((id) => config.shells[id]?.enabled)).toBe(true);
    expect(config.shells.anvil?.enabled).toBe(false);
  });

  it('offers only the active quick-start map rotation', () => {
    expect(MATCH_WORLD_OPTIONS).toEqual(['terra', 'rust', 'selene', 'ferrum']);
  });

  it('rejects invalid shapes, missing or extra shell keys, malformed entries, and invalid ids', () => {
    const defaults = createDefaultConfig();
    const { he, mortar, ...shellsWithoutHe } = defaults.shells;

    expect(validateConfig(null)).toBeNull();
    expect(validateConfig({})).toBeNull();
    expect(validateConfig({
      ...defaults,
      selectedWorldId: 'unknown',
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      cpuTierId: 'ace',
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      selectedGeneratorId: 'bogus',
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      shells: shellsWithoutHe,
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      shells: {
        ...defaults.shells,
        bonus: defaults.shells.he,
      },
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      shells: {
        ...defaults.shells,
        mortar: true,
      },
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      shells: {
        ...defaults.shells,
        he: {
          ...defaults.shells.he,
          enabled: false,
        },
      },
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      shells: {
        ...defaults.shells,
        mortar: {
          ...defaults.shells.mortar,
          ammo: MATCH_AMMO_BOUNDS.max + 1,
        },
      },
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      enabledShellIds: defaults.enabledShellIds.filter((id) => id !== 'sand'),
    })).toBeNull();
  });

  it('resolves random world selection to a shipped world and compatible generator', () => {
    const resolved = resolveMatchConfig({ ...createDefaultConfig(), selectedWorldId: 'random' }, createRng(7));

    expect(SHIPPED_WORLDS.map((world) => world.id)).toContain(resolved.worldId);
    expect(resolved.selectedWorldId).toBe('random');
    expect(resolved.generatorId).toBe(worldById(resolved.worldId).generator);
  });


  it('offers the two presentation colours then one accent per shipped world, all distinct', () => {
    // Values read from spec/, never retyped: only the order of the eight is design copy.
    expect(CREW_COLOR_OPTIONS).toHaveLength(2 + SHIPPED_WORLDS.length);
    expect(CREW_COLOR_OPTIONS.slice(0, 2)).toEqual(PRESENTATION.players.map((p) => p.color));
    expect(CREW_COLOR_OPTIONS.slice(2)).toEqual(
      ['terra', 'rust', 'selene', 'ferrum', 'hollow', 'vesper']
        .map((id) => worldById(id as Parameters<typeof worldById>[0]).palette.accent),
    );
    expect(new Set(CREW_COLOR_OPTIONS).size).toBe(CREW_COLOR_OPTIONS.length);
    expect(CREW_COLOR_OPTIONS.every((color) => /^#[0-9A-Fa-f]{6}$/.test(color))).toBe(true);
  });

  it('defaults both crews to unnamed in the presentation colours', () => {
    const config = createDefaultConfig();

    expect(config.crews).toEqual([
      { name: '', color: PRESENTATION.players[0].color },
      { name: '', color: PRESENTATION.players[1].color },
    ]);
    // Unnamed still reads as somebody, so every downstream surface has a label to print.
    expect(crewDisplayName(config, 0)).toBe('Player 1');
    expect(crewDisplayName(config, 1)).toBe('Player 2');
  });

  it('names the CPU crew itself and reads a typed name back trimmed', () => {
    const local = withCrewName(withCrewName(createDefaultConfig(), 0, '  Ash  '), 1, 'Vale');

    expect(crewDisplayName(local, 0)).toBe('Ash');

    const cpu = validateConfig({ ...local, mode: 'cpu' })!;
    expect(crewDisplayName(cpu, 1)).toBe(CPU_CREW_NAME);
    // The machine names itself whatever crew 2's stored name happens to be.
    expect(crewDisplayName(validateConfig({ ...cpu, crews: [cpu.crews[0], { ...cpu.crews[1], name: '' }] })!, 1))
      .toBe(CPU_CREW_NAME);
  });

  it('rolls the CPU a colour from the palette that is never the one crew 1 holds', () => {
    const config = createDefaultConfig();
    const rolls = [0, 0.5, 0.999, 1, -1, Number.NaN];

    for (const roll of rolls) {
      const rolled = withRolledCpuColor(config, roll);
      expect(CREW_COLOR_OPTIONS).toContain(rolled.crews[1].color);
      expect(rolled.crews[1].color).not.toBe(rolled.crews[0].color);
      // Crew 1 keeps what it picked: only the machine's paint is rolled.
      expect(rolled.crews[0].color).toBe(config.crews[0].color);
    }

    // Every option but crew 1's is reachable, so the roll is a real spread and not a
    // constant that happens to differ from the default.
    const landed = new Set(
      Array.from({ length: 64 }, (_, index) => withRolledCpuColor(config, index / 64).crews[1].color),
    );
    expect(landed.size).toBe(CREW_COLOR_OPTIONS.length - 1);
    expect(landed.has(config.crews[0].color)).toBe(false);
  });

  it('rejects an over-long name, a malformed colour, and two crews sharing one colour', () => {
    const config = createDefaultConfig();
    const crewsWith = (overrides: readonly [object, object]) => ([
      { ...config.crews[0], ...overrides[0] },
      { ...config.crews[1], ...overrides[1] },
    ]);

    expect(validateConfig({ ...config, crews: crewsWith([{ name: 'a'.repeat(CREW_NAME_MAX_LENGTH) }, {}]) }))
      .not.toBeNull();
    expect(validateConfig({ ...config, crews: crewsWith([{ name: 'a'.repeat(CREW_NAME_MAX_LENGTH + 1) }, {}]) }))
      .toBeNull();
    expect(validateConfig({ ...config, crews: crewsWith([{ color: 'blue' }, {}]) })).toBeNull();
    expect(validateConfig({ ...config, crews: crewsWith([{ color: '#4DA3FF' }, { color: '#4DA3FF' }]) }))
      .toBeNull();
    expect(validateConfig({ ...config, crews: [config.crews[0]] })).toBeNull();
  });

  it('loads a config saved before crews existed, at the default identities', () => {
    const { crews, ...withoutCrews } = createDefaultConfig();

    expect(validateConfig(withoutCrews)?.crews).toEqual(crews);
  });

  it('swaps rather than refuses when a crew takes the colour the other holds', () => {
    const config = createDefaultConfig();
    const [first, second] = [config.crews[0].color, config.crews[1].color];

    // No swatch is ever disabled, so picking the opponent's colour has to mean something.
    const swapped = withCrewColor(config, 0, second);
    expect(swapped.crews.map((crew) => crew.color)).toEqual([second, first]);

    const free = withCrewColor(config, 1, CREW_COLOR_OPTIONS[4]!);
    expect(free.crews.map((crew) => crew.color)).toEqual([first, CREW_COLOR_OPTIONS[4]]);
    expect(withCrewColor(config, 0, '#000000')).toBe(config);
  });

  it('resolves random world selection deterministically for an identical seed', () => {
    const config = createDefaultConfig();
    const first = resolveMatchConfig(config, createRng(0x51a7));
    const second = resolveMatchConfig(config, createRng(0x51a7));

    expect(first).toEqual(second);
  });

  it('preserves explicit world and generator selections when they are compatible', () => {
    const resolved = resolveMatchConfig({
      ...createDefaultConfig(),
      selectedWorldId: 'rust',
      selectedGeneratorId: 'plates',
    }, createRng(99));

    expect(resolved.worldId).toBe('rust');
    expect(resolved.generatorId).toBe('plates');
  });
});
