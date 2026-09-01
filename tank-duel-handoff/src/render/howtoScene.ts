import { launchProjectile, stepProjectile, type TrailPoint } from '../sim/ballistics';
import { CONSTANTS } from '../sim/constants';
import type { Rng } from '../sim/rng';
import { HE_SHELL } from '../sim/shells';
import { TERRA } from '../sim/worlds';
import { buildHowToScreenModel } from '../ui/screenModels';
import type { MotionPolicy } from './motion';
import { functionalAccent, PALETTE } from './palette';
import type { DisposableScene, SceneAnimationOptions } from './titleScene';

export type HistoricalShotResult = 'short' | 'long' | 'hit';

export interface HistoricalShot {
  readonly result: HistoricalShotResult;
  readonly power: number;
  readonly rangePx: number;
  readonly flightFrames: number;
  readonly points: readonly TrailPoint[];
  readonly styleSeed: number;
}

export interface HowtoSceneModel {
  readonly width: number;
  readonly height: number;
  readonly shots: readonly HistoricalShot[];
  readonly targetRangePx: number;
  readonly reducedMotion: boolean;
}

export interface HowtoFrameState {
  readonly activeShotIndex: number | null;
  readonly visiblePointCounts: readonly number[];
  readonly updateWork: number;
}

const HOWTO_SHOT_COUNT = buildHowToScreenModel().shots.length;
const HISTORICAL_TRAIL_WORLDS = ['rust', 'hollow'] as const;
const HOWTO_PASS_WORK_BUDGET =
  CONSTANTS.settle.hardExitFrames * HOWTO_SHOT_COUNT + HOWTO_SHOT_COUNT;
/** Total deterministic work allowed for one model update plus one canvas draw. */
export const HOWTO_FRAME_WORK_BUDGET = HOWTO_PASS_WORK_BUDGET * 2;

export function createHowtoScene(
  canvas: HTMLCanvasElement,
  options: SceneAnimationOptions,
): DisposableScene {
  const context = canvas.getContext('2d');
  if (!context) return { setPaused() {}, dispose() {} };
  const model = createHowtoSceneModel(canvas.width, canvas.height, options.rng, options.motion);
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
    const state = updateHowtoSceneModel(model, elapsedMs);
    drawHowtoScene(context, model, state);
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

export function createHowtoSceneModel(
  width: number,
  height: number,
  rng: Rng,
  motion: MotionPolicy,
): HowtoSceneModel {
  const shots = buildHowToScreenModel().shots.map((shot) =>
    historicalShot(shot.result, shot.power, rng.next()));
  const hit = shots.find((shot) => shot.result === 'hit');
  if (!hit) throw new Error('HOWTO hit trajectory is missing from spec/screens.json');
  return {
    width,
    height,
    shots,
    targetRangePx: hit.rangePx,
    reducedMotion: !motion.shake && !motion.hitstop && motion.particleMultiplier < 1,
  };
}

export function updateHowtoSceneModel(
  model: HowtoSceneModel,
  elapsedMs: number,
): HowtoFrameState {
  if (model.reducedMotion) {
    const visiblePointCounts = model.shots.map((shot) => shot.points.length);
    return {
      activeShotIndex: null,
      visiblePointCounts,
      updateWork: visiblePointCounts.reduce((sum, count) => sum + count, 0) + model.shots.length,
    };
  }

  let remainingFrames = Math.max(0, elapsedMs) * CONSTANTS.simHz / 1000;
  const visiblePointCounts: number[] = [];
  let activeShotIndex: number | null = null;
  for (let index = 0; index < model.shots.length; index++) {
    const shot = model.shots[index];
    if (!shot) continue;
    if (activeShotIndex !== null) {
      visiblePointCounts.push(0);
      continue;
    }
    if (remainingFrames > shot.flightFrames) {
      visiblePointCounts.push(shot.points.length);
      remainingFrames -= shot.flightFrames;
      continue;
    }
    activeShotIndex = index;
    visiblePointCounts.push(Math.min(shot.points.length, Math.floor(remainingFrames) + 1));
  }
  if (activeShotIndex === null && model.shots.length > 0) {
    activeShotIndex = model.shots.length - 1;
  }
  return {
    activeShotIndex,
    visiblePointCounts,
    updateWork: visiblePointCounts.reduce((sum, count) => sum + count, 0) + model.shots.length,
  };
}

export function drawHowtoScene(
  context: CanvasRenderingContext2D,
  model: HowtoSceneModel,
  frame: HowtoFrameState,
): number {
  const groundY = model.height * CONSTANTS.damage.minFractionAtEdge * 3;
  const horizontalPadding = Math.min(CONSTANTS.spawnInsetPx, model.width * CONSTANTS.damage.minFractionAtEdge);
  const maxRange = Math.max(...model.shots.map((shot) => shot.rangePx));
  const maxAltitude = Math.max(
    CONSTANTS.damage.edgePadding,
    ...model.shots.flatMap((shot) => shot.points.map((point) => -point.y)),
  );
  const xScale = (model.width - horizontalPadding * 2) / maxRange;
  const yScale = groundY * (1 - CONSTANTS.damage.minFractionAtEdge) / maxAltitude;

  context.globalAlpha = 1;
  context.fillStyle = TERRA.palette.sky[0] ?? PALETTE.skyTop;
  context.fillRect(0, 0, model.width, model.height);
  context.fillStyle = TERRA.palette.ground;
  context.fillRect(0, groundY, model.width, model.height - groundY);

  let work = model.shots.length;
  model.shots.forEach((shot, shotIndex) => {
    const visible = frame.visiblePointCounts[shotIndex] ?? 0;
    if (visible === 0) return;
    context.save();
    context.globalAlpha = shotIndex === frame.activeShotIndex || frame.activeShotIndex === null
      ? 1
      : 1 - CONSTANTS.damage.minFractionAtEdge;
    const world = HISTORICAL_TRAIL_WORLDS[shotIndex % (HISTORICAL_TRAIL_WORLDS.length + 1)];
    context.strokeStyle = world ? functionalAccent(world) : HE_SHELL.accent;
    context.lineWidth = EFFECTIVE_TRAIL_WIDTH;
    context.beginPath();
    for (let pointIndex = 0; pointIndex < visible; pointIndex++) {
      const point = shot.points[pointIndex];
      if (!point) continue;
      const x = horizontalPadding + point.x * xScale;
      const y = groundY + point.y * yScale;
      if (pointIndex === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
      work++;
    }
    context.stroke();
    context.restore();
  });

  const targetX = horizontalPadding + model.targetRangePx * xScale;
  context.fillStyle = HE_SHELL.accent;
  context.beginPath();
  context.arc(
    targetX,
    groundY,
    CONSTANTS.tank.hullHalfWidth,
    Math.PI,
    Math.PI * 2,
  );
  context.fill();
  return work;
}

const EFFECTIVE_TRAIL_WIDTH = Math.max(1, CONSTANTS.substeps / CONSTANTS.power.coarseStep);

function historicalShot(
  result: HistoricalShotResult,
  power: number,
  styleSeed: number,
): HistoricalShot {
  const elevation = HE_SHELL.demoShot.elevation;
  if (elevation === null) throw new Error('HE demo elevation is missing from spec/shells.json');
  const projectile = launchProjectile({
    x: 0,
    y: -CONSTANTS.damage.edgePadding,
    angleDeg: elevation,
    power,
    direction: 1,
    shell: HE_SHELL,
    owner: 0,
  });

  for (let flightFrames = 1; flightFrames <= CONSTANTS.settle.hardExitFrames; flightFrames++) {
    const step = stepProjectile(projectile, {
      world: TERRA,
      wind: 0,
      solidAt: (_x, y) => y >= 0,
    });
    if (step.hit) {
      return {
        result,
        power,
        rangePx: projectile.x,
        flightFrames,
        points: Object.freeze([...projectile.trail, { x: projectile.x, y: projectile.y }]),
        styleSeed,
      };
    }
  }
  throw new Error(`Historical ${result} shot did not land within the spec hard exit`);
}
