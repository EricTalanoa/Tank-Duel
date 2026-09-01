import { describe, expect, it } from 'vitest';
import rawScreens from '../../spec/screens.json';
import { CONSTANTS } from '../sim/constants';
import { PRESENTATION } from './presentation';
import { createRng } from '../sim/rng';
import { HE_SHELL } from '../sim/shells';
import type { WorldId } from '../sim/worlds';
import { buildHowToScreenModel } from '../ui/screenModels';
import * as howtoScene from './howtoScene';
import { motionPolicy } from './motion';
import * as palette from './palette';

type FunctionalAccent = (world: WorldId) => string;
const functionalAccent = (palette as unknown as { readonly functionalAccent: FunctionalAccent })
  .functionalAccent;

function createCanvasContextDouble(): {
  readonly context: CanvasRenderingContext2D;
  readonly drawCalls: () => number;
} {
  let calls = 0;
  const draw = (): void => {
    calls++;
  };
  const context = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    createLinearGradient() { return { addColorStop() {} } as unknown as CanvasGradient; },
    setLineDash() {},
    scale() {},
    ellipse() {},
    save() {},
    restore() {},
    fillRect: draw,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill: draw,
    stroke: draw,
    translate() {},
  } as unknown as CanvasRenderingContext2D;
  return { context, drawCalls: () => calls };
}

function readHowtoShotsFromScreenSpec(): readonly {
  readonly result: howtoScene.HistoricalShotResult;
  readonly power: number;
}[] {
  const record = rawScreens.screens.find((screen) => screen.id === 'HOWTO');
  const teaches = record && 'teaches' in record ? String(record.teaches) : '';
  const matches = [...teaches.matchAll(/(short|long|hit)\s+(\d+)/g)];
  if (matches.length !== 3) throw new Error('Expected three HOWTO shots in spec/screens.json');
  return matches.map((match) => ({
    result: match[1] as howtoScene.HistoricalShotResult,
    power: Number(match[2]),
  }));
}

describe('HOWTO scene model', () => {
  it('keeps historical trajectory colors functional rather than player-owned', () => {
    // Break caught: mapping synthetic historical shots to playerColor by shot index.
    const strokes: string[] = [];
    const context = {
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createLinearGradient() { return { addColorStop() {} } as unknown as CanvasGradient; },
      setLineDash() {}, scale() {}, ellipse() {},
      lineCap: 'butt' as CanvasLineCap,
      save() {}, restore() {}, fillRect() {}, beginPath() {}, closePath() {}, fill() {},
      moveTo() {}, lineTo() {}, arc() {}, translate() {},
      stroke(this: { strokeStyle: string }) { strokes.push(this.strokeStyle); },
    } as unknown as CanvasRenderingContext2D;
    const model: howtoScene.HowtoSceneModel = {
      width: 900,
      height: CONSTANTS.fieldHeight,
      targetRangePx: 100,
      reducedMotion: false,
      shots: [
        { result: 'short', power: 50, rangePx: 60, flightFrames: 1, styleSeed: 0, points: [{ x: 0, y: 0 }, { x: 60, y: -20 }] },
        { result: 'long', power: 75, rangePx: 100, flightFrames: 1, styleSeed: 0, points: [{ x: 0, y: 0 }, { x: 100, y: -30 }] },
        { result: 'hit', power: 90, rangePx: 120, flightFrames: 1, styleSeed: 0, points: [{ x: 0, y: 0 }, { x: 120, y: -40 }] },
      ],
    };

    howtoScene.drawHowtoScene(context, model, {
      activeShotIndex: null,
      visiblePointCounts: [2, 2, 2],
      updateWork: 0,
    });

    // The three trajectory strokes come first; the two tanks drawn after them are the only
    // player-owned colour in this scene.
    expect(strokes.slice(0, 3)).toEqual([
      functionalAccent('rust'),
      functionalAccent('hollow'),
      HE_SHELL.accent,
    ]);
    const playerColours = PRESENTATION.players.map((player) => player.color);
    expect(strokes.slice(0, 3).some((stroke) => playerColours.includes(stroke))).toBe(false);
  });

  it('builds the three historical shots in short, long, hit sequence from spec-backed powers', () => {
    const model = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(71),
      motionPolicy(false),
    );
    const specShots = readHowtoShotsFromScreenSpec();

    expect(model.shots.map(({ result, power }) => ({ result, power }))).toEqual(specShots);
    expect(buildHowToScreenModel().shots.map(({ result, power }) => ({ result, power })))
      .toEqual(specShots);
    const [short, long, hit] = model.shots;
    expect(short?.rangePx).toBeLessThan(hit?.rangePx ?? 0);
    expect(hit?.rangePx).toBeLessThan(long?.rangePx ?? 0);
    expect(model.targetRangePx).toBe(hit?.rangePx);
  });

  it('reveals short, then long, then hit with bounded deterministic work', () => {
    const model = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(73),
      motionPolicy(false),
    );
    const [short, long] = model.shots;
    if (!short || !long) throw new Error('HOWTO history is incomplete');

    const first = howtoScene.updateHowtoSceneModel(model, 0);
    const second = howtoScene.updateHowtoSceneModel(
      model,
      ((short.flightFrames + 1) * 1000) / CONSTANTS.simHz,
    );
    const third = howtoScene.updateHowtoSceneModel(
      model,
      ((short.flightFrames + long.flightFrames + 1) * 1000) / CONSTANTS.simHz,
    );

    expect([first.activeShotIndex, second.activeShotIndex, third.activeShotIndex]).toEqual([0, 1, 2]);
    expect(first.visiblePointCounts[1]).toBe(0);
    expect(second.visiblePointCounts[0]).toBe(short.points.length);
    expect(second.visiblePointCounts[2]).toBe(0);
    expect(third.visiblePointCounts[1]).toBe(long.points.length);
    expect(Math.max(first.updateWork, second.updateWork, third.updateWork)).toBeLessThanOrEqual(
      howtoScene.HOWTO_FRAME_WORK_BUDGET,
    );
  });

  it('bounds total update plus draw work through partial and complete history states', () => {
    const model = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(77),
      motionPolicy(false),
    );
    const reducedModel = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(77),
      motionPolicy(true),
    );
    const transitionFrames = model.shots.reduce<number[]>(
      (frames, shot) => [...frames, (frames.at(-1) ?? 0) + shot.flightFrames + 1],
      [0],
    );
    const states = transitionFrames.map((frames) => ({
      model,
      frame: howtoScene.updateHowtoSceneModel(model, (frames * 1000) / CONSTANTS.simHz),
    }));
    states.push({
      model: reducedModel,
      frame: howtoScene.updateHowtoSceneModel(reducedModel, 0),
    });

    for (const state of states) {
      const canvas = createCanvasContextDouble();
      const drawWork = howtoScene.drawHowtoScene(canvas.context, state.model, state.frame);
      expect(state.frame.updateWork + drawWork).toBeLessThanOrEqual(
        howtoScene.HOWTO_FRAME_WORK_BUDGET,
      );
      expect(canvas.drawCalls()).toBeGreaterThan(0);
    }
  });

  it('shows the complete explanatory history without spatial animation in reduced motion', () => {
    const model = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(79),
      motionPolicy(true),
    );
    const frame = howtoScene.updateHowtoSceneModel(model, 0);

    expect(frame.activeShotIndex).toBeNull();
    expect(frame.visiblePointCounts).toEqual(model.shots.map((shot) => shot.points.length));
  });

  it('owns one frame loop, draws, and disposes idempotently', () => {
    let callback: ((timestamp: number) => void) | undefined;
    let requested = 0;
    let cancelled = 0;
    const canvasContext = createCanvasContextDouble();
    const canvas = {
      width: CONSTANTS.defaultFieldWidth,
      height: CONSTANTS.fieldHeight,
      getContext: () => canvasContext.context,
    } as unknown as HTMLCanvasElement;
    const scene = howtoScene.createHowtoScene(canvas, {
      requestFrame: (next) => {
        requested++;
        callback = next;
        return requested;
      },
      cancelFrame: () => {
        cancelled++;
      },
      now: () => 1000 / CONSTANTS.simHz,
      rng: createRng(83),
      motion: motionPolicy(false),
    });

    callback?.(1000 / CONSTANTS.simHz);
    expect(canvasContext.drawCalls()).toBeGreaterThan(0);
    scene.dispose();
    scene.dispose();
    callback?.(1000 / CONSTANTS.simHz);
    expect(requested).toBe(2);
    expect(cancelled).toBe(1);
  });

  it('cancels one frame while paused and resumes with exactly one frame without recreating history', () => {
    let callback: ((timestamp: number) => void) | undefined;
    let requested = 0;
    let cancelled = 0;
    let now = 0;
    const canvasContext = createCanvasContextDouble();
    const canvas = {
      width: CONSTANTS.defaultFieldWidth,
      height: CONSTANTS.fieldHeight,
      getContext: () => canvasContext.context,
    } as unknown as HTMLCanvasElement;
    const scene = howtoScene.createHowtoScene(canvas, {
      requestFrame(next) { requested++; callback = next; return requested; },
      cancelFrame() { cancelled++; },
      now: () => now,
      rng: createRng(89),
      motion: motionPolicy(false),
    });

    callback?.(now);
    scene.setPaused(true);
    scene.setPaused(true);
    const requestsBeforeResume = requested;
    now += 10_000;
    scene.setPaused(false);
    scene.setPaused(false);

    expect(cancelled).toBe(1);
    expect(requested).toBe(requestsBeforeResume + 1);
    callback?.(now);
    expect(canvasContext.drawCalls()).toBeGreaterThan(0);
    scene.dispose();
    scene.setPaused(false);
    expect(requested).toBe(requestsBeforeResume + 2);
  });

  it('exposes historical explanation only, never a current-match prediction API', () => {
    expect(Object.keys(howtoScene).some((name) => /predict|preview|current.?match/i.test(name))).toBe(false);
  });
});
