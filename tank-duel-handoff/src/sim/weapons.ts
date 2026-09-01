import {
  SHELLS,
  type BurrowHook,
  type RollHook,
  type SkipHook,
  type Shell,
  type ShellHooks,
} from './shells';
import { CONSTANTS } from './constants';
import type { Projectile } from './ballistics';
import type { Box } from './terrain';
import { nearestWrappedX } from './wrap';

export interface Weapon {
  readonly shell: Shell;
  readonly hooks: ShellHooks;
}

export const PLAYABLE_WEAPONS: readonly Weapon[] = Object.freeze(
  SHELLS.filter((shell) => shell.id !== 'anvil').map((shell) => ({
    shell,
    hooks: shell.hooks ?? {},
  })),
);

export const PLAYABLE_SHELL_IDS: readonly string[] = Object.freeze(
  PLAYABLE_WEAPONS.map((weapon) => weapon.shell.id),
);

for (const weapon of PLAYABLE_WEAPONS) {
  const apex = weapon.hooks.onApex;
  if (apex?.secondStageSplit !== undefined || apex?.totalSubmunitions !== undefined) {
    if (apex.secondStageSplit === undefined || apex.totalSubmunitions === undefined ||
      apex.maxDepth === undefined || apex.split * apex.secondStageSplit !== apex.totalSubmunitions) {
      throw new Error(`Malformed staged apex hook for ${weapon.shell.id}`);
    }
  }
}

export const STANDARD_WEAPONS: readonly Weapon[] = Object.freeze(
  PLAYABLE_WEAPONS.filter((weapon) => weapon.shell.slot <= 6),
);

export const STANDARD_SHELL_IDS: readonly string[] = Object.freeze(
  STANDARD_WEAPONS.map((weapon) => weapon.shell.id),
);

export function weaponById(id: string): Weapon {
  const weapon = PLAYABLE_WEAPONS.find((candidate) => candidate.shell.id === id);
  if (!weapon) throw new Error(`Unknown playable weapon: ${id}`);
  return weapon;
}

export function runApexHook(projectile: Projectile): Projectile[] | null {
  const hook = projectile.shell.hooks?.onApex;
  if (!hook || projectile.splitDepth >= (hook.maxDepth ?? 1)) {
    return null;
  }

  const staged = hook.secondStageAfterFrames !== undefined && projectile.splitDepth > 0;
  if (staged) {
    if (projectile.stageAgeFrames < hook.secondStageAfterFrames) return null;
  } else if (projectile.apexDone || projectile.previousVy >= 0 || projectile.vy < 0) {
    return null;
  }

  projectile.apexDone = true;
  const spread = hook.spreadVx ?? 0;
  const split = staged ? hook.secondStageSplit! : hook.split;
  return Array.from({ length: split }, (_, index): Projectile => ({
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx + (index - (split - 1) / 2) * spread,
    vy: projectile.vy,
    shell: projectile.shell,
    owner: projectile.owner,
    trail: [{ x: projectile.x, y: projectile.y }],
    apexDone: true,
    previousVy: projectile.vy,
    collisionGraceSubsteps: CONSTANTS.settle.collisionGraceSubsteps,
    mode: 'flight',
    ageFrames: 0,
    rollStartY: null,
    rollDirection: projectile.vx < 0 ? -1 : 1,
    bounceCount: 0,
    splitDepth: projectile.splitDepth + 1,
    stageAgeFrames: 0,
    altitudeArmed: false,
    altitudeDone: projectile.altitudeDone,
    effectiveMass: projectile.effectiveMass,
  }));
}

export function runAltitudeHook(
  projectile: Projectile,
  surfaceAt: (x: number) => number,
): Projectile[] | null {
  const hook = projectile.shell.hooks?.onAltitude;
  if (!hook || projectile.altitudeDone) return null;
  const altitude = surfaceAt(projectile.x) - projectile.y;
  if (altitude >= hook.armAfterExceedingPx) projectile.altitudeArmed = true;
  if (!projectile.altitudeArmed || projectile.vy <= 0 || altitude > hook.triggerAltitudePx) {
    return null;
  }
  projectile.altitudeDone = true;
  return Array.from({ length: hook.bomblets }, (_, index): Projectile => ({
    ...projectile,
    x: projectile.x + (index - (hook.bomblets - 1) / 2) * hook.spacingPx,
    vx: 0,
    trail: [{ x: projectile.x + (index - (hook.bomblets - 1) / 2) * hook.spacingPx, y: projectile.y }],
    collisionGraceSubsteps: CONSTANTS.settle.collisionGraceSubsteps,
    altitudeDone: true,
  }));
}

export interface TerrainHookContext {
  readonly width: number;
  readonly height: number;
  readonly wrap?: boolean;
  readonly surfaceY: (x: number) => number;
  readonly hullBoxes: readonly Box[];
}

export type TerrainHookReason = 'ordinary' | 'burrow' | 'fuse' | 'climb' | 'edge' | 'hull';

export interface TerrainHookResult {
  readonly status: 'continue' | 'detonate';
  readonly x: number;
  readonly y: number;
  readonly reason?: TerrainHookReason;
}

function isBurrowHook(hook: unknown): hook is BurrowHook {
  return typeof hook === 'object' && hook !== null &&
    'type' in hook && hook.type === 'burrow' &&
    'distancePx' in hook && typeof hook.distancePx === 'number';
}

function isRollHook(hook: unknown): hook is RollHook {
  return typeof hook === 'object' && hook !== null &&
    'type' in hook && hook.type === 'roll' &&
    'fuseFrames' in hook && typeof hook.fuseFrames === 'number' &&
    'climbLimitPx' in hook && typeof hook.climbLimitPx === 'number' &&
    'speedPxPerFrame' in hook && typeof hook.speedPxPerFrame === 'number';
}

function isSkipHook(hook: unknown): hook is SkipHook {
  return typeof hook === 'object' && hook !== null &&
    'type' in hook && hook.type === 'skip' &&
    'maxBounces' in hook && typeof hook.maxBounces === 'number' &&
    'horizontalRetention' in hook && typeof hook.horizontalRetention === 'number' &&
    'relaunchAngleFactor' in hook && typeof hook.relaunchAngleFactor === 'number';
}

export function runTerrainHitHook(
  projectile: Projectile,
  context: TerrainHookContext,
): TerrainHookResult {
  const hook = projectile.shell.hooks?.onTerrainHit;
  if (isBurrowHook(hook)) {
    const magnitude = Math.hypot(projectile.vx, projectile.vy) || 1;
    const dx = projectile.vx / magnitude;
    const dy = projectile.vy / magnitude;
    const maxY = context.height - Number.EPSILON * context.height;
    const nextX = projectile.x + dx * hook.distancePx;
    const maxX = context.width - Number.EPSILON * context.width;
    projectile.x = context.wrap ? nextX : Math.max(0, Math.min(maxX, nextX));
    projectile.y = Math.max(0, Math.min(maxY, projectile.y + dy * hook.distancePx));
    projectile.collisionGraceSubsteps = CONSTANTS.settle.collisionGraceSubsteps;
    return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'burrow' };
  }

  if (isRollHook(hook)) {
    projectile.mode = 'rolling';
    projectile.rollDirection = projectile.vx < 0 ? -1 : 1;
    projectile.rollStartY = projectile.y;
    projectile.collisionGraceSubsteps = CONSTANTS.settle.collisionGraceSubsteps;
    return { status: 'continue', x: projectile.x, y: projectile.y };
  }


  if (isSkipHook(hook)) {
    if (projectile.bounceCount >= hook.maxBounces) {
      return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'ordinary' };
    }
    projectile.vx *= hook.horizontalRetention;
    projectile.vy = -Math.abs(projectile.vx) * hook.relaunchAngleFactor;
    projectile.bounceCount++;
    projectile.collisionGraceSubsteps = CONSTANTS.settle.collisionGraceSubsteps;
    return { status: 'continue', x: projectile.x, y: projectile.y };
  }

  return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'ordinary' };
}

function contains(box: Box, x: number, y: number, wrapWidth?: number): boolean {
  const centre = (box.x0 + box.x1) / 2;
  const boxCentre = wrapWidth === undefined ? centre : nearestWrappedX(centre, x, wrapWidth);
  const halfWidth = (box.x1 - box.x0) / 2;
  return x >= boxCentre - halfWidth && x < boxCentre + halfWidth &&
    y >= box.y0 && y < box.y1;
}

export function stepRollingHook(
  projectile: Projectile,
  context: TerrainHookContext,
): TerrainHookResult {
  const hook = projectile.shell.hooks?.onTerrainHit;
  if (!isRollHook(hook)) {
    return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'ordinary' };
  }

  projectile.ageFrames++;
  if (projectile.ageFrames >= hook.fuseFrames) {
    return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'fuse' };
  }

  const nextX = projectile.x + projectile.rollDirection * hook.speedPxPerFrame;
  if (!context.wrap && (nextX < 0 || nextX >= context.width)) {
    return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'edge' };
  }
  const nextY = context.surfaceY(nextX);
  if ((projectile.rollStartY ?? projectile.y) - nextY > hook.climbLimitPx) {
    return { status: 'detonate', x: projectile.x, y: projectile.y, reason: 'climb' };
  }
  if (context.hullBoxes.some((box) => contains(
    box,
    nextX,
    nextY,
    context.wrap ? context.width : undefined,
  ))) {
    return { status: 'detonate', x: nextX, y: nextY, reason: 'hull' };
  }

  projectile.x = nextX;
  projectile.y = nextY;
  projectile.trail.push({ x: nextX, y: nextY });
  return { status: 'continue', x: nextX, y: nextY };
}
