import { setActiveCrews } from '../render/palette';
import { resolveGeneratorId } from '../sim/generators';
import { makePlayerLoadouts, type PlayerLoadouts } from '../sim/playerLoadouts';
import { createRng, hashSeed } from '../sim/rng';
import { resolveWorldId, worldById } from '../sim/worlds';
import type { AppView, AppViewCallbacks } from '../ui/appView';
import { cpuPlayerLoadoutIds } from '../ui/loadout';
import {
  createDefaultConfig,
  crewLabel,
  resolveMatchConfig,
  validateConfig,
  type MatchConfig,
  type ResolvedMatchConfig,
} from '../ui/config';
import { createFlow, reduceFlow, type AppFlowState, type FlowAction, type RoundOverRecap } from '../ui/flow';
import { loadLastConfig, saveLastConfig, type StorageLike } from '../ui/storage';

export interface AppControllerDisposable {
  dispose(): void;
}

export interface PausableDisposable extends AppControllerDisposable {
  setPaused(paused: boolean): void;
}

export interface AppControllerLocation {
  readonly search: string;
}

export interface AppControllerLoadoutOptions {
  readonly onDeploy: (loadouts: PlayerLoadouts) => void;
  readonly onBack: () => void;
  readonly enabledShellIds: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
  readonly mode: MatchConfig['mode'];
  readonly cpuTierId: MatchConfig['cpuTierId'];
}

export interface AppControllerRuntimeOptions {
  readonly config: ResolvedMatchConfig;
  readonly playerLoadoutIds: PlayerLoadouts;
  readonly onComplete: (recap: RoundOverRecap) => void;
}

export interface AppControllerDependencies {
  readonly storage: StorageLike;
  readonly location: AppControllerLocation;
  readonly createView: (callbacks: AppViewCallbacks) => AppView;
  readonly createTitleScene: () => PausableDisposable;
  readonly createHowtoScene: () => PausableDisposable;
  readonly mountLoadout: (options: AppControllerLoadoutOptions) => AppControllerDisposable;
  readonly createMatchRuntime: (options: AppControllerRuntimeOptions) => PausableDisposable;
}

export interface AppController {
  readonly state: AppFlowState;
  readonly resolvedConfig: ResolvedMatchConfig | null;
  /** For chrome that lives outside the view, such as the presentation gate's way out. */
  dispatch(action: FlowAction): void;
  setPresentationBlocked(blocked: boolean): void;
  dispose(): void;
}

type MutableConfigOverrides = {
  -readonly [Key in keyof MatchConfig]?: MatchConfig[Key];
};

export function createAppController(dependencies: AppControllerDependencies): AppController {
  let disposed = false;
  let state = createFlow(initialConfig(dependencies.storage, dependencies.location));
  let resolvedConfig: ResolvedMatchConfig | null = null;
  let selectedPlayerLoadoutIds: PlayerLoadouts | null = null;
  let activeScene: PausableDisposable | null = null;
  let activeLoadout: AppControllerDisposable | null = null;
  let loadoutGeneration = 0;
  let activeRuntime: PausableDisposable | null = null;
  let presentationBlocked = false;
  let runtimeGeneration = 0;
  let view: AppView;

  const callbacks: AppViewCallbacks = {
    onAction(action) {
      transition(action);
    },
    onConfigChange(config) {
      if (disposed || (state.screen !== 'CUSTOM' && state.screen !== 'CREW')) return;
      const validated = validateConfig(config);
      if (!validated || sameConfig(state.config, validated)) return;
      state = Object.freeze({ ...state, config: guardedSave(dependencies.storage, validated) });
      resolvedConfig = null;
      publishCrews(state.config);
      view.render(state);
    },
  };

  view = dependencies.createView(callbacks);
  publishCrews(state.config);
  renderAndEnter();

  function transition(action: FlowAction): void {
    if (disposed) return;
    const previousState = state;
    const nextState = reduceFlow(previousState, action);
    if (nextState === previousState) return;

    leaveScreen(previousState.screen);
    state = nextState;

    if (action.type === 'selectMap' || action.type === 'startCustom') {
      resolvedConfig = resolveMatchConfig(state.config, createRng(state.config.seed));
    } else if (action.type === 'rematch') {
      const prior = resolvedConfig ?? resolveMatchConfig(previousState.config, createRng(previousState.config.seed));
      resolvedConfig = Object.freeze({ ...prior, seed: state.config.seed });
    } else if (action.type === 'menu' || action.type === 'quickStart' || action.type === 'openCustom') {
      resolvedConfig = null;
    }

    if (!sameConfig(previousState.config, state.config)) {
      state = Object.freeze({ ...state, config: guardedSave(dependencies.storage, state.config) });
    }
    publishCrews(state.config);
    renderAndEnter();
  }

  /**
   * The render layer owns no state, so the crews it draws with are pushed down from here —
   * the one place that knows which match config is live. Every colour and name downstream,
   * tank tones through the HUD, follows from this call.
   */
  function publishCrews(config: MatchConfig): void {
    setActiveCrews([
      { name: crewLabel(config, 0), color: config.crews[0].color },
      { name: crewLabel(config, 1), color: config.crews[1].color },
    ]);
  }

  function leaveScreen(screen: AppFlowState['screen']): void {
    disposeOwned(activeScene);
    activeScene = null;
    if (activeLoadout) loadoutGeneration++;
    disposeOwned(activeLoadout);
    activeLoadout = null;
    if (screen === 'MATCH') disposeRuntime();
  }

  function renderAndEnter(): void {
    if (disposed) return;
    view.render(renderState(state, resolvedConfig));
    if (state.screen === 'TITLE') {
      activeScene = dependencies.createTitleScene();
      if (presentationBlocked) activeScene.setPaused(true);
    } else if (state.screen === 'HOWTO') {
      activeScene = dependencies.createHowtoScene();
      if (presentationBlocked) activeScene.setPaused(true);
    } else if (state.screen === 'LOADOUT') {
      const generation = ++loadoutGeneration;
      const options: AppControllerLoadoutOptions = {
        enabledShellIds: state.config.enabledShellIds,
        mode: state.config.mode,
        cpuTierId: state.config.cpuTierId,
        onDeploy(loadouts) {
          if (disposed || state.screen !== 'LOADOUT' || generation !== loadoutGeneration) return;
          // Copy in: the deploying screen keeps no handle on what the controller now owns.
          selectedPlayerLoadoutIds = state.config.mode === 'cpu'
            ? makePlayerLoadouts(loadouts[0], cpuPlayerLoadoutIds())
            : makePlayerLoadouts(loadouts[0], loadouts[1]);
          transition({ type: 'deployLoadout' });
        },
        onBack() {
          if (disposed || state.screen !== 'LOADOUT' || generation !== loadoutGeneration) return;
          transition({ type: 'back' });
        },
        ...(selectedPlayerLoadoutIds === null ? {} : {
          initialPlayerLoadoutIds: copyLoadouts(selectedPlayerLoadoutIds),
        }),
      };
      activeLoadout = dependencies.mountLoadout(options);
    } else if (state.screen === 'MATCH') {
      startRuntime();
    }
  }

  function startRuntime(): void {
    if (activeRuntime || !resolvedConfig || !selectedPlayerLoadoutIds) return;
    const generation = ++runtimeGeneration;
    let pendingCompletion: RoundOverRecap | null = null;
    let creating = true;
    const runtime = dependencies.createMatchRuntime({
      config: resolvedConfig,
      // Copy out: a rematch reuses this value, so the runtime must not share the storage.
      playerLoadoutIds: copyLoadouts(selectedPlayerLoadoutIds),
      onComplete(recap) {
        if (disposed || generation !== runtimeGeneration || state.screen !== 'MATCH') return;
        if (creating) {
          pendingCompletion = recap;
          return;
        }
        transition({ type: 'completeMatch', recap });
      },
    });
    creating = false;

    if (pendingCompletion !== null) {
      runtime.dispose();
      transition({ type: 'completeMatch', recap: pendingCompletion });
      return;
    }
    if (disposed || generation !== runtimeGeneration || state.screen !== 'MATCH') {
      runtime.dispose();
      return;
    }
    if (presentationBlocked) runtime.setPaused(true);
    activeRuntime = runtime;
  }

  function disposeRuntime(): void {
    runtimeGeneration++;
    disposeOwned(activeRuntime);
    activeRuntime = null;
  }

  return {
    get state() {
      return state;
    },
    get resolvedConfig() {
      return resolvedConfig;
    },
    dispatch(action: FlowAction): void {
      transition(action);
    },
    setPresentationBlocked(blocked: boolean): void {
      if (disposed || presentationBlocked === blocked) return;
      presentationBlocked = blocked;
      activeScene?.setPaused(blocked);
      activeRuntime?.setPaused(blocked);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      setActiveCrews(null);
      disposeRuntime();
      disposeOwned(activeScene);
      activeScene = null;
      disposeOwned(activeLoadout);
      activeLoadout = null;
      view.dispose();
    },
  };
}

function initialConfig(storage: StorageLike, location: AppControllerLocation): MatchConfig {
  let config = guardedLoad(storage);
  const parameters = new URLSearchParams(location.search);
  const overrides: MutableConfigOverrides = {};

  if (parameters.has('seed')) overrides.seed = hashSeed(parameters.get('seed') ?? '');
  if (parameters.has('world')) overrides.selectedWorldId = resolveWorldId(parameters.get('world'));
  if (parameters.has('generator')) {
    const selectedWorldId = overrides.selectedWorldId ?? config.selectedWorldId;
    const fallbackWorldId = selectedWorldId === 'random' ? 'terra' : selectedWorldId;
    overrides.selectedGeneratorId = resolveGeneratorId(
      parameters.get('generator'),
      worldById(fallbackWorldId).generator,
    );
  }

  if (Object.keys(overrides).length > 0) {
    config = validateConfig({ ...config, ...overrides }) ?? config;
    config = guardedSave(storage, config);
  }
  return config;
}

function guardedLoad(storage: StorageLike): MatchConfig {
  try {
    return loadLastConfig(storage);
  } catch {
    return createDefaultConfig();
  }
}

function guardedSave(storage: StorageLike, config: MatchConfig): MatchConfig {
  try {
    return saveLastConfig(storage, config);
  } catch {
    return validateConfig(config) ?? createDefaultConfig();
  }
}

function renderState(
  state: AppFlowState,
  resolvedConfig: ResolvedMatchConfig | null,
): AppFlowState {
  if (!resolvedConfig || state.screen === 'TITLE' || state.screen === 'MODE' ||
    state.screen === 'CREW' || state.screen === 'MAP' || state.screen === 'CUSTOM' ||
    state.screen === 'HOWTO') {
    return state;
  }
  return Object.freeze({ ...state, config: resolvedConfig });
}

function sameConfig(left: MatchConfig, right: MatchConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function copyLoadouts(loadouts: PlayerLoadouts): PlayerLoadouts {
  return makePlayerLoadouts(loadouts[0], loadouts[1]);
}

function disposeOwned(owner: AppControllerDisposable | null): void {
  owner?.dispose();
}
