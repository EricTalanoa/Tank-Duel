import rawScreens from '../../spec/screens.json';
import { CONSTANTS } from '../sim/constants';
import type { PausableDisposable } from '../app/controller';
import { createRng, hashSeed, type Rng } from '../sim/rng';
import { HE_SHELL } from '../sim/shells';
import { generateHeightmap } from '../sim/generators';
import { drawTankSilhouette } from './entities';
import { TERRA } from '../sim/worlds';
import { EFFECTS } from './effectConfig';
import type { MotionPolicy } from './motion';
import { functionalAccent, PALETTE } from './palette';

export type TitleSystem =
  | 'embers'
  | 'drifting cloud bands'
  | 'sweeping beams'
  | 'waving flags'
  | 'twinkling stars'
  | 'pulsing muzzle glow'
  | 'periodic exchange of fire';

export interface DisposableScene extends PausableDisposable {}

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
const TITLE_FLAG_WORLDS = ['rust', 'hollow'] as const;
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
  if (!context) return { setPaused() {}, dispose() {} };

  const model = createTitleSceneModel(canvas.width, canvas.height, options.rng, options.motion);
  let last = options.now();
  let elapsedMs = 0;
  let disposed = false;
  let paused = false;
  let frameHandle: number | null = null;
  const frame = (_timestamp: number): void => {
    frameHandle = null;
    if (disposed || paused) return;
    const now = options.now();
    elapsedMs += Math.max(0, now - last);
    last = now;
    updateTitleSceneModel(model, elapsedMs);
    drawTitleScene(context, model);
    frameHandle = options.requestFrame(frame);
  };
  frameHandle = options.requestFrame(frame);

  return {
    setPaused(nextPaused: boolean): void {
      if (disposed || paused === nextPaused) return;
      paused = nextPaused;
      if (paused) {
        if (frameHandle !== null) options.cancelFrame(frameHandle);
        frameHandle = null;
        return;
      }
      last = options.now();
      if (frameHandle === null) frameHandle = options.requestFrame(frame);
    },
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

/**
 * Static backdrop, back to front: a sky gradient, three receding ridges, the foreground
 * ground, the two duellists and one dotted arc between them, then a left vignette so the
 * wordmark holds against the scene. The idle animation systems draw on top of this and are
 * unchanged.
 */
const TITLE_SKY = ['#0A0E15', '#141C28', '#2A2A2C'] as const;
const TITLE_RIDGES = [
  { offset: 130, amplitude: 34, color: '#141A24', phase: 11 },
  { offset: 74, amplitude: 30, color: '#182029', phase: 29 },
  { offset: 24, amplitude: 22, color: '#1D262C', phase: 57 },
] as const;
const TITLE_GROUND = { fill: '#39412F', edge: '#4A5540', capWidth: 3, reliefPx: 90, liftPx: 30 } as const;
const TITLE_TANKS = [
  { xFraction: 760 / 1194, direction: 1 as const, player: 0 as const },
  { xFraction: 1060 / 1194, direction: -1 as const, player: 1 as const },
];
const TITLE_TANK_SCALE = 1.7;
const TITLE_ARC = { apexPx: 160, clearancePx: 26, dash: [2, 9], alpha: 0.55 } as const;
const TITLE_VIGNETTE_PX = 620;

export function drawTitleScene(
  context: CanvasRenderingContext2D,
  model: TitleSceneModel,
): TitleDrawWork {
  const horizon = model.height * CONSTANTS.damage.minFractionAtEdge * 3;
  const surface = titleSurface(model, horizon);
  // The idle systems anchor to the two tanks the backdrop draws, not to the spawn insets:
  // decoration hanging in empty air reads as a bug.
  const anchors = titleTankAnchors(model, surface, horizon);
  const tankY = anchors[0]?.y ?? horizon - CONSTANTS.tank.hullBottom;
  context.globalAlpha = 1;
  drawTitleBackdrop(context, model, horizon, surface, anchors);

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
    const anchor = anchors[index] ?? anchors[0];
    const x = anchor?.x ?? model.width / 2;
    context.save();
    context.translate(x, (anchor?.y ?? tankY) + CONSTANTS.tank.turretPivotY);
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
    const anchor = anchors[index] ?? anchors[0];
    const x = anchor?.x ?? model.width / 2;
    context.save();
    context.translate(x, (anchor?.y ?? tankY) + CONSTANTS.tank.hullTop);
    context.strokeStyle = PALETTE.telemetry;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, CONSTANTS.tank.hullTop);
    context.stroke();
    context.fillStyle = functionalAccent(TITLE_FLAG_WORLDS[index] ?? TITLE_FLAG_WORLDS[0]);
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
    const anchor = anchors[index] ?? anchors[0];
    const side = anchor?.direction ?? 1;
    const x = anchor?.x ?? model.width / 2;
    context.save();
    context.globalAlpha = EFFECTS.reducedMotion.particleMultiplier
      + model.activity.muzzlePulse * EFFECTS.reducedMotion.particleMultiplier;
    context.fillStyle = HE_SHELL.accent;
    context.beginPath();
    context.arc(
      x + side * CONSTANTS.tank.muzzleOffset,
      (anchor?.y ?? tankY) + CONSTANTS.tank.turretPivotY,
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
    const left = anchors[0]?.x ?? CONSTANTS.spawnInsetPx;
    const right = anchors[1]?.x ?? model.width - CONSTANTS.spawnInsetPx;
    const startX = fromLeft ? left : right;
    const endX = fromLeft ? right : left;
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

function drawTitleBackdrop(
  context: CanvasRenderingContext2D,
  model: TitleSceneModel,
  horizon: number,
  surface: Float32Array,
  placed: readonly TitleTankAnchor[],
): void {
  const sky = context.createLinearGradient(0, 0, 0, horizon);
  TITLE_SKY.forEach((color, index) => {
    sky.addColorStop(index === 1 ? 0.55 : index / (TITLE_SKY.length - 1), color);
  });
  context.fillStyle = sky;
  context.fillRect(0, 0, model.width, model.height);

  for (const ridge of TITLE_RIDGES) {
    context.beginPath();
    context.moveTo(0, model.height);
    for (let x = 0; x <= model.width; x += 6) {
      context.lineTo(x, ridgeY(ridge, horizon, x));
    }
    context.lineTo(model.width, model.height);
    context.closePath();
    context.fillStyle = ridge.color;
    context.fill();
  }

  context.beginPath();
  context.moveTo(0, model.height);
  for (let x = 0; x < model.width; x++) context.lineTo(x, surface[x] ?? horizon);
  context.lineTo(model.width, model.height);
  context.closePath();
  context.fillStyle = TITLE_GROUND.fill;
  context.fill();

  context.beginPath();
  for (let x = 0; x < model.width; x++) {
    const y = surface[x] ?? horizon;
    if (x === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = TITLE_GROUND.edge;
  context.lineWidth = TITLE_GROUND.capWidth;
  context.stroke();

  for (const tank of placed) {
    context.save();
    context.translate(tank.x, tank.y);
    context.scale(TITLE_TANK_SCALE, TITLE_TANK_SCALE);
    drawTankSilhouette(context, {
      x: 0,
      y: 0,
      direction: tank.direction,
      player: tank.player,
      angleDeg: HE_SHELL.demoShot.elevation ?? CONSTANTS.elevation.maxDisplay / 2,
      health: CONSTANTS.damage.startingHealth,
      active: false,
      hideHealth: true,
    });
    context.restore();
  }

  const from = placed[0];
  const to = placed[1];
  if (from && to) {
    context.save();
    context.setLineDash([...TITLE_ARC.dash]);
    context.strokeStyle = `rgba(255,140,66,${TITLE_ARC.alpha})`;
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.beginPath();
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const x = from.x + (to.x - from.x) * t;
      const y = from.y - TITLE_ARC.clearancePx - Math.sin(t * Math.PI) * TITLE_ARC.apexPx;
      if (t === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }

  const vignetteWidth = Math.min(TITLE_VIGNETTE_PX, model.width);
  const vignette = context.createLinearGradient(0, 0, vignetteWidth, 0);
  vignette.addColorStop(0, 'rgba(10,13,18,0.94)');
  vignette.addColorStop(1, 'rgba(10,13,18,0)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, vignetteWidth, model.height);
}

export interface TitleTankAnchor {
  readonly x: number;
  readonly y: number;
  readonly direction: 1 | -1;
  readonly player: 0 | 1;
}

function titleTankAnchors(
  model: TitleSceneModel,
  surface: Float32Array,
  horizon: number,
): readonly TitleTankAnchor[] {
  return TITLE_TANKS.map((tank) => {
    const x = Math.round(model.width * tank.xFraction);
    return {
      x,
      y: (surface[x] ?? horizon) - CONSTANTS.tank.hullBottom,
      direction: tank.direction,
      player: tank.player,
    };
  });
}

/** Two sines plus a deterministic wobble — a ridge, not a terrain the sim has to agree with. */
function ridgeY(
  ridge: typeof TITLE_RIDGES[number],
  horizon: number,
  x: number,
): number {
  return horizon - ridge.offset
    + Math.sin(x * 0.004 + ridge.phase) * ridge.amplitude
    + Math.sin(x * 0.013 + ridge.phase * 2) * ridge.amplitude * 0.4
    + (seededUnit(ridge.phase / 100, x) - 0.5) * 3;
}

/** The foreground ground: a real `hills` heightmap, flattened into the band below horizon. */
function titleSurface(model: TitleSceneModel, horizon: number): Float32Array {
  const heights = generateHeightmap(
    Math.max(1, Math.round(model.width)),
    Math.max(1, Math.round(model.height)),
    'hills',
    createRng(TITLE_SURFACE_SEED),
  );
  const surface = new Float32Array(heights.length);
  for (let x = 0; x < heights.length; x++) {
    surface[x] = horizon
      + ((heights[x] ?? 0) / model.height) * TITLE_GROUND.reliefPx
      - TITLE_GROUND.liftPx;
  }
  return surface;
}

const TITLE_SURFACE_SEED = hashSeed('tank-duel:title-ground');

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
