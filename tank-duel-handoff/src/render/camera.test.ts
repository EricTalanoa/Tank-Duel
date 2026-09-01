import { describe, expect, test } from 'vitest';
import type { GameState } from '../sim/world';
import { cameraForState } from './camera';
import { launchProjectile, stepProjectile } from '../sim/ballistics';
import { HE_SHELL } from '../sim/shells';
import { CONSTANTS } from '../sim/constants';
import { HOLLOW, TERRA } from '../sim/worlds';

const TEST_FIELD_WIDTH = TERRA.width * 2;

function state(overrides: Partial<GameState>): GameState {
  return {
    field: { width: TEST_FIELD_WIDTH, height: CONSTANTS.fieldHeight },
    phase: 'aim',
    tanks: [
      { x: CONSTANTS.spawnInsetPx, y: 420 },
      { x: TEST_FIELD_WIDTH - CONSTANTS.spawnInsetPx, y: 430 },
    ],
    projectile: null,
    world: { wrap: false },
    ...overrides,
  } as unknown as GameState;
}

describe('camera policy', () => {
  test('AIM frames both tanks', () => {
    const view = cameraForState(state({}), {
      width: CONSTANTS.defaultFieldWidth,
      height: CONSTANTS.fieldHeight,
    });
    expect(view.x).toBeLessThanOrEqual(CONSTANTS.spawnInsetPx);
    expect(view.x + view.width).toBeGreaterThanOrEqual(TEST_FIELD_WIDTH - CONSTANTS.spawnInsetPx);
  });

  test('FLIGHT follows the active projectile', () => {
    const leftX = TEST_FIELD_WIDTH / 4;
    const rightX = TEST_FIELD_WIDTH * 3 / 4;
    const left = cameraForState(state({ phase: 'flight', projectile: { x: leftX, y: 200 } as GameState['projectile'] }), { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight });
    const right = cameraForState(state({ phase: 'flight', projectile: { x: rightX, y: 200 } as GameState['projectile'] }), { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight });
    expect(right.x).toBeGreaterThan(left.x);
    expect(right.x + right.width / 2).toBeCloseTo(rightX, 5);
  });

  test.each([HOLLOW.width + 100, HOLLOW.width * 3 + 100])('wrapped FLIGHT stays centered on unbounded projectile x=%s', (x) => {
    const view = cameraForState(state({
      field: { width: HOLLOW.width, height: CONSTANTS.fieldHeight },
      world: { wrap: true } as GameState['world'],
      phase: 'flight',
      projectile: { x, y: 200 } as GameState['projectile'],
    }), { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight });

    expect(view.x + view.width / 2).toBe(x);
    expect(view.y).toBe(0);
    expect(view.y + view.height).toBe(CONSTANTS.fieldHeight);
  });

  test('wrapped AIM frames the opponent copy nearest the active tank', () => {
    const seamInset = 50;
    const view = cameraForState(state({
      field: { width: HOLLOW.width, height: CONSTANTS.fieldHeight },
      world: { wrap: true } as GameState['world'],
      tanks: [
        { x: seamInset, y: 420 },
        { x: HOLLOW.width - seamInset, y: 430 },
      ] as GameState['tanks'],
      activePlayer: 0,
    }), { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight });

    expect(view).toEqual({
      x: -seamInset - CONSTANTS.camera.aimPaddingPx,
      y: 0,
      width: (seamInset + CONSTANTS.camera.aimPaddingPx) * 2,
      height: CONSTANTS.fieldHeight,
    });
  });

  test.each([{ x: -100, y: -100 }, { x: TEST_FIELD_WIDTH + 80, y: CONSTANTS.fieldHeight + 140 }])('never leaves a non-wrap field near $x,$y', (point) => {
    const view = cameraForState(state({ phase: 'flight', projectile: point as GameState['projectile'] }), { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight });
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.y).toBeGreaterThanOrEqual(0);
    expect(view.x + view.width).toBeLessThanOrEqual(TEST_FIELD_WIDTH);
    expect(view.y + view.height).toBeLessThanOrEqual(CONSTANTS.fieldHeight);
  });

  test('recomputing the camera at a resized viewport cannot alter an in-flight trajectory', () => {
    const first = launchProjectile({ x: 150, y: 400, angleDeg: 45, power: 75, direction: 1, shell: HE_SHELL, owner: 0 });
    const second = launchProjectile({ x: 150, y: 400, angleDeg: 45, power: 75, direction: 1, shell: HE_SHELL, owner: 0 });
    for (let frame = 0; frame < 40; frame++) {
      cameraForState(state({ field: { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight }, phase: 'flight', projectile: first }), frame < 20 ? { width: CONSTANTS.defaultFieldWidth, height: CONSTANTS.fieldHeight } : { width: 640, height: 900 });
      stepProjectile(first, { world: TERRA, wind: 0, solidAt: () => false });
      stepProjectile(second, { world: TERRA, wind: 0, solidAt: () => false });
    }
    expect({ x: first.x, y: first.y, vx: first.vx, vy: first.vy }).toEqual({ x: second.x, y: second.y, vx: second.vx, vy: second.vy });
  });
});
