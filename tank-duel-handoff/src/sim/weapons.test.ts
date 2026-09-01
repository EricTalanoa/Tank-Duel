import rawShells from '../../spec/shells.json';
import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { launchProjectile } from './ballistics';
import {
  runApexHook,
  runTerrainHitHook,
  stepRollingHook,
  PLAYABLE_SHELL_IDS,
  PLAYABLE_WEAPONS,
  STANDARD_SHELL_IDS,
  STANDARD_WEAPONS,
  weaponById,
  type TerrainHookContext,
} from './weapons';
import type { Projectile } from './ballistics';

describe('standard weapon registry', () => {
  const projectileFor = (id: string): Projectile => launchProjectile({
    x: 50,
    y: 50,
    angleDeg: 45,
    power: 70,
    direction: 1,
    shell: weaponById(id).shell,
    owner: 0,
  });

  const context = (overrides: Partial<TerrainHookContext> = {}): TerrainHookContext => ({
    width: 100,
    height: 100,
    surfaceY: () => 50,
    hullBoxes: [],
    ...overrides,
  });

  it('loads the prototype deck from shell slots 1 through 6', () => {
    const expected = rawShells.filter((shell) => shell.slot <= 6).map((shell) => shell.id);
    expect(STANDARD_SHELL_IDS).toEqual(expected);
    expect(STANDARD_WEAPONS.map((weapon) => weapon.shell.id)).toEqual(expected);
  });

  it('loads the complete playable roster while excluding Anvil', () => {
    const expected = rawShells
      .filter((shell) => shell.id !== 'anvil')
      .map((shell) => shell.id);
    expect(PLAYABLE_SHELL_IDS).toEqual(expected);
    expect(PLAYABLE_WEAPONS.map((weapon) => weapon.shell.id)).toEqual(expected);
    expect(PLAYABLE_SHELL_IDS).not.toContain('anvil');
  });

  it('loads Drill column width from the shell spec', () => {
    const drill = PLAYABLE_WEAPONS.find((weapon) => weapon.shell.id === 'drill');
    expect(drill?.hooks.onTerrainHit).toMatchObject({
      type: 'drillColumn',
      depthPx: expect.any(Number),
      widthPx: expect.any(Number),
    });
  });

  it('keeps HE hook-free and preserves Cluster hook data', () => {
    expect(weaponById('he').hooks).toEqual({});
    expect(weaponById('cluster').hooks.onApex).toEqual(
      rawShells.find((shell) => shell.id === 'cluster')?.hooks?.onApex,
    );
  });

  it('resolves the playable roster and rejects excluded shells', () => {
    expect(weaponById('mirv').shell.id).toBe('mirv');
    expect(() => weaponById('anvil')).toThrow('Unknown playable weapon: anvil');
  });

  it('splits Cluster exactly once and prevents children from re-splitting', () => {
    const parent = launchProjectile({
      x: 200,
      y: 100,
      angleDeg: 45,
      power: 70,
      direction: 1,
      shell: weaponById('cluster').shell,
      owner: 0,
    });
    parent.vy = 0.1;
    parent.previousVy = -0.1;

    const children = runApexHook(parent);
    const hook = weaponById('cluster').hooks.onApex;
    if (!hook) throw new Error('Cluster apex hook missing');
    expect(children).toHaveLength(hook.split);
    expect(children?.every((child) => child.apexDone)).toBe(true);
    expect(children?.every((child) =>
      child.collisionGraceSubsteps === CONSTANTS.settle.collisionGraceSubsteps,
    )).toBe(true);
    expect(children?.map((child) => child.vx)).toEqual([...children!.map((child) => child.vx)].sort((a, b) => a - b));
    expect(runApexHook(children![0]!)).toBeNull();
  });

  it('terminates Bunker Buster within its burrow distance', () => {
    const projectile = projectileFor('buster');
    projectile.vx = 3;
    projectile.vy = 4;
    const result = runTerrainHitHook(projectile, context());
    const distance = Math.hypot(result.x - 50, result.y - 50);
    expect(result.status).toBe('detonate');
    expect(distance).toBeLessThanOrEqual(36);
    expect(distance).toBeGreaterThan(35);
    expect(projectile.collisionGraceSubsteps).toBe(CONSTANTS.settle.collisionGraceSubsteps);
  });

  it('stops Bunker Buster at a map boundary', () => {
    const projectile = projectileFor('buster');
    projectile.x = 98;
    projectile.vx = 4;
    projectile.vy = 1;
    const result = runTerrainHitHook(projectile, context());
    expect(result.status).toBe('detonate');
    expect(result.x).toBeLessThan(100);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThan(100);
  });

  it('scripts exactly the configured Skipper bounces forward', () => {
    const projectile = projectileFor('skipper');
    const hook = weaponById('skipper').hooks.onTerrainHit;
    if (!hook || hook.type !== 'skip') throw new Error('Skipper hook missing');
    projectile.vx = 10;
    projectile.vy = 4;
    const contacts: number[] = [];

    for (let bounce = 0; bounce < hook.maxBounces; bounce++) {
      contacts.push(projectile.x);
      const beforeVx = projectile.vx;
      expect(runTerrainHitHook(projectile, context()).status).toBe('continue');
      expect(projectile.vx).toBeCloseTo(beforeVx * hook.horizontalRetention);
      expect(projectile.vy).toBeCloseTo(-Math.abs(projectile.vx) * hook.relaunchAngleFactor);
      expect(projectile.collisionGraceSubsteps).toBe(CONSTANTS.settle.collisionGraceSubsteps);
      projectile.x += projectile.vx;
    }

    contacts.push(projectile.x);
    expect(runTerrainHitHook(projectile, context()).status).toBe('detonate');
    expect(projectile.bounceCount).toBe(hook.maxBounces);
    expect(contacts.every((x, index) => index === 0 || x > contacts[index - 1]!)).toBe(true);
  });

  it.each([
    ['fuse', { ageFrames: 149 }, context()],
    ['climb', {}, context({ surfaceY: () => 44 })],
    ['edge', { x: 99 }, context()],
    ['hull', {}, context({ hullBoxes: [{ x0: 51, y0: 40, x1: 54, y1: 60 }] })],
  ] as const)('terminates Roller independently on %s', (reason, projectileChanges, hookContext) => {
    const projectile = projectileFor('roller');
    Object.assign(projectile, projectileChanges);
    const conversion = runTerrainHitHook(projectile, hookContext);
    expect(conversion.status).toBe('continue');
    expect(projectile.collisionGraceSubsteps).toBe(CONSTANTS.settle.collisionGraceSubsteps);
    const result = stepRollingHook(projectile, hookContext);
    expect(result.status).toBe('detonate');
    expect(result.reason).toBe(reason);
  });

  it('keeps Roller coordinates unbounded while crossing a wrapping edge', () => {
    const projectile = projectileFor('roller');
    projectile.x = 99;
    const wrapping = context({
      wrap: true,
      surfaceY: () => 50,
    });
    expect(runTerrainHitHook(projectile, wrapping).status).toBe('continue');

    const result = stepRollingHook(projectile, wrapping);

    expect(result.status).toBe('continue');
    expect(projectile.x).toBeGreaterThan(100);
    expect(projectile.trail.at(-1)?.x).toBe(projectile.x);
  });

  it('does not clamp Bunker Buster horizontally in a wrapping world', () => {
    const projectile = projectileFor('buster');
    projectile.x = 98;
    projectile.vx = 4;
    projectile.vy = 1;

    const result = runTerrainHitHook(projectile, context({ wrap: true }));

    expect(result.status).toBe('detonate');
    expect(result.x).toBeGreaterThan(100);
  });
});
