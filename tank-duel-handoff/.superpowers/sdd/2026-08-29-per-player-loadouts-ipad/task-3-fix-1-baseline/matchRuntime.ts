import { createClock, pump, alpha, type Clock } from '../sim/clock';
import {
  adjustAngle,
  adjustPower,
  createWorld,
  fire,
  selectShell,
  step,
  NO_INPUT,
  type CreateWorldOptions,
  type GameState,
  type SimInput,
} from '../sim/world';
import { hashSeed } from '../sim/rng';
import { CONSTANTS } from '../sim/constants';
import type { PlayerLoadouts } from '../sim/playerLoadouts';
import { createRenderer, type Renderer } from '../render/renderer';
import {
  attachAimControls,
  type AimControlsOptions,
  type Controls,
} from '../input/controls';
import { createEffects, type EffectsEngine } from '../render/effects';
import { motionPolicy } from '../render/motion';
import {
  createFlightStepScaler,
  simulationStepsForFrame,
  type FlightStepScaler,
} from '../render/framePolicy';
import { createAudio, type EffectsAudio } from '../render/audio';
import {
  drainPresentationEvents,
  type PresentationEvent,
} from '../sim/presentation';
import type { GeneratorId } from '../sim/terrain';
import type { WorldId } from '../sim/worlds';
import type { RoundOverRecap } from '../ui/flow';

export interface MatchRuntimeConfig {
  readonly seed: number;
  readonly worldId: WorldId;
  readonly generatorId: GeneratorId;
}

export interface ReducedMotionListener {
  readonly matches: boolean;
  dispose(): void;
}

export interface MatchRuntimeDependencies {
  now(): number;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
  createWorld(seed: number, options?: CreateWorldOptions): GameState;
  createClock(): Clock;
  createFlightStepScaler(): FlightStepScaler;
  step(state: GameState, input: SimInput): GameState;
  drainPresentationEvents(queue: PresentationEvent[]): PresentationEvent[];
  createReducedMotionListener(
    onChange: (matches: boolean) => void,
  ): ReducedMotionListener;
  createEffects(seed: number, policy: ReturnType<typeof motionPolicy>): EffectsEngine;
  createAudio(): EffectsAudio;
  createRenderer(
    canvas: HTMLCanvasElement,
    terrain: GameState['terrain'],
    effects: EffectsEngine,
  ): Renderer;
  attachControls(options: AimControlsOptions): Controls;
}

export interface CreateMatchRuntimeOptions {
  readonly canvas: HTMLCanvasElement;
  readonly config: MatchRuntimeConfig;
  /** Both players' complete decks, already validated by `makePlayerLoadouts`. */
  readonly playerLoadoutIds: PlayerLoadouts;
  readonly onComplete: (recap: RoundOverRecap) => void;
  readonly dependencies?: Partial<MatchRuntimeDependencies>;
}

export interface MatchRuntime {
  readonly state: GameState;
  /**
   * Suspends and resumes the frame loop without touching sim state. Idempotent in both
   * directions, and inert after disposal. Task 5's orientation gate is the caller.
   */
  setPaused(paused: boolean): void;
  dispose(): void;
}

const BROWSER_DEPENDENCIES: MatchRuntimeDependencies = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
  createWorld,
  createClock,
  createFlightStepScaler,
  step,
  drainPresentationEvents,
  createReducedMotionListener: createBrowserReducedMotionListener,
  createEffects,
  createAudio: () => createAudio(),
  createRenderer,
  attachControls: (options) => attachAimControls(window, options),
};

export function createMatchRuntime(options: CreateMatchRuntimeOptions): MatchRuntime {
  const dependencies: MatchRuntimeDependencies = {
    ...BROWSER_DEPENDENCIES,
    ...options.dependencies,
  };
  let disposed = false;
  const state = dependencies.createWorld(options.config.seed, {
    playerLoadoutIds: options.playerLoadoutIds,
    worldId: options.config.worldId,
    generator: options.config.generatorId,
  });
  const clock = dependencies.createClock();
  const flightStepScaler = dependencies.createFlightStepScaler();
  let effectsForMotionChange: EffectsEngine | null = null;
  const reducedMotion = dependencies.createReducedMotionListener((matches) => {
    if (disposed) return;
    effectsForMotionChange?.setPolicy(motionPolicy(matches));
  });
  const effects = dependencies.createEffects(
    hashSeed(`${state.seed}:effects`),
    motionPolicy(reducedMotion.matches),
  );
  effectsForMotionChange = effects;
  const audio = dependencies.createAudio();
  const renderer = dependencies.createRenderer(options.canvas, state.terrain, effects);
  const spentShellIdsByPlayer = [new Set<string>(), new Set<string>()] as const;

  const unlockAudio = (): void => {
    void audio.unlock().catch(() => undefined);
  };

  const controls = dependencies.attachControls({
    angleFineStep: CONSTANTS.elevation.fineStep,
    angleCoarseStep: CONSTANTS.elevation.coarseStep,
    powerFineStep: CONSTANTS.power.fineStep,
    powerCoarseStep: CONSTANTS.power.coarseStep,
    onAngle: (delta) => {
      if (disposed) return;
      unlockAudio();
      adjustAngle(state, delta);
    },
    onPower: (delta) => {
      if (disposed) return;
      unlockAudio();
      adjustPower(state, delta);
    },
    onFire: () => {
      if (disposed) return;
      unlockAudio();
      const player = state.activePlayer;
      const shellId = state.arsenals[player].selectedShellId;
      if (fire(state)) spentShellIdsByPlayer[player].add(shellId);
    },
    onShell: (slot) => {
      if (disposed) return;
      unlockAudio();
      selectShell(state, slot);
    },
  });

  const inspection = { state, clock };
  const inspectionTarget = globalThis as unknown as Record<string, unknown>;
  if (import.meta.env.DEV) inspectionTarget['__tankDuel'] = inspection;

  let last = dependencies.now();
  let completionReported = false;
  let frameHandle: number | null = null;
  let paused = false;

  const cancelPendingFrame = (): void => {
    if (frameHandle === null) return;
    dependencies.cancelFrame(frameHandle);
    frameHandle = null;
  };

  const reportCompletion = (): void => {
    if (completionReported || state.phase !== 'round_over') return;
    completionReported = true;
    const recap: RoundOverRecap = Object.freeze({
      spentShellIdsByPlayer: Object.freeze(
        spentShellIdsByPlayer.map((shellIds) => Object.freeze([...shellIds])),
      ),
    });
    options.onComplete(recap);
  };

  const frame = (now: number): void => {
    if (disposed || paused) return;
    frameHandle = null;
    const elapsedSeconds = (now - last) / 1_000;
    last = now;

    const requestedSteps = pump(clock, elapsedSeconds);
    const steps = simulationStepsForFrame(
      flightStepScaler,
      requestedSteps,
      effects.shouldPauseSimulation(),
      state.phase,
      state.world.flightTimeScale,
    );
    for (let index = 0; index < steps; index++) dependencies.step(state, NO_INPUT);
    const events = dependencies.drainPresentationEvents(state.presentationEvents);
    effects.consume(events);
    for (const event of events) {
      if (event.type === 'muzzleFlash') audio.playFire();
      else if (event.type === 'impact') audio.playImpact();
      else audio.playDirectHit();
    }
    if (state.terrainDirty.length > 0) {
      renderer.terrainChanged(state.terrainDirty);
      state.terrainDirty = [];
    }

    renderer.draw(state, { stepsThisFrame: steps, alpha: alpha(clock) });
    if (events.length === 0) effects.advanceFrame();
    reportCompletion();
    if (!disposed && !paused) frameHandle = dependencies.requestFrame(frame);
  };

  frameHandle = dependencies.requestFrame(frame);

  return {
    state,
    setPaused(nextPaused) {
      if (disposed || paused === nextPaused) return;
      paused = nextPaused;
      if (paused) {
        cancelPendingFrame();
        return;
      }
      // Rebase the frame clock: the paused wall-clock interval is not simulation time.
      // Billing it to the accumulator would fast-forward the match by up to the 250 ms
      // clamp on the first frame back (CLAUDE.md non-negotiable 1).
      last = dependencies.now();
      if (frameHandle === null) frameHandle = dependencies.requestFrame(frame);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelPendingFrame();
      controls.dispose();
      reducedMotion.dispose();
      if (import.meta.env.DEV && inspectionTarget['__tankDuel'] === inspection) {
        delete inspectionTarget['__tankDuel'];
      }
    },
  };
}

function createBrowserReducedMotionListener(
  onChange: (matches: boolean) => void,
): ReducedMotionListener {
  const query = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  const handleChange = (event: MediaQueryListEvent): void => { onChange(event.matches); };
  query.addEventListener('change', handleChange);
  return {
    matches: query.matches,
    dispose: () => { query.removeEventListener('change', handleChange); },
  };
}
