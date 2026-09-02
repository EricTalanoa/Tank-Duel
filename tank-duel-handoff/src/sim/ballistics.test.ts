import { describe, expect, it } from 'vitest';
import vectors from '../../spec/test-vectors.json';
import { launchProjectile, stepProjectile, type Projectile } from './ballistics';
import { HE_SHELL, SHELLS, type Shell } from './shells';
import { CONSTANTS } from './constants';
import { createTerrain, solidAt } from './terrain';
import { TERRA, worldById, type WorldPhysics } from './worlds';
import { effectiveMassFor } from './worldValidation';

interface ShotResult {
  readonly projectile: Projectile;
  readonly flightFrames: number;
}

function flatGroundShot(
  power: number,
  angleDeg = 45,
  wind = 0,
  world: WorldPhysics = TERRA,
  shell: Shell = HE_SHELL,
  effectiveMass?: number,
): ShotResult {
  const projectile = launchProjectile({
    x: 0,
    // A shell center needs clearance from the collision plane. Golden ranges are
    // frame-quantized; this small fixture offset keeps substep impact inside ±5 px.
    y: -4,
    angleDeg,
    power,
    direction: 1,
    shell,
    owner: 0,
    ...(effectiveMass === undefined ? {} : { effectiveMass }),
  });

  for (let flightFrames = 1; flightFrames < 10_000; flightFrames++) {
    const result = stepProjectile(projectile, {
      world,
      wind,
      solidAt: (_x, y) => y >= 0,
    });
    if (result.hit) return { projectile, flightFrames };
  }
  throw new Error('Shot did not land');
}

describe('Terra ballistics', () => {
  it('takes gravity, drag, and wind acceleration from the supplied world', () => {
    const projectile = launchProjectile({
      x: 0,
      y: 0,
      angleDeg: 45,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });
    const before = { vx: projectile.vx, vy: projectile.vy };
    stepProjectile(projectile, {
      world: TERRA,
      wind: TERRA.windRange,
      solidAt: () => false,
    });
    expect(projectile.vx).toBeGreaterThan(before.vx);
    expect(projectile.vy).toBeGreaterThan(before.vy);
  });
  it.each(Object.entries(vectors.shellMaxRangeOnTerra))(
    '%s matches its golden maximum range and crosses the spawn gap',
    (id, goldenRange) => {
      const shell = SHELLS.find((candidate) => candidate.id === id);
      if (!shell) throw new Error(`${id} is missing from spec/shells.json`);
      const actual = flatGroundShot(CONSTANTS.power.max, 45, 0, TERRA, shell).projectile.x;
      expect(Math.abs(actual - goldenRange)).toBeLessThanOrEqual(10);
      // Terra's widened gap outruns a few base-mass shells, so reach is asserted at
      // the effective mass the world actually ships.
      const shipped = flatGroundShot(
        CONSTANTS.power.max,
        45,
        0,
        TERRA,
        shell,
        effectiveMassFor(TERRA, shell),
      ).projectile.x;
      expect(shipped).toBeGreaterThan(vectors.spawnGapPx);
    },
  );

  it('skips terrain checks for collision-grace substeps after repositioning', () => {
    const projectile = launchProjectile({
      x: 10,
      y: 10,
      angleDeg: 0,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });
    projectile.collisionGraceSubsteps = CONSTANTS.settle.collisionGraceSubsteps;
    let checks = 0;
    const environment = {
      world: TERRA,
      wind: 0,
      solidAt: () => {
        checks++;
        return true;
      },
    };

    expect(stepProjectile(projectile, environment).hit).toBe(false);
    expect(checks).toBe(0);
    expect(projectile.collisionGraceSubsteps).toBe(
      CONSTANTS.settle.collisionGraceSubsteps - CONSTANTS.substeps,
    );
  });

  it.each(Object.entries(vectors.terraFlatGroundRange45NoWind))(
    'lands power %s within 5 px of its golden range',
    (power, golden) => {
      const shot = flatGroundShot(Number(power));
      expect(Math.abs(shot.projectile.x - golden.rangePx)).toBeLessThanOrEqual(5);
    },
  );

  it.each(Object.entries(vectors.windDriftAtPower70).filter(([wind]) => wind !== '0'))(
    'drifts at wind %s within 10 px of its golden offset',
    (wind, goldenDrift) => {
      const noWind = flatGroundShot(70).projectile.x;
      const windy = flatGroundShot(70, 45, Number(wind)).projectile.x;
      expect(Math.abs(windy - noWind - goldenDrift)).toBeLessThanOrEqual(10);
    },
  );

  it('matches the power-75 golden angle sweep', () => {
    const ranges = Object.entries(vectors.angleSweepAtPower75).map(([angle, golden]) => {
      const actual = flatGroundShot(75, Number(angle)).projectile.x;
      expect(Math.abs(actual - golden.rangePx)).toBeLessThanOrEqual(5);
      return [Number(angle), actual] as const;
    });

    const byAngle = new Map(ranges);
    expect(byAngle.get(45)).toBe(Math.max(...ranges.map(([, range]) => range)));
    expect(Math.abs((byAngle.get(30) as number) - (byAngle.get(60) as number))).toBeLessThanOrEqual(5);
  });

  it('applies per-frame atmospheric drag on Vesper', () => {
    const vesper = worldById('vesper');
    const actual = flatGroundShot(75, 45, 0, vesper).projectile.x;
    expect(Math.abs(actual - vectors.worldRanges.vesper.atPower75)).toBeLessThanOrEqual(5);
  });

  it('stops a power-100 shell at terrain only four pixels thick', () => {
    const terrain = createTerrain(100, 100);
    for (let y = 0; y < terrain.height; y++) {
      for (let x = 40; x < 44; x++) terrain.mask[y * terrain.width + x] = 1;
    }
    const projectile = launchProjectile({
      x: 0,
      y: 50,
      angleDeg: 0,
      power: 100,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });

    let hit = false;
    for (let frame = 0; frame < 10 && !hit; frame++) {
      hit = stepProjectile(projectile, {
        world: TERRA,
        wind: 0,
        solidAt: (x, y) => solidAt(terrain, x, y),
      }).hit;
    }

    expect(hit).toBe(true);
    expect(projectile.x).toBeGreaterThanOrEqual(40);
    expect(projectile.x).toBeLessThan(44);
  });
});
