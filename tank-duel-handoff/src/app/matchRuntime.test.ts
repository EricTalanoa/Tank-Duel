import { afterEach, describe, expect, it, vi } from 'vitest';
import { DT, createClock } from '../sim/clock';
import { CONSTANTS } from '../sim/constants';
import { surfaceY } from '../sim/terrain';
import {
  createWorld,
  step as stepWorld,
  type CreateWorldOptions,
  type GameState,
  type ResolvedShotImpact,
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
import { createLoadout } from '../sim/loadout';
import { makePlayerLoadouts, type PlayerLoadouts } from '../sim/playerLoadouts';
import { deploymentShellIds } from '../ui/loadout';
import {
  createMatchRuntime,
  type MatchRuntimeConfig,
  type MatchRuntimeDependencies,
  type ReducedMotionListener,
} from './matchRuntime';
import { chooseCpuCommand, createCpuMemory } from '../sim/cpu';
import { fire, step } from '../sim/world';
import type { TouchControlCallbacks, TouchControlState } from '../ui/touchControls';

/**
 * The exact decks the loadout screen deploys for these picks: built through the same
 * `createLoadout` → `deploymentShellIds` path production uses, so they are legal by
 * construction rather than by assertion. `createLoadout` throws on an unplayable id or
 * a deck over `spec/constants.json → loadout.points`, and `deploymentShellIds` supplies
 * the locked HE slot and the canonical `PLAYABLE_WEAPONS` order.
 *
 * The two decks share nothing but the locked HE slot. Two copies of one deck could not
 * distinguish per-player plumbing from the shared-deck contract it replaces.
 */
const PLAYER_ONE_SHELL_IDS: readonly string[] = deploymentShellIds(
  createLoadout(['mortar', 'cluster', 'skipper', 'drill']),
);
const PLAYER_TWO_SHELL_IDS: readonly string[] = deploymentShellIds(
  createLoadout(['sand', 'roller', 'buster', 'napalm']),
);
const PLAYER_LOADOUT_IDS: PlayerLoadouts = makePlayerLoadouts(
  PLAYER_ONE_SHELL_IDS,
  PLAYER_TWO_SHELL_IDS,
);

interface Harness {
  readonly state: GameState;
  readonly frames: FrameRequestCallback[];
  readonly cancelledFrames: number[];
  readonly controls: AimControlsOptions[];
  readonly consumedEvents: PresentationEvent[][];
  readonly resolvedImpacts: ResolvedShotImpact[];
  readonly policies: MotionPolicy[];
  readonly audioCalls: string[];
  readonly terrainChanges: { readonly x0: number; readonly x1: number }[][];
  readonly draws: { readonly stepsThisFrame: number; readonly alpha: number }[];
  readonly order: string[];
  readonly counts: Record<string, number>;
  readonly worldOptions: (CreateWorldOptions | undefined)[];
  readonly createWorld: MatchRuntimeDependencies['createWorld'];
  readonly dependencies: MatchRuntimeDependencies;
  changeReducedMotion(matches: boolean): void;
  /** Moves the wall clock the runtime samples, so a paused interval can pass. */
  setNow(value: number): void;
  runNextFrame(): void;
}

function createHarness(): Harness {
  const state = createWorld(17, { worldId: 'terra', generator: 'hills' });
  const frames: FrameRequestCallback[] = [];
  const cancelledFrames: number[] = [];
  const controls: AimControlsOptions[] = [];
  const consumedEvents: PresentationEvent[][] = [];
  const resolvedImpacts: ResolvedShotImpact[] = [];
  const policies: MotionPolicy[] = [];
  const audioCalls: string[] = [];
  const terrainChanges: { readonly x0: number; readonly x1: number }[][] = [];
  const draws: { readonly stepsThisFrame: number; readonly alpha: number }[] = [];
  const order: string[] = [];
  const counts: Record<string, number> = {};
  const worldOptions: (CreateWorldOptions | undefined)[] = [];
  let reducedMotionChange: ((matches: boolean) => void) | undefined;
  let nowValue = 1_000;
  let frameNow = nowValue;

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

  const createWorldSpy = vi.fn((_seed: number, options?: CreateWorldOptions): GameState => {
    count('world');
    worldOptions.push(options);
    return state;
  });

  const dependencies: MatchRuntimeDependencies = {
    now: () => nowValue,
    requestFrame(callback) {
      order.push('raf.request');
      frames.push(callback);
      return frames.length;
    },
    cancelFrame(handle) { cancelledFrames.push(handle); },
    createWorld: createWorldSpy,
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
      const previousImpact = target.lastResolvedShotImpact;
      const result = stepWorld(target, input);
      if (result.lastResolvedShotImpact !== previousImpact && result.lastResolvedShotImpact !== null) {
        resolvedImpacts.push(result.lastResolvedShotImpact);
      }
      return result;
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
    resolvedImpacts,
    policies,
    audioCalls,
    terrainChanges,
    draws,
    order,
    counts,
    worldOptions,
    createWorld: createWorldSpy,
    dependencies,
    changeReducedMotion(matches) { reducedMotionChange?.(matches); },
    setNow(value) { nowValue = value; frameNow = value; },
    runNextFrame() {
      frameNow += 250;
      const callback = frames.at(-1);
      if (!callback) throw new Error('expected a scheduled runtime frame');
      callback(frameNow);
    },
  };
}

const LOCAL_RUNTIME_CONFIG: MatchRuntimeConfig = Object.freeze({
  seed: 17,
  worldId: 'terra',
  generatorId: 'hills',
  mode: 'local',
  cpuTierId: 'gunner',
});

const CPU_RUNTIME_CONFIG: MatchRuntimeConfig = Object.freeze({
  ...LOCAL_RUNTIME_CONFIG,
  mode: 'cpu',
  cpuTierId: 'recruit',
});

function startRuntime(
  harness: Harness,
  onComplete: (recap: RoundOverRecap) => void = () => undefined,
  config: MatchRuntimeConfig = LOCAL_RUNTIME_CONFIG,
) {
  return createMatchRuntime({
    canvas: {} as HTMLCanvasElement,
    config,
    playerLoadoutIds: PLAYER_LOADOUT_IDS,
    onComplete,
    dependencies: harness.dependencies,
  });
}

function advanceUntil(harness: Harness, predicate: () => boolean): void {
  for (let frame = 0; frame < 500; frame++) {
    if (predicate()) return;
    harness.runNextFrame();
  }
  throw new Error(`runtime did not reach the expected state: ${harness.state.phase}, player ${harness.state.activePlayer}, frame ${harness.state.frame}`);
}

function humanFireToCpuTurn(harness: Harness): void {
  harness.controls[0]?.onFire();
  advanceUntil(harness, () => harness.state.activePlayer === 1 &&
    (harness.state.phase === 'aim' || harness.state.phase === 'flight'));
  if (harness.state.phase === 'aim') harness.runNextFrame();
}

function advanceWorldToCpuAim(state: GameState): void {
  if (!fire(state)) throw new Error('expected Player 1 normal HE fire');
  for (let frame = 0; frame < 20_000; frame++) {
    if (state.phase === 'aim' && state.activePlayer === 1) return;
    step(state);
  }
  throw new Error('world did not reach Player 2 AIM');
}

function muzzleFlashCount(harness: Harness, player: 0 | 1): number {
  return harness.consumedEvents.flat().filter((event) => event.type === 'muzzleFlash' && event.player === player).length;
}

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)['__tankDuel'];
});

describe('match runtime lifecycle', () => {
  it('routes touch controls through the same guarded aim and fire path', () => {
    const harness = createHarness();
    let touch: TouchControlCallbacks | undefined;
    const rendered: TouchControlState[] = [];
    const runtime = createMatchRuntime({
      canvas: {} as HTMLCanvasElement,
      controlRoot: {} as HTMLElement,
      config: LOCAL_RUNTIME_CONFIG,
      playerLoadoutIds: PLAYER_LOADOUT_IDS,
      onComplete: () => undefined,
      dependencies: {
        ...harness.dependencies,
        mountTouchControls(_root, callbacks) {
          touch = callbacks;
          return { render: (state) => { rendered.push(state); }, dispose() {} };
        },
        attachPointerDragControls() { return { dispose() {} }; },
      },
    });

    expect(touch).toBeDefined();
    expect(rendered.at(-1)?.shells).toHaveLength(harness.state.arsenals[0].slots.length);
    touch!.onAngle(55);
    touch!.onPower(82);
    touch!.onShell(2);
    touch!.onFire();
    touch!.onFire();

    expect(harness.state.aim).toEqual({ angleDeg: 55, power: 82 });
    expect(harness.state.projectile?.shell.id).toBe('mortar');
    expect(harness.state.projectiles).toHaveLength(1);
    runtime.dispose();
  });

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

  it('passes the two independent decks to createWorld unchanged', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);

    expect(harness.createWorld).toHaveBeenCalledWith(17, expect.objectContaining({
      playerLoadoutIds: PLAYER_LOADOUT_IDS,
    }));
    expect(harness.worldOptions).toHaveLength(1);
    const playerLoadoutIds = harness.worldOptions[0]?.playerLoadoutIds;
    // Identity, not just equality: the runtime forwards the tuple it was given rather
    // than rebuilding one, so there is no second path into createWorld to keep in step.
    expect(playerLoadoutIds).toBe(PLAYER_LOADOUT_IDS);
    expect(playerLoadoutIds?.[0]).toEqual(PLAYER_ONE_SHELL_IDS);
    expect(playerLoadoutIds?.[1]).toEqual(PLAYER_TWO_SHELL_IDS);
    expect(playerLoadoutIds?.[0]).not.toEqual(playerLoadoutIds?.[1]);

    runtime.dispose();
  });

  it('preserves step, event/audio, terrain repaint, draw, motion, and scheduling order', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    harness.order.length = 0;
    harness.state.terrainDirty = [{ x0: 2, x1: 5 }];
    harness.state.presentationEvents.push(
      { type: 'muzzleFlash', x: 1, y: 2, shellId: 'he', accent: '#fff', player: 0 },
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

  it('suppresses advancement while paused and resumes on one fresh-baseline frame', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    const pendingFrame = harness.frames[0]!;

    runtime.setPaused(true);
    runtime.setPaused(true);
    pendingFrame(1_000 + DT * 1_000 + 0.001);

    expect(harness.cancelledFrames).toEqual([1]);
    expect(harness.state.frame).toBe(0);
    expect(harness.draws).toEqual([]);
    expect(harness.frames).toHaveLength(1);
    expect(harness.counts.controlsDispose ?? 0).toBe(0);
    expect(harness.counts.reducedMotionDispose ?? 0).toBe(0);

    // Five seconds blocked. Billing that to the accumulator would fast-forward the match
    // by MAX_STEPS_PER_FRAME steps on the first frame back — the clamp's failure mode.
    harness.setNow(6_000);
    runtime.setPaused(false);
    runtime.setPaused(false);

    expect(harness.frames).toHaveLength(2);
    expect(harness.cancelledFrames).toEqual([1]);

    harness.frames[1]!(6_000 + DT * 1_000 + 0.001);

    expect(harness.state.frame).toBe(1);
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.stepsThisFrame).toBe(1);
    expect(harness.frames).toHaveLength(3);

    runtime.dispose();
  });

  it('ignores player input while paused and accepts it after resume', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    const controls = harness.controls[0]!;
    const initialAim = { ...harness.state.aim };
    const initialShell = harness.state.arsenals[0].selectedShellId;

    runtime.setPaused(true);
    controls.onAngle(10);
    controls.onPower(10);
    controls.onShell(2);
    controls.onFire();

    expect(harness.state.aim).toEqual(initialAim);
    expect(harness.state.arsenals[0].selectedShellId).toBe(initialShell);
    expect(harness.state.projectile).toBeNull();
    expect(harness.state.projectiles).toEqual([]);
    expect(harness.state.phase).toBe('aim');
    expect(harness.audioCalls).toEqual([]);

    runtime.setPaused(false);
    controls.onAngle(10);
    controls.onPower(10);
    controls.onShell(2);
    controls.onFire();

    expect(harness.state.aim).toEqual({
      angleDeg: initialAim.angleDeg + 10,
      power: initialAim.power + 10,
    });
    expect(harness.state.arsenals[0].selectedShellId).toBe('mortar');
    expect(harness.state.projectile?.shell.id).toBe('mortar');
    expect(harness.state.phase).toBe('flight');
    expect(harness.audioCalls).toEqual(['unlock', 'unlock', 'unlock', 'unlock']);

    runtime.dispose();
  });

  it('stays disposed when resumed after disposal while paused', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness);
    const pendingFrame = harness.frames[0]!;

    runtime.setPaused(true);
    runtime.dispose();
    runtime.setPaused(false);
    pendingFrame(9_000);

    expect(harness.frames).toHaveLength(1);
    expect(harness.cancelledFrames).toEqual([1]);
    expect(harness.counts.controlsDispose).toBe(1);
    expect(harness.counts.reducedMotionDispose).toBe(1);
    expect(harness.state.frame).toBe(0);
    expect(harness.draws).toEqual([]);
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
      result: 0,
      turns: harness.state.turn,
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

describe('CPU match runtime scheduling', () => {
  it('catches an implementation that automates either player in local mode', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, LOCAL_RUNTIME_CONFIG);

    for (let frame = 0; frame < 4; frame++) harness.runNextFrame();

    expect(harness.state.phase).toBe('aim');
    expect(harness.state.activePlayer).toBe(0);
    expect(muzzleFlashCount(harness, 0)).toBe(0);
    expect(muzzleFlashCount(harness, 1)).toBe(0);
    runtime.dispose();
  });

  it('catches an implementation that automates Player 1 in CPU mode', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);

    for (let frame = 0; frame < 4; frame++) harness.runNextFrame();

    expect(harness.state.phase).toBe('aim');
    expect(harness.state.activePlayer).toBe(0);
    expect(muzzleFlashCount(harness, 0)).toBe(0);
    expect(muzzleFlashCount(harness, 1)).toBe(0);
    runtime.dispose();
  });

  it('catches a CPU turn that does not issue one HE command through normal simulation APIs', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);

    humanFireToCpuTurn(harness);

    const expected = chooseCpuCommand({
      tierId: 'recruit',
      memory: createCpuMemory(),
      distance: Math.abs(harness.state.tanks[0].x - harness.state.tanks[1].x),
      targetX: harness.state.tanks[0].x,
      direction: harness.state.tanks[1].direction,
      wind: harness.state.wind,
      rng: harness.state.rng.clone(),
    });
    expect(harness.state.projectile?.owner).toBe(1);
    expect(harness.state.projectile?.shell.id).toBe('he');
    expect(harness.state.aim).toEqual({ angleDeg: expected.elevationDeg, power: expected.power });
    expect(muzzleFlashCount(harness, 0)).toBe(1);
    expect(muzzleFlashCount(harness, 1)).toBe(1);
    runtime.dispose();
  });

  it('catches repeated active frames that duplicate one Player 2 shot', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);

    humanFireToCpuTurn(harness);
    for (let frame = 0; frame < 4; frame++) harness.runNextFrame();

    expect(muzzleFlashCount(harness, 1)).toBe(1);
    expect(harness.state.arsenals[1].ammo.he).toBe('inf');
    runtime.dispose();
  });

  it('catches CPU scheduling that runs before pause or more than once after a paused Player 2 AIM resumes', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);
    const staleFrame = harness.frames[0]!;

    runtime.setPaused(true);
    advanceWorldToCpuAim(harness.state);
    staleFrame(1_250);

    expect(harness.state.phase).toBe('aim');
    expect(harness.state.activePlayer).toBe(1);
    expect(muzzleFlashCount(harness, 1)).toBe(0);

    runtime.setPaused(false);
    harness.runNextFrame();
    harness.runNextFrame();

    expect(muzzleFlashCount(harness, 1)).toBe(1);
    expect(harness.state.phase).toBe('flight');
    runtime.dispose();
  });

  it('catches an observation path that skips a new CPU impact or consumes Player 1’s later impact', () => {
    const harness = createHarness();
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);
    harness.state.tanks[0].health = 10_000;
    harness.state.tanks[1].health = 10_000;
    harness.state.tanks[0].x = 490;
    harness.state.tanks[1].x = 710;
    harness.state.tanks[0].y = surfaceY(harness.state.terrain, harness.state.tanks[0].x)
      - CONSTANTS.tank.hullBottom;
    harness.state.tanks[1].y = surfaceY(harness.state.terrain, harness.state.tanks[1].x)
      - CONSTANTS.tank.hullBottom;

    humanFireToCpuTurn(harness);
    const firstCommand = Object.freeze({ ...harness.state.aim });
    advanceUntil(harness, () => harness.state.phase === 'aim' && harness.state.activePlayer === 0 &&
      harness.resolvedImpacts.some((impact) => impact.owner === 1));
    const firstImpact = harness.resolvedImpacts.find((impact) => impact.owner === 1);
    if (!firstImpact) throw new Error('expected one real CPU-owned resolved impact');

    humanFireToCpuTurn(harness);

    expect(harness.state.aim.angleDeg).toBe(45);
    expect(harness.state.aim.power).not.toBe(firstCommand.power);
    expect(harness.resolvedImpacts.filter((impact) => impact.owner === 1)).toHaveLength(1);
    expect(muzzleFlashCount(harness, 1)).toBe(2);
    runtime.dispose();
  });

  it('catches a Player 1 impact treated as CPU observation before the next command', () => {
    const harness = createHarness();
    advanceWorldToCpuAim(harness.state);
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);

    harness.runNextFrame();

    const expected = chooseCpuCommand({
      tierId: 'recruit',
      memory: createCpuMemory(),
      distance: Math.abs(harness.state.tanks[0].x - harness.state.tanks[1].x),
      targetX: harness.state.tanks[0].x,
      direction: harness.state.tanks[1].direction,
      wind: harness.state.wind,
      rng: harness.state.rng.clone(),
    });
    expect(harness.state.aim).toEqual({ angleDeg: expected.elevationDeg, power: expected.power });
    expect(harness.state.lastResolvedShotImpact?.owner).toBe(0);
    runtime.dispose();
  });

  it('catches a stale Player 2 impact consumed by a newly created runtime', () => {
    const harness = createHarness();
    advanceWorldToCpuAim(harness.state);
    harness.state.lastResolvedShotImpact = Object.freeze({ owner: 1, x: 1, y: 1 });
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);

    harness.runNextFrame();

    const expected = chooseCpuCommand({
      tierId: 'recruit',
      memory: createCpuMemory(),
      distance: Math.abs(harness.state.tanks[0].x - harness.state.tanks[1].x),
      targetX: harness.state.tanks[0].x,
      direction: harness.state.tanks[1].direction,
      wind: harness.state.wind,
      rng: harness.state.rng.clone(),
    });
    expect(harness.state.aim).toEqual({ angleDeg: expected.elevationDeg, power: expected.power });
    expect(muzzleFlashCount(harness, 1)).toBe(1);
    runtime.dispose();
  });

  it('catches CPU command memory shared across runtime recreation', () => {
    const firstHarness = createHarness();
    const firstRuntime = startRuntime(firstHarness, undefined, CPU_RUNTIME_CONFIG);
    humanFireToCpuTurn(firstHarness);
    firstRuntime.dispose();

    const secondHarness = createHarness();
    const secondRuntime = startRuntime(secondHarness, undefined, CPU_RUNTIME_CONFIG);
    humanFireToCpuTurn(secondHarness);

    const expected = chooseCpuCommand({
      tierId: 'recruit',
      memory: createCpuMemory(),
      distance: Math.abs(secondHarness.state.tanks[0].x - secondHarness.state.tanks[1].x),
      targetX: secondHarness.state.tanks[0].x,
      direction: secondHarness.state.tanks[1].direction,
      wind: secondHarness.state.wind,
      rng: secondHarness.state.rng.clone(),
    });
    expect(secondHarness.state.aim).toEqual({ angleDeg: expected.elevationDeg, power: expected.power });
    expect(muzzleFlashCount(secondHarness, 1)).toBe(1);
    secondRuntime.dispose();
  });

  it('catches stale callbacks that fire after a CPU runtime is disposed', () => {
    const harness = createHarness();
    advanceWorldToCpuAim(harness.state);
    const runtime = startRuntime(harness, undefined, CPU_RUNTIME_CONFIG);
    const staleFrame = harness.frames[0]!;

    runtime.dispose();
    staleFrame(1_250);

    expect(harness.state.phase).toBe('aim');
    expect(harness.state.activePlayer).toBe(1);
    expect(muzzleFlashCount(harness, 1)).toBe(0);
    expect(harness.frames).toHaveLength(1);
  });
});
