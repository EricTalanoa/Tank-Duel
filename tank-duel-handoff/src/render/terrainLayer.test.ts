import { describe, it, expect } from 'vitest';
import { paintColumns, paintRanges } from './terrainLayer';
import { TERRAIN_BANDS } from './palette';
import { carve, carveWrapped, createTerrain, generate, surfaceY, type Terrain } from '../sim/terrain';
import { createRng } from '../sim/rng';
import { CONSTANTS } from '../sim/constants';

const W = CONSTANTS.defaultFieldWidth;
const H = CONSTANTS.fieldHeight;

function paintedTerrain(seed: number): { terrain: Terrain; pixels: Uint8ClampedArray } {
  const terrain = createTerrain(W, H);
  generate(terrain, 'hills', createRng(seed));
  const pixels = new Uint8ClampedArray(W * H * 4);
  paintColumns(pixels, terrain, 0, W);
  return { terrain, pixels };
}

/** Columns whose pixels differ between two paints. */
function changedColumns(before: Uint8ClampedArray, after: Uint8ClampedArray): number[] {
  const changed = new Set<number>();
  for (let i = 0; i < before.length; i += 4) {
    if (
      before[i] !== after[i] ||
      before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2] ||
      before[i + 3] !== after[i + 3]
    ) {
      changed.add((i / 4) % W);
    }
  }
  return [...changed].sort((a, b) => a - b);
}

/** Index of the first differing byte, or -1. Deep-equals on 2.2M bytes is far too slow. */
function firstDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return -2;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/**
 * First pixel index that would look different, or -1.
 *
 * Cleared pixels keep their old RGB under a zero alpha — `paintColumns` only writes the
 * alpha byte for empty space, so a repainted buffer and a fresh one differ in bytes that
 * cannot affect a single rendered pixel. Compare what is actually visible.
 */
function firstVisibleDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return -2;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return i / 4;
    if (a[i + 3] === 0) continue;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) return i / 4;
  }
  return -1;
}

/** A point buried in the terrain at this column, so a carve there actually removes pixels. */
function buriedAt(terrain: Terrain, x: number): number {
  return Math.min(terrain.height - 1, surfaceY(terrain, x) + 30);
}

describe('terrain repaint bounds', () => {
  it('repaint after a crater touches only columns within the crater x range +/- 1', () => {
    const { terrain, pixels } = paintedTerrain(0xc4a7e);
    const before = pixels.slice();

    const cx = 500;
    const r = 44; // the widest blast in the roster
    const range = carve(terrain, cx, buriedAt(terrain, cx), r);
    paintColumns(pixels, terrain, range.x0, range.x1);

    const changed = changedColumns(before, pixels);
    expect(changed.length).toBeGreaterThan(0);
    expect(Math.min(...changed)).toBeGreaterThanOrEqual(cx - r - 1);
    expect(Math.max(...changed)).toBeLessThanOrEqual(cx + r + 1);
  });

  it('a dirty repaint matches a full repaint pixel for pixel', () => {
    const { terrain, pixels } = paintedTerrain(0xc4a7e);

    const range = carve(terrain, 500, buriedAt(terrain, 500), 44);
    paintColumns(pixels, terrain, range.x0, range.x1);

    const full = new Uint8ClampedArray(W * H * 4);
    paintColumns(full, terrain, 0, W);
    expect(firstVisibleDiff(pixels, full)).toBe(-1);
  });

  it('repaints only the clamped range when a crater sits on the left edge', () => {
    const { terrain, pixels } = paintedTerrain(3);
    const before = pixels.slice();

    const range = carve(terrain, 0, buriedAt(terrain, 0), 44);
    expect(range.x0).toBe(0);
    paintColumns(pixels, terrain, range.x0, range.x1);

    const changed = changedColumns(before, pixels);
    expect(Math.max(...changed)).toBeLessThanOrEqual(45);
  });

  it('leaves carved pixels transparent so the sky shows through', () => {
    const { terrain, pixels } = paintedTerrain(11);
    const cy = buriedAt(terrain, 500);
    const range = carve(terrain, 500, cy, 30);
    paintColumns(pixels, terrain, range.x0, range.x1);
    expect(pixels[(cy * W + 500) * 4 + 3]).toBe(0);
  });

  it('colours by depth from the surface: scrub, then dirt, then bedrock', () => {
    const terrain = createTerrain(4, 400);
    terrain.mask.fill(1);
    const pixels = new Uint8ClampedArray(4 * 400 * 4);
    paintColumns(pixels, terrain, 0, 4);

    const red = (y: number) => pixels[(y * 4 + 0) * 4] as number;
    const near = (a: number, b: number) => Math.abs(a - b) <= 8; // the grain is +/-8

    expect(near(red(0), TERRAIN_BANDS.scrub[0])).toBe(true);
    expect(near(red(20), TERRAIN_BANDS.dirt[0])).toBe(true);
    expect(near(red(399), TERRAIN_BANDS.bedrock[0])).toBe(true);
  });

  it('paints the same pixels for the same terrain — grain is stable across repaints', () => {
    const { pixels: a } = paintedTerrain(42);
    const { pixels: b } = paintedTerrain(42);
    expect(firstDiff(a, b)).toBe(-1);
  });

  it('repaints only split seam ranges and matches a full repaint', () => {
    const terrain = createTerrain(W, H);
    terrain.mask.fill(1);
    const pixels = new Uint8ClampedArray(W * H * 4);
    paintColumns(pixels, terrain, 0, W);
    const before = pixels.slice();

    const ranges = carveWrapped(terrain, 0, H / 2, 44);
    paintRanges(pixels, terrain, ranges);

    expect(ranges).toEqual([{ x0: 0, x1: 46 }, { x0: W - 45, x1: W }]);
    expect(ranges).not.toEqual([{ x0: 0, x1: W }]);
    expect(changedColumns(before, pixels).every((x) => x <= 44 || x >= W - 44)).toBe(true);

    const full = new Uint8ClampedArray(W * H * 4);
    paintColumns(full, terrain, 0, W);
    expect(firstVisibleDiff(pixels, full)).toBe(-1);
  });
});
