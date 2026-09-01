/**
 * Fixed-timestep accumulator. Pure: it takes elapsed wall-clock seconds and reports how
 * many `DT` steps are owed. `main.ts` owns requestAnimationFrame; this owns the arithmetic,
 * which is what makes the clamp testable headlessly.
 *
 * The sim is NEVER stepped with a variable dt — see CLAUDE.md non-negotiable 1.
 */
import { SIM_HZ } from './constants';

/** Seconds per simulation step. */
export const DT = 1 / SIM_HZ;

/**
 * Longest wall-clock gap a single frame may contribute. A backgrounded tab returns with
 * seconds of elapsed time; without this clamp the loop would fast-forward the match.
 * Clamped, it simply runs slow for a moment and catches up.
 */
export const MAX_FRAME_SECONDS = 0.25;

/** Most steps one pump can ever return, given the clamp. */
export const MAX_STEPS_PER_FRAME = Math.floor(MAX_FRAME_SECONDS / DT);

export interface Clock {
  /** Unconsumed time, always < DT after a pump. */
  accumulator: number;
  /** Steps taken over this clock's lifetime. */
  steps: number;
}

export function createClock(): Clock {
  return { accumulator: 0, steps: 0 };
}

/**
 * Bank `elapsedSeconds` and return how many fixed steps to run now.
 * Negative gaps (clock skew) contribute nothing.
 */
export function pump(clock: Clock, elapsedSeconds: number): number {
  const clamped = Math.min(Math.max(elapsedSeconds, 0), MAX_FRAME_SECONDS);
  clock.accumulator += clamped;

  let steps = 0;
  while (clock.accumulator >= DT) {
    clock.accumulator -= DT;
    steps++;
  }
  clock.steps += steps;
  return steps;
}

/** Fraction of the way into the next step, for render interpolation. */
export function alpha(clock: Clock): number {
  return clock.accumulator / DT;
}
