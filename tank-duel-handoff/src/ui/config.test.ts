import { describe, expect, it } from 'vitest';
import { CPU_TIERS } from '../sim/cpu';
import { createRng } from '../sim/rng';
import { HE_SHELL, SHELLS } from '../sim/shells';
import { PLAYABLE_SHELL_IDS } from '../sim/weapons';
import { SHIPPED_WORLDS, worldById } from '../sim/worlds';
import * as configModule from './config';
import {
  MATCH_AMMO_BOUNDS,
  CREATE_DEFAULT_CPU_TIER_ID,
  MATCH_ROUND_OPTIONS,
  MATCH_SCREEN_IDS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WIND_OPTIONS,
  createDefaultConfig,
  resolveMatchConfig,
  validateConfig,
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
      selectedWorldId: 'random',
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
    const resolved = resolveMatchConfig(createDefaultConfig(), createRng(7));

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
