import {
  CPU_TIER_IDS,
  MATCH_WORLD_OPTIONS,
  createDefaultConfig,
  validateConfig,
  type MatchConfig,
  type MatchMode,
  type MatchWorldId,
} from './config';

export type ScreenId =
  | 'TITLE'
  | 'MODE'
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
  readonly cpuTierIds?: readonly string[];
}

export interface AppFlowState {
  readonly screen: ScreenId;
  readonly config: MatchConfig;
  readonly modeOptions: readonly FlowModeOption[];
  readonly mapOptions: readonly MatchWorldId[];
  readonly roundOver: RoundOverRecap | null;
}

export interface RoundOverRecap {
  readonly spentShellIdsByPlayer: readonly (readonly string[])[];
}

export type FlowAction =
  | { readonly type: 'quickStart' }
  | { readonly type: 'openMode' }
  | { readonly type: 'selectMode'; readonly mode: MatchMode }
  | { readonly type: 'openCustom' }
  | { readonly type: 'startCustom' }
  | { readonly type: 'openHowTo' }
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
    enabled: false,
    note: 'Task 12',
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
      return state.screen === 'TITLE' ? createState('MAP', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
      })) : state;
    case 'openMode':
      return state.screen === 'TITLE' ? createState('MODE', state.config) : state;
    case 'selectMode':
      if (state.screen !== 'MODE') return state;
      if (action.mode === 'cpu') return state;
      return createState('MAP', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
      }));
    case 'openCustom':
      return state.screen === 'TITLE' ? createState('CUSTOM', withConfig(state.config, {
        path: 'custom',
        mode: 'local',
      })) : state;
    case 'startCustom':
      return state.screen === 'CUSTOM' ? createState('ROUND_INTRO', withConfig(state.config, {
        mode: 'local',
      })) : state;
    case 'openHowTo':
      return state.screen === 'TITLE' ? createState('HOWTO', state.config) : state;
    case 'back':
      return state.screen === 'HOWTO' ? createState('TITLE', state.config) : state;
    case 'playFromHowTo':
      return state.screen === 'HOWTO' ? createState('MAP', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
      })) : state;
    case 'selectMap':
      if (state.screen !== 'MAP' || !MAP_OPTIONS.includes(action.worldId)) return state;
      return createState('ROUND_INTRO', withConfig(state.config, {
        path: 'quick',
        mode: 'local',
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
  });
}

function assertNever(value: never): never {
  throw new Error(`Unhandled flow action: ${JSON.stringify(value)}`);
}
