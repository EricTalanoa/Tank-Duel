import { describe, expect, it } from 'vitest';
import rawScreens from '../../spec/screens.json';
import { CONSTANTS } from '../sim/constants';
import { createRng } from '../sim/rng';
import { buildHowToScreenModel } from '../ui/screenModels';
import * as howtoScene from './howtoScene';
import { motionPolicy } from './motion';

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
  it('builds the three historical shots in short, long, hit sequence from spec-backed powers', () => {
    const model = howtoScene.createHowtoSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(71),
      motionPolicy(false),
    );
    const specShots = readHowtoShotsFromScreenSpec();

    expect(model.shots.map(({ result, power }) => ({ result, power }))).toEqual(specShots);
    expect(buildHowToScreenModel().shots).toEqual(specShots);
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

  it('exposes historical explanation only, never a current-match prediction API', () => {
    expect(Object.keys(howtoScene).some((name) => /predict|preview|current.?match/i.test(name))).toBe(false);
  });
});
