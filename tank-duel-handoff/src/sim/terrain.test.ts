import { describe, it, expect } from 'vitest';
import {
  createTerrain,
  carve,
  carveWrapped,
  carveColumnWrapped,
  fill,
  fillWrapped,
  solidAt,
  solidAtWrapped,
  surfaceY,
  generate,
  hillsHeightmap,
  type Terrain,
} from './terrain';
import { createRng } from './rng';
import { CONSTANTS } from './constants';

const W = CONSTANTS.defaultFieldWidth;
const H = CONSTANTS.fieldHeight;

/**
 * Masks run to hundreds of thousands of bytes, so these tests reduce a whole scan to one
 * assertion rather than calling expect() per pixel — the latter takes seconds per test.
 */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return -2;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

function solidTerrain(width = W, height = H): Terrain {
  const terrain = createTerrain(width, height);
  terrain.mask.fill(1);
  return terrain;
}

/** Terrain whose mask is a window into a larger buffer, so writes past either end show up. */
function guardedTerrain(
  width: number,
  height: number,
  guard = 64,
): { terrain: Terrain; guardsIntact(): boolean } {
  const buffer = new Uint8Array(guard + width * height + guard).fill(9);
  const mask = buffer.subarray(guard, guard + width * height);
  mask.fill(1);
  const terrain: Terrain = { width, height, mask };
  return {
    terrain,
    guardsIntact: () =>
      buffer.subarray(0, guard).every((v) => v === 9) &&
      buffer.subarray(guard + width * height).every((v) => v === 9),
  };
}

/** First column in `[x0, x1)` that is not solid top to bottom, or -1. */
function firstNonSolidColumn(terrain: Terrain, x0: number, x1: number): number {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < terrain.height; y++) {
      if (terrain.mask[y * terrain.width + x] !== 1) return x;
    }
  }
  return -1;
}

function solidColumnsAtRow(terrain: Terrain, y: number): number[] {
  const columns: number[] = [];
  for (let x = 0; x < terrain.width; x++) {
    if (terrain.mask[y * terrain.width + x] === 1) columns.push(x);
  }
  return columns;
}

function nonSolidColumnsAtRow(terrain: Terrain, y: number): number[] {
  const columns: number[] = [];
  for (let x = 0; x < terrain.width; x++) {
    if (terrain.mask[y * terrain.width + x] !== 1) columns.push(x);
  }
  return columns;
}

describe('terrain mask', () => {
  it('reads out of bounds without throwing, and treats below the field as floor', () => {
    const terrain = solidTerrain(64, 32);
    expect(solidAt(terrain, -1, 10)).toBe(false);
    expect(solidAt(terrain, 64, 10)).toBe(false);
    expect(solidAt(terrain, 10, -1)).toBe(false);
    expect(solidAt(terrain, 10, 32)).toBe(true); // the floor stops shells
    expect(solidAt(terrain, 10, 10)).toBe(true);
  });

  it('reports the first solid row, or height for an empty column', () => {
    const terrain = createTerrain(8, 8);
    for (let y = 5; y < 8; y++) terrain.mask[y * 8 + 3] = 1;
    expect(surfaceY(terrain, 3)).toBe(5);
    expect(surfaceY(terrain, 4)).toBe(8);
    expect(surfaceY(terrain, -1)).toBe(8);
  });
});

describe('wrapped terrain primitives', () => {
  it('reads either edge through unbounded horizontal coordinates while retaining solidAt vertical rules', () => {
    const terrain = createTerrain(20, 10);
    terrain.mask[5 * terrain.width] = 1;
    terrain.mask[5 * terrain.width + terrain.width - 1] = 1;

    expect(solidAtWrapped(terrain, 20, 5)).toBe(true);
    expect(solidAtWrapped(terrain, -1, 5)).toBe(true);
    expect(solidAtWrapped(terrain, 20, -1)).toBe(false);
    expect(solidAtWrapped(terrain, -1, 10)).toBe(true);
  });

  it('carves across both seam edges without corrupting untouched middle columns', () => {
    const { terrain, guardsIntact } = guardedTerrain(20, 10);

    const ranges = carveWrapped(terrain, 0, 5, 2);

    expect(ranges).toEqual([{ x0: 0, x1: 4 }, { x0: 17, x1: 20 }]);
    expect(solidAt(terrain, 0, 5)).toBe(false);
    expect(solidAt(terrain, 19, 5)).toBe(false);
    expect(firstNonSolidColumn(terrain, 3, 17)).toBe(-1);
    expect(guardsIntact()).toBe(true);
  });

  it('carveWrapped preserves >2^31 centres as the same canonical seam write and dirty ranges', () => {
    const { terrain, guardsIntact } = guardedTerrain(20, 10);

    const ranges = carveWrapped(terrain, 2 ** 31 + 10, 5, 3);

    expect(ranges).toEqual([{ x0: 0, x1: 3 }, { x0: 14, x1: 20 }]);
    expect(nonSolidColumnsAtRow(terrain, 5)).toEqual([0, 1, 15, 16, 17, 18, 19]);
    expect(solidColumnsAtRow(terrain, 5).slice(0, 3)).toEqual([2, 3, 4]);
    expect(guardsIntact()).toBe(true);
  });

  it('fills through the seam while keeping a canonical hull exclusion empty at its wrapped copy', () => {
    const terrain = createTerrain(20, 10);

    const ranges = fillWrapped(terrain, 19, 5, 3, [{ x0: 0, y0: 4, x1: 2, y1: 7 }]);

    expect(ranges).toEqual([{ x0: 0, x1: 4 }, { x0: 15, x1: 20 }]);
    expect(solidAt(terrain, 19, 5)).toBe(true);
    expect(solidAt(terrain, 2, 5)).toBe(true);
    expect(solidAt(terrain, 0, 5)).toBe(false);
    expect(solidAt(terrain, 1, 5)).toBe(false);
  });

  it('fillWrapped preserves large negative centres as the same canonical seam write and dirty ranges', () => {
    const terrain = createTerrain(20, 10);

    const ranges = fillWrapped(terrain, -(2 ** 31) - 13, 5, 2);

    expect(ranges).toEqual([{ x0: 0, x1: 3 }, { x0: 16, x1: 20 }]);
    expect(solidColumnsAtRow(terrain, 5)).toEqual([0, 1, 17, 18, 19]);
    expect(solidColumnsAtRow(terrain, 4)).toEqual([0, 18, 19]);
  });

  it('carves a wrapped column across both seam edges and returns split dirty ranges', () => {
    const terrain = solidTerrain(20, 12);

    const ranges = carveColumnWrapped(terrain, 19, 2, 6, 4);

    expect(ranges).toEqual([{ x0: 0, x1: 2 }, { x0: 16, x1: 20 }]);
    expect(solidAt(terrain, 0, 2)).toBe(false);
    expect(solidAt(terrain, 19, 5)).toBe(false);
    expect(solidAt(terrain, 10, 2)).toBe(true);
  });

  it('does not emit an empty dirty range when a wrapped column ends exactly at the seam', () => {
    const terrain = solidTerrain(20, 12);

    const ranges = carveColumnWrapped(terrain, 18, 2, 4, 4);

    expect(ranges).toEqual([{ x0: 16, x1: 20 }]);
    expect(solidAt(terrain, 16, 2)).toBe(false);
    expect(solidAt(terrain, 19, 5)).toBe(false);
    expect(solidAt(terrain, 0, 2)).toBe(true);
  });
});

describe('carve at the mask edges', () => {
  const r = 26;

  it('carving at x=0 writes nothing outside the mask and does not wrap into the far edge', () => {
    const { terrain, guardsIntact } = guardedTerrain(W, H);
    carve(terrain, 0, H / 2, r);

    expect(guardsIntact()).toBe(true);
    // A row-wrapping write would land on the last columns of the previous row.
    expect(firstNonSolidColumn(terrain, r + 1, W)).toBe(-1);
    expect(solidAt(terrain, 0, H / 2)).toBe(false);
  });

  it('carving at x=width-1 writes nothing outside the mask and does not wrap into column 0', () => {
    const { terrain, guardsIntact } = guardedTerrain(W, H);
    carve(terrain, W - 1, H / 2, r);

    expect(guardsIntact()).toBe(true);
    expect(firstNonSolidColumn(terrain, 0, W - r - 1)).toBe(-1);
    expect(solidAt(terrain, W - 1, H / 2)).toBe(false);
  });

  it('carving at the top and bottom edges stays inside the mask', () => {
    const { terrain, guardsIntact } = guardedTerrain(W, H);
    carve(terrain, W / 2, 0, r);
    carve(terrain, W / 2, H - 1, r);
    expect(guardsIntact()).toBe(true);
    expect(solidAt(terrain, W / 2, 0)).toBe(false);
    expect(solidAt(terrain, W / 2, H - 1)).toBe(false);
  });

  it('clears exactly the circle and nothing beside it', () => {
    const terrain = solidTerrain(200, 200);
    const cx = 100;
    const cy = 100;
    carve(terrain, cx, cy, 20);

    const wrong: string[] = [];
    for (let y = 0; y < 200 && wrong.length < 5; y++) {
      for (let x = 0; x < 200; x++) {
        const inside = (x - cx) ** 2 + (y - cy) ** 2 <= 400;
        if ((terrain.mask[y * 200 + x] === 0) !== inside) wrong.push(`${x},${y}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('reports the crater columns plus one either side, clamped to the mask', () => {
    const terrain = solidTerrain(200, 200);
    expect(carve(terrain, 100, 100, 20)).toEqual({ x0: 79, x1: 122 });
    expect(carve(terrain, 0, 100, 20)).toEqual({ x0: 0, x1: 22 });
    expect(carve(terrain, 199, 100, 20)).toEqual({ x0: 178, x1: 200 });
  });
});

describe('fill', () => {
  it('sets a solid circle and reports the same dirty range as carve', () => {
    const terrain = createTerrain(200, 200);
    const range = fill(terrain, 100, 100, 20);
    expect(range).toEqual({ x0: 79, x1: 122 });
    expect(solidAt(terrain, 100, 100)).toBe(true);
    expect(solidAt(terrain, 100, 130)).toBe(false);
  });

  it('writes nothing outside the mask at the edges', () => {
    const { terrain, guardsIntact } = guardedTerrain(W, H);
    terrain.mask.fill(0);
    fill(terrain, 0, 0, 30);
    fill(terrain, W - 1, H - 1, 30);
    expect(guardsIntact()).toBe(true);
  });

  it('never writes a solid pixel inside an excluded box', () => {
    const terrain = createTerrain(200, 200);
    const box = { x0: 90, y0: 90, x1: 110, y1: 110 };
    fill(terrain, 100, 100, 30, [box]);

    const inside: number[] = [];
    for (let y = box.y0; y < box.y1; y++) {
      for (let x = box.x0; x < box.x1; x++) {
        if (terrain.mask[y * 200 + x] !== 0) inside.push(y * 200 + x);
      }
    }
    expect(inside).toEqual([]);
    expect(solidAt(terrain, 100, 75)).toBe(true); // still filled outside the box
  });
});

describe('hills generator', () => {
  it('produces a byte-identical mask for the same seed', () => {
    const a = createTerrain(W, H);
    const b = createTerrain(W, H);
    generate(a, 'hills', createRng(0x51ee7));
    generate(b, 'hills', createRng(0x51ee7));
    expect(firstDiff(a.mask, b.mask)).toBe(-1);
  });

  it('produces a different mask for a different seed', () => {
    const a = createTerrain(W, H);
    const b = createTerrain(W, H);
    generate(a, 'hills', createRng(1));
    generate(b, 'hills', createRng(2));
    expect(firstDiff(a.mask, b.mask)).toBeGreaterThanOrEqual(0);
  });

  it('is solid from the surface down, with no floating pixels', () => {
    const terrain = createTerrain(W, H);
    generate(terrain, 'hills', createRng(99));

    const gaps: number[] = [];
    for (let x = 0; x < W; x++) {
      const top = surfaceY(terrain, x);
      if (top >= H) gaps.push(x);
      for (let y = top; y < H; y++) {
        if (terrain.mask[y * W + x] !== 1) {
          gaps.push(x);
          break;
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('keeps the surface inside its bounds on every column', () => {
    const outOfBounds: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const v of hillsHeightmap(W, H, createRng(seed))) {
        if (v < H * 0.3 || v > H - 46) outOfBounds.push(v);
      }
    }
    expect(outOfBounds).toEqual([]);
  });

  it('takes its dimensions from the terrain, not a hardcoded field size', () => {
    const terrain = createTerrain(320, 240);
    generate(terrain, 'hills', createRng(7));
    expect(terrain.mask.length).toBe(320 * 240);
    expect(surfaceY(terrain, 319)).toBeLessThan(240);
  });
});
