import { expect, test } from 'vitest';
import { launchProjectile, type Projectile } from './ballistics';
import { createWorld, fire } from './world';
import { runAltitudeHook, runApexHook, runTerrainHitHook, stepRollingHook, weaponById } from './weapons';

type OwnedLaunch = (options: {
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly power: number;
  readonly direction: -1 | 1;
  readonly shell: Projectile['shell'];
  readonly owner: 0 | 1;
}) => Projectile;

const launchOwned = launchProjectile as unknown as OwnedLaunch;
const ownerOf = (projectile: Projectile): 0 | 1 | undefined =>
  (projectile as Projectile & { readonly owner?: 0 | 1 }).owner;

function projectileFor(id: string, owner: 0 | 1 = 1): Projectile {
  return launchOwned({
    x: 100, y: 90, angleDeg: 45, power: 70, direction: 1, shell: weaponById(id).shell, owner,
  });
}

const terrain = { width: 500, height: 500, surfaceY: () => 100, hullBoxes: [] };

test('keeps the firing player as owner through every projectile continuation and spawn', () => {
  // Break caught: a split, bomblet, bounce, or roll loses the player that owns its presentation.
  const cluster = projectileFor('cluster');
  cluster.previousVy = -1;
  cluster.vy = 1;
  const clusterChildren = runApexHook(cluster)!;

  const mirv = projectileFor('mirv');
  mirv.previousVy = -1;
  mirv.vy = 1;
  const firstMirv = runApexHook(mirv)!;
  for (const child of firstMirv) child.stageAgeFrames = weaponById('mirv').hooks.onApex!.secondStageAfterFrames!;
  const terminalMirv = firstMirv.flatMap((child) => runApexHook(child) ?? [child]);

  const airburst = projectileFor('airburst');
  const altitude = weaponById('airburst').hooks.onAltitude!;
  airburst.y = 20;
  runAltitudeHook(airburst, () => 20 + altitude.armAfterExceedingPx);
  airburst.vy = 1;
  const bomblets = runAltitudeHook(airburst, () => airburst.y + altitude.triggerAltitudePx)!;

  const skipper = projectileFor('skipper');
  runTerrainHitHook(skipper, terrain);
  const roller = projectileFor('roller');
  runTerrainHitHook(roller, terrain);
  stepRollingHook(roller, terrain);

  expect([cluster, ...clusterChildren, mirv, ...firstMirv, ...terminalMirv, airburst, ...bomblets, skipper, roller]
    .every((projectile) => ownerOf(projectile) === 1)).toBe(true);
});

test('assigns fire to the active tank while owner leaves an identical launch vector unchanged', () => {
  // Break caught: fire uses launcher/default ownership or lets ownership affect the launch vector.
  const state = createWorld(0x5eed);
  state.activePlayer = 1;
  state.aim = state.tanks[1].aim;
  fire(state);
  const first = launchProjectile({
    x: 100, y: 90, angleDeg: 45, power: 70, direction: 1, shell: weaponById('he').shell, owner: 0,
  });
  const second = launchProjectile({
    x: 100, y: 90, angleDeg: 45, power: 70, direction: 1, shell: weaponById('he').shell, owner: 1,
  });

  expect(state.projectile && ownerOf(state.projectile)).toBe(1);
  expect({
    x: first.x,
    y: first.y,
    vx: first.vx,
    vy: first.vy,
  }).toEqual({
    x: second.x,
    y: second.y,
    vx: second.vx,
    vy: second.vy,
  });
});
