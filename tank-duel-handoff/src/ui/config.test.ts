import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { createRng } from '../sim/rng';
import { HE_SHELL, SHELLS } from '../sim/shells';
import { PLAYABLE_SHELL_IDS } from '../sim/weapons';
import { SHIPPED_WORLDS, worldById } from '../sim/worlds';
import * as configModule from './config';
import {
  CREW_COLOR_OPTIONS,
  CREW_NAME_MAX_LENGTH,
  CREW_SCREEN_STEP,
  MATCH_AMMO_BOUNDS,
  CREATE_DEFAULT_CPU_TIER_ID,
  MATCH_ROUND_OPTIONS,
  MATCH_SCREEN_IDS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WORLD_OPTIONS,
  MATCH_WIND_OPTIONS,
  createDefaultConfig,
  crewLabel,
  crewsNamed,
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

    expect(MATCH_SCREEN_IDS).toContain('CREW');
    expect(MATCH_SCREEN_IDS).toContain('MAP');
    expect(MATCH_SCREEN_IDS).toContain('CUSTOM');
    // Both read from the CREW record rather than typed into the screen that renders it.
    expect(CREW_SCREEN_STEP).toBe('Step 01 / 02');
    expect(CREW_NAME_MAX_LENGTH).toBe(14);
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
    expect(config.crews).toEqual([
      { name: '', color: '#4DA3FF' },
      { name: '', color: '#FF5CA8' },
    ]);
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
    expect(validateConfig({ ...defaults, crews: undefined })).toBeNull();
    expect(validateConfig({ ...defaults, crews: [defaults.crews[0]] })).toBeNull();
    expect(validateConfig({
      ...defaults,
      crews: [{ name: 'Hammer', color: '#7BD389' }, { name: 'Anvil', color: '#7bd389' }],
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      crews: [{ name: 'Hammer', color: 'green' }, defaults.crews[1]],
    })).toBeNull();
    expect(validateConfig({
      ...defaults,
      crews: [{ name: 'A'.repeat(CREW_NAME_MAX_LENGTH + 1), color: '#7BD389' }, defaults.crews[1]],
    })).toBeNull();
  });

  it('offers eight distinct swatches drawn from spec rather than retyped', () => {
    // Break caught: a hand-written palette drifting from `spec/presentation.json` and the
    // world accents it is built out of.
    expect(CREW_COLOR_OPTIONS).toEqual([
      '#4DA3FF', '#FF5CA8', '#7BD389', '#E8B33C', '#B8C4D4', '#FF5C5C', '#4FC3D9', '#FF8C6B',
    ]);
    expect(new Set(CREW_COLOR_OPTIONS.map((color) => color.toUpperCase())).size)
      .toBe(CREW_COLOR_OPTIONS.length);
  });

  it('names crews, caps what is typed, and lets the CPU stand in for crew two', () => {
    const config = createDefaultConfig();
    const named = withCrewName(withCrewName(config, 0, 'Hammer'), 1, 'Anvil');
    const overlong = withCrewName(config, 0, 'A'.repeat(CREW_NAME_MAX_LENGTH + 4));

    expect(crewLabel(config, 0)).toBe('Player 1');
    expect(crewLabel(config, 1)).toBe('Player 2');
    expect(crewsNamed(config)).toBe(false);
    expect(crewLabel(named, 0)).toBe('Hammer');
    expect(crewsNamed(named)).toBe(true);
    expect(overlong.crews[0]!.name).toHaveLength(CREW_NAME_MAX_LENGTH);
    // A blank is still blank once trimmed, so it must not open the gate.
    expect(crewsNamed(withCrewName(named, 1, '   '))).toBe(false);

    const cpu = validateConfig({ ...config, mode: 'cpu' })!;
    expect(crewLabel(cpu, 1)).toBe('CPU');
    expect(crewsNamed(withCrewName(cpu, 0, 'Hammer'))).toBe(true);
  });

  it('swaps rather than duplicates when a crew takes the other crew\'s colour', () => {
    const config = createDefaultConfig();
    const swapped = withCrewColor(config, 1, config.crews[0]!.color);

    expect(swapped.crews.map((crew) => crew.color)).toEqual(['#FF5CA8', '#4DA3FF']);
    expect(withCrewColor(config, 0, '#4FC3D9').crews.map((crew) => crew.color))
      .toEqual(['#4FC3D9', '#FF5CA8']);
  });

  it('resolves random world selection to a shipped world and compatible generator', () => {
    const resolved = resolveMatchConfig({ ...createDefaultConfig(), selectedWorldId: 'random' }, createRng(7));

    expect(SHIPPED_WORLDS.map((world) => world.id)).toContain(resolved.worldId);
    expect(resolved.selectedWorldId).toBe('random');
    expect(resolved.generatorId).toBe(worldById(resolved.worldId).generator);
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
