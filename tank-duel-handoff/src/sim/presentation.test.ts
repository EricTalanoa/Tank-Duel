import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { drainPresentationEvents, pointInHull } from './presentation';
import { HE_SHELL } from './shells';
import { createWorld, fire, step } from './world';

describe('presentation events', () => {
  it('emits one muzzle flash only after a successful fire', () => {
    const state = createWorld(61);
    expect(fire(state)).toBe(true);
    expect(fire(state)).toBe(false);
    const events = drainPresentationEvents(state.presentationEvents);
    expect(events.filter((event) => event.type === 'muzzleFlash')).toHaveLength(1);
    expect(state.presentationEvents).toHaveLength(0);
  });

  it('emits an impact and direct hit for a point inside either hull', () => {
    const state = createWorld(62);
    const tank = state.tanks[1];
    state.pendingImpact = { owner: 0, x: tank.x, y: tank.y + CONSTANTS.tank.hullTop, shell: HE_SHELL };
    state.phase = 'resolve';
    step(state);
    const events = drainPresentationEvents(state.presentationEvents);
    expect(events.filter((event) => event.type === 'impact')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'directHit')).toEqual([
      expect.objectContaining({ type: 'directHit', player: 1, shellId: 'he' }),
    ]);
  });

  it('uses half-open hull geometry', () => {
    const state = createWorld(63);
    const tank = state.tanks[0];
    expect(pointInHull(tank, tank.x - CONSTANTS.tank.hullHalfWidth, tank.y + CONSTANTS.tank.hullTop)).toBe(true);
    expect(pointInHull(tank, tank.x + CONSTANTS.tank.hullHalfWidth, tank.y)).toBe(false);
    expect(pointInHull(tank, tank.x, tank.y + CONSTANTS.tank.hullBottom)).toBe(false);
  });

  it('tests the nearest wrapped hull copy when a world width is supplied', () => {
    const state = createWorld(64, { worldId: 'hollow' });
    const tank = state.tanks[1];
    tank.x = state.field.width - 4;

    expect(pointInHull(tank, -5, tank.y, state.field.width)).toBe(true);
    expect(pointInHull(tank, -5, tank.y)).toBe(false);
  });
});
