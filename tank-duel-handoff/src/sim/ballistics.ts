import {
  MUZZLE_COEFFICIENT,
  SUBSTEPS,
} from './constants';
import type { Shell } from './shells';
import type { PlayerIndex } from './playerLoadouts';
import type { WorldPhysics } from './worlds';

export interface TrailPoint {
  readonly x: number;
  readonly y: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly shell: Shell;
  readonly owner: PlayerIndex;
  readonly trail: TrailPoint[];
  apexDone: boolean;
  previousVy: number;
  collisionGraceSubsteps: number;
  mode: 'flight' | 'rolling';
  ageFrames: number;
  rollStartY: number | null;
  rollDirection: -1 | 1;
  bounceCount: number;
  splitDepth: number;
  stageAgeFrames: number;
  altitudeArmed: boolean;
  altitudeDone: boolean;
  effectiveMass: number;
}

export interface LaunchOptions {
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly power: number;
  readonly direction: -1 | 1;
  readonly shell: Shell;
  readonly owner: PlayerIndex;
  readonly effectiveMass?: number;
}

export interface BallisticsEnvironment {
  readonly world: WorldPhysics;
  readonly wind: number;
  readonly solidAt: (x: number, y: number) => boolean;
}

export interface ProjectileStep {
  readonly hit: boolean;
}

export function launchProjectile(options: LaunchOptions): Projectile {
  const angle = (options.angleDeg * Math.PI) / 180;
  const speed = options.power * MUZZLE_COEFFICIENT;
  return {
    x: options.x,
    y: options.y,
    vx: Math.cos(angle) * speed * options.direction,
    vy: -Math.sin(angle) * speed,
    shell: options.shell,
    owner: options.owner,
    trail: [{ x: options.x, y: options.y }],
    apexDone: false,
    previousVy: -Math.sin(angle) * speed,
    collisionGraceSubsteps: 0,
    mode: 'flight',
    ageFrames: 0,
    rollStartY: null,
    rollDirection: options.direction,
    bounceCount: 0,
    splitDepth: 0,
    stageAgeFrames: 0,
    altitudeArmed: false,
    altitudeDone: false,
    effectiveMass: options.effectiveMass ?? options.shell.mass,
  };
}

export function stepProjectile(
  projectile: Projectile,
  environment: BallisticsEnvironment,
): ProjectileStep {
  projectile.previousVy = projectile.vy;
  const gravity = environment.world.baseGravity * environment.world.gravity * projectile.effectiveMass;
  const wind = environment.wind * environment.world.windCoefficient * projectile.shell.drag;

  for (let substep = 0; substep < SUBSTEPS; substep++) {
    projectile.vy += gravity / SUBSTEPS;
    projectile.vx += wind / SUBSTEPS;
    projectile.x += projectile.vx / SUBSTEPS;
    projectile.y += projectile.vy / SUBSTEPS;

    if (projectile.collisionGraceSubsteps > 0) {
      projectile.collisionGraceSubsteps--;
    } else if (environment.solidAt(projectile.x, projectile.y)) {
      return { hit: true };
    }
  }

  const damping = 1 - environment.world.airDrag;
  projectile.vx *= damping;
  projectile.vy *= damping;
  projectile.trail.push({ x: projectile.x, y: projectile.y });
  projectile.ageFrames++;
  projectile.stageAgeFrames++;
  return { hit: false };
}
