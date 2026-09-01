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
import {
  chooseCpuCommand,
  createCpuMemory,
  observeCpuImpact as observeCpuImpactMemory,
  type CpuCommand,
  type CpuMemory,
  type CpuTierId,
} from '../sim/cpu';
import { hashSeed } from '../sim/rng';
import { CONSTANTS } from '../sim/constants';
import { HE_SHELL } from '../sim/shells';
import type { PlayerLoadouts } from '../sim/playerLoadouts';
import { createRenderer, type Renderer } from '../render/renderer';
import type { HudChrome } from '../render/hud';
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
  readonly mode: 'local' | 'cpu';
  readonly cpuTierId: CpuTierId;
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
    world: GameState['world'],
    chrome: HudChrome,
  ): Renderer;
  attachControls(options: AimControlsOptions): Controls;
}

export interface CreateMatchRuntimeOptions {
  readonly canvas: HTMLCanvasElement;
  readonly config: MatchRuntimeConfig;
  /** Both players' complete decks, already validated by `makePlayerLoadouts`. */
  readonly playerLoadoutIds: PlayerLoadouts;
  readonly onComplete: (recap: RoundOverRecap) => void;
  /** HUD chrome the simulation does not own: rounds, turn timer, the dev telemetry flag. */
  readonly hudChrome?: HudChrome;
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
  const renderer = dependencies.createRenderer(
    options.canvas,
    state.terrain,
    effects,
    state.world,
    options.hudChrome ?? {},
  );
  const spentShellIdsByPlayer = [new Set<string>(), new Set<string>()] as const;
  let cpuMemory: CpuMemory = createCpuMemory();
  let lastCpuCommand: CpuCommand | null = null;
  let lastCpuCommandWind: number | null = null;
  let consumedResolvedImpact = state.lastResolvedShotImpact;

  const unlockAudio = (): void => {
    void audio.unlock().catch(() => undefined);
  };

  const controls = dependencies.attachControls({
    angleFineStep: CONSTANTS.elevation.fineStep,
    angleCoarseStep: CONSTANTS.elevation.coarseStep,
    powerFineStep: CONSTANTS.power.fineStep,
    powerCoarseStep: CONSTANTS.power.coarseStep,
    onAngle: (delta) => {
      if (disposed || paused) return;
      unlockAudio();
      adjustAngle(state, delta);
    },
    onPower: (delta) => {
      if (disposed || paused) return;
      unlockAudio();
      adjustPower(state, delta);
    },
    onFire: () => {
      if (disposed || paused) return;
      unlockAudio();
      const player = state.activePlayer;
      const shellId = state.arsenals[player].selectedShellId;
      if (fire(state)) spentShellIdsByPlayer[player].add(shellId);
    },
    onShell: (slot) => {
      if (disposed || paused) return;
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

  const consumeCpuImpact = (): void => {
    const impact = state.lastResolvedShotImpact;
    if (impact === consumedResolvedImpact) return;
    consumedResolvedImpact = impact;
    if (impact?.owner !== 1 || lastCpuCommand === null || lastCpuCommandWind === null) return;
    cpuMemory = observeCpuImpactMemory(cpuMemory, lastCpuCommand, impact.x, lastCpuCommandWind);
  };

  const scheduleCpuTurn = (): void => {
    if (options.config.mode !== 'cpu') return;
    consumeCpuImpact();
    if (state.phase !== 'aim' || state.activePlayer !== 1) return;

    const shooter = state.tanks[1];
    const target = state.tanks[0];
    const command = chooseCpuCommand({
      tierId: options.config.cpuTierId,
      memory: cpuMemory,
      distance: Math.abs(target.x - shooter.x),
      targetX: target.x,
      direction: shooter.direction,
      wind: state.wind,
      rng: state.rng,
    });
    const heSlot = state.arsenals[1].slots.findIndex((weapon) => weapon.shell.id === HE_SHELL.id) + 1;
    if (heSlot === 0) return;

    adjustAngle(state, command.elevationDeg - state.aim.angleDeg);
    adjustPower(state, command.power - state.aim.power);
    if (!selectShell(state, heSlot) || !fire(state)) return;

    spentShellIdsByPlayer[1].add(HE_SHELL.id);
    lastCpuCommand = command;
    lastCpuCommandWind = state.wind;
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
    for (let index = 0; index < steps; index++) {
      dependencies.step(state, NO_INPUT);
      scheduleCpuTurn();
    }
    if (steps === 0) scheduleCpuTurn();
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
