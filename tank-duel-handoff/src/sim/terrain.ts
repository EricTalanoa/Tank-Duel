/**
 * Destructible terrain: one `Uint8Array` bitmask, 1 = solid.
 *
 * Collision is `mask[y * width + x] === 1` and nothing more — O(1), no colliders, no
 * geometry. Carving zeroes a circle and reports the column range that changed so the
 * render layer can repaint just those columns.
 *
 * Pure: no DOM, no Canvas, no `Math.random`. Generation draws from a seeded `Rng`, so the
 * same seed produces a byte-identical mask.
 */
import type { Rng } from './rng';
import { generateHeightmap, type GeneratorId } from './generators';
import { wrapX, wrappedDelta } from './wrap';
export { hillsHeightmap, type GeneratorId } from './generators';

export interface Terrain {
  readonly width: number;
  readonly height: number;
  /** width * height, row-major. 1 = solid. */
  readonly mask: Uint8Array;
}

/** Half-open column range `[x0, x1)`, already clamped to the mask. */
export interface DirtyRange {
  readonly x0: number;
  readonly x1: number;
}

/** Ordered, non-overlapping dirty column intervals. */
export type DirtyRanges = readonly DirtyRange[];

/** Half-open box in field pixels — used to keep `fill` out of tank hulls. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export const EMPTY_RANGE: DirtyRange = Object.freeze({ x0: 0, x1: 0 });

export function createTerrain(width: number, height: number): Terrain {
  return { width, height, mask: new Uint8Array(width * height) };
}

/**
 * Solidity test. Out of bounds horizontally is empty, above the field is empty, and
 * below the field is solid — the floor stops shells rather than swallowing them.
 */
export function solidAt(terrain: Terrain, x: number, y: number): boolean {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || ix >= terrain.width || iy < 0) return false;
  if (iy >= terrain.height) return true;
  return terrain.mask[iy * terrain.width + ix] === 1;
}

/** Solidity test for a horizontally wrapping terrain mask. Vertical rules match `solidAt`. */
export function solidAtWrapped(terrain: Terrain, x: number, y: number): boolean {
  return solidAt(terrain, wrapX(x, terrain.width), y);
}

/** First solid y at this column, or `height` if the column is empty. */
export function surfaceY(terrain: Terrain, x: number): number {
  const ix = x | 0;
  if (ix < 0 || ix >= terrain.width) return terrain.height;
  const { mask, width, height } = terrain;
  for (let y = 0; y < height; y++) {
    if (mask[y * width + ix] === 1) return y;
  }
  return height;
}

/**
 * The column range a circular edit dirties: the circle's own columns plus one either
 * side, clamped. The extra column is what keeps a repaint seam from showing.
 */
function dirtyRangeFor(terrain: Terrain, cx: number, r: number): DirtyRange {
  return {
    x0: Math.max(0, ((cx - r) | 0) - 1),
    x1: Math.min(terrain.width, ((cx + r + 1) | 0) + 1),
  };
}

function wrappedCircleXBounds(cx: number, r: number): DirtyRange {
  return {
    x0: Math.floor(cx - r),
    x1: Math.ceil(cx + r) + 1,
  };
}

function circleYBounds(cy: number, r: number, height: number): DirtyRange {
  return {
    x0: Math.max(0, Math.floor(cy - r)),
    x1: Math.min(height, Math.ceil(cy + r) + 1),
  };
}

/**
 * The dirty column intervals for a wrapping circular edit. A seam crossing stays split so
 * consumers repaint and collapse only the columns actually affected at either edge.
 */
function dirtyRangesForWrapped(terrain: Terrain, cx: number, r: number): DirtyRanges {
  const bounds = wrappedCircleXBounds(cx, r);
  const from = bounds.x0 - 1;
  const to = bounds.x1 + 1;
  const span = to - from;
  if (span >= terrain.width) return [{ x0: 0, x1: terrain.width }];

  const x0 = wrapX(from, terrain.width);
  const x1 = wrapX(to, terrain.width);
  if (x0 < x1) return [{ x0, x1 }];
  if (x0 > x1) return [{ x0: 0, x1 }, { x0, x1: terrain.width }];
  return [];
}

/** Zero a filled circle. Returns the columns to repaint. */
export function carve(terrain: Terrain, cx: number, cy: number, r: number): DirtyRange {
  const { mask, width, height } = terrain;
  const x0 = Math.max(0, (cx - r) | 0);
  const x1 = Math.min(width, (cx + r + 1) | 0);
  const y0 = Math.max(0, (cy - r) | 0);
  const y1 = Math.min(height, (cy + r + 1) | 0);
  const r2 = r * r;

  for (let y = y0; y < y1; y++) {
    const dy = y - cy;
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) mask[row + x] = 0;
    }
  }
  return dirtyRangeFor(terrain, cx, r);
}

/** Zero a filled circle whose horizontal footprint wraps around the terrain seam. */
export function carveWrapped(terrain: Terrain, cx: number, cy: number, r: number): DirtyRanges {
  const { mask, width, height } = terrain;
  const xBounds = wrappedCircleXBounds(cx, r);
  const yBounds = circleYBounds(cy, r, height);
  const r2 = r * r;

  for (let y = yBounds.x0; y < yBounds.x1; y++) {
    const dy = y - cy;
    const row = y * width;
    for (let x = xBounds.x0; x < xBounds.x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy <= r2) mask[row + wrapX(x, width)] = 0;
    }
  }
  return dirtyRangesForWrapped(terrain, cx, r);
}

/** Zero a downward half-open rectangle centered at `cx`. */
export function carveColumn(
  terrain: Terrain,
  cx: number,
  cy: number,
  widthPx: number,
  depthPx: number,
): DirtyRange {
  const x0 = Math.max(0, Math.floor(cx - widthPx / 2));
  const x1 = Math.min(terrain.width, Math.ceil(cx + widthPx / 2));
  const y0 = Math.max(0, Math.floor(cy));
  const y1 = Math.min(terrain.height, y0 + depthPx);
  for (let y = y0; y < y1; y++) {
    terrain.mask.fill(0, y * terrain.width + x0, y * terrain.width + x1);
  }
  return { x0, x1 };
}

/** Zero a downward half-open rectangle whose horizontal footprint wraps at the seam. */
export function carveColumnWrapped(
  terrain: Terrain,
  cx: number,
  cy: number,
  widthPx: number,
  depthPx: number,
): DirtyRanges {
  const x0 = Math.floor(cx - widthPx / 2);
  const x1 = Math.ceil(cx + widthPx / 2);
  const y0 = Math.max(0, Math.floor(cy));
  const y1 = Math.min(terrain.height, y0 + depthPx);
  for (let y = y0; y < y1; y++) {
    const row = y * terrain.width;
    for (let x = x0; x < x1; x++) terrain.mask[row + wrapX(x, terrain.width)] = 0;
  }

  const span = x1 - x0;
  if (span <= 0) return [];
  if (span >= terrain.width) return [{ x0: 0, x1: terrain.width }];
  const wrappedX0 = wrapX(x0, terrain.width);
  const wrappedX1 = wrapX(x1, terrain.width);
  if (wrappedX0 < wrappedX1) return [{ x0: wrappedX0, x1: wrappedX1 }];
  return [
    { x0: 0, x1: wrappedX1 },
    { x0: wrappedX0, x1: terrain.width },
  ].filter((range) => range.x0 < range.x1);
}

/**
 * Set a filled circle solid, skipping any excluded box.
 *
 * `exclusions` is how Sandbags avoids entombing a tank at Task 5. It is deliberately not
 * owner-aware: the firer's own hull goes in the list too, and the resulting wall still
 * blocks the player who built it. See CLAUDE.md non-negotiable 5.
 */
export function fill(
  terrain: Terrain,
  cx: number,
  cy: number,
  r: number,
  exclusions: readonly Box[] = [],
): DirtyRange {
  const { mask, width, height } = terrain;
  const x0 = Math.max(0, (cx - r) | 0);
  const x1 = Math.min(width, (cx + r + 1) | 0);
  const y0 = Math.max(0, (cy - r) | 0);
  const y1 = Math.min(height, (cy + r + 1) | 0);
  const r2 = r * r;

  for (let y = y0; y < y1; y++) {
    const dy = y - cy;
    const row = y * width;
    for (let x = x0; x < x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy > r2) continue;
      let blocked = false;
      for (const box of exclusions) {
        if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) {
          blocked = true;
          break;
        }
      }
      if (!blocked) mask[row + x] = 1;
    }
  }
  return dirtyRangeFor(terrain, cx, r);
}

function insideWrappedBox(x: number, y: number, box: Box, width: number): boolean {
  if (y < box.y0 || y >= box.y1) return false;
  const centre = (box.x0 + box.x1) / 2;
  const nearestX = centre + wrappedDelta(centre, x, width);
  return nearestX >= box.x0 && nearestX < box.x1;
}

/**
 * Set a filled circle solid across the horizontal seam, skipping the nearest wrapped copy
 * of each canonical hull exclusion box.
 */
export function fillWrapped(
  terrain: Terrain,
  cx: number,
  cy: number,
  r: number,
  exclusions: readonly Box[] = [],
): DirtyRanges {
  const { mask, width, height } = terrain;
  const xBounds = wrappedCircleXBounds(cx, r);
  const yBounds = circleYBounds(cy, r, height);
  const r2 = r * r;

  for (let y = yBounds.x0; y < yBounds.x1; y++) {
    const dy = y - cy;
    const row = y * width;
    for (let x = xBounds.x0; x < xBounds.x1; x++) {
      const dx = x - cx;
      if (dx * dx + dy * dy > r2) continue;
      const wrappedX = wrapX(x, width);
      if (!exclusions.some((box) => insideWrappedBox(wrappedX, y, box, width))) {
        mask[row + wrappedX] = 1;
      }
    }
  }
  return dirtyRangesForWrapped(terrain, cx, r);
}

/** Fills `terrain` from a heightmap: solid from the surface down. */
export function fillFromHeightmap(terrain: Terrain, surface: Float32Array): void {
  const { mask, width, height } = terrain;
  mask.fill(0);
  for (let x = 0; x < width; x++) {
    const top = Math.round(surface[x] as number);
    for (let y = top; y < height; y++) mask[y * width + x] = 1;
  }
}

/** Generates terrain in place. Same seed, byte-identical mask. */
export function generate(terrain: Terrain, generator: GeneratorId, rng: Rng): void {
  fillFromHeightmap(terrain, generateHeightmap(terrain.width, terrain.height, generator, rng));
}
