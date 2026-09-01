import { describe, expect, it } from 'vitest';
import { EFFECTS, validateEffectsConfig } from './effectConfig';

describe('effects configuration', () => {
  it('loads a valid machine-readable effects spec', () => {
    expect(() => validateEffectsConfig(EFFECTS)).not.toThrow();
  });

  it('rejects invalid caps and fractions', () => {
    expect(() => validateEffectsConfig({ ...EFFECTS, hitstop: { directHitFrames: 0 } })).toThrow();
    expect(() => validateEffectsConfig({
      ...EFFECTS,
      reducedMotion: { ...EFFECTS.reducedMotion, particleMultiplier: 2 },
    })).toThrow();
  });
});
