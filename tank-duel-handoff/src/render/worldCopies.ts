import { visibleCopyRange } from '../sim/wrap';

export interface HorizontalView {
  readonly x: number;
  readonly width: number;
}

/**
 * Finite tile offsets whose half-open world intervals intersect the camera view.
 * `overflowPx` expands the selection for canonical visuals that can draw beyond a tile.
 */
export function worldCopyOffsets(
  view: HorizontalView,
  worldWidth: number,
  overflowPx = 0,
): readonly number[] {
  const overflow = Math.max(0, overflowPx);
  const { first, last } = visibleCopyRange(
    view.x - overflow,
    view.width + overflow * 2,
    worldWidth,
  );
  return Array.from(
    { length: last - first + 1 },
    (_, index) => (first + index) * worldWidth,
  );
}
