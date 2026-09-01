import { describe, it, expect } from 'vitest';
import { createClock, pump, alpha, DT, MAX_FRAME_SECONDS, MAX_STEPS_PER_FRAME } from './clock';
import { createWorld, step, simSeconds } from './world';

describe('fixed-timestep clock', () => {
  it('clamps a 5 second frame gap to at most 250 ms of steps', () => {
    const clock = createClock();
    const steps = pump(clock, 5);

    expect(steps).toBe(MAX_STEPS_PER_FRAME);
    expect(steps * DT).toBeLessThanOrEqual(MAX_FRAME_SECONDS + 1e-9);
  });

  it('advances the sim by at most 250 ms across a 5 second stall', () => {
    const state = createWorld(1);
    const clock = createClock();

    // One rAF callback arriving 5 seconds late, as after an alt-tab.
    for (let i = 0; i < pump(clock, 5); i++) step(state);

    expect(simSeconds(state)).toBeLessThanOrEqual(MAX_FRAME_SECONDS + 1e-9);
    expect(state.frame).toBe(MAX_STEPS_PER_FRAME);
  });

  it('never returns more than the clamp allows, whatever the accumulator held', () => {
    const clock = createClock();
    pump(clock, DT * 0.99); // leave a near-full step banked
    expect(pump(clock, 60)).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME);
  });

  it('runs one step per frame at 60 Hz and stays in step over a second', () => {
    const clock = createClock();
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += pump(clock, 1 / 60);
    expect(steps).toBe(60);
  });

  it('runs two steps per frame at 30 Hz — the sim rate is independent of frame rate', () => {
    const clock = createClock();
    let steps = 0;
    for (let i = 0; i < 30; i++) steps += pump(clock, 1 / 30);
    expect(steps).toBe(60);
  });

  it('banks sub-step frames instead of dropping or duplicating time', () => {
    const clock = createClock();
    const frames = 300;
    let steps = 0;
    for (let i = 0; i < frames; i++) steps += pump(clock, 1 / 144); // ~2.083 s of wall clock

    // Every second that went in comes out as either a step or banked remainder.
    expect(steps * DT + clock.accumulator).toBeCloseTo(frames / 144, 6);
  });

  it('leaves less than one step banked and reports alpha in [0, 1)', () => {
    const clock = createClock();
    for (const gap of [0.004, 0.017, 0.033, 5, 0.008]) {
      pump(clock, gap);
      expect(clock.accumulator).toBeGreaterThanOrEqual(0);
      expect(clock.accumulator).toBeLessThan(DT);
      expect(alpha(clock)).toBeGreaterThanOrEqual(0);
      expect(alpha(clock)).toBeLessThan(1);
    }
  });

  it('ignores negative gaps from clock skew', () => {
    const clock = createClock();
    expect(pump(clock, -3)).toBe(0);
    expect(clock.accumulator).toBe(0);
  });
});
