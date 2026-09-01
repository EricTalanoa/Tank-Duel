import { describe, expect, it } from 'vitest';
import { carveColumn, createTerrain } from './terrain';
import { weaponById } from './weapons';

describe('Drill column terrain effect', () => {
  const hook = weaponById('drill').hooks.onTerrainHit;
  if (!hook || hook.type !== 'drillColumn') throw new Error('Drill hook missing');

  it.each([
    ['center', 50, 20],
    ['left edge', 0, 20],
    ['right edge', 99, 20],
    ['floor', 50, 95],
  ] as const)('clamps its spec-sized rectangle at the %s', (_label, cx, cy) => {
    const terrain = createTerrain(100, 100);
    terrain.mask.fill(1);
    const dirty = carveColumn(terrain, cx, cy, hook.widthPx, hook.depthPx);
    const x0 = Math.max(0, Math.floor(cx - hook.widthPx / 2));
    const x1 = Math.min(terrain.width, Math.ceil(cx + hook.widthPx / 2));
    const y0 = Math.max(0, Math.floor(cy));
    const y1 = Math.min(terrain.height, y0 + hook.depthPx);
    let cleared = 0;
    for (let y = 0; y < terrain.height; y++) for (let x = 0; x < terrain.width; x++) {
      const expected = x >= x0 && x < x1 && y >= y0 && y < y1;
      if (terrain.mask[y * terrain.width + x] === 0) cleared++;
      expect(terrain.mask[y * terrain.width + x] === 0).toBe(expected);
    }
    expect(cleared).toBe((x1 - x0) * (y1 - y0));
    expect(dirty).toEqual({ x0, x1 });
  });
});
