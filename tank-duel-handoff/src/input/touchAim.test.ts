import { describe, expect, it } from 'vitest';
import { mapTouchAim } from './touchAim';

describe('touch aim mapping', () => {
  it('maps right-facing and left-facing diagonal drags to the same displayed angle', () => {
    const range = { min: 10, max: 100 } as const;
    expect(mapTouchAim({ x: 100, y: 200 }, { x: 200, y: 100 }, 1, range, 200).angleDeg)
      .toBeCloseTo(45);
    expect(mapTouchAim({ x: 100, y: 200 }, { x: 0, y: 100 }, -1, range, 200).angleDeg)
      .toBeCloseTo(45);
  });

  it('clamps elevation and maps drag distance across the complete power range', () => {
    const range = { min: 10, max: 100 } as const;
    expect(mapTouchAim({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, range, 200))
      .toEqual({ angleDeg: 0, power: 10 });
    expect(mapTouchAim({ x: 0, y: 0 }, { x: 0, y: -250 }, 1, range, 200))
      .toEqual({ angleDeg: 90, power: 100 });
    expect(mapTouchAim({ x: 0, y: 0 }, { x: -100, y: 20 }, 1, range, 200).angleDeg)
      .toBe(0);
  });
});
