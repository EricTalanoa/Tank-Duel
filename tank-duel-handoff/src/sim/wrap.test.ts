import { describe, expect, it } from 'vitest';
import {
  nearestWrappedX,
  visibleCopyRange,
  wrapX,
  wrappedDelta,
} from './wrap';

describe('shared wrap coordinate helpers', () => {
  it('normalizes negative and boundary coordinates into the world interval', () => {
    expect(wrapX(-1, 1200)).toBe(1199);
    expect(wrapX(1200, 1200)).toBe(0);
    expect(wrapX(2401, 1200)).toBe(1);
  });

  it('returns the shortest signed displacement across a seam', () => {
    expect(wrappedDelta(1100, 200, 1200)).toBe(300);
    expect(wrappedDelta(200, 1100, 1200)).toBe(-300);
  });

  it('chooses the nearest copy even when the reference is several laps away', () => {
    expect(nearestWrappedX(100, 3700, 1200)).toBe(3700);
    expect(nearestWrappedX(1100, -2500, 1200)).toBe(-2500);
  });

  it('returns exactly the world tiles intersecting a half-open camera interval', () => {
    expect(visibleCopyRange(0, 1200, 1200)).toEqual({ first: 0, last: 0 });
    expect(visibleCopyRange(100, 1200, 1200)).toEqual({ first: 0, last: 1 });
    expect(visibleCopyRange(1200, 1200, 1200)).toEqual({ first: 1, last: 1 });
    expect(visibleCopyRange(-100, 200, 1200)).toEqual({ first: -1, last: 0 });
  });

  it('rejects non-positive and non-finite widths for every helper', () => {
    const helpers = [
      (width: number) => wrapX(1, width),
      (width: number) => wrappedDelta(1, 2, width),
      (width: number) => nearestWrappedX(1, 2, width),
      (width: number) => visibleCopyRange(0, 1, width),
    ];

    for (const helper of helpers) {
      expect(() => helper(0)).toThrow(/width must be a finite number greater than 0/);
      expect(() => helper(-1)).toThrow(/width must be a finite number greater than 0/);
      expect(() => helper(Number.NaN)).toThrow(/width must be a finite number greater than 0/);
      expect(() => helper(Number.POSITIVE_INFINITY)).toThrow(
        /width must be a finite number greater than 0/,
      );
    }
  });
});
