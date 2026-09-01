import { createRng } from '../sim/rng';
import type { PresentationEvent } from '../sim/presentation';
import { EFFECTS } from './effectConfig';
import type { MotionPolicy } from './motion';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Flash {
  x: number;
  y: number;
  color: string;
  frames: number;
}

export interface EffectsEngine {
  readonly activeParticleCount: number;
  readonly shakeFrames: number;
  readonly hitstopFrames: number;
  readonly shakeOffset: { readonly x: number; readonly y: number };
  consume(events: readonly PresentationEvent[]): void;
  setPolicy(policy: MotionPolicy): void;
  shouldPauseSimulation(): boolean;
  advanceFrame(): void;
  draw(ctx: CanvasRenderingContext2D): void;
  particleSnapshot(): readonly Readonly<Particle>[];
}

export function createEffects(seed: number, policy: MotionPolicy): EffectsEngine {
  let currentPolicy = policy;
  const rng = createRng(seed);
  const particles: Particle[] = Array.from({ length: EFFECTS.particles.maxCount }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0,
  }));
  const flashes: Flash[] = [];
  let shakeFrames = 0;
  let hitstopFrames = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawnImpact(event: Extract<PresentationEvent, { type: 'impact' }>): void {
    const fullCount = Math.min(
      EFFECTS.particles.maxCount,
      Math.round(EFFECTS.particles.baseCount + event.blastRadius * EFFECTS.particles.perRadius),
    );
    let remaining = Math.round(fullCount * currentPolicy.particleMultiplier);
    for (const particle of particles) {
      if (remaining <= 0) break;
      if (particle.active) continue;
      const angle = rng.range(0, Math.PI * 2);
      const speed = rng.range(EFFECTS.particles.speedMin, EFFECTS.particles.speedMax);
      const lifetime = Math.round(rng.range(
        EFFECTS.particles.lifetimeFramesMin,
        EFFECTS.particles.lifetimeFramesMax,
      ));
      const spark = rng.next() < EFFECTS.particles.sparkFraction;
      Object.assign(particle, {
        active: true,
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: lifetime,
        maxLife: lifetime,
        color: spark ? event.accent : '#8A6C4A',
        size: spark ? EFFECTS.particles.sparkSize : EFFECTS.particles.debrisSize,
      });
      remaining--;
    }
  }

  const engine: EffectsEngine = {
    get activeParticleCount() { return particles.reduce((count, p) => count + Number(p.active), 0); },
    get shakeFrames() { return shakeFrames; },
    get hitstopFrames() { return hitstopFrames; },
    get shakeOffset() { return { x: shakeX, y: shakeY }; },

    consume(events) {
      for (const event of events) {
        if (event.type === 'muzzleFlash') {
          flashes.push({
            x: event.x, y: event.y, color: event.accent,
            frames: EFFECTS.muzzleFlash.durationFrames,
          });
        } else if (event.type === 'impact') {
          spawnImpact(event);
          if (currentPolicy.shake) shakeFrames = Math.max(shakeFrames, EFFECTS.shake.durationFrames);
        } else if (currentPolicy.hitstop) {
          hitstopFrames = Math.max(hitstopFrames, EFFECTS.hitstop.directHitFrames);
        }
      }
    },

    setPolicy(nextPolicy) {
      currentPolicy = nextPolicy;
      if (!nextPolicy.shake) shakeFrames = 0;
      if (!nextPolicy.hitstop) hitstopFrames = 0;
    },

    shouldPauseSimulation: () => hitstopFrames > 0,

    advanceFrame() {
      if (hitstopFrames > 0) {
        hitstopFrames--;
        return;
      }
      for (const particle of particles) {
        if (!particle.active) continue;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += EFFECTS.particles.gravityPerFrame;
        particle.life--;
        if (particle.life <= 0) particle.active = false;
      }
      for (let index = flashes.length - 1; index >= 0; index--) {
        const flash = flashes[index]!;
        flash.frames--;
        if (flash.frames <= 0) flashes.splice(index, 1);
      }
      if (shakeFrames > 0) {
        const progress = shakeFrames / EFFECTS.shake.durationFrames;
        const amplitude = EFFECTS.shake.amplitudePx * progress * EFFECTS.shake.decay;
        shakeX = rng.range(-amplitude, amplitude);
        shakeY = rng.range(-amplitude, amplitude);
        shakeFrames--;
      } else {
        shakeX = 0;
        shakeY = 0;
      }
    },

    draw(ctx) {
      ctx.save();
      for (const particle of particles) {
        if (!particle.active) continue;
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;
      for (const flash of flashes) {
        const progress = flash.frames / EFFECTS.muzzleFlash.durationFrames;
        ctx.fillStyle = flash.color;
        ctx.globalAlpha = progress;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, EFFECTS.muzzleFlash.radiusPx * progress, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    particleSnapshot: () => particles.filter((particle) => particle.active).map((particle) => ({ ...particle })),
  };
  return engine;
}
