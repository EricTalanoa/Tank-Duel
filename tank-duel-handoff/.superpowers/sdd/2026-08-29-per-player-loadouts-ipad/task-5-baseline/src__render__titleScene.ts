import rawScreens from '../../spec/screens.json';
import { CONSTANTS } from '../sim/constants';
import type { Rng } from '../sim/rng';
import { HE_SHELL } from '../sim/shells';
import { TERRA } from '../sim/worlds';
import { EFFECTS } from './effectConfig';
import type { MotionPolicy } from './motion';
import { PALETTE } from './palette';

export type TitleSystem =
  | 'embers'
  | 'drifting cloud bands'
  | 'sweeping beams'
  | 'waving flags'
  | 'twinkling stars'
  | 'pulsing muzzle glow'
  | 'periodic exchange of fire';

export interface DisposableScene {
  dispose(): void;
}

export interface SceneAnimationOptions {
  readonly requestFrame: (callback: (timestamp: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly now: () => number;
  readonly rng: Rng;
  readonly motion: MotionPolicy;
}

export interface TitleSceneModel {
  readonly systems: readonly TitleSystem[];
  readonly width: number;
  readonly height: number;
  readonly atmosphere: readonly number[];
  readonly pools: TitleScenePools;
  readonly reducedMotion: boolean;
  activity: TitleSceneActivity;
  elapsedMs: number;
}

export interface TitleSceneActivity {
  readonly cloudDrift: number;
  readonly beamSweep: number;
  readonly flagWave: number;
  readonly starTwinkle: number;
  readonly muzzlePulse: number;
  readonly exchangeProgress: number | null;
}

export interface TitleScenePools {
  readonly embers: readonly number[];
  readonly clouds: readonly number[];
  readonly beams: readonly number[];
  readonly flags: readonly number[];
  readonly stars: readonly number[];
  readonly muzzleGlows: readonly number[];
  readonly exchangedShots: readonly number[];
}

export type TitleScenePoolCounts = Readonly<Record<keyof TitleScenePools, number>>;

export interface TitleSceneSnapshot {
  readonly atmosphere: readonly number[];
  readonly activity: TitleSceneActivity;
  readonly elapsedMs: number;
}

export interface TitleDrawWork {
  readonly bySystem: Readonly<Record<TitleSystem, number>>;
  readonly total: number;
}

const OPPOSING_SIDES = [-1, 1] as const;
const MAX_TITLE_PARTICLES = EFFECTS.particles.baseCount;
const MAX_TITLE_CLOUDS = TERRA.palette.sky.length;
const TITLE_SYSTEMS = readTitleSystems();

const MAX_TITLE_PASS_WORK =
  MAX_TITLE_PARTICLES * OPPOSING_SIDES.length
  + MAX_TITLE_CLOUDS
  + OPPOSING_SIDES.length * 3
  + (OPPOSING_SIDES.length - 1)
  + TITLE_SYSTEMS.length;
export const TITLE_FRAME_WORK_BUDGET = MAX_TITLE_PASS_WORK * OPPOSING_SIDES.length;

export function createTitleScene(
  canvas: HTMLCanvasElement,
  options: SceneAnimationOptions,
): DisposableScene {
  const context = canvas.getContext('2d');
  if (!context) return { dispose() {} };

  const model = createTitleSceneModel(canvas.width, canvas.height, options.rng, options.motion);
  const startedAt = options.now();
  let disposed = false;
  let frameHandle: number | null = null;
  const frame = (_timestamp: number): void => {
    frameHandle = null;
    if (disposed) return;
    updateTitleSceneModel(model, options.now() - startedAt);
    drawTitleScene(context, model);
    frameHandle = options.requestFrame(frame);
  };
  frameHandle = options.requestFrame(frame);

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (frameHandle !== null) options.cancelFrame(frameHandle);
      frameHandle = null;
    },
  };
}

export function createTitleSceneModel(
  width: number,
  height: number,
  rng: Rng,
  _motion: MotionPolicy,
): TitleSceneModel {
  const viewportScale = Math.min(1, Math.max(0, width) / CONSTANTS.defaultFieldWidth);
  const particleScale = Math.max(0, Math.min(1, _motion.particleMultiplier));
  const reducedMotion = !_motion.shake && !_motion.hitstop && particleScale < 1;
  const atmosphericCount = Math.max(
    1,
    Math.ceil(MAX_TITLE_PARTICLES * viewportScale * particleScale),
  );
  const pool = (count: number): readonly number[] =>
    Array.from({ length: count }, () => rng.next());
  return {
    systems: TITLE_SYSTEMS,
    width,
    height,
    atmosphere: TITLE_SYSTEMS.map(() => rng.next()),
    pools: {
      embers: pool(atmosphericCount),
      clouds: pool(MAX_TITLE_CLOUDS),
      beams: pool(OPPOSING_SIDES.length),
      flags: pool(OPPOSING_SIDES.length),
      stars: pool(atmosphericCount),
      muzzleGlows: pool(OPPOSING_SIDES.length),
      exchangedShots: pool(OPPOSING_SIDES.length - 1),
    },
    reducedMotion,
    activity: titleSceneActivity(0, reducedMotion),
    elapsedMs: 0,
  };
}

export function updateTitleSceneModel(model: TitleSceneModel, elapsedMs: number): number {
  model.elapsedMs = Math.max(0, elapsedMs);
  model.activity = titleSceneActivity(model.elapsedMs, model.reducedMotion);
  return Object.values(titleScenePoolCounts(model)).reduce((sum, count) => sum + count, 0)
    + model.systems.length;
}

export function snapshotTitleScene(model: TitleSceneModel): TitleSceneSnapshot {
  return {
    atmosphere: [...model.atmosphere],
    activity: { ...model.activity },
    elapsedMs: model.elapsedMs,
  };
}

export function drawTitleScene(
  context: CanvasRenderingContext2D,
  model: TitleSceneModel,
): TitleDrawWork {
  const horizon = model.height * CONSTANTS.damage.minFractionAtEdge * 3;
  const tankY = horizon - CONSTANTS.tank.hullBottom;
  context.globalAlpha = 1;
  context.fillStyle = TERRA.palette.sky[0] ?? PALETTE.skyTop;
  context.fillRect(0, 0, model.width, model.height);
  context.fillStyle = TERRA.palette.ground;
  context.fillRect(0, horizon, model.width, model.height - horizon);

  drawSeedPool(context, model.pools.stars, model, (seed, index) => {
    context.globalAlpha = EFFECTS.reducedMotion.particleMultiplier
      + model.activity.starTwinkle * (1 - EFFECTS.reducedMotion.particleMultiplier);
    context.fillStyle = PALETTE.horizonHaze;
    context.fillRect(seed * model.width, seededUnit(seed, index) * horizon, 1, 1);
  });

  drawSeedPool(context, model.pools.clouds, model, (seed, index) => {
    context.save();
    context.globalAlpha = EFFECTS.reducedMotion.particleMultiplier;
    context.translate(model.activity.cloudDrift * model.width, 0);
    context.fillStyle = TERRA.palette.sky[index % TERRA.palette.sky.length] ?? PALETTE.skyUpper;
    const y = seededUnit(seed, index) * horizon;
    context.fillRect(seed * model.width - model.width, y, model.width, CONSTANTS.tank.hullHalfWidth);
    context.fillRect(seed * model.width, y, model.width, CONSTANTS.tank.hullHalfWidth);
    context.restore();
  });

  drawSeedPool(context, model.pools.beams, model, (_seed, index) => {
    const side = OPPOSING_SIDES[index] ?? 1;
    const x = side < 0 ? CONSTANTS.spawnInsetPx : model.width - CONSTANTS.spawnInsetPx;
    context.save();
    context.translate(x, tankY + CONSTANTS.tank.turretPivotY);
    context.rotate(side * model.activity.beamSweep * Math.PI * EFFECTS.reducedMotion.particleMultiplier);
    context.globalAlpha = EFFECTS.reducedMotion.particleMultiplier;
    context.fillStyle = PALETTE.horizonHaze;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(side * model.width, -horizon);
    context.lineTo(side * model.width, -horizon + CONSTANTS.tank.muzzleOffset);
    context.closePath();
    context.fill();
    context.restore();
  });

  drawSeedPool(context, model.pools.flags, model, (_seed, index) => {
    const side = OPPOSING_SIDES[index] ?? 1;
    const x = side < 0 ? CONSTANTS.spawnInsetPx : model.width - CONSTANTS.spawnInsetPx;
    context.save();
    context.translate(x, tankY + CONSTANTS.tank.hullTop);
    context.strokeStyle = PALETTE.telemetry;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, CONSTANTS.tank.hullTop);
    context.stroke();
    context.fillStyle = side < 0 ? PALETTE.playerOne : PALETTE.playerTwo;
    context.beginPath();
    context.moveTo(0, CONSTANTS.tank.hullTop);
    context.lineTo(side * CONSTANTS.tank.muzzleOffset, CONSTANTS.tank.hullTop + model.activity.flagWave);
    context.lineTo(0, CONSTANTS.tank.turretPivotY);
    context.closePath();
    context.fill();
    context.restore();
  });

  drawSeedPool(context, model.pools.embers, model, (seed, index) => {
    const travel = model.reducedMotion ? 0 : model.activity.cloudDrift * horizon;
    context.save();
    context.translate(0, -travel);
    context.globalAlpha = 1 - model.activity.cloudDrift;
    context.fillStyle = HE_SHELL.accent;
    context.fillRect(
      seededUnit(seed, index) * model.width,
      horizon + seed * (model.height - horizon),
      EFFECTS.particles.sparkSize,
      EFFECTS.particles.sparkSize,
    );
    context.restore();
  });

  drawSeedPool(context, model.pools.muzzleGlows, model, (_seed, index) => {
    const side = OPPOSING_SIDES[index] ?? 1;
    const x = side < 0 ? CONSTANTS.spawnInsetPx : model.width - CONSTANTS.spawnInsetPx;
    context.save();
    context.globalAlpha = EFFECTS.reducedMotion.particleMultiplier
      + model.activity.muzzlePulse * EFFECTS.reducedMotion.particleMultiplier;
    context.fillStyle = HE_SHELL.accent;
    context.beginPath();
    context.arc(
      x + side * CONSTANTS.tank.muzzleOffset,
      tankY + CONSTANTS.tank.turretPivotY,
      EFFECTS.muzzleFlash.radiusPx,
      0,
      Math.PI * OPPOSING_SIDES.length,
    );
    context.fill();
    context.restore();
  });

  const exchangeActive = model.activity.exchangeProgress !== null
    && model.activity.exchangeProgress < CONSTANTS.damage.minFractionAtEdge;
  if (exchangeActive) {
    const progress = model.activity.exchangeProgress! / CONSTANTS.damage.minFractionAtEdge;
    const direction = Math.floor(model.elapsedMs / (CONSTANTS.settle.hardExitFrames * 1000 / CONSTANTS.simHz))
      % OPPOSING_SIDES.length;
    const fromLeft = direction === 0;
    const startX = fromLeft ? CONSTANTS.spawnInsetPx : model.width - CONSTANTS.spawnInsetPx;
    const endX = fromLeft ? model.width - CONSTANTS.spawnInsetPx : CONSTANTS.spawnInsetPx;
    const x = startX + (endX - startX) * progress;
    const y = tankY - Math.sin(progress * Math.PI) * horizon * CONSTANTS.damage.minFractionAtEdge;
    context.globalAlpha = 1 - progress;
    context.fillStyle = HE_SHELL.accent;
    context.beginPath();
    context.arc(x, y, EFFECTS.particles.sparkSize, 0, Math.PI * OPPOSING_SIDES.length);
    context.fill();
  }

  context.globalAlpha = 1;
  const bySystem: Record<TitleSystem, number> = {
    embers: model.pools.embers.length,
    'drifting cloud bands': model.pools.clouds.length,
    'sweeping beams': model.pools.beams.length,
    'waving flags': model.pools.flags.length,
    'twinkling stars': model.pools.stars.length,
    'pulsing muzzle glow': model.pools.muzzleGlows.length,
    'periodic exchange of fire': exchangeActive ? model.pools.exchangedShots.length : 0,
  };
  return {
    bySystem,
    total: Object.values(bySystem).reduce((sum, work) => sum + work, 0) + model.systems.length,
  };
}

export function titleScenePoolCounts(model: TitleSceneModel): TitleScenePoolCounts {
  return {
    embers: model.pools.embers.length,
    clouds: model.pools.clouds.length,
    beams: model.pools.beams.length,
    flags: model.pools.flags.length,
    stars: model.pools.stars.length,
    muzzleGlows: model.pools.muzzleGlows.length,
    exchangedShots: model.pools.exchangedShots.length,
  };
}

function readTitleSystems(): readonly TitleSystem[] {
  const title = rawScreens.screens.find((screen) => screen.id === 'TITLE');
  if (!title || !('idleAnimation' in title) || !Array.isArray(title.idleAnimation)) {
    throw new Error('TITLE idleAnimation is missing from spec/screens.json');
  }
  return Object.freeze([...title.idleAnimation] as TitleSystem[]);
}

function titleSceneActivity(elapsedMs: number, reducedMotion: boolean): TitleSceneActivity {
  if (reducedMotion) {
    return {
      cloudDrift: 0,
      beamSweep: 0,
      flagWave: 0,
      starTwinkle: EFFECTS.reducedMotion.particleMultiplier,
      muzzlePulse: EFFECTS.reducedMotion.particleMultiplier,
      exchangeProgress: null,
    };
  }

  const elapsedFrames = (elapsedMs * CONSTANTS.simHz) / 1000;
  return {
    cloudDrift: normalizedCycle(elapsedFrames, CONSTANTS.settle.hardExitFrames),
    beamSweep: Math.sin(
      normalizedCycle(elapsedFrames, CONSTANTS.settle.quietFrames * OPPOSING_SIDES.length)
      * Math.PI * OPPOSING_SIDES.length,
    ),
    flagWave: Math.sin(
      normalizedCycle(elapsedFrames, CONSTANTS.settle.quietFrames)
      * Math.PI * OPPOSING_SIDES.length,
    ),
    starTwinkle: normalizedPulse(elapsedFrames, EFFECTS.particles.lifetimeFramesMax),
    muzzlePulse: normalizedPulse(elapsedFrames, EFFECTS.hitstop.directHitFrames),
    exchangeProgress: normalizedCycle(elapsedFrames, CONSTANTS.settle.hardExitFrames),
  };
}

function normalizedCycle(elapsedFrames: number, durationFrames: number): number {
  return ((elapsedFrames % durationFrames) + durationFrames) % durationFrames / durationFrames;
}

function normalizedPulse(elapsedFrames: number, durationFrames: number): number {
  return (Math.sin(
    normalizedCycle(elapsedFrames, durationFrames) * Math.PI * OPPOSING_SIDES.length,
  ) + 1) / OPPOSING_SIDES.length;
}

function drawSeedPool(
  _context: CanvasRenderingContext2D,
  pool: readonly number[],
  _model: TitleSceneModel,
  draw: (seed: number, index: number) => void,
): void {
  pool.forEach(draw);
}

function seededUnit(seed: number, index: number): number {
  return (seed * (index + TITLE_SYSTEMS.length)) % 1;
}
