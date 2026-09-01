import { describe, expect, it } from 'vitest';
import { CONSTANTS } from '../sim/constants';
import { createRng } from '../sim/rng';
import { worldById, type WorldId } from '../sim/worlds';
import { motionPolicy } from './motion';
import * as palette from './palette';
import {
  TITLE_FRAME_WORK_BUDGET,
  createTitleScene,
  createTitleSceneModel,
  drawTitleScene,
  snapshotTitleScene,
  titleScenePoolCounts,
  updateTitleSceneModel,
} from './titleScene';

type FunctionalAccent = (world: WorldId) => string;
const functionalAccent = (palette as unknown as { readonly functionalAccent: FunctionalAccent })
  .functionalAccent;

describe('title scene model', () => {
  it('orchestrates every title animation system required by the screen spec', () => {
    const model = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(11),
      motionPolicy(false),
    );

    expect(model.systems).toEqual([
      'embers',
      'drifting cloud bands',
      'sweeping beams',
      'waving flags',
      'twinkling stars',
      'pulsing muzzle glow',
      'periodic exchange of fire',
    ]);
  });

  it('produces deterministic state from injected seed and elapsed time', () => {
    const create = (seed: number) => createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(seed),
      motionPolicy(false),
    );
    const first = create(29);
    const second = create(29);
    const different = create(30);
    const elapsedMs = (CONSTANTS.simHz * CONSTANTS.power.coarseStep * 1000) / CONSTANTS.simHz;

    updateTitleSceneModel(first, elapsedMs);
    updateTitleSceneModel(second, elapsedMs);
    updateTitleSceneModel(different, elapsedMs);

    expect(snapshotTitleScene(first)).toEqual(snapshotTitleScene(second));
    expect(snapshotTitleScene(first)).not.toEqual(snapshotTitleScene(different));
  });

  it('keeps every pool and each frame of work bounded over a long run', () => {
    const model = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(47),
      motionPolicy(false),
    );
    const initialCounts = titleScenePoolCounts(model);

    for (let frame = 0; frame < CONSTANTS.settle.hardExitFrames * CONSTANTS.power.coarseStep; frame++) {
      const work = updateTitleSceneModel(model, (frame * 1000) / CONSTANTS.simHz);
      expect(work).toBeLessThanOrEqual(TITLE_FRAME_WORK_BUDGET);
    }

    expect(titleScenePoolCounts(model)).toEqual(initialCounts);
    expect(Object.values(initialCounts).every((count) => count > 0)).toBe(true);
  });

  it('materially quiets decoration under the injected reduced-motion policy', () => {
    const full = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(53),
      motionPolicy(false),
    );
    const reduced = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(53),
      motionPolicy(true),
    );
    const elapsedMs = (CONSTANTS.settle.quietFrames * 1000) / CONSTANTS.simHz;

    updateTitleSceneModel(full, elapsedMs);
    updateTitleSceneModel(reduced, elapsedMs);

    const fullCounts = titleScenePoolCounts(full);
    const reducedCounts = titleScenePoolCounts(reduced);
    const reducedSnapshot = snapshotTitleScene(reduced);
    expect(reduced.systems).toEqual(full.systems);
    expect(reducedCounts.embers).toBeLessThan(fullCounts.embers);
    expect(reducedCounts.stars).toBeLessThan(fullCounts.stars);
    expect(reducedSnapshot.activity.cloudDrift).toBe(0);
    expect(reducedSnapshot.activity.beamSweep).toBe(0);
    expect(reducedSnapshot.activity.flagWave).toBe(0);
    expect(reducedSnapshot.activity.exchangeProgress).toBeNull();
  });

  it('owns one injected frame loop and disposes it idempotently', () => {
    let callback: ((timestamp: number) => void) | undefined;
    let requested = 0;
    let cancelled = 0;
    let now = 0;
    let drawCalls = 0;
    const context = {
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createLinearGradient() { return { addColorStop() {} } as unknown as CanvasGradient; },
      setLineDash() {}, scale() {}, ellipse() {},
      lineCap: 'butt' as CanvasLineCap,
      save() {}, restore() {}, fillRect() { drawCalls++; }, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, translate() {}, rotate() {},
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: CONSTANTS.defaultFieldWidth,
      height: CONSTANTS.fieldHeight,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    const scene = createTitleScene(canvas, {
      requestFrame: (next) => {
        requested++;
        callback = next;
        return requested;
      },
      cancelFrame: () => {
        cancelled++;
      },
      now: () => now,
      rng: createRng(59),
      motion: motionPolicy(false),
    });

    expect(requested).toBe(1);
    now = 1000 / CONSTANTS.simHz;
    callback?.(now);
    expect(requested).toBe(2);
    expect(drawCalls).toBeGreaterThan(0);

    scene.dispose();
    scene.dispose();
    callback?.(now);
    expect(cancelled).toBe(1);
    expect(requested).toBe(2);
  });

  it('cancels one frame while paused and resumes without resetting its animation timeline', () => {
    let callback: ((timestamp: number) => void) | undefined;
    let requested = 0;
    let cancelled = 0;
    let now = 0;
    const canvas = {
      width: CONSTANTS.defaultFieldWidth,
      height: CONSTANTS.fieldHeight,
      getContext: () => ({
        globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt' as CanvasLineCap,
        createLinearGradient: () => ({ addColorStop() {} } as unknown as CanvasGradient),
        setLineDash() {}, scale() {}, ellipse() {},
        save() {}, restore() {}, fillRect() {}, beginPath() {}, closePath() {},
        moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, translate() {}, rotate() {},
      } as unknown as CanvasRenderingContext2D),
    } as unknown as HTMLCanvasElement;
    const scene = createTitleScene(canvas, {
      requestFrame(next) { requested++; callback = next; return requested; },
      cancelFrame() { cancelled++; },
      now: () => now,
      rng: createRng(67),
      motion: motionPolicy(false),
    });

    now = 1000 / CONSTANTS.simHz;
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
    scene.dispose();
    scene.setPaused(false);
    expect(requested).toBe(requestsBeforeResume + 2);
  });

  it('draws every required system within the deterministic frame-work budget', () => {
    const context = {
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createLinearGradient() { return { addColorStop() {} } as unknown as CanvasGradient; },
      setLineDash() {}, scale() {}, ellipse() {},
      lineCap: 'butt' as CanvasLineCap,
      save() {}, restore() {}, fillRect() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, translate() {}, rotate() {},
    } as unknown as CanvasRenderingContext2D;
    const model = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(61),
      motionPolicy(false),
    );
    const updateWork = updateTitleSceneModel(
      model,
      (CONSTANTS.settle.quietFrames * 1000) / CONSTANTS.simHz,
    );
    const drawWork = drawTitleScene(context, model);

    expect(model.systems.every((system) => drawWork.bySystem[system] > 0)).toBe(true);
    expect(updateWork + drawWork.total).toBeLessThanOrEqual(TITLE_FRAME_WORK_BUDGET);
  });

  it('keeps TITLE flags on their functional colors rather than gameplay identity colors', () => {
    // Break caught: indexing playerColor for non-player title decoration.
    const fills: string[] = [];
    const context = {
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createLinearGradient() { return { addColorStop() {} } as unknown as CanvasGradient; },
      setLineDash() {}, scale() {}, ellipse() {},
      lineCap: 'butt' as CanvasLineCap,
      save() {}, restore() {}, fillRect() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, stroke() {}, translate() {}, rotate() {},
      fill(this: { fillStyle: string }) { fills.push(this.fillStyle); },
    } as unknown as CanvasRenderingContext2D;
    const model = createTitleSceneModel(
      CONSTANTS.defaultFieldWidth,
      CONSTANTS.fieldHeight,
      createRng(73),
      motionPolicy(false),
    );

    drawTitleScene(context, model);

    expect(fills).toEqual(expect.arrayContaining([
      functionalAccent('rust'),
      functionalAccent('hollow'),
    ]));
  });

  it('exposes functional decorative accents from the world spec through the render contract', () => {
    // Break caught: a render accessor drifts from spec-backed functional accents.
    expect(functionalAccent('rust')).toBe(worldById('rust').palette.accent);
    expect(functionalAccent('hollow')).toBe(worldById('hollow').palette.accent);
  });
});
