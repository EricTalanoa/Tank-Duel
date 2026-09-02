import {
  CPU_TIER_IDS,
  MATCH_WORLD_OPTIONS,
  createDefaultConfig,
  validateConfig,
  withCrewColor,
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
  | { readonly type: 'selectMode'; readonly mode: MatchMode }
  | { readonly type: 'confirmMode' }
  | { readonly type: 'selectCpuTier'; readonly cpuTierId: CpuTierId }
  | { readonly type: 'openCustom' }
  | { readonly type: 'startCustom' }
  | { readonly type: 'openHowTo' }
  | { readonly type: 'confirmCrews' }
  | { readonly type: 'selectCrewColor'; readonly player: 0 | 1; readonly color: string }
  | { readonly type: 'back' }
  | { readonly type: 'playFromHowTo' }
  | { readonly type: 'selectMap'; readonly worldId: MatchWorldId }
  | { readonly type: 'deployLoadout' }
  | { readonly type: 'completeMatch'; readonly recap: RoundOverRecap }
  | { readonly type: 'rematch'; readonly seed: number }
  | { readonly type: 'changeLoadout' }
  | { readonly type: 'menu' };

const MODE_OPTIONS: readonly FlowModeOption[] = Object.freeze([
  Object.freeze({
    id: 'local',
    label: '1v1 Local',
    enabled: true,
    note: 'Two crews, one device. Pass it across between shots.',
  }),
  Object.freeze({
    id: 'cpu',
    label: '1 v CPU',
    enabled: true,
    note: 'One crew against the machine. Pick a difficulty below.',
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
      // Mode is the first thing chosen now, so Quick Start opens it rather than assuming
      // local — and the mode carried in from the last match is what it opens on.
      return state.screen === 'TITLE'
        ? createState('MODE', withConfig(state.config, { path: 'quick' }))
        : state;
    case 'selectMode':
      // On MODE, picking a card selects it and stays put: the CPU card's difficulty is
      // chosen on the same screen, which an advance-on-click card would walk straight past.
      if (state.screen === 'MODE' || state.screen === 'CREW' || state.screen === 'MAP' ||
        state.screen === 'CUSTOM') {
        return createState(state.screen, withConfig(state.config, { mode: action.mode }));
      }
      return state;
    case 'confirmMode':
      return state.screen === 'MODE' ? createState('CREW', state.config) : state;
    case 'selectCpuTier':
      if ((state.screen !== 'MODE' && state.screen !== 'CREW' && state.screen !== 'MAP' &&
        state.screen !== 'CUSTOM') ||
        state.config.mode !== 'cpu' || !CPU_TIER_IDS.includes(action.cpuTierId)) return state;
      return createState(state.screen, withConfig(state.config, { cpuTierId: action.cpuTierId }));
    case 'openCustom':
      return state.screen === 'TITLE' ? createState('CUSTOM', withConfig(state.config, {
        path: 'custom',
      })) : state;
    case 'startCustom':
      return state.screen === 'CUSTOM' ? createState('LOADOUT', state.config) : state;
    case 'openHowTo':
      return state.screen === 'TITLE' ? createState('HOWTO', state.config) : state;
    case 'confirmCrews':
      // Ungated. Names are decoration on a nameplate, not a prerequisite for a duel, and
      // `crewDisplayName` already falls back to Player 1 / Player 2 everywhere one is shown.
      return state.screen === 'CREW' ? createState('MAP', state.config) : state;
    case 'selectCrewColor': {
      if (state.screen !== 'CREW') return state;
      const config = withCrewColor(state.config, action.player, action.color);
      return config === state.config ? state : createState('CREW', config);
    }
    case 'back':
      switch (state.screen) {
        case 'MODE':
        case 'CUSTOM':
        case 'HOWTO':
          return createState('TITLE', state.config);
        case 'CREW':
          return createState('MODE', state.config);
        case 'MAP':
          return createState('CREW', state.config);
        case 'LOADOUT':
          return createState(state.config.path === 'custom' ? 'CUSTOM' : 'MAP', state.config);
        default:
          return state;
      }
    case 'playFromHowTo':
      return state.screen === 'HOWTO'
        ? createState('MODE', withConfig(state.config, { path: 'quick' }))
        : state;
    case 'selectMap':
      // Deploy opens the loadout directly. The briefing screen that used to sit here
      // restated choices the player had just made on the two screens behind it.
      if (state.screen !== 'MAP' || !MAP_OPTIONS.includes(action.worldId)) return state;
      return createState('LOADOUT', withConfig(state.config, {
        path: 'quick',
        selectedWorldId: action.worldId,
        selectedGeneratorId: null,
      }));
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
      // Reachable from the match as well as the recap: the match's Menu button confirms
      // first, so this arriving mid-round is a decision, not a stray tap.
      return state.screen === 'ROUND_OVER' || state.screen === 'MATCH'
        ? createState('TITLE', state.config)
        : state;
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
