import { resolveGeneratorId } from '../sim/generators';
import { createRng, hashSeed } from '../sim/rng';
import { resolveWorldId, worldById } from '../sim/worlds';
import type { AppView, AppViewCallbacks } from '../ui/appView';
import {
  createDefaultConfig,
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

export interface AppControllerLocation {
  readonly search: string;
}

export interface AppControllerLoadoutOptions {
  readonly onDeploy: (ids: readonly string[]) => void;
  readonly enabledShellIds: readonly string[];
  readonly initialShellIds?: readonly string[];
}

export interface AppControllerRuntimeOptions {
  readonly config: ResolvedMatchConfig;
  readonly loadoutIds: readonly string[];
  readonly onComplete: (recap: RoundOverRecap) => void;
}

export interface AppControllerDependencies {
  readonly storage: StorageLike;
  readonly location: AppControllerLocation;
  readonly createView: (callbacks: AppViewCallbacks) => AppView;
  readonly createTitleScene: () => AppControllerDisposable;
  readonly createHowtoScene: () => AppControllerDisposable;
  readonly mountLoadout: (options: AppControllerLoadoutOptions) => AppControllerDisposable;
  readonly createMatchRuntime: (options: AppControllerRuntimeOptions) => AppControllerDisposable;
}

export interface AppController {
  readonly state: AppFlowState;
  readonly resolvedConfig: ResolvedMatchConfig | null;
  dispose(): void;
}

type MutableConfigOverrides = {
  -readonly [Key in keyof MatchConfig]?: MatchConfig[Key];
};

export function createAppController(dependencies: AppControllerDependencies): AppController {
  let disposed = false;
  let state = createFlow(initialConfig(dependencies.storage, dependencies.location));
  let resolvedConfig: ResolvedMatchConfig | null = null;
  let selectedLoadoutIds: readonly string[] | null = null;
  let activeScene: AppControllerDisposable | null = null;
  let activeLoadout: AppControllerDisposable | null = null;
  let activeRuntime: AppControllerDisposable | null = null;
  let runtimeGeneration = 0;
  let view: AppView;

  const callbacks: AppViewCallbacks = {
    onAction(action) {
      transition(action);
    },
    onConfigChange(config) {
      if (disposed || state.screen !== 'CUSTOM') return;
      const validated = validateConfig(config);
      if (!validated || sameConfig(state.config, validated)) return;
      state = Object.freeze({ ...state, config: guardedSave(dependencies.storage, validated) });
      resolvedConfig = null;
      view.render(state);
    },
  };

  view = dependencies.createView(callbacks);
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
    renderAndEnter();
  }

  function leaveScreen(screen: AppFlowState['screen']): void {
    disposeOwned(activeScene);
    activeScene = null;
    disposeOwned(activeLoadout);
    activeLoadout = null;
    if (screen === 'MATCH') disposeRuntime();
  }

  function renderAndEnter(): void {
    if (disposed) return;
    view.render(renderState(state, resolvedConfig));
    if (state.screen === 'TITLE') {
      activeScene = dependencies.createTitleScene();
    } else if (state.screen === 'HOWTO') {
      activeScene = dependencies.createHowtoScene();
    } else if (state.screen === 'LOADOUT') {
      const options: AppControllerLoadoutOptions = {
        enabledShellIds: state.config.enabledShellIds,
        onDeploy(ids) {
          if (disposed || state.screen !== 'LOADOUT') return;
          selectedLoadoutIds = Object.freeze([...ids]);
          transition({ type: 'deployLoadout' });
        },
        ...(selectedLoadoutIds === null ? {} : { initialShellIds: selectedLoadoutIds }),
      };
      activeLoadout = dependencies.mountLoadout(options);
    } else if (state.screen === 'MATCH') {
      startRuntime();
    }
  }

  function startRuntime(): void {
    if (activeRuntime || !resolvedConfig || !selectedLoadoutIds) return;
    const generation = ++runtimeGeneration;
    let pendingCompletion: RoundOverRecap | null = null;
    let creating = true;
    const runtime = dependencies.createMatchRuntime({
      config: resolvedConfig,
      loadoutIds: selectedLoadoutIds,
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
    dispose() {
      if (disposed) return;
      disposed = true;
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
    state.screen === 'MAP' || state.screen === 'CUSTOM' || state.screen === 'HOWTO') {
    return state;
  }
  return Object.freeze({ ...state, config: resolvedConfig });
}

function sameConfig(left: MatchConfig, right: MatchConfig): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function disposeOwned(owner: AppControllerDisposable | null): void {
  owner?.dispose();
}
