import { describe, expect, it } from 'vitest';
import { EFFECTS } from './effectConfig';
import { createEffects } from './effects';
import { motionPolicy } from './motion';
import type { PresentationEvent } from '../sim/presentation';

const impact: PresentationEvent = {
  type: 'impact', x: 300, y: 220, shellId: 'mortar', accent: '#FF8C42', blastRadius: 44,
};
const directHit: PresentationEvent = {
  type: 'directHit', x: 300, y: 220, shellId: 'mortar', player: 1,
};

describe('visual effects engine', () => {
  it('creates deterministic bounded particles from its own seed', () => {
    const first = createEffects(0xefeec7, motionPolicy(false));
    const second = createEffects(0xefeec7, motionPolicy(false));
    first.consume([impact]);
    second.consume([impact]);
    const expected = Math.min(
      EFFECTS.particles.maxCount,
      Math.round(EFFECTS.particles.baseCount + impact.blastRadius * EFFECTS.particles.perRadius),
    );
    expect(first.activeParticleCount).toBe(expected);
    expect(first.particleSnapshot()).toEqual(second.particleSnapshot());
  });

  it('cuts particles and removes shake and hitstop under reduced motion', () => {
    const normal = createEffects(1, motionPolicy(false));
    const reduced = createEffects(1, motionPolicy(true));
    normal.consume([impact, directHit]);
    reduced.consume([impact, directHit]);
    expect(reduced.activeParticleCount).toBe(
      Math.round(normal.activeParticleCount * EFFECTS.reducedMotion.particleMultiplier),
    );
    expect(normal.shakeFrames).toBe(EFFECTS.shake.durationFrames);
    expect(reduced.shakeFrames).toBe(0);
    expect(normal.hitstopFrames).toBe(EFFECTS.hitstop.directHitFrames);
    expect(reduced.hitstopFrames).toBe(0);
  });

  it('holds normal presentation for exactly the configured direct-hit frames', () => {
    const effects = createEffects(2, motionPolicy(false));
    effects.consume([directHit]);
    for (let frame = 0; frame < EFFECTS.hitstop.directHitFrames; frame++) {
      expect(effects.shouldPauseSimulation()).toBe(true);
      effects.advanceFrame();
    }
    expect(effects.shouldPauseSimulation()).toBe(false);
  });

  it('applies a reduced-motion policy change without rebuilding the engine', () => {
    const effects = createEffects(3, motionPolicy(false));
    effects.setPolicy(motionPolicy(true));
    effects.consume([impact, directHit]);
    expect(effects.shakeFrames).toBe(0);
    expect(effects.hitstopFrames).toBe(0);
  });
});
