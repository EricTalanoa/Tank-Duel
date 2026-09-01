import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { launchProjectile } from './ballistics';
import { runAltitudeHook, runApexHook, weaponById } from './weapons';

function projectileFor(id: string) {
  return launchProjectile({
    x: 100,
    y: 90,
    angleDeg: CONSTANTS.elevation.minDisplay,
    power: CONSTANTS.power.min,
    direction: 1,
    shell: weaponById(id).shell,
  });
}

describe('exotic projectile staging', () => {
  it('does not trigger Airburst at the minimum-power minimum-elevation muzzle', () => {
    const projectile = projectileFor('airburst');
    expect(runAltitudeHook(projectile, () => projectile.y)).toBeNull();
    expect(projectile.altitudeArmed).toBe(false);
  });

  it('arms Airburst high up and emits vertical, evenly spaced bomblets on descent', () => {
    const projectile = projectileFor('airburst');
    const hook = weaponById('airburst').hooks.onAltitude!;
    projectile.y = 20;
    expect(runAltitudeHook(projectile, () => 20 + hook.armAfterExceedingPx)).toBeNull();
    projectile.vy = 1;
    const children = runAltitudeHook(projectile, () => projectile.y + hook.triggerAltitudePx);
    expect(children).toHaveLength(hook.bomblets);
    expect(children?.map((child) => child.x)).toEqual(
      Array.from({ length: hook.bomblets }, (_, index) =>
        projectile.x + (index - (hook.bomblets - 1) / 2) * hook.spacingPx),
    );
    expect(children?.every((child) => child.vx === 0 && child.altitudeDone)).toBe(true);
    expect(children?.every((child) =>
      child.collisionGraceSubsteps === CONSTANTS.settle.collisionGraceSubsteps,
    )).toBe(true);
  });

  it('stages MIRV into exactly the configured terminal count and depth', () => {
    const parent = projectileFor('mirv');
    const hook = weaponById('mirv').hooks.onApex!;
    if (hook.secondStageAfterFrames === undefined || hook.totalSubmunitions === undefined ||
      hook.maxDepth === undefined) throw new Error('MIRV staging hook missing');
    parent.previousVy = -1;
    parent.vy = 1;
    const first = runApexHook(parent)!;
    for (const child of first) child.stageAgeFrames = hook.secondStageAfterFrames;
    const terminal = first.flatMap((child) => runApexHook(child) ?? [child]);
    expect(terminal).toHaveLength(hook.totalSubmunitions);
    expect(Math.max(...terminal.map((child) => child.splitDepth))).toBe(hook.maxDepth);
    expect(terminal.every((child) => runApexHook(child) === null)).toBe(true);
  });
});
