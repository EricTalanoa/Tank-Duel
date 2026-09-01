import { describe, expect, test } from 'vitest';
import { createRng } from './rng';
import {
  SHIPPED_GENERATORS,
  generateHeightmap,
  resolveGeneratorId,
} from './generators';
import { CONSTANTS } from './constants';
import { HOLLOW } from './worlds';

function values(surface: Float32Array): number[] {
  return Array.from(surface);
}

describe('Task 9 generator registry', () => {
  test('ships Ring and forces it for a seamless world fallback', () => {
    expect(SHIPPED_GENERATORS).toEqual(['hills', 'canyon', 'craters', 'plates', 'spires', 'ring']);
    expect(resolveGeneratorId('ring', 'hills')).toBe('ring');
    expect(resolveGeneratorId('spires', 'hills')).toBe('spires');
    expect(resolveGeneratorId('spires', 'ring')).toBe('ring');
  });

  test.each(SHIPPED_GENERATORS)('%s is byte-deterministic for a seed', (id) => {
    const first = generateHeightmap(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      id,
      createRng(1597),
    );
    const second = generateHeightmap(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      id,
      createRng(1597),
    );
    expect(values(first)).toEqual(values(second));
  });

  test('canyon pulls the centre lower than its rims', () => {
    const width = CONSTANTS.defaultFieldWidth;
    const h = generateHeightmap(width, CONSTANTS.fieldHeight, 'canyon', createRng(1597));
    expect(h[width / 2]).toBeGreaterThan(h[width / 10] as number);
    expect(h[width / 2]).toBeGreaterThan(h[width - width / 10] as number);
  });

  test('plates quantises every column to the configured step', () => {
    const h = generateHeightmap(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      'plates',
      createRng(1597),
    );
    const unique = new Set(values(h).map((height) => height.toFixed(4)));
    expect(unique.size).toBeLessThan(10);
  });

  test('spires produce a substantially higher peak than the floor', () => {
    const h = values(generateHeightmap(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      'spires',
      createRng(1597),
    ));
    expect(Math.max(...h) - Math.min(...h)).toBeGreaterThan(100);
  });

  test('Ring is deterministic and joins with a natural non-flat seam', () => {
    const width = HOLLOW.width;
    const h = generateHeightmap(width, CONSTANTS.fieldHeight, 'ring', createRng(2));
    const again = generateHeightmap(width, CONSTANTS.fieldHeight, 'ring', createRng(2));
    const meanStep = values(h).slice(1)
      .reduce((total, value, x) => total + Math.abs(value - (h[x] as number)), 0) / (width - 1);
    const seamStep = Math.abs((h[width - 1] as number) - (h[0] as number));

    expect(values(h)).toEqual(values(again));
    expect(seamStep).toBeGreaterThan(0);
    expect(seamStep).toBeLessThanOrEqual(meanStep);
  });
});
