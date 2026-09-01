import { EFFECTS } from './effectConfig';

export interface MotionPolicy {
  readonly shake: boolean;
  readonly hitstop: boolean;
  readonly particleMultiplier: number;
  readonly trajectories: boolean;
}

export function motionPolicy(reduced: boolean): MotionPolicy {
  if (reduced) return { ...EFFECTS.reducedMotion };
  return { shake: true, hitstop: true, particleMultiplier: 1, trajectories: true };
}
