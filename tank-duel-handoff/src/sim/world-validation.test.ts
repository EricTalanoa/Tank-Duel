import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { PLAYABLE_WEAPONS, weaponById } from './weapons';
import {
  effectiveMassFor,
  spawnGapForWorld,
  validateWorldShellRanges,
} from './worldValidation';
import { SHIPPED_WORLDS, worldById } from './worlds';

describe('world shell reachability', () => {
  it('ships only wide battlefields with distant spawns', () => {
    for (const world of SHIPPED_WORLDS) {
      expect(world.width).toBeGreaterThanOrEqual(1200);
      expect(spawnGapForWorld(world)).toBeGreaterThanOrEqual(900);
    }
  });

  it.each(SHIPPED_WORLDS)('$name validates every flight-capable shell across its spawn gap', (world) => {
    const results = validateWorldShellRanges(world);
    expect(results.map((result) => result.shellId)).not.toContain('repair');
    expect(results).toHaveLength(PLAYABLE_WEAPONS.filter(({ shell }) => !shell.noFlight).length);
    expect(results.every((result) => result.rangePx > spawnGapForWorld(world))).toBe(true);
  });

  it('derives a lower effective mass when a harsher profile makes Mortar fail', () => {
    const ferrum = worldById('ferrum');
    const harsh = {
      ...ferrum,
      gravity: ferrum.gravity * ferrum.gravity,
      massOverrides: {},
    };
    const result = validateWorldShellRanges(harsh)
      .find((candidate) => candidate.shellId === 'mortar')!;
    expect(result.overridden).toBe(true);
    expect(result.effectiveMass).toBeLessThan(weaponById('mortar').shell.mass);
    expect(result.rangePx).toBeGreaterThan(spawnGapForWorld(harsh));
  });

  it('reads effective mass from a world override without mutating shell spec data', () => {
    const shell = weaponById('mortar').shell;
    const world = worldById('terra');
    const overridden = { ...world, massOverrides: { mortar: shell.mass / 2 } };
    expect(effectiveMassFor(overridden, shell)).toBe(shell.mass / 2);
    expect(shell.mass).toBe(weaponById('mortar').shell.mass);
    expect(spawnGapForWorld(world)).toBe(world.width - CONSTANTS.spawnInsetPx * 2);
  });
});
