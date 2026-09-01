import raw from '../../spec/effects.json';

export interface EffectsConfig {
  readonly hitstop: { readonly directHitFrames: number };
  readonly collapse: { readonly maxPixelsPerFrame: number };
  readonly reducedMotion: {
    readonly particleMultiplier: number;
    readonly shake: boolean;
    readonly hitstop: boolean;
    readonly trajectories: boolean;
  };
  readonly performance: { readonly frameBudgetMs: number; readonly referenceShellId: string };
  readonly particles: {
    readonly baseCount: number; readonly perRadius: number; readonly maxCount: number;
    readonly lifetimeFramesMin: number; readonly lifetimeFramesMax: number;
    readonly speedMin: number; readonly speedMax: number; readonly gravityPerFrame: number;
    readonly sparkFraction: number; readonly sparkSize: number; readonly debrisSize: number;
  };
  readonly shake: { readonly durationFrames: number; readonly amplitudePx: number; readonly decay: number };
  readonly muzzleFlash: { readonly durationFrames: number; readonly radiusPx: number };
  readonly audio: {
    readonly masterGain: number; readonly fireFrequencyHz: number;
    readonly impactFrequencyHz: number; readonly directHitFrequencyHz: number;
    readonly attackSeconds: number; readonly releaseSeconds: number;
  };
}

export function validateEffectsConfig(config: EffectsConfig): void {
  const positive = [
    config.hitstop.directHitFrames, config.collapse.maxPixelsPerFrame,
    config.performance.frameBudgetMs, config.particles.baseCount, config.particles.maxCount,
    config.shake.durationFrames, config.muzzleFlash.durationFrames,
  ];
  if (positive.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Effects caps and durations must be positive');
  }
  if (config.reducedMotion.particleMultiplier < 0 || config.reducedMotion.particleMultiplier > 1) {
    throw new Error('Reduced-motion particle multiplier must be between 0 and 1');
  }
}

export const EFFECTS: EffectsConfig = raw;
validateEffectsConfig(EFFECTS);
