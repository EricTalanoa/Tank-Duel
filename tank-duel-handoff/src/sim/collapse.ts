import { EFFECTS } from '../config/effects';
import type { DirtyRange, DirtyRanges, Terrain } from './terrain';

export interface CollapseQueue {
  readonly width: number;
  readonly ranges: DirtyRanges;
  readonly activeCount: number;
}

export interface CollapseStep {
  readonly moved: boolean;
  readonly dirtyRanges: DirtyRanges;
  readonly visitedColumns: readonly number[];
}

export function createCollapseQueue(width: number): CollapseQueue {
  const ranges: DirtyRange[] = [];
  return {
    width,
    get ranges() {
      return ranges;
    },
    get activeCount() {
      let count = 0;
      for (const range of ranges) count += range.x1 - range.x0;
      return count;
    },
  };
}

function queueRanges(queue: CollapseQueue): DirtyRange[] {
  return queue.ranges as DirtyRange[];
}

function replaceQueueRanges(queue: CollapseQueue, next: readonly DirtyRange[]): void {
  const ranges = queueRanges(queue);
  ranges.splice(0, ranges.length, ...next);
}

function normalizeRange(width: number, range: DirtyRange): DirtyRange | null {
  const x0 = Math.max(0, Math.floor(range.x0));
  const x1 = Math.min(width, Math.ceil(range.x1));
  return x1 > x0 ? { x0, x1 } : null;
}

function appendRange(ranges: DirtyRange[], range: DirtyRange): void {
  if (range.x1 <= range.x0) return;
  const last = ranges[ranges.length - 1];
  if (!last) {
    ranges.push(range);
    return;
  }
  if (last.x1 >= range.x0) {
    ranges[ranges.length - 1] = { x0: last.x0, x1: Math.max(last.x1, range.x1) };
    return;
  }
  ranges.push(range);
}

export function enqueueCollapse(queue: CollapseQueue, range: DirtyRange): void {
  const pending = normalizeRange(queue.width, range);
  if (!pending) return;

  const merged: DirtyRange[] = [];
  let next = pending;
  let inserted = false;

  for (const current of queue.ranges) {
    if (current.x1 < next.x0) {
      merged.push(current);
      continue;
    }
    if (next.x1 < current.x0) {
      if (!inserted) {
        merged.push(next);
        inserted = true;
      }
      merged.push(current);
      continue;
    }
    next = { x0: Math.min(next.x0, current.x0), x1: Math.max(next.x1, current.x1) };
  }

  if (!inserted) merged.push(next);
  replaceQueueRanges(queue, merged);
}

/** Enqueue each split dirty interval without activating columns between the intervals. */
export function enqueueCollapseRanges(queue: CollapseQueue, ranges: DirtyRanges): void {
  for (const range of ranges) enqueueCollapse(queue, range);
}

export function stepCollapse(terrain: Terrain, queue: CollapseQueue): CollapseStep {
  const visitedColumns: number[] = [];
  const nextRanges: DirtyRange[] = [];
  let moved = false;

  for (const range of queue.ranges) {
    let movedStart = -1;
    for (let x = range.x0; x < range.x1; x++) {
      visitedColumns.push(x);
      let columnMoved = false;
      for (let pass = 0; pass < EFFECTS.collapse.maxPixelsPerFrame; pass++) {
        let passMoved = false;
        for (let y = terrain.height - 2; y >= 0; y--) {
          const index = y * terrain.width + x;
          const below = index + terrain.width;
          if (terrain.mask[index] === 1 && terrain.mask[below] === 0) {
            terrain.mask[index] = 0;
            terrain.mask[below] = 1;
            passMoved = true;
            columnMoved = true;
          }
        }
        if (!passMoved) break;
      }

      if (columnMoved) {
        moved = true;
        if (movedStart < 0) movedStart = x;
      } else if (movedStart >= 0) {
        appendRange(nextRanges, { x0: movedStart, x1: x });
        movedStart = -1;
      }
    }

    if (movedStart >= 0) appendRange(nextRanges, { x0: movedStart, x1: range.x1 });
  }

  replaceQueueRanges(queue, nextRanges);

  return {
    moved,
    dirtyRanges: moved ? nextRanges : [],
    visitedColumns,
  };
}
