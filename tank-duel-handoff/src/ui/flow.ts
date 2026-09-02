import {
  CPU_TIER_IDS,
  MATCH_WORLD_OPTIONS,
  createDefaultConfig,
  crewsNamed,
  validateConfig,
  type MatchConfig,
  type MatchMode,
  type MatchWorldId,
  type CpuTierId,
} from './config';

export type ScreenId =
  | 'TITLE'
  | 'MODE'
  | 'CREW'
  | 'MAP'
  | 'CUSTOM'
  | 'HOWTO'
  | 'ROUND_INTRO'
  | 'LOADOUT'
  | 'MATCH'
  | 'ROUND_OVER';

export interface FlowModeOption {
  readonly id: MatchMode;
  readonly label: string;
  readonly enabled: boolean;
  readonly note?: string;
  readonly cpuTierIds?: readonly CpuTierId[];
}

export interface AppFlowState {
  readonly screen: ScreenId;
  readonly config: MatchConfig;
  readonly modeOptions: readonly FlowModeOption[];
  readonly mapOptions: readonly MatchWorldId[];
  readonly roundOver: RoundOverRecap | null;
}

export interface RoundOverRecap {
  /** One entry per shot fired, in order — so the recap can show counts, not repeats. */
  readonly spentShellIdsByPlayer: readonly (readonly string[])[];
  /**
   * Who took the round. Optional because a recap can be built before the round resolves;
   * the screen falls back to its plain label rather than naming a winner it does not have.
   */
  readonly result?: 0 | 1 | 'draw' | null;
  readonly turns?: number;
}

export type FlowAction =
  | { readonly type: 'quickStart' }
  | { readonly type: 'openMode' }
  | { readonly type: 'selectMode'; readonly mode: MatchMode }
  | { readonly type: 'selectCpuTier'; readonly cpuTierId: CpuTierId }
  | { readonly type: 'openCustom' }
  | { readonly type: 'startCustom' }
  | { readonly type: 'openHowTo' }
  | { readonly type: 'confirmCrews' }
  | { readonly type: 'back' }
  | { readonly type: 'playFromHowTo' }
  | { readonly type: 'selectMap'; readonly worldId: MatchWorldId }
  | { readonly type: 'openLoadout' }
  | { readonly type: 'deployLoadout' }
  | { readonly type: 'completeMatch'; readonly recap: RoundOverRecap }
  | { readonly type: 'rematch'; readonly seed: number }
  | { readonly type: 'changeLoadout' }
  | { readonly type: 'menu' };

const MODE_OPTIONS: readonly FlowModeOption[] = Object.freeze([
  Object.freeze({ id: 'local', label: '1v1 Local', enabled: true }),
  Object.freeze({
    id: 'cpu',
    label: '1 v CPU',
    enabled: true,
    cpuTierIds: CPU_TIER_IDS,
  }),
]);

const MAP_OPTIONS: readonly MatchWorldId[] = MATCH_WORLD_OPTIONS;

export function createFlow(config: MatchConfig): AppFlowState {
  return createState('TITLE', config);
}

export function reduceFlow(state: AppFlowState, action: FlowAction): AppFlowState {
  switch (action.type) {
    case 'quickStart':
      return state.screen === 'TITLE' ? createState('CREW', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
      })) : state;
    case 'openMode':
      return state.screen === 'TITLE' ? createState('MODE', state.config) : state;
    case 'selectMode':
      if (state.screen === 'MODE') {
        return createState('MAP', withConfig(state.config, {
          path: 'quick',
          mode: action.mode,
        }));
      }
      if (state.screen === 'CREW' || state.screen === 'MAP' || state.screen === 'CUSTOM') {
        return createState(state.screen, withConfig(state.config, { mode: action.mode }));
      }
      return state;
    case 'selectCpuTier':
      if ((state.screen !== 'MODE' && state.screen !== 'MAP' && state.screen !== 'CUSTOM') ||
        state.config.mode !== 'cpu' || !CPU_TIER_IDS.includes(action.cpuTierId)) return state;
      return createState(state.screen, withConfig(state.config, { cpuTierId: action.cpuTierId }));
    case 'openCustom':
      return state.screen === 'TITLE' ? createState('CUSTOM', withConfig(state.config, {
        path: 'custom',
      })) : state;
    case 'startCustom':
      return state.screen === 'CUSTOM' ? createState('ROUND_INTRO', state.config) : state;
    case 'openHowTo':
      return state.screen === 'TITLE' ? createState('HOWTO', state.config) : state;
    case 'confirmCrews':
      return state.screen === 'CREW' && crewsNamed(state.config)
        ? createState('MAP', state.config)
        : state;
    case 'back':
      switch (state.screen) {
        case 'MODE':
        case 'CREW':
        case 'CUSTOM':
        case 'HOWTO':
          return createState('TITLE', state.config);
        case 'MAP':
          return createState('CREW', state.config);
        case 'ROUND_INTRO':
          return createState(state.config.path === 'custom' ? 'CUSTOM' : 'MAP', state.config);
        case 'LOADOUT':
          return createState('ROUND_INTRO', state.config);
        default:
          return state;
      }
    case 'playFromHowTo':
      return state.screen === 'HOWTO' ? createState('CREW', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
      })) : state;
    case 'selectMap':
      if (state.screen !== 'MAP' || !MAP_OPTIONS.includes(action.worldId)) return state;
      return createState('ROUND_INTRO', withConfig(state.config, {
        path: 'quick',
        selectedWorldId: action.worldId,
        selectedGeneratorId: null,
      }));
    case 'openLoadout':
      return state.screen === 'ROUND_INTRO' ? createState('LOADOUT', state.config) : state;
    case 'deployLoadout':
      return state.screen === 'LOADOUT' ? createState('MATCH', state.config) : state;
    case 'completeMatch':
      return state.screen === 'MATCH'
        ? createState('ROUND_OVER', state.config, freezeRoundOverRecap(action.recap))
        : state;
    case 'rematch':
      if (state.screen !== 'ROUND_OVER' || !isRematchSeed(state.config.seed, action.seed)) return state;
      return createState('MATCH', withConfig(state.config, {
        seed: action.seed,
      }));
    case 'changeLoadout':
      return state.screen === 'ROUND_OVER' ? createState('LOADOUT', state.config) : state;
    case 'menu':
      return state.screen === 'ROUND_OVER' ? createState('TITLE', state.config) : state;
    default:
      return assertNever(action);
  }
}

function createState(
  screen: ScreenId,
  config: MatchConfig,
  roundOver: RoundOverRecap | null = null,
): AppFlowState {
  return Object.freeze({
    screen,
    config: validateConfig(config) ?? createDefaultConfig(),
    modeOptions: MODE_OPTIONS,
    mapOptions: MAP_OPTIONS,
    roundOver,
  });
}

function withConfig(config: MatchConfig, overrides: Partial<MatchConfig>): MatchConfig {
  return validateConfig({
    ...config,
    ...overrides,
  }) ?? config;
}

function isRematchSeed(previousSeed: number, nextSeed: number): boolean {
  return Number.isInteger(nextSeed) && nextSeed >= 0 && nextSeed <= 0xffffffff && nextSeed !== previousSeed;
}

function freezeRoundOverRecap(recap: RoundOverRecap): RoundOverRecap {
  return Object.freeze({
    spentShellIdsByPlayer: Object.freeze(
      recap.spentShellIdsByPlayer.map((playerShells) => Object.freeze([...playerShells])),
    ),
    ...(recap.result === undefined ? {} : { result: recap.result }),
    ...(recap.turns === undefined ? {} : { turns: recap.turns }),
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled flow action: ${JSON.stringify(value)}`);
}
