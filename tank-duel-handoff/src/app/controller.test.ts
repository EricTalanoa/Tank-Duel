import { describe, expect, it } from 'vitest';
import { makePlayerLoadouts, type PlayerLoadouts } from '../sim/playerLoadouts';
import { hashSeed } from '../sim/rng';
import { STANDARD_SHELL_IDS } from '../sim/weapons';
import { SHIPPED_WORLDS } from '../sim/worlds';
import { createDefaultConfig, validateConfig, withCrewName, type MatchConfig } from '../ui/config';
import type { AppViewCallbacks } from '../ui/appView';
import type { AppFlowState, FlowAction, RoundOverRecap } from '../ui/flow';
import { loadLastConfig, saveLastConfig, type StorageLike } from '../ui/storage';
import {
  createAppController,
  type AppControllerLoadoutOptions,
  type AppControllerRuntimeOptions,
} from './controller';

/**
 * Two decks that differ in every optional slot. A pair of identical decks would pass
 * against the shared single-deck contract this checkpoint replaces, so it could not show
 * that each player's choice survives the controller.
 */
const PLAYER_ONE_SHELL_IDS: readonly string[] = ['he', 'mortar', 'cluster'];
const PLAYER_TWO_SHELL_IDS: readonly string[] = ['he', 'sand', 'roller'];
const PLAYER_LOADOUT_IDS: PlayerLoadouts = makePlayerLoadouts(
  PLAYER_ONE_SHELL_IDS,
  PLAYER_TWO_SHELL_IDS,
);

/**
 * TITLE -> MODE -> CREW -> MAP. Quick Start lands on mode selection now; the crew names it
 * types on the way through are optional, and are here so the later assertions have them.
 */
function quickStartToMap(harness: ReturnType<typeof createHarness>): void {
  harness.dispatch({ type: 'quickStart' });
  harness.dispatch({ type: 'confirmMode' });
  harness.changeConfig(
    withCrewName(withCrewName(harness.controller.state.config, 0, 'Ash'), 1, 'Vale'),
  );
  harness.dispatch({ type: 'confirmCrews' });
}

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

  it('starts enabled CPU flow while owning scenes only while TITLE or HOWTO is visible', () => {
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

    harness.dispatch({ type: 'quickStart' });
    const renderCount = harness.rendered.length;
    harness.dispatch({ type: 'selectMode', mode: 'cpu' });

    expect(harness.controller.state.screen).toBe('MODE');
    expect(harness.controller.state.config.mode).toBe('cpu');
    expect(harness.rendered).toHaveLength(renderCount + 1);
    expect(harness.runtimes).toHaveLength(0);
    harness.controller.dispose();
  });

  it('pins CPU deployment to the standard deck and ignores a stale loadout callback', () => {
    const harness = createHarness();
    harness.dispatch({ type: 'quickStart' });
    harness.dispatch({ type: 'selectMode', mode: 'cpu' });
    harness.dispatch({
      type: 'selectCpuTier',
      cpuTierId: 'veteran',
    });
    harness.dispatch({ type: 'confirmMode' });
    harness.dispatch({ type: 'confirmCrews' });
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });

    const firstLoadout = harness.loadouts[0]!;
    expect(firstLoadout.options).toMatchObject({ mode: 'cpu', cpuTierId: 'veteran' });
    firstLoadout.options.onDeploy(makePlayerLoadouts(
      ['he', 'mortar', 'cluster'],
      ['he', 'sand'],
    ));

    expect(harness.runtimes[0]!.options.config).toMatchObject({ mode: 'cpu', cpuTierId: 'veteran' });
    expect(harness.runtimes[0]!.options.playerLoadoutIds).toEqual([
      ['he', 'mortar', 'cluster'],
      STANDARD_SHELL_IDS,
    ]);
    expect(Object.isFrozen(harness.runtimes[0]!.options.playerLoadoutIds[1])).toBe(true);

    harness.runtimes[0]!.options.onComplete({ spentShellIdsByPlayer: [[], []] });
    harness.dispatch({ type: 'changeLoadout' });
    expect(harness.loadouts[1]!.options.initialPlayerLoadoutIds).toEqual([
      ['he', 'mortar', 'cluster'],
      STANDARD_SHELL_IDS,
    ]);

    firstLoadout.options.onDeploy(makePlayerLoadouts(['he', 'sand'], ['he', 'mortar']));
    expect(harness.controller.state.screen).toBe('LOADOUT');
    expect(harness.runtimes).toHaveLength(1);
    harness.controller.dispose();
  });

  it('pauses the active owner immediately while blocked without replacing a loadout owner', () => {
    const harness = createHarness();

    harness.controller.setPresentationBlocked(true);
    expect(harness.titleScenes[0]?.pauseStates).toEqual([true]);

    quickStartToMap(harness);
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });
    const loadout = harness.loadouts[0];
    harness.controller.setPresentationBlocked(true);
    expect(harness.loadouts).toEqual([loadout]);

    harness.loadouts[0]!.options.onDeploy(PLAYER_LOADOUT_IDS);
    expect(harness.runtimes[0]?.pauseStates).toEqual([true]);
    harness.controller.setPresentationBlocked(false);
    expect(harness.runtimes[0]?.pauseStates).toEqual([true, false]);
    harness.controller.dispose();
  });

  it('resolves Random at map selection, not earlier, and renders the concrete configuration', () => {
    const harness = createHarness();

    expect(harness.controller.resolvedConfig).toBeNull();
    quickStartToMap(harness);
    expect(harness.controller.resolvedConfig).toBeNull();

    harness.dispatch({ type: 'selectMap', worldId: 'random' });

    const resolved = harness.controller.resolvedConfig;
    // Deploy opens the loadout directly; the briefing screen that sat here is gone.
    expect(harness.controller.state.screen).toBe('LOADOUT');
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

  it('carries accepted Custom Game settings through the loadout into the runtime', () => {
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
    expect(harness.controller.state.screen).toBe('LOADOUT');
    expect(harness.controller.resolvedConfig).toMatchObject({
      selectedWorldId: custom.selectedWorldId,
      worldId: custom.selectedWorldId,
      generatorId: custom.selectedGeneratorId,
      seed: custom.seed,
      rounds: custom.rounds,
      wind: custom.wind,
      turnTimer: custom.turnTimer,
    });

    harness.loadouts[0]!.options.onDeploy(PLAYER_LOADOUT_IDS);

    expect(harness.controller.state.screen).toBe('MATCH');
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0]!.options.config).toEqual(harness.controller.resolvedConfig);
    expect(harness.runtimes[0]!.options.playerLoadoutIds).toEqual(PLAYER_LOADOUT_IDS);
    expect(harness.runtimes[0]!.options.playerLoadoutIds[0]).toEqual(PLAYER_ONE_SHELL_IDS);
    expect(harness.runtimes[0]!.options.playerLoadoutIds[1]).toEqual(PLAYER_TWO_SHELL_IDS);
    harness.controller.dispose();
  });

  it('keeps the deployed decks after the deploying caller mutates the arrays it passed', () => {
    const harness = createHarness();
    quickStartToMap(harness);
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });

    const playerOne = [...PLAYER_ONE_SHELL_IDS];
    const playerTwo = [...PLAYER_TWO_SHELL_IDS];
    harness.loadouts[0]!.options.onDeploy([playerOne, playerTwo]);
    playerOne.push('napalm');
    playerTwo.length = 1;

    expect(harness.runtimes[0]!.options.playerLoadoutIds).toEqual(PLAYER_LOADOUT_IDS);

    harness.runtimes[0]!.options.onComplete({ spentShellIdsByPlayer: [[], []] });
    harness.dispatch({ type: 'changeLoadout' });
    expect(harness.loadouts[1]?.options.initialPlayerLoadoutIds).toEqual(PLAYER_LOADOUT_IDS);
    harness.controller.dispose();
  });

  it('disposes loadout on deploy, completes once, and rematches with deep-equal resolved settings except seed', () => {
    const storage = new MemoryStorage();
    const harness = createHarness({ storage });
    quickStartToMap(harness);
    harness.dispatch({ type: 'selectMap', worldId: 'random' });

    expect(harness.loadouts).toHaveLength(1);
    harness.loadouts[0]!.options.onDeploy(PLAYER_LOADOUT_IDS);

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
    expect(harness.runtimes[1]!.options.playerLoadoutIds).toEqual(PLAYER_LOADOUT_IDS);
    expect(harness.runtimes[1]!.options.playerLoadoutIds)
      .toEqual(harness.runtimes[0]!.options.playerLoadoutIds);
    expect(harness.loadouts).toHaveLength(1);
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
    quickStartToMap(harness);
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });
    harness.loadouts[0]!.options.onDeploy(PLAYER_LOADOUT_IDS);
    harness.runtimes[0]!.options.onComplete({ spentShellIdsByPlayer: [[], []] });
    const beforeChange = harness.controller.state.config;

    harness.dispatch({ type: 'changeLoadout' });

    expect(harness.controller.state.screen).toBe('LOADOUT');
    expect(harness.controller.state.config).toEqual(beforeChange);
    expect(harness.loadouts[1]?.options.initialPlayerLoadoutIds).toEqual(PLAYER_LOADOUT_IDS);
    expect(harness.loadouts[1]?.options.initialPlayerLoadoutIds?.[0]).toEqual(PLAYER_ONE_SHELL_IDS);
    expect(harness.loadouts[1]?.options.initialPlayerLoadoutIds?.[1]).toEqual(PLAYER_TWO_SHELL_IDS);

    harness.controller.dispose();
    harness.controller.dispose();
    expect(harness.loadouts[1]?.disposeCount).toBe(1);
    expect(harness.viewDisposeCount).toBe(1);

    const runtimeCount = harness.runtimes.length;
    harness.loadouts[1]!.options.onDeploy(PLAYER_LOADOUT_IDS);
    expect(harness.runtimes).toHaveLength(runtimeCount);
  });

  it('disposes a runtime that completes synchronously during creation without leaving a live owner', () => {
    const harness = createHarness({ completeRuntimeSynchronously: true });
    quickStartToMap(harness);
    harness.dispatch({ type: 'selectMap', worldId: 'terra' });
    harness.loadouts[0]!.options.onDeploy(PLAYER_LOADOUT_IDS);

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
  pauseStates: boolean[];
  dispose(): void;
  setPaused(paused: boolean): void;
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
        pauseStates: [],
        setPaused(paused) { record.pauseStates.push(paused); },
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
        pauseStates: [],
        setPaused(paused) { record.pauseStates.push(paused); },
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
    pauseStates: [],
    setPaused(paused) { record.pauseStates.push(paused); },
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
