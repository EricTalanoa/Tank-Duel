import { describe, expect, it } from 'vitest';
import { createFlightStepScaler, simulationStepsForFrame } from './framePolicy';
import { createEffects } from './effects';
import { motionPolicy } from './motion';
import { createWorld, fire, step } from '../sim/world';

describe('presentation hitstop frame policy', () => {
  it('suppresses simulation steps only while presentation is paused', () => {
    const scaler = createFlightStepScaler();
    expect(simulationStepsForFrame(scaler, 4, true, 'flight', 1)).toBe(0);
    expect(simulationStepsForFrame(scaler, 4, false, 'aim', 3)).toBe(4);
  });

  it('accumulates fractional FLIGHT scale into integer fixed steps', () => {
    const scaler = createFlightStepScaler();
    expect(simulationStepsForFrame(scaler, 1, false, 'flight', 1.6)).toBe(1);
    expect(simulationStepsForFrame(scaler, 1, true, 'flight', 1.6)).toBe(0);
    expect(simulationStepsForFrame(scaler, 1, false, 'flight', 1.6)).toBe(2);
  });

  it('produces the same step count regardless of render-frame grouping', () => {
    const grouped = createFlightStepScaler();
    const split = createFlightStepScaler();
    const groupedSteps = simulationStepsForFrame(grouped, 5, false, 'flight', 1.6);
    const splitSteps = Array.from({ length: 5 }, () =>
      simulationStepsForFrame(split, 1, false, 'flight', 1.6))
      .reduce((sum, steps) => sum + steps, 0);
    expect(groupedSteps).toBe(8);
    expect(splitSteps).toBe(groupedSteps);
  });

  it('changes render-frame step count without changing final terrain', () => {
    const fixture = { width: 400, height: 240 } as const;
    const normal = createWorld(82, fixture);
    const scaled = createWorld(82, fixture);
    fire(normal);
    fire(scaled);
    const normalScaler = createFlightStepScaler();
    const fastScaler = createFlightStepScaler();

    const done = (state: typeof normal) => state.phase === 'aim' && state.activePlayer === 1;
    for (let frame = 0; frame < 1_000 && (!done(normal) || !done(scaled)); frame++) {
      const normalSteps = simulationStepsForFrame(normalScaler, 1, false, normal.phase, 1);
      const scaledSteps = simulationStepsForFrame(fastScaler, 1, false, scaled.phase, 2);
      for (let index = 0; index < normalSteps; index++) step(normal);
      for (let index = 0; index < scaledSteps; index++) step(scaled);
    }

    expect(done(normal)).toBe(true);
    expect(done(scaled)).toBe(true);
    expect(scaled.terrain.mask).toEqual(normal.terrain.mask);
  });

  it('keeps a projectile trajectory advancing under reduced motion', () => {
    const state = createWorld(81);
    fire(state);
    const beforeX = state.projectile!.x;
    const effects = createEffects(81, motionPolicy(true));
    effects.consume([{ type: 'directHit', x: 0, y: 0, shellId: 'he', player: 0 }]);
    const steps = simulationStepsForFrame(
      createFlightStepScaler(),
      1,
      effects.shouldPauseSimulation(),
      state.phase,
      state.world.flightTimeScale,
    );
    for (let index = 0; index < steps; index++) step(state);
    expect(steps).toBe(1);
    expect(state.projectile!.x).not.toBe(beforeX);
  });
});
