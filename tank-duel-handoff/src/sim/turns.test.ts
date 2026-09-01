import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { adjustAngle, adjustPower, createWorld, fire, step } from './world';
import { solidAt } from './terrain';
import { TERRA } from './worlds';
import { HE_SHELL } from './shells';

function solidCount(state: ReturnType<typeof createWorld>): number {
  return state.terrain.mask.reduce((sum, pixel) => sum + pixel, 0);
}

describe('turn flow', () => {
  it('transitions FLIGHT to RESOLVE before carving, then RESOLVE to SETTLE', () => {
    const state = createWorld(0x404);
    state.aim.angleDeg = 90;
    state.aim.power = CONSTANTS.power.min;
    const before = solidCount(state);
    fire(state);

    for (let frame = 0; frame < 600 && state.projectile; frame++) step(state);

    expect(state.phase).toBe('resolve');
    expect(solidCount(state)).toBe(before);
    step(state);
    expect(state.phase).toBe('settle');
    expect(solidCount(state)).toBeLessThan(before);
  });

  it('digs a buried tank upward before applying gravity', () => {
    const state = createWorld(0x405);
    const tank = state.tanks[0];
    state.phase = 'settle';
    state.terrain.mask.fill(1);
    tank.y = Math.floor(state.field.height / 2);
    tank.vy = 0;

    step(state);

    expect(solidAt(state.terrain, tank.x, tank.y + CONSTANTS.tank.damageOriginY)).toBe(false);
    expect(tank.vy).toBe(0);
  });

  it('always exits SETTLE within the hard limit', () => {
    const state = createWorld(0x406);
    state.phase = 'settle';
    state.terrain.mask.fill(0);

    for (let frame = 0; frame < CONSTANTS.settle.hardExitFrames; frame++) step(state);

    expect(state.phase).not.toBe('settle');
  });

  it('HANDOFF swaps players and rerolls wind exactly once from the seeded RNG', () => {
    const state = createWorld(0x407);
    state.phase = 'handoff';
    const expectedRng = state.rng.clone();
    const expectedWind = Math.round(expectedRng.range(-TERRA.windRange, TERRA.windRange));

    step(state);

    expect(state.phase).toBe('aim');
    expect(state.activePlayer).toBe(1);
    expect(state.wind).toBe(expectedWind);
    expect(state.rng.getState()).toBe(expectedRng.getState());
  });

  it('resolves a double KO as a reachable draw', () => {
    const state = createWorld(0x408);
    const impactX = Math.floor(state.field.width / 2);
    const impactY = Math.floor(state.field.height / 2);
    for (const tank of state.tanks) {
      tank.x = impactX;
      tank.y = impactY - CONSTANTS.tank.damageOriginY;
      tank.health = 1;
    }
    state.pendingImpact = { owner: 0, x: impactX, y: impactY, shell: HE_SHELL };
    state.phase = 'resolve';
    step(state);
    const isSettling = () => state.phase === 'settle';

    for (let frame = 0; frame < CONSTANTS.settle.hardExitFrames && isSettling(); frame++) {
      step(state);
    }

    expect(state.phase).toBe('round_over');
    expect(state.roundResult).toBe('draw');
  });

  it.each([
    [CONSTANTS.damage.fallDamageThresholdPx, 0],
    [CONSTANTS.damage.fallDamageThresholdPx + 1, CONSTANTS.damage.fallDamagePerPx],
  ])('applies integrated fall damage for a %s px landing', (drop, expectedDamage) => {
    const state = createWorld(0x409 + drop);
    const tank = state.tanks[0];
    const startHealth = tank.health;
    tank.fallFrom = tank.y - drop;
    state.phase = 'settle';

    step(state);

    expect(tank.health).toBe(startHealth - expectedDamage);
    expect(tank.fallFrom).toBeNull();
  });

  it('ignores aim adjustments outside AIM', () => {
    const state = createWorld(0x410);
    const angle = state.aim.angleDeg;
    const power = state.aim.power;
    state.phase = 'settle';

    adjustAngle(state, CONSTANTS.elevation.coarseStep);
    adjustPower(state, CONSTANTS.power.coarseStep);

    expect(state.aim).toEqual({ angleDeg: angle, power });
  });

  it('awards the round to the surviving player', () => {
    const state = createWorld(0x411);
    state.tanks[0].health = 0;
    state.phase = 'settle';

    for (let frame = 0; frame < CONSTANTS.settle.hardExitFrames && state.phase === 'settle'; frame++) {
      step(state);
    }

    expect(state.phase).toBe('round_over');
    expect(state.roundResult).toBe(1);
  });
});
