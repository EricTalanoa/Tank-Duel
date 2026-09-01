import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { createWorld, fire, selectShell, step } from './world';
import { carve, fill, solidAt } from './terrain';
import { weaponById } from './weapons';

describe('standard shell world integration', () => {
  it('keeps FLIGHT active for all five Cluster children and queues every impact', () => {
    const state = createWorld(0xc1057e);
    state.aim.angleDeg = CONSTANTS.elevation.maxDisplay;
    state.aim.power = 30;
    expect(selectShell(state, 3)).toBe(true);
    expect(fire(state)).toBe(true);

    let sawSplit = false;
    for (let frame = 0; frame < 600 && state.phase === 'flight'; frame++) {
      step(state);
      if (state.projectiles.length === 5) sawSplit = true;
      expect(state.projectiles.length).toBeLessThanOrEqual(5);
    }

    expect(sawSplit).toBe(true);
    expect(state.phase).toBe('resolve');
    expect(state.pendingImpacts).toHaveLength(5);
    expect(state.pendingImpacts.every((impact) => impact.shell.id === 'cluster')).toBe(true);
  });

  it('never fills a solid pixel inside either tank hull box', () => {
    const state = createWorld(0x5a4d);
    const sand = weaponById('sand').shell;
    const left = state.tanks[0];
    const right = state.tanks[1];
    right.x = left.x + CONSTANTS.tank.hullHalfWidth;
    right.y = left.y;
    const impactX = (left.x + right.x) / 2;
    const impactY = left.y + CONSTANTS.tank.hullTop / 2;
    carve(state.terrain, impactX, impactY, sand.blastRadius);
    state.pendingImpact = { owner: 0, x: impactX, y: impactY, shell: sand };
    state.phase = 'resolve';

    step(state);

    for (const tank of state.tanks) {
      for (let y = tank.y + CONSTANTS.tank.hullTop; y < tank.y + CONSTANTS.tank.hullBottom; y++) {
        for (let x = tank.x - CONSTANTS.tank.hullHalfWidth; x < tank.x + CONSTANTS.tank.hullHalfWidth; x++) {
          expect(solidAt(state.terrain, x, y)).toBe(false);
        }
      }
    }
    expect(solidAt(state.terrain, impactX, impactY - sand.blastRadius + 1)).toBe(true);
  });

  it('digs a tank buried by Sandbags upward before gravity in one settle frame', () => {
    const state = createWorld(0xd16007);
    const tank = state.tanks[0];
    const sand = weaponById('sand').shell;
    fill(
      state.terrain,
      tank.x,
      tank.y + CONSTANTS.tank.damageOriginY,
      sand.blastRadius,
    );
    const beforeY = tank.y;
    state.phase = 'settle';

    step(state);

    expect(tank.y).toBeLessThan(beforeY);
    expect(solidAt(state.terrain, tank.x, tank.y + CONSTANTS.tank.damageOriginY)).toBe(false);
    expect(tank.vy).toBe(0);
  });
});
