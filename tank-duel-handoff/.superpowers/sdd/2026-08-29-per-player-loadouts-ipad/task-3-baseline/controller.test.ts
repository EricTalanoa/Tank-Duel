import { describe, expect, it } from 'vitest';
import { hashSeed } from '../sim/rng';
import { SHIPPED_WORLDS } from '../sim/worlds';
import { createDefaultConfig, validateConfig, type MatchConfig } from '../ui/config';
import type { AppViewCallbacks } from '../ui/appView';
import type { AppFlowState, FlowAction, RoundOverRecap } from '../ui/flow';
import { loadLastConfig, saveLastConfig, type StorageLike } from '../ui/storage';
import {
  createAppController,
  type AppControllerLoadoutOptions,
  type AppControllerRuntimeOptions,
} from './controller';

describe('application controller', () => {
  it('loads persisted choices, applies only explicit URL overrides once, and preserves later saved changes on reload', () => {
    const storage = new MemoryStorage();
    saveLastConfig(storage, configWith({
      path: 'custom',
      selectedWorldId: 'rust',
      selectedGeneratorId: 'plates',
      seed: 7,
      rounds: 5,
      wind: 'light',
      turnTimer: '30',
    }));
    const first = createHarness({
      storage,
      search: '?seed=shared-shot&world=vesper&generator=canyon',
    });

    expect(first.controller.state.config).toMatchObject({
      selectedWorldId: 'vesper',
      selectedGeneratorId: 'canyon',
      seed: hashSeed('shared-shot'),
      rounds: 5,
      wind: 'light',
      turnTimer: '30',
    });

    first.dispatch({ type: 'openCustom' });
    const changed = configWith({
      ...first.controller.state.config,
      path: 'custom',
      selectedWorldId: 'terra',
      selectedGeneratorId: 'hills',
      seed: 99,
      rounds: 1,
      wind: 'off',
      turnTimer: '15',
    });
    first.changeConfig(changed);
    first.dispatch({ type: 'startCustom' });

    expect(first.controller.state.config).toEqual(changed);
    expect(loadLastConfig(storage)).toEqual(changed);
    first.controller.dispose();

    const reloaded = createHarness({ storage, search: '' });
    expect(reloaded.controller.state.config).toEqual(changed);
    reloaded.controller.dispose();
  });

  it('keeps CPU non-startable and owns scenes only while TITLE or HOWTO is visible', () => {
    const harness = createHarness();

    expect(harness.controller.state.screen).toBe('TITLE');
    expect(harness.titleScenes).toHaveLength(1);
    expect(harness.titleScenes[0]?.disposeCount).toBe(0);

    harness.dispatch({ type: 'openHowTo' });
    expect(harness.controller.state.screen).toBe('HOWTO');
    expect(harness.titleScenes[0]?.disposeCount).toBe(1);
    expect(harness.howtoScenes).toHaveLength(1);

    harness.dispatch({ type: 'back' });
    expect(harness.controller.state.screen).toBe('TITLE');
    expect(harness.howtoScenes[0]?.disposeCount).toBe(1);
    expect(harness.titleScenes).toHaveLength(2);

    harness.dispatch({ type: 'openMode' });
    const renderCount = harness.rendered.length;
    harness.dispatch({ type: 'selectMode', mode: 'cpu' });

    expect(harness.controller.state.screen).toBe('MODE');
    expect(harness.controller.state.config.mode).toBe('local');
    expect(harness.rendered).toHaveLength(renderCount);
    expect(harness.runtimes).toHaveLength(0);
    harness.controller.dispose();
  });

  it('resolves Random at map selection, not earlier, and shows the concrete intro configuration', () => {
    const harness = createHarness();

    expect(harness.controller.resolvedConfig).toBeNull();
    harness.dispatch({ type: 'quickStart' });
    expect(harness.controller.resolvedConfig).toBeNull();

    harness.dispatch({ type: 'selectMap', worldId: 'random' });

    const resolved = harness.controller.resolvedConfig;
    expect(harness.controller.state.screen).toBe('ROUND_INTRO');
    expect(resolved?.selectedWorldId).toBe('random');
    expect(SHIPPED_WORLDS.map((world) => world.id)).toContain(resolved?.worldId);
    expect(resolved?.worldId).not.toBe('random');
    expect(harness.rendered.at(-1)?.config).toMatchObject({
      selectedWorldId: 'random',
      worldId: resolved?.worldId,
      generatorId: resolved?.generatorId,
    });
    expect(harness.runtimes).toHaveLength(0);
    harness.controller.dispose();
  });

  it('carries accepted Custom Game settings through intro and loadout into the runtime', () => {
    const harness = createHarness();
    harness.dispatch({ type: 'openCustom' });
    const custom = configWith({
      ...harness.controller.state.config,
      path: 'custom',
      selectedWorldId: 'vesper',
      selectedGeneratorId: 'canyon',
      seed: 0x1234abcd,
      rounds: 5,
      wind: 'light',
      turnTimer: '30',
    });

    harness.changeConfig(custom);
    harness.dispatch({ type: 'startCustom' });
    expect(harness.controller.state.screen).toBe('ROUND_INTRO');
    expect(harness.controller.resolvedConfig).toMatchObject({
      selectedWorldId: custom.selectedWorldId,
      worldId: custom.selectedWorldId,
      generatorId: custom.selectedGeneratorId,
      seed: custom.seed,
      rounds: custom.rounds,
      wind: custom.wind,
      turnTimer: custom.turnTimer,
    });

    harness.dispatch({ type: 'openLoadout' });
    harness.loadouts[0]!.options.onDeploy(['he', 'mortar']);

    expect(harness.controller.state.screen).toBe('MATCH');
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0]!.options.config).toEqual(harness.controller.resolvedConfig);
    harness.controller.dispose();
  });

  it('disposes loadout on deploy, completes once, and rematches with deep-equal resolved settings except seed', () => {
    const storage = new MemoryStorage();
    const harness = createHarness({ storage });
    harness.dispatch({ type: 'quickStart' });
    harness.dispatch({ type: 'selectMap', worldId: 'random' });
    harness.dispatch({ type: 'openLoadout' });

    expect(harness.loadouts).toHaveLength(1);
    harness.loadouts[0]!.options.onDeploy(['he', 'mortar']);

    expect(harness.loadouts[0]?.disposeCount).toBe(1);
    expect(harness.controller.state.screen).toBe('MATCH');
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.maxActiveRuntimes).toBe(1);
    const firstResolved = harness.runtimes[0]!.options.config;

    const recap: RoundOverRecap = { spentShellIdsByPlayer: [['he'], ['mortar']] };
    harness.runtimes[0]!.options.onComplete(recap);
    harness.runtimes[0]!.options.onComplete(recap);

    expect(harness.controller.state.screen).toBe('ROUND_OVER');
    expect(harness.controller.state.roundOver).toEqual(recap);
    expect(harness.runtimes[0]?.disposeCount).toBe(1);

    const rematchSeed = (firstResolved.seed + 1) >>> 0;
    harness.dispatch({ type: 'rematch', seed: rematchSeed });

    expect(harness.runtimes).toHaveLength(2);
    expect(harness.maxActiveRuntimes).toBe(1);
    const secondResolved = harness.runtimes[1]!.options.config;
    const { seed: firstSeed, ...firstSettings } = firstResolved;
    const { seed: secondSeed, ...secondSettings } = secondResolved;
    expect(secondSeed).toBe(rematchSeed);
    expect(secondSeed).not.toBe(firstSeed);
    expect(secondSettings).toEqual(firstSettings);
    expect(loadLastConfig(storage).seed).toBe(rematchSeed);

    harness.runtimes[1]!.options.onComplete({ spentShellIdsByPlayer: [[], []] });
    harness.dispatch({ type: 'menu' });
    expect(harness.controller.state.screen).toBe('TITLE');
    expect(harness.runtimes[1]?.disposeCount).toBe(1);
    expect(harness.titleScenes.at(-1)?.disposeCount).toBe(0);
    harness.controller.dispose();
  });

  it('preserves settings and the previous deck for Change Loadout, then disposes its overlay on controller disposal', () => {
    const harness = createHarness();
    harness.dispatch({ type: 'quickStart' });
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });
    harness.dispatch({ type: 'openLoadout' });
    harness.loadouts[0]!.options.onDeploy(['he', 'cluster']);
    harness.runtimes[0]!.options.onComplete({ spentShellIdsByPlayer: [[], []] });
    const beforeChange = harness.controller.state.config;

    harness.dispatch({ type: 'changeLoadout' });

    expect(harness.controller.state.screen).toBe('LOADOUT');
    expect(harness.controller.state.config).toEqual(beforeChange);
    expect(harness.loadouts[1]?.options.initialShellIds).toEqual(['he', 'cluster']);

    harness.controller.dispose();
    harness.controller.dispose();
    expect(harness.loadouts[1]?.disposeCount).toBe(1);
    expect(harness.viewDisposeCount).toBe(1);

    const runtimeCount = harness.runtimes.length;
    harness.loadouts[1]!.options.onDeploy(['he']);
    expect(harness.runtimes).toHaveLength(runtimeCount);
  });

  it('disposes a runtime that completes synchronously during creation without leaving a live owner', () => {
    const harness = createHarness({ completeRuntimeSynchronously: true });
    harness.dispatch({ type: 'quickStart' });
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });
    harness.dispatch({ type: 'openLoadout' });
    harness.loadouts[0]!.options.onDeploy(['he']);

    expect(harness.controller.state.screen).toBe('ROUND_OVER');
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0]?.disposeCount).toBe(1);
    expect(harness.activeRuntimes).toBe(0);
    expect(harness.maxActiveRuntimes).toBe(1);
    harness.controller.dispose();
  });
});

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

interface DisposableRecord {
  disposeCount: number;
  dispose(): void;
}

interface LoadoutRecord extends DisposableRecord {
  readonly options: AppControllerLoadoutOptions;
}

interface RuntimeRecord extends DisposableRecord {
  readonly options: AppControllerRuntimeOptions;
}

function createHarness(options: Readonly<{
  storage?: MemoryStorage;
  search?: string;
  completeRuntimeSynchronously?: boolean;
}> = {}) {
  const storage = options.storage ?? new MemoryStorage();
  const rendered: AppFlowState[] = [];
  const titleScenes: DisposableRecord[] = [];
  const howtoScenes: DisposableRecord[] = [];
  const loadouts: LoadoutRecord[] = [];
  const runtimes: RuntimeRecord[] = [];
  let callbacks: AppViewCallbacks | null = null;
  let viewDisposeCount = 0;
  let activeRuntimes = 0;
  let maxActiveRuntimes = 0;

  const controller = createAppController({
    storage,
    location: { search: options.search ?? '' },
    createView(receivedCallbacks) {
      callbacks = receivedCallbacks;
      let disposed = false;
      return {
        render(state) {
          if (!disposed) rendered.push(state);
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          viewDisposeCount++;
        },
      };
    },
    createTitleScene() {
      const record = disposableRecord();
      titleScenes.push(record);
      return record;
    },
    createHowtoScene() {
      const record = disposableRecord();
      howtoScenes.push(record);
      return record;
    },
    mountLoadout(loadoutOptions) {
      let disposed = false;
      const record: LoadoutRecord = {
        options: loadoutOptions,
        disposeCount: 0,
        dispose() {
          if (disposed) return;
          disposed = true;
          record.disposeCount++;
        },
      };
      loadouts.push(record);
      return record;
    },
    createMatchRuntime(runtimeOptions) {
      activeRuntimes++;
      maxActiveRuntimes = Math.max(maxActiveRuntimes, activeRuntimes);
      let disposed = false;
      const record: RuntimeRecord = {
        options: runtimeOptions,
        disposeCount: 0,
        dispose() {
          if (disposed) return;
          disposed = true;
          record.disposeCount++;
          activeRuntimes--;
        },
      };
      runtimes.push(record);
      if (options.completeRuntimeSynchronously) {
        runtimeOptions.onComplete({ spentShellIdsByPlayer: [[], []] });
      }
      return record;
    },
  });

  const requiredCallbacks = (): AppViewCallbacks => {
    if (!callbacks) throw new Error('Controller did not create its view');
    return callbacks;
  };

  return {
    controller,
    storage,
    rendered,
    titleScenes,
    howtoScenes,
    loadouts,
    runtimes,
    get viewDisposeCount() { return viewDisposeCount; },
    get activeRuntimes() { return activeRuntimes; },
    get maxActiveRuntimes() { return maxActiveRuntimes; },
    dispatch(action: FlowAction) { requiredCallbacks().onAction(action); },
    changeConfig(config: MatchConfig) { requiredCallbacks().onConfigChange?.(config); },
  };
}

function disposableRecord(): DisposableRecord {
  let disposed = false;
  const record: DisposableRecord = {
    disposeCount: 0,
    dispose() {
      if (disposed) return;
      disposed = true;
      record.disposeCount++;
    },
  };
  return record;
}

function configWith(overrides: Partial<MatchConfig>): MatchConfig {
  const config = validateConfig({ ...createDefaultConfig(), ...overrides });
  if (!config) throw new Error('Invalid test configuration');
  return config;
}
