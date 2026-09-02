import { describe, it, expect } from 'vitest';
import { enqueueCollapseRanges } from './collapse';
import { adjustAngle, adjustPower, createWorld, fire, selectShell, step, simSeconds } from './world';
import { DT } from './clock';
import { CONSTANTS } from './constants';
import { launchProjectile } from './ballistics';
import { HE_SHELL } from './shells';
import { makePlayerLoadouts } from './playerLoadouts';
import { STANDARD_SHELL_IDS, weaponById } from './weapons';
import { wrappedDelta } from './wrap';
import vectors from '../../spec/test-vectors.json';

describe('world', () => {
  it('uses the selected world generator by default', () => {
    expect(createWorld(12, { worldId: 'rust' }).generatorId).toBe('canyon');
    expect(createWorld(12, { worldId: 'selene', generator: 'plates' }).generatorId).toBe('plates');
    expect(createWorld(12, { worldId: 'hollow', generator: 'plates' }).generatorId).toBe('ring');
  });

  it('records accepted terrain seed and regeneration metadata', () => {
    const state = createWorld(0x51ee7, { worldId: 'ferrum', generator: 'spires' });
    expect(state.terrainGeneration.attempts).toBeGreaterThan(0);
    expect(state.terrainGeneration.acceptedSeed).toBeTypeOf('number');
    expect(state.terrainGeneration.generatorId).toBe('spires');
  });
  it('places Terra tanks at the golden spawn gap', () => {
    const state = createWorld(2);
    expect(state.tanks[1].x - state.tanks[0].x).toBe(vectors.spawnGapPx);
  });
  it.each([
    ['terra', 1200],
    ['vesper', 1200],
    ['ferrum', 1200],
  ] as const)('creates the %s field from its selected world profile', (worldId, width) => {
    const state = createWorld(3, { worldId });
    expect(state.world.id).toBe(worldId);
    expect(state.field.width).toBe(width);
  });

  it('keeps fixed-mode Vesper wind across handoffs', () => {
    const state = createWorld(4, { worldId: 'vesper' });
    const initial = state.wind;
    state.phase = 'handoff';
    step(state);
    state.phase = 'handoff';
    step(state);
    expect(state.wind).toBe(initial);
  });
  it('creates independent arsenals from each player’s complete deck', () => {
    const playerLoadoutIds = makePlayerLoadouts(
      ['he', 'mortar', 'cluster'],
      ['he', 'roller', 'sand'],
    );
    const state = createWorld(71, { playerLoadoutIds });

    expect(state.arsenals[0].slots.map((weapon) => weapon.shell.id)).toEqual(playerLoadoutIds[0]);
    expect(state.arsenals[1].slots.map((weapon) => weapon.shell.id)).toEqual(playerLoadoutIds[1]);
    expect(state.arsenals[0].slots).not.toBe(state.arsenals[1].slots);
    expect(state.arsenals[0].ammo).not.toBe(state.arsenals[1].ammo);
    state.arsenals[0].ammo.mortar = 0;
    expect(state.arsenals[1].ammo.mortar).toBeUndefined();
    expect(state.arsenals[1].ammo.roller).toBeGreaterThan(0);
  });

  it('creates independent complete default decks', () => {
    const state = createWorld(73);

    expect(STANDARD_SHELL_IDS[0]).toBe('he');
    expect(state.arsenals[0].slots.map((weapon) => weapon.shell.id)).toEqual(STANDARD_SHELL_IDS);
    expect(state.arsenals[1].slots.map((weapon) => weapon.shell.id)).toEqual(STANDARD_SHELL_IDS);
    expect(state.arsenals[0].slots).not.toBe(state.arsenals[1].slots);
    expect(state.arsenals[0].ammo).not.toBe(state.arsenals[1].ammo);
    state.arsenals[0].ammo.mortar = 0;
    expect(state.arsenals[1].ammo.mortar).toBe(weaponById('mortar').shell.ammo);
  });

  it('selects slot two from the active player’s own deck after handoff', () => {
    const state = createWorld(72, {
      playerLoadoutIds: makePlayerLoadouts(['he', 'mortar'], ['he', 'roller']),
    });

    expect(selectShell(state, 2)).toBe(true);
    expect(state.arsenals[0].selectedShellId).toBe('mortar');

    state.phase = 'handoff';
    step(state);

    expect(state.activePlayer).toBe(1);
    expect(selectShell(state, 2)).toBe(true);
    expect(state.arsenals[1].selectedShellId).toBe('roller');
  });

  it('keeps custom deck positions stable and falls back to HE when ammo is spent', () => {
    const ids = ['skipper', 'drill', 'sand', 'buster', 'cluster'];
    const state = createWorld(71, {
      playerLoadoutIds: makePlayerLoadouts(['he', ...ids], ['he', ...ids]),
    });
    expect(state.arsenals[0].slots.map((weapon) => weapon.shell.id)).toEqual(['he', ...ids]);
    expect(state.arsenals[1].slots.map((weapon) => weapon.shell.id)).toEqual(['he', ...ids]);

    expect(selectShell(state, 4)).toBe(true);
    expect(state.arsenals[0].selectedShellId).toBe('sand');
    state.arsenals[0].ammo.sand = 1;
    expect(fire(state)).toBe(true);
    expect(state.arsenals[0].ammo.sand).toBe(0);
    expect(state.arsenals[0].slots[3]?.shell.id).toBe('sand');
    expect(state.arsenals[0].selectedShellId).toBe('he');
  });
  it('starts with two 100-health tanks in AIM', () => {
    const state = createWorld(11);
    expect(state.phase).toBe('aim');
    expect(state.tanks).toHaveLength(2);
    expect(state.tanks.map((tank) => tank.health)).toEqual([
      CONSTANTS.damage.startingHealth,
      CONSTANTS.damage.startingHealth,
    ]);
  });

  it('takes its field size from spec/constants.json', () => {
    const state = createWorld(7);
    expect(state.field.width).toBe(CONSTANTS.defaultFieldWidth);
    expect(state.field.height).toBe(CONSTANTS.fieldHeight);
  });

  it('accepts an explicit field width — Task 8 supplies one per world', () => {
    const state = createWorld(7, { width: 1200 });
    expect(state.field.width).toBe(1200);
  });

  it('replays identically from the same seed', () => {
    const run = (seed: number) => {
      const state = createWorld(seed);
      const draws: number[] = [];
      for (let i = 0; i < 600; i++) {
        step(state);
        draws.push(state.rng.next());
      }
      return { frame: state.frame, rngState: state.rng.getState(), draws };
    };

    expect(run(0xbeef)).toEqual(run(0xbeef));
    expect(run(0xbeef)).not.toEqual(run(0xbeee));
  });

  it('derives sim time from the step count, not the wall clock', () => {
    const state = createWorld(1);
    for (let i = 0; i < 90; i++) step(state);
    expect(simSeconds(state)).toBeCloseTo(90 * DT, 10);
    expect(simSeconds(state)).toBeCloseTo(1.5, 10);
  });

  it('fires HE, carves on impact, and completes the active trail', () => {
    const state = createWorld(0x51a7);
    state.aim.angleDeg = 90;
    state.aim.power = CONSTANTS.power.min;
    const before = state.terrain.mask.reduce((sum, pixel) => sum + pixel, 0);

    expect(fire(state)).toBe(true);
    expect(state.projectile?.shell.id).toBe('he');
    expect(state.trails[0]).toHaveLength(1);

    for (let frame = 0; frame < 600 && state.phase !== 'settle'; frame++) step(state);

    const after = state.terrain.mask.reduce((sum, pixel) => sum + pixel, 0);
    expect(state.projectile).toBeNull();
    expect(after).toBeLessThan(before);
    expect(state.terrainDirty).toHaveLength(1);
    expect(state.trails[0][0]?.length).toBeGreaterThan(2);
  });

  it.each([0, 1] as const)('records the resolved HE impact for owner %s only after resolution', (owner) => {
    const state = createWorld(0x5100 + owner);
    const y = Math.floor(state.field.height / 2);
    state.pendingImpacts = [{ owner, x: 200 + owner, y, shell: HE_SHELL }];
    state.phase = 'resolve';

    expect(state.lastResolvedShotImpact).toBeNull();
    step(state);

    expect(state.lastResolvedShotImpact).toEqual({ owner, x: 200 + owner, y });
    expect(Object.isFrozen(state.lastResolvedShotImpact)).toBe(true);
  });

  it('copies a projectile owner into its pending impact before resolution', () => {
    const state = createWorld(0x5102);
    const x = 48;
    const y = 100;
    state.terrain.mask.fill(0);
    for (let terrainY = 99; terrainY <= 102; terrainY++) {
      for (let terrainX = 50; terrainX < 54; terrainX++) {
        state.terrain.mask[terrainIndex(state.field.width, terrainY, terrainX)] = 1;
      }
    }
    const projectile = launchProjectile({
      x,
      y,
      angleDeg: CONSTANTS.elevation.minDisplay,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 1,
    });
    projectile.vx = 4;
    projectile.vy = 0;
    state.wind = 0;
    state.projectile = projectile;
    state.projectiles = [projectile];
    state.phase = 'flight';

    step(state);

    expect(state.phase).toBe('resolve');
    expect(state.pendingImpacts).toHaveLength(1);
    expect(state.pendingImpacts[0]?.owner).toBe(1);
    expect(state.lastResolvedShotImpact).toBeNull();
  });

  it('records canonical wrapped coordinates only after canonical resolution', () => {
    const state = createWorld(0x5103, { worldId: 'hollow' });
    const y = Math.floor(state.field.height / 2);
    state.pendingImpact = { owner: 1, x: state.field.width + 2, y, shell: HE_SHELL };
    state.phase = 'resolve';

    step(state);

    expect(state.lastResolvedShotImpact).toEqual({ owner: 1, x: 2, y });
  });

  it('keeps the last resolved impact until the next owned shot resolves', () => {
    const state = createWorld(0x5104);
    state.pendingImpact = { owner: 0, x: 200, y: 200, shell: HE_SHELL };
    state.phase = 'resolve';
    step(state);
    const first = state.lastResolvedShotImpact;

    state.phase = 'settle';
    step(state);
    expect(state.lastResolvedShotImpact).toBe(first);

    state.pendingImpact = { owner: 1, x: 300, y: 200, shell: HE_SHELL };
    state.phase = 'resolve';
    step(state);
    expect(state.lastResolvedShotImpact).toEqual({ owner: 1, x: 300, y: 200 });
  });

  it('rejects a split HE impact batch as a CPU observation', () => {
    const state = createWorld(0x5105);
    state.pendingImpacts = [
      { owner: 0, x: 200, y: 200, shell: HE_SHELL },
      { owner: 0, x: 210, y: 200, shell: HE_SHELL },
    ];
    state.phase = 'resolve';

    step(state);

    expect(state.lastResolvedShotImpact).toBeNull();
  });

  it('keeps split collapse dirty ranges split during settle instead of merging them across the field', () => {
    const state = createWorld(0x51a7);
    const width = state.field.width;
    state.terrain.mask.fill(0);
    state.terrain.mask[terrainIndex(width, 1, 0)] = 1;
    state.terrain.mask[terrainIndex(width, 1, width - 1)] = 1;
    enqueueCollapseRanges(state.collapseQueue, [{ x0: 0, x1: 1 }, { x0: width - 1, x1: width }]);
    state.phase = 'settle';
    state.tanks[0].health = 0;
    state.tanks[1].health = 0;

    step(state);

    expect(state.terrainDirty).toEqual([{ x0: 0, x1: 1 }, { x0: width - 1, x1: width }]);
    expect(state.terrainDirty).not.toEqual([{ x0: 0, x1: width }]);
  });

  it('retains only the latest three trails', () => {
    const state = createWorld(0x7a11);
    state.aim.angleDeg = 90;
    state.aim.power = CONSTANTS.power.min;

    for (let shot = 0; shot < 4; shot++) {
      expect(fire(state)).toBe(true);
      for (let frame = 0; frame < 600 && state.projectile; frame++) step(state);
      if (state.phase === 'resolve') step(state);
      state.phase = 'aim';
    }

    expect(state.trails[0]).toHaveLength(3);
  });

  it('clamps angle and power adjustments to spec bounds', () => {
    const state = createWorld(3);
    adjustAngle(state, -10_000);
    adjustPower(state, -10_000);
    expect(state.aim.angleDeg).toBe(CONSTANTS.elevation.minDisplay);
    expect(state.aim.power).toBe(CONSTANTS.power.min);

    adjustAngle(state, 10_000);
    adjustPower(state, 10_000);
    expect(state.aim.angleDeg).toBe(CONSTANTS.elevation.maxDisplay);
    expect(state.aim.power).toBe(CONSTANTS.power.max);
  });

  it('fires exactly once during a three-second held input and rejects fire outside AIM', () => {
    const state = createWorld(17);
    expect(fire(state)).toBe(true);
    expect(state.phase).toBe('flight');

    for (let frame = 0; frame < CONSTANTS.simHz * 3; frame++) {
      expect(fire(state)).toBe(false);
    }
    expect(state.trails[0]).toHaveLength(1);

    state.projectile = null;
    state.phase = 'settle';
    expect(fire(state)).toBe(false);
  });

  it('selects stable shell slots only during AIM and consumes finite ammo once', () => {
    const state = createWorld(23);
    const mortar = state.arsenals[0].slots[1]!;
    expect(mortar.shell.slot).toBe(2);
    expect(selectShell(state, 2)).toBe(true);
    expect(state.arsenals[0].selectedShellId).toBe('mortar');
    const before = state.arsenals[0].ammo.mortar;
    expect(typeof before).toBe('number');

    expect(fire(state)).toBe(true);
    expect(state.projectile?.shell.id).toBe('mortar');
    expect(state.arsenals[0].ammo.mortar).toBe((before as number) - 1);
    expect(selectShell(state, 1)).toBe(false);
    expect(fire(state)).toBe(false);
    expect(state.arsenals[0].ammo.mortar).toBe((before as number) - 1);
  });

  it('keeps HE ammunition unlimited', () => {
    const state = createWorld(29);
    expect(state.arsenals[0].ammo.he).toBe('inf');
    expect(selectShell(state, 1)).toBe(true);
    expect(fire(state)).toBe(true);
    expect(state.arsenals[0].ammo.he).toBe('inf');
  });

  it('collides with wrapped terrain while retaining unbounded flight and trail coordinates', () => {
    const state = createWorld(0x10c, { worldId: 'hollow' });
    const width = state.field.width;
    state.terrain.mask.fill(0);
    for (let y = 99; y <= 102; y++) {
      for (let x = 0; x < 4; x++) state.terrain.mask[terrainIndex(width, y, x)] = 1;
    }
    const projectile = launchProjectile({
      x: width - 0.25,
      y: 100,
      angleDeg: CONSTANTS.elevation.minDisplay,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });
    projectile.vx = 4;
    projectile.vy = 0;
    state.wind = 0;
    state.projectile = projectile;
    state.projectiles = [projectile];
    state.phase = 'flight';

    step(state);

    expect(state.phase).toBe('resolve');
    expect(projectile.x).toBeGreaterThan(width);
    expect(projectile.trail.at(-1)?.x).toBeGreaterThan(width);
    expect(state.pendingImpacts[0]?.x).toBeGreaterThanOrEqual(0);
    expect(state.pendingImpacts[0]?.x).toBeLessThan(width);
  });

  it('keeps a fired wrapping projectile unbounded through three horizontal laps', () => {
    const state = createWorld(0x10d, { worldId: 'hollow' });
    state.terrain.mask.fill(0);
    state.wind = 0;
    state.tanks[0].health = 0;
    state.tanks[1].health = 0;
    const demo = HE_SHELL.demoShot;
    if (demo.elevation === null) throw new Error('HE demo elevation missing');
    state.aim.angleDeg = demo.elevation;
    state.aim.power = CONSTANTS.power.max;

    expect(fire(state)).toBe(true);
    const trail = state.projectile!.trail;
    for (let frame = 0; frame < CONSTANTS.settle.hardExitFrames && state.projectile; frame++) {
      step(state);
    }

    expect(Math.max(...trail.map((point) => point.x))).toBeGreaterThan(state.field.width * 3);
    expect(trail.every((point, index) => index === 0 || point.x >= trail[index - 1]!.x)).toBe(true);
  });

  it('retains horizontal edge termination on a non-wrapping world', () => {
    const state = createWorld(0x10e, { worldId: 'terra' });
    const projectile = launchProjectile({
      x: state.field.width * 3,
      y: 100,
      angleDeg: CONSTANTS.elevation.minDisplay,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });
    state.terrain.mask.fill(0);
    state.projectile = projectile;
    state.projectiles = [projectile];
    state.phase = 'flight';

    step(state);

    expect(state.phase).toBe('resolve');
    expect(state.projectile).toBeNull();
  });

  it('carves a seam impact into both canonical edges and preserves split dirty ranges', () => {
    const state = createWorld(0x10f, { worldId: 'hollow' });
    const width = state.field.width;
    const y = Math.floor(state.field.height / 2);
    state.terrain.mask.fill(1);
    state.pendingImpact = { owner: 0, x: width - 1, y, shell: HE_SHELL };
    state.phase = 'resolve';

    step(state);

    expect(state.terrain.mask[terrainIndex(width, y, 0)]).toBe(0);
    expect(state.terrain.mask[terrainIndex(width, y, width - 1)]).toBe(0);
    expect(state.terrainDirty).toHaveLength(2);
    expect(state.terrainDirty).not.toEqual([{ x0: 0, x1: width }]);
  });

  it('direct-hits the nearest wrapped hull copy without canonicalizing the trail', () => {
    const state = createWorld(0x110, { worldId: 'hollow' });
    const width = state.field.width;
    const target = state.tanks[1];
    target.x = 8;
    target.y = 120;
    state.terrain.mask.fill(0);
    const projectile = launchProjectile({
      x: width - 2,
      y: target.y,
      angleDeg: CONSTANTS.elevation.minDisplay,
      power: CONSTANTS.power.min,
      direction: 1,
      shell: HE_SHELL,
      owner: 0,
    });
    projectile.vx = 16;
    projectile.vy = 0;
    state.wind = 0;
    state.projectile = projectile;
    state.projectiles = [projectile];
    state.phase = 'flight';

    step(state);
    step(state);

    expect(state.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'directHit', player: 1 }),
    ]));
    expect(target.health).toBeLessThan(CONSTANTS.damage.startingHealth);
    expect(projectile.trail.some((point) => point.x >= width)).toBe(true);
  });

  it('canonicalizes persistent fire zones created by unbounded seam impacts', () => {
    const state = createWorld(0x111, { worldId: 'hollow' });
    const shell = weaponById('napalm').shell;
    state.pendingImpact = {
      owner: 0,
      x: state.field.width + 2,
      y: Math.floor(state.field.height / 2),
      shell,
    };
    state.phase = 'resolve';

    step(state);

    expect(state.fireZones[0]?.x).toBe(2);
  });

  it('hits an opponent by firing away through Hollow with an unbounded multi-seam trail', () => {
    const state = createWorld(0x112, { worldId: 'hollow' });
    const shooter = state.tanks[0];
    const target = state.tanks[1];
    target.x = CONSTANTS.spawnInsetPx - CONSTANTS.tank.hullHalfWidth * 3;
    target.y = shooter.y;
    state.terrain.mask.fill(0);
    state.wind = 0;
    const demo = HE_SHELL.demoShot;
    if (demo.elevation === null || demo.power === null) throw new Error('HE demo shot missing');
    state.aim.angleDeg = demo.elevation;
    state.aim.power = demo.power;
    const nearestTargetDirection = Math.sign(wrappedDelta(shooter.x, target.x, state.field.width));

    expect(nearestTargetDirection).toBe(-shooter.direction);
    expect(fire(state)).toBe(true);
    const trail = state.projectile!.trail;
    for (
      let frame = 0;
      frame < CONSTANTS.settle.hardExitFrames &&
      target.health === CONSTANTS.damage.startingHealth;
      frame++
    ) {
      step(state);
    }

    expect(target.health).toBeLessThan(CONSTANTS.damage.startingHealth);
    expect(Math.max(...trail.map((point) => point.x))).toBeGreaterThan(state.field.width * 2);
    expect(trail.every((point, index) => index === 0 || point.x >= trail[index - 1]!.x)).toBe(true);
  });
});

function terrainIndex(width: number, y: number, x: number): number {
  return y * width + x;
}
