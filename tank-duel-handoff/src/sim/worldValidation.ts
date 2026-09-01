import { launchProjectile, stepProjectile } from './ballistics';
import { CONSTANTS } from './constants';
import type { Shell } from './shells';
import { PLAYABLE_WEAPONS } from './weapons';
import type { WorldPhysics } from './worlds';

export interface ShellRangeValidation {
  readonly shellId: string;
  readonly rangePx: number;
  readonly effectiveMass: number;
  readonly overridden: boolean;
}

export function spawnGapForWorld(world: WorldPhysics): number {
  return Math.max(0, world.width - CONSTANTS.spawnInsetPx * 2);
}

export function effectiveMassFor(world: WorldPhysics, shell: Shell): number {
  return world.massOverrides[shell.id] ?? shell.mass;
}

function flatRange(world: WorldPhysics, shell: Shell, effectiveMass: number): number {
  const projectile = launchProjectile({
    x: 0,
    y: 0,
    angleDeg: (CONSTANTS.elevation.minDisplay + CONSTANTS.elevation.maxDisplay) / 2,
    power: CONSTANTS.power.max,
    direction: 1,
    shell,
    owner: 0,
    effectiveMass,
  });
  for (let frame = 0; frame < 10_000; frame++) {
    if (stepProjectile(projectile, {
      world,
      wind: 0,
      solidAt: (_x, y) => y >= 0,
    }).hit) return projectile.x;
  }
  throw new Error(`${shell.id} did not land while validating ${world.id}`);
}

function derivePassingMass(world: WorldPhysics, shell: Shell, gap: number): number {
  let passing = shell.mass;
  let passingRange = flatRange(world, shell, passing);
  for (let attempt = 0; passingRange <= gap && attempt < 64; attempt++) {
    passing /= 2;
    passingRange = flatRange(world, shell, passing);
  }
  if (passingRange <= gap) throw new Error(`${shell.id} cannot cross ${world.id} spawn gap`);

  let failing = shell.mass;
  for (let iteration = 0; iteration < 32; iteration++) {
    const candidate = (passing + failing) / 2;
    if (flatRange(world, shell, candidate) > gap) passing = candidate;
    else failing = candidate;
  }
  return passing;
}

export function validateWorldShellRanges(world: WorldPhysics): readonly ShellRangeValidation[] {
  const gap = spawnGapForWorld(world);
  return PLAYABLE_WEAPONS
    .filter(({ shell }) => !shell.noFlight)
    .map(({ shell }) => {
      const specifiedMass = effectiveMassFor(world, shell);
      const specifiedRange = flatRange(world, shell, specifiedMass);
      const effectiveMass = specifiedRange > gap
        ? specifiedMass
        : derivePassingMass(world, shell, gap);
      return {
        shellId: shell.id,
        rangePx: effectiveMass === specifiedMass
          ? specifiedRange
          : flatRange(world, shell, effectiveMass),
        effectiveMass,
        overridden: effectiveMass !== shell.mass,
      };
    });
}

export function buildMassOverrides(world: WorldPhysics): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(
    validateWorldShellRanges(world)
      .filter((result) => result.overridden)
      .map((result) => [result.shellId, result.effectiveMass]),
  ));
}
