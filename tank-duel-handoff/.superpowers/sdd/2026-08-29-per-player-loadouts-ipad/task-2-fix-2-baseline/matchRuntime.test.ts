import { afterEach, describe, expect, it } from 'vitest';
import { DT, createClock } from '../sim/clock';
import {
  createWorld,
  step as stepWorld,
  type CreateWorldOptions,
  type GameState,
  type SimInput,
} from '../sim/world';
import { createFlightStepScaler } from '../render/framePolicy';
import type { EffectsEngine } from '../render/effects';
import type { EffectsAudio } from '../render/audio';
import type { Renderer } from '../render/renderer';
import type { Controls, AimControlsOptions } from '../input/controls';
import type { MotionPolicy } from '../render/motion';
import {
  drainPresentationEvents,
  type PresentationEvent,
} from '../sim/presentation';
import type { RoundOverRecap } from '../ui/flow';
import {
  createMatchRuntime,
  type MatchRuntimeDependencies,
  type ReducedMotionListener,
} from './matchRuntime';

interface Harness {
  readonly state: GameState;
  readonly frames: FrameRequestCallback[];
  readonly cancelledFrames: number[];
  readonly controls: AimControlsOptions[];
  readonly consumedEvents: PresentationEvent[][];
  readonly policies: MotionPolicy[];
  readonly audioCalls: string[];
  readonly terrainChanges: { readonly x0: number; readonly x1: number }[][];
  readonly draws: { readonly stepsThisFrame: number; readonly alpha: number }[];
  readonly order: string[];
  readonly counts: Record<string, number>;
  readonly worldOptions: (CreateWorldOptions | undefined)[];
  readonly dependencies: MatchRuntimeDependencies;
  changeReducedMotion(matches: boolean): void;
}

function createHarness(): Harness {
  const state = createWorld(17, { worldId: 'terra', generator: 'hills' });
  const frames: FrameRequestCallback[] = [];
  const cancelledFrames: number[] = [];
  const controls: AimControlsOptions[] = [];
  const consumedEvents: PresentationEvent[][] = [];
  const policies: MotionPolicy[] = [];
  const audioCalls: string[] = [];
  const terrainChanges: { readonly x0: number; readonly x1: number }[][] = [];
  const draws: { readonly stepsThisFrame: number; readonly alpha: number }[] = [];
  const order: string[] = [];
  const counts: Record<string, number> = {};
  const worldOptions: (CreateWorldOptions | undefined)[] = [];
  let reducedMotionChange: ((matches: boolean) => void) | undefined;

  const count = (name: string): void => {
    counts[name] = (counts[name] ?? 0) + 1;
  };

  const effects: EffectsEngine = {
    activeParticleCount: 0,
    shakeFrames: 0,
    hitstopFrames: 0,
    shakeOffset: { x: 0, y: 0 },
    consume(events) {
      order.push('effects.consume');
      consumedEvents.push([...events]);
    },
    setPolicy(policy) { policies.push(policy); },
    shouldPauseSimulation: () => false,
    advanceFrame: () => {
      order.push('effects.advanceFrame');
      count('advanceFrame');
    },
    draw: () => undefined,
    particleSnapshot: () => [],
  };
  const audio: EffectsAudio = {
    unlock: async () => { audioCalls.push('unlock'); },
    playFire: () => {
      order.push('audio.fire');
      audioCalls.push('fire');
    },
    playImpact: () => {
      order.push('audio.impact');
      audioCalls.push('impact');
    },
    playDirectHit: () => {
      order.push('audio.directHit');
      audioCalls.push('directHit');
    },
  };
  const renderer: Renderer = {
    draw(_state, telemetry) {
      order.push('renderer.draw');
      draws.push({ ...telemetry });
    },
    terrainChanged(ranges) {
      order.push('renderer.terrainChanged');
      terrainChanges.push(ranges.map((range) => ({ ...range })));
    },
    screenToField: () => null,
  };

  const dependencies: MatchRuntimeDependencies = {
    now: () => 1_000,
    requestFrame(callback) {
      order.push('raf.request');
      frames.push(callback);
      return frames.length;
    },
    cancelFrame(handle) { cancelledFrames.push(handle); },
    createWorld(_seed: number, options?: CreateWorldOptions) {
      count('world');
      worldOptions.push(options);
      return state;
    },
    createClock() {
      count('clock');
      return createClock();
    },
    createFlightStepScaler() {
      count('flightStepScaler');
      return createFlightStepScaler();
    },
    step(target: GameState, input: SimInput) {
      order.push('sim.step');
      return stepWorld(target, input);
    },
    drainPresentationEvents(queue: PresentationEvent[]) {
      order.push('events.drain');
      return drainPresentationEvents(queue);
    },
    createReducedMotionListener(onChange): ReducedMotionListener {
      count('reducedMotionListener');
      reducedMotionChange = onChange;
      return {
        matches: false,
        dispose: () => { count('reducedMotionDispose'); },
      };
    },
    createEffects() {
      count('effects');
      return effects;
    },
    createAudio() {
      count('audio');
      return audio;
    },
    createRenderer() {
      count('renderer');
      return renderer;
    },
    attachControls(options): Controls {
      count('controls');
      controls.push(options);
      return { dispose: () => { count('controlsDispose'); } };
    },
  };

  return {
    state,
    frames,
    cancelledFrames,
    controls,
    consumedEvents,
    policies,
    audioCalls,
    terrainChanges,
    draws,
    order,
    counts,
    worldOptions,
    dependencies,
    changeReducedMotion(matches) { reducedMotionChange?.(matches); },
  };
}

// Production supplies a complete deck: deploymentShellIds always includes the free
// HE shell in slot one (src/ui/loadout.ts), so the fixture must have the same shape.
const DEPLOYED_SHELL_IDS: readonly string[] = [
  'he',
  'mortar',
  'cluster',
  'buster',
  'roller',
  'anvil',
];

function startRuntime(
  harness: Harness,
  onComplete: (recap: RoundOverRecap) => void = () => undefined,
) {
  return createMatchRuntime({
    canvas: {} as HTMLCanvasElement,
    config: { seed: 17, worldId: 'terra', generatorId: 'hills' },
    loadoutIds: DEPLOYED_SHELL_IDS,
    onComplete,
    dependencies: harness.dependencies,
  });
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)['__tankDuel'];
});

describe('match runtime lifecycle', () => {
  it('owns one resource set and starts one fixed-step frame loop', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);

    expect(runtime.state).toBe(harness.state);
    expect(harness.counts).toMatchObject({
      world: 1,
      clock: 1,
      flightStepScaler: 1,
      reducedMotionListener: 1,
      effects: 1,
      audio: 1,
      renderer: 1,
      controls: 1,
    });
    expect(harness.frames).toHaveLength(1);
    expect((globalThis as unknown as Record<string, { state?: GameState }>)['__tankDuel']?.state)
      .toBe(runtime.state);

    runtime.dispose();
  });

  it('passes the supplied complete deck to both players without duplicating HE', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);

    expect(harness.worldOptions).toHaveLength(1);
    const playerLoadoutIds = harness.worldOptions[0]?.playerLoadoutIds;
    expect(playerLoadoutIds?.[0]).toEqual(DEPLOYED_SHELL_IDS);
    expect(playerLoadoutIds?.[1]).toEqual(DEPLOYED_SHELL_IDS);
    for (const deck of playerLoadoutIds ?? []) {
      expect(deck[0]).toBe('he');
      expect(deck.filter((id) => id === 'he')).toHaveLength(1);
    }

    runtime.dispose();
  });

  it('preserves step, event/audio, terrain repaint, draw, motion, and scheduling order', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    harness.order.length = 0;
    harness.state.terrainDirty = [{ x0: 2, x1: 5 }];
    harness.state.presentationEvents.push(
      { type: 'muzzleFlash', x: 1, y: 2, shellId: 'he', accent: '#fff' },
      { type: 'impact', x: 3, y: 4, shellId: 'he', accent: '#fff', blastRadius: 10 },
      { type: 'directHit', x: 5, y: 6, shellId: 'he', player: 1 },
    );

    harness.frames[0]!(1_000 + DT * 1_000 + 0.001);

    expect(harness.order).toEqual([
      'sim.step',
      'events.drain',
      'effects.consume',
      'audio.fire',
      'audio.impact',
      'audio.directHit',
      'renderer.terrainChanged',
      'renderer.draw',
      'raf.request',
    ]);
    expect(harness.state.frame).toBe(1);
    expect(harness.consumedEvents[0]?.map((event) => event.type))
      .toEqual(['muzzleFlash', 'impact', 'directHit']);
    expect(harness.audioCalls).toEqual(['fire', 'impact', 'directHit']);
    expect(harness.terrainChanges).toEqual([[{ x0: 2, x1: 5 }]]);
    expect(harness.state.terrainDirty).toEqual([]);
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.stepsThisFrame).toBe(1);
    expect(harness.counts.advanceFrame ?? 0).toBe(0);
    expect(harness.frames).toHaveLength(2);

    harness.changeReducedMotion(true);
    expect(harness.policies).toEqual([{
      shake: false,
      hitstop: false,
      particleMultiplier: 0.25,
      trajectories: true,
    }]);

    harness.order.length = 0;
    harness.frames[1]!(1_000 + DT * 2_000 + 0.002);
    expect(harness.order).toEqual([
      'sim.step',
      'events.drain',
      'effects.consume',
      'renderer.draw',
      'effects.advanceFrame',
      'raf.request',
    ]);
    expect(harness.counts.advanceFrame).toBe(1);
    runtime.dispose();
  });

  it('stops all work and scheduling after idempotent disposal', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    const queuedFrame = harness.frames[0]!;
    const controls = harness.controls[0]!;
    const initialAim = { ...harness.state.aim };
    const initialShell = harness.state.arsenals[0].selectedShellId;

    runtime.dispose();
    runtime.dispose();
    queuedFrame(2_000);
    controls.onAngle(10);
    controls.onPower(10);
    controls.onShell(2);
    controls.onFire();
    harness.changeReducedMotion(true);

    expect(harness.cancelledFrames).toEqual([1]);
    expect(harness.counts.controlsDispose).toBe(1);
    expect(harness.counts.reducedMotionDispose).toBe(1);
    expect(harness.state.frame).toBe(0);
    expect(harness.state.aim).toEqual(initialAim);
    expect(harness.state.arsenals[0].selectedShellId).toBe(initialShell);
    expect(harness.consumedEvents).toEqual([]);
    expect(harness.audioCalls).toEqual([]);
    expect(harness.policies).toEqual([]);
    expect(harness.draws).toEqual([]);
    expect(harness.frames).toHaveLength(1);
  });

  it('reports terminal completion once with shells from successful fires', () => {
    const harness = createHarness();
    const recaps: unknown[] = [];
    const runtime = startRuntime(harness, (recap) => { recaps.push(recap); });
    const controls = harness.controls[0]!;

    controls.onFire();
    controls.onFire();
    harness.state.roundResult = 0;
    harness.state.phase = 'round_over';
    harness.frames[0]!(1_000);
    harness.frames[1]!(1_001);

    expect(recaps).toEqual([{
      spentShellIdsByPlayer: [['he'], []],
    }]);
    runtime.dispose();
  });

  it('does not reschedule when completion synchronously disposes the runtime', () => {
    const harness = createHarness();
    let runtime: ReturnType<typeof startRuntime> | null = null;
    runtime = startRuntime(harness, () => {
      harness.order.push('onComplete');
      runtime?.dispose();
      runtime?.dispose();
    });
    const completingFrame = harness.frames[0]!;
    harness.state.roundResult = 0;
    harness.state.phase = 'round_over';
    harness.order.length = 0;

    completingFrame(1_000);
    const orderAfterCompletion = [...harness.order];
    completingFrame(1_001);
    runtime.dispose();

    expect(orderAfterCompletion).toEqual([
      'events.drain',
      'effects.consume',
      'renderer.draw',
      'effects.advanceFrame',
      'onComplete',
    ]);
    expect(harness.order).toEqual(orderAfterCompletion);
    expect(harness.frames).toHaveLength(1);
    expect(harness.draws).toHaveLength(1);
    expect(harness.counts.controlsDispose).toBe(1);
    expect(harness.counts.reducedMotionDispose).toBe(1);
  });
});
