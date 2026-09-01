import { describe, expect, it } from 'vitest';
import { EFFECTS } from './effectConfig';
import { motionPolicy } from './motion';

describe('motion policy', () => {
  it('keeps full effects and trajectory information normally', () => {
    expect(motionPolicy(false)).toEqual({
      shake: true,
      hitstop: true,
      particleMultiplier: 1,
      trajectories: true,
    });
  });

  it('removes shake and hitstop, cuts particles, and keeps trajectories under reduced motion', () => {
    expect(motionPolicy(true)).toEqual({
      shake: EFFECTS.reducedMotion.shake,
      hitstop: EFFECTS.reducedMotion.hitstop,
      particleMultiplier: EFFECTS.reducedMotion.particleMultiplier,
      trajectories: EFFECTS.reducedMotion.trajectories,
    });
  });
});
