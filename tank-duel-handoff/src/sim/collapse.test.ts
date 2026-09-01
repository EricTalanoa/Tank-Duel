import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../render/effectConfig';
import { createCollapseQueue, enqueueCollapse, enqueueCollapseRanges, stepCollapse } from './collapse';
import { createTerrain } from './terrain';
import { HE_SHELL } from './shells';
import { createWorld, step } from './world';

describe('dirty-column terrain collapse', () => {
  it('visits only queued columns and moves terrain by at most the configured cap', () => {
    const terrain = createTerrain(8, 8);
    terrain.mask[1 * terrain.width + 2] = 1;
    terrain.mask[1 * terrain.width + 7] = 1;
    const queue = createCollapseQueue(terrain.width);
    enqueueCollapse(queue, { x0: 2, x1: 3 });

    const result = stepCollapse(terrain, queue);

    expect(result.visitedColumns).toEqual([2]);
    expect(result.moved).toBe(true);
    expect(terrain.mask[1 * terrain.width + 2]).toBe(0);
    expect(terrain.mask[(1 + EFFECTS.collapse.maxPixelsPerFrame) * terrain.width + 2]).toBe(1);
    expect(terrain.mask[1 * terrain.width + 7]).toBe(1);
  });

  it('removes a column from the queue after a quiet pass', () => {
    const terrain = createTerrain(4, 4);
    terrain.mask[3 * terrain.width + 1] = 1;
    const queue = createCollapseQueue(terrain.width);
    enqueueCollapse(queue, { x0: 1, x1: 2 });
    expect(stepCollapse(terrain, queue).moved).toBe(false);
    expect(queue.activeCount).toBe(0);
  });

  it('stores only active canonical intervals in ascending order', () => {
    const queue = createCollapseQueue(10);

    enqueueCollapseRanges(queue, [{ x0: 8, x1: 10 }, { x0: 0, x1: 2 }, { x0: 3, x1: 5 }]);

    expect(queue.ranges).toEqual([{ x0: 0, x1: 2 }, { x0: 3, x1: 5 }, { x0: 8, x1: 10 }]);
    expect(queue.activeCount).toBe(6);
  });

  it('enqueues split dirty intervals without scanning the untouched middle columns', () => {
    const terrain = createTerrain(10, 8);
    terrain.mask[1 * terrain.width] = 1;
    terrain.mask[1 * terrain.width + 9] = 1;
    const queue = createCollapseQueue(terrain.width);

    enqueueCollapseRanges(queue, [{ x0: 0, x1: 2 }, { x0: 8, x1: 10 }]);
    const result = stepCollapse(terrain, queue);

    expect(queue.ranges).toEqual([{ x0: 0, x1: 1 }, { x0: 9, x1: 10 }]);
    expect(result.visitedColumns).toEqual([0, 1, 8, 9]);
    expect(result.dirtyRanges).toEqual([{ x0: 0, x1: 1 }, { x0: 9, x1: 10 }]);
    expect('dirty' in result).toBe(false);
    expect(result.moved).toBe(true);
    expect(terrain.mask[1 * terrain.width + 9]).toBe(0);
    expect(terrain.mask[1 * terrain.width + 5]).toBe(0);
  });

  it('queues only an impact dirty range for collapse during RESOLVE', () => {
    const state = createWorld(71);
    state.pendingImpact = { owner: 0, x: 500, y: 350, shell: HE_SHELL };
    state.phase = 'resolve';
    step(state);
    expect(state.collapseQueue.activeCount).toBeGreaterThan(0);
    expect(state.collapseQueue.activeCount).toBeLessThan(state.field.width);
  });
});
