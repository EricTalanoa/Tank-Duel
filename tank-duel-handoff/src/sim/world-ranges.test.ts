import { describe, expect, it } from 'vitest';
import vectors from '../../spec/test-vectors.json';
import rawWorlds from '../../spec/worlds.json';
import { launchProjectile, stepProjectile } from './ballistics';
import { CONSTANTS } from './constants';
import { HE_SHELL } from './shells';
import { SHIPPED_WORLDS, type WorldPhysics } from './worlds';

function flatRange(world: WorldPhysics, power: number): { range: number; frames: number } {
  const projectile = launchProjectile({
    x: 0,
    y: 0,
    angleDeg: 45,
    power,
    direction: 1,
    shell: HE_SHELL,
    owner: 0,
  });
  for (let frames = 1; frames < 10_000; frames++) {
    const result = stepProjectile(projectile, {
      world,
      wind: 0,
      solidAt: (_x, y) => y >= 0,
    });
    // Reference flight duration includes the launch frame.
    if (result.hit) return { range: projectile.x, frames: frames + 1 };
  }
  throw new Error(`${world.id} shot did not land`);
}

describe('shipped world golden ranges', () => {
  it.each(SHIPPED_WORLDS)('$name matches its reference range and watched time', (world) => {
    const golden = vectors.worldRanges[world.id];
    const source = rawWorlds.find((candidate) => candidate.id === world.id)!;
    const at75 = flatRange(world, 75);
    const at100 = flatRange(world, CONSTANTS.power.max);
    expect(Math.abs(at75.range - golden.atPower75)).toBeLessThanOrEqual(10);
    expect(Math.abs(at100.range - golden.atPower100)).toBeLessThanOrEqual(10);
    expect(at100.range).toBeGreaterThan(world.width);
    expect(at100.frames).toBe(golden.flightFramesAtPower100);
    expect(at100.frames / CONSTANTS.simHz / world.flightTimeScale)
      .toBeCloseTo(source.derived.watchedSeconds, 2);
  });
});
