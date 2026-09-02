import rawScreens from '../../spec/screens.json';
import { CPU_TIERS } from '../sim/cpu';
import { functionalAccent } from '../render/palette';
import { HE_SHELL } from '../sim/shells';
import { PRESENTATION } from '../render/presentation';
import { SHIPPED_GENERATORS, type GeneratorId } from '../sim/generators';
import { SHELLS } from '../sim/shells';
import { SHIPPED_WORLDS } from '../sim/worlds';
import {
  CPU_CREW_NAME,
  CREW_COLOR_OPTIONS,
  CREW_NAME_MAX_LENGTH,
  MATCH_AMMO_BOUNDS,
  MATCH_ROUND_OPTIONS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WIND_OPTIONS,
  crewDisplayName,
  type MatchConfig,
  type MatchMode,
  type CpuTierId,
  type MatchRounds,
  type MatchTurnTimer,
  type MatchWind,
  type MatchWorldId,
} from './config';
import type { AppFlowState, FlowAction } from './flow';

export interface ActionButtonModel {
  readonly label: string;
  readonly action: FlowAction;
  readonly disabled: boolean;
  readonly note?: string;
}

export interface TitleScreenModel {
  readonly id: 'TITLE';
  readonly label: string;
  readonly kicker: string;
  /** The wordmark, one word per line. */
  readonly wordmark: readonly string[];
  readonly blurb: readonly string[];
  readonly buttons: readonly ActionButtonModel[];
  readonly corner: readonly string[];
}

export interface ModeOptionModel {
  readonly id: MatchMode;
  readonly label: string;
  readonly disabled: boolean;
  readonly selected: boolean;
  readonly note?: string;
  readonly action: FlowAction;
}

export interface CpuTierOptionModel {
  readonly id: CpuTierId;
  readonly label: string;
  /** The tier's measured median, straight from `spec/cpu.json` — never a guessed figure. */
  readonly note: string;
  readonly disabled: boolean;
  readonly selected: boolean;
  readonly action: FlowAction;
}

export interface ModeScreenModel {
  readonly id: 'MODE';
  readonly label: string;
  readonly kicker: string;
  readonly step: string;
  readonly options: readonly ModeOptionModel[];
  readonly cpuTiers: readonly CpuTierOptionModel[];
  /** `1v1 LOCAL SELECTED`, or the CPU line with the tier named. */
  readonly status: string;
  readonly backAction: FlowAction;
  readonly continueAction: FlowAction;
}

export interface CrewSwatchModel {
  readonly color: string;
  readonly label: string;
  readonly selected: boolean;
  readonly action: FlowAction;
}

export interface CrewPanelModel {
  readonly player: 0 | 1;
  /** `P1` / `P2`, tinted with `color`. */
  readonly tag: string;
  /** The panel heading: `Player 1`, or `CPU` when crew 2 is the machine. */
  readonly label: string;
  /** What is in the field right now — empty while the placeholder is showing. */
  readonly name: string;
  readonly placeholder: string;
  readonly color: string;
  /** The chosen hex, uppercased, shown opposite the heading. */
  readonly colorLabel: string;
  readonly maxLength: number;
  /** False for the CPU: there is no one to name, so the field is not rendered at all. */
  readonly nameEditable: boolean;
  /** False for the CPU, whose colour is rolled rather than chosen. */
  readonly colorEditable: boolean;
  /** Says why the CPU panel has no controls. Absent on a human panel. */
  readonly note?: string;
  /** P2's panel is a mirror of P1's, so the two tanks face each other. */
  readonly mirrored: boolean;
  /** `+1` for the left crew, `-1` for the right one. */
  readonly direction: 1 | -1;
  /** Stored 0-180 absolute; P2's display is mirrored per `spec/constants.json`. */
  readonly angleDeg: number;
  readonly swatches: readonly CrewSwatchModel[];
}

export interface CrewScreenModel {
  readonly id: 'CREW';
  readonly label: string;
  readonly kicker: string;
  readonly step: string;
  readonly panels: readonly [CrewPanelModel, CrewPanelModel];
  /** `<NAME 1> VS <NAME 2>`, with the defaults standing in for anything left blank. */
  readonly status: string;
  readonly backAction: FlowAction;
  readonly continueAction: FlowAction;
}

export interface MapTileModel {
  readonly id: MatchWorldId;
  readonly name: string;
  readonly description: string;
  readonly selected: boolean;
  /** Random rolls its world at deploy, so it has no figures to show. */
  readonly random: boolean;
  /** The generator to draw a preview silhouette from. Null for Random. */
  readonly generator: GeneratorId | null;
  /** Field width in px, so a preview is generated over the world's real x-domain. */
  readonly fieldWidth: number;
  readonly gravity: string;
  readonly width: string;
  readonly wind: string;
  readonly accent: string | null;
  readonly action: FlowAction;
}

export interface MapScreenModel {
  readonly id: 'MAP';
  readonly label: string;
  readonly kicker: string;
  readonly step: string;
  readonly tiles: readonly MapTileModel[];
  readonly cpuTiers: readonly CpuTierOptionModel[];
}

export interface CustomShellRowModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** `MASS 1.55`, or `LOCKED` for the free shell. There is no point cost to show. */
  readonly costLabel: string;
  readonly locked: boolean;
  readonly enabled: boolean;
  readonly ammo: number | 'inf';
  readonly ammoLabel: string;
  readonly toggleDisabled: boolean;
  readonly countDisabled: boolean;
}

export interface CustomScreenModel {
  readonly id: 'CUSTOM';
  readonly label: string;
  readonly rounds: MatchRounds;
  readonly roundOptions: readonly MatchRounds[];
  readonly wind: MatchWind;
  readonly windOptions: readonly MatchWind[];
  readonly turnTimer: MatchTurnTimer;
  readonly turnTimerOptions: readonly MatchTurnTimer[];
  readonly worldId: MatchWorldId;
  readonly worldOptions: readonly MapTileModel[];
  readonly generatorId: GeneratorId | null;
  readonly generatorOptions: readonly GeneratorId[];
  readonly seed: number;
  readonly ammoBounds: Readonly<{ min: number; max: number }>;
  readonly shells: readonly CustomShellRowModel[];
  /** `Ammunition · 6 of 13 in play`. */
  readonly ammunitionLabel: string;
  /** The footer's one-line readout of what is about to be played. */
  readonly summary: string;
  readonly modeOptions: readonly ModeOptionModel[];
  readonly cpuTiers: readonly CpuTierOptionModel[];
  readonly startAction: FlowAction;
}

export interface HowToShotModel {
  readonly result: 'short' | 'long' | 'hit';
  readonly power: number;
  readonly step: string;
  /** Matches the trajectory this card describes in `drawHowtoScene`. */
  readonly accent: string;
}

export interface HowToScreenModel {
  readonly id: 'HOWTO';
  readonly label: string;
  /** The title, one line per element. */
  readonly headline: readonly string[];
  readonly lede: readonly string[];
  readonly shots: readonly HowToShotModel[];
  readonly backAction: FlowAction;
  readonly playAction: FlowAction;
}

export interface RoundOverShellModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** How many of this shell the player spent. `spentShellIdsByPlayer` repeats per shot. */
  readonly count: number;
}

export interface RoundOverPlayerModel {
  readonly label: string;
  readonly tag: string;
  readonly color: string;
  readonly summary: string;
  readonly winner: boolean;
  readonly shells: readonly RoundOverShellModel[];
}

/** One run of the outcome headline. `accent` runs carry the winner's colour. */
export interface HeadlineSpan {
  readonly text: string;
  readonly accent: boolean;
}

export interface RoundOverScreenModel {
  readonly id: 'ROUND_OVER';
  readonly label: string;
  readonly kicker: string;
  /** The outcome, one array of spans per line. */
  readonly headline: readonly (readonly HeadlineSpan[])[];
  readonly accentColor: string | null;
  readonly players: readonly RoundOverPlayerModel[];
  readonly buttons: readonly ActionButtonModel[];
}

/**
 * Title copy. Not in `spec/screens.json`, which carries the button list and the idle
 * animation systems rather than prose, so it lives here as one named constant instead of
 * being scattered through the view.
 */
const TITLE_KICKER = 'Local artillery · Two players';
const TITLE_BLURB: readonly string[] = Object.freeze([
  'Six worlds · Twelve shells · Destructible ground',
  'Miss short. Miss long. Split the difference.',
]);

export function buildTitleScreenModel(): TitleScreenModel {
  return {
    id: 'TITLE',
    label: 'Tank Duel',
    kicker: TITLE_KICKER,
    wordmark: Object.freeze(['Tank', 'Duel']),
    blurb: TITLE_BLURB,
    buttons: [
      actionButton('Quick Start', { type: 'quickStart' }),
      actionButton('How to Play', { type: 'openHowTo' }),
    ],
    corner: readTitleCorner(),
  };
}

export function buildModeScreenModel(state: AppFlowState): ModeScreenModel {
  const cpuTiers = cpuTierModels(state.config);
  return {
    id: 'MODE',
    label: 'Choose mode',
    kicker: 'Quick start',
    step: 'Step 01 / 03',
    options: modeOptionModels(state),
    cpuTiers,
    status: modeStatus(state, cpuTiers),
    backAction: { type: 'back' },
    continueAction: { type: 'confirmMode' },
  };
}

/** The footer says what is selected, including the tier, so Continue is never a leap. */
function modeStatus(state: AppFlowState, tiers: readonly CpuTierOptionModel[]): string {
  const mode = selectedModeLabel(state);
  if (state.config.mode !== 'cpu') return `${mode} selected`.toUpperCase();
  const tier = tiers.find((option) => option.selected)?.label ?? state.config.cpuTierId;
  return `${mode} · ${tier}`.toUpperCase();
}

/**
 * The aiming angles the two preview tanks hold. Stored angles are 0-180 absolute and
 * player 2's display is mirrored, so 52 and 128 are the same elevation pointing inward —
 * the two tanks read as facing each other across the panel gap.
 */
const CREW_PREVIEW_ANGLES: readonly [number, number] = Object.freeze([52, 128]);

const CPU_CREW_NOTE = 'Name and colour rolled by the machine. Take its colour and the two swap.';

export function buildCrewScreenModel(state: AppFlowState): CrewScreenModel {
  const { config } = state;
  const panels = [0, 1].map((index) => {
    const player = index === 1 ? 1 : 0;
    const cpu = player === 1 && config.mode === 'cpu';
    const label = cpu ? CPU_CREW_NAME : PRESENTATION.players[player].label;
    return {
      player,
      tag: `P${player + 1}`,
      label,
      // A field showing a stale human name would read as the CPU's own.
      name: cpu ? '' : config.crews[player].name,
      placeholder: PRESENTATION.players[player].label,
      color: config.crews[player].color,
      colorLabel: config.crews[player].color.toUpperCase(),
      maxLength: CREW_NAME_MAX_LENGTH,
      nameEditable: !cpu,
      colorEditable: !cpu,
      ...(cpu ? { note: CPU_CREW_NOTE } : {}),
      mirrored: player === 1,
      direction: player === 0 ? 1 : -1,
      angleDeg: CREW_PREVIEW_ANGLES[player],
      swatches: cpu ? Object.freeze([]) : crewSwatchModels(config, player),
    } satisfies CrewPanelModel;
  }) as [CrewPanelModel, CrewPanelModel];

  return {
    id: 'CREW',
    label: 'Set up your crews',
    kicker: `Quick start · ${selectedModeLabel(state)}`,
    step: 'Step 02 / 03',
    panels: Object.freeze(panels) as readonly [CrewPanelModel, CrewPanelModel],
    // Names are optional, so the status shows the matchup that would be played right now
    // rather than telling anyone what still has to be filled in.
    status: `${crewDisplayName(config, 0)} vs ${crewDisplayName(config, 1)}`.toUpperCase(),
    backAction: { type: 'back' },
    continueAction: { type: 'confirmCrews' },
  };
}

/**
 * Every colour stays pickable. Taking the one the other crew holds swaps the two, which is
 * why no option is ever disabled — see `withCrewColor`.
 */
function crewSwatchModels(config: MatchConfig, player: 0 | 1): readonly CrewSwatchModel[] {
  return CREW_COLOR_OPTIONS.map((color) => ({
    color,
    label: `${color} for ${PRESENTATION.players[player].label}`,
    selected: config.crews[player].color === color,
    action: { type: 'selectCrewColor', player, color },
  }));
}

export function buildMapScreenModel(state: AppFlowState): MapScreenModel {
  return {
    id: 'MAP',
    label: 'Choose battlefield',
    // Mode is settled two screens back and is not switchable here; the kicker reports it.
    kicker: `Quick start · ${selectedModeLabel(state)}`,
    step: 'Step 03 / 03',
    tiles: mapTileModels(state.mapOptions, state.config.selectedWorldId),
    cpuTiers: cpuTierModels(state.config),
  };
}

export function buildCustomScreenModel(state: AppFlowState): CustomScreenModel {
  const { config } = state;
  return {
    id: 'CUSTOM',
    label: 'Custom game',
    rounds: config.rounds,
    roundOptions: MATCH_ROUND_OPTIONS,
    wind: config.wind,
    windOptions: MATCH_WIND_OPTIONS,
    turnTimer: config.turnTimer,
    turnTimerOptions: MATCH_TURN_TIMER_OPTIONS,
    worldId: config.selectedWorldId,
    worldOptions: mapTileModels(
      [...SHIPPED_WORLDS.map((world) => world.id), 'random'],
      config.selectedWorldId,
    ),
    generatorId: config.selectedGeneratorId,
    generatorOptions: SHIPPED_GENERATORS,
    seed: config.seed,
    ammoBounds: MATCH_AMMO_BOUNDS,
    shells: SHELLS.map((shell) => {
      const shellConfig = config.shells[shell.id];
      if (!shellConfig) throw new Error(`Missing shell config for ${shell.id}`);
      const locked = shellConfig.locked;
      return {
        id: shell.id,
        name: shellConfig.name,
        icon: shellConfig.icon,
        costLabel: locked ? 'Locked' : `Mass ${shell.mass}`,
        locked,
        enabled: shellConfig.enabled,
        ammo: shellConfig.ammo,
        ammoLabel: ammoLabel(shellConfig.ammo),
        toggleDisabled: locked,
        countDisabled: locked || !shellConfig.enabled,
      };
    }),
    ammunitionLabel: `Ammunition · ${config.enabledShellIds.length} of ${SHELLS.length} in play`,
    summary: `Seed ${config.seed.toString(16).padStart(8, '0')} · ${
      worldLabel(config.selectedWorldId)} · ${config.selectedGeneratorId ?? 'Default'}`,
    modeOptions: modeOptionModels(state),
    cpuTiers: cpuTierModels(config),
    startAction: { type: 'startCustom' },
  };
}

function ammoLabel(ammo: number | 'inf'): string {
  return ammo === 'inf' ? '∞' : String(ammo);
}

function worldLabel(id: MatchWorldId): string {
  return SHIPPED_WORLDS.find((world) => world.id === id)?.name ?? 'Random';
}

const HOWTO_LEDE: readonly string[] = Object.freeze([
  'There is no trajectory preview and there never will be.',
  'Miss short. Miss long. Fire between your last two shots.',
]);

export function buildHowToScreenModel(): HowToScreenModel {
  return {
    id: 'HOWTO',
    label: 'How to play',
    headline: Object.freeze(['Bracket', 'the target']),
    lede: HOWTO_LEDE,
    shots: readHowToShots(),
    backAction: { type: 'back' },
    playAction: { type: 'playFromHowTo' },
  };
}

export function buildRoundOverScreenModel(state: AppFlowState): RoundOverScreenModel {
  const result = state.roundOver?.result ?? null;
  const winner = result === 0 || result === 1 ? result : null;
  return {
    id: 'ROUND_OVER',
    label: 'Round over',
    kicker: roundOverKicker(state),
    headline: roundOverHeadline(state.config, result),
    accentColor: winner === null ? null : state.config.crews[winner].color,
    players: (state.roundOver?.spentShellIdsByPlayer ?? []).map((ids, index) => {
      const player = index === 1 ? 1 : 0;
      return {
        label: crewDisplayName(state.config, player),
        tag: `P${player + 1}`,
        color: state.config.crews[player].color,
        summary: `${ids.length} ${ids.length === 1 ? 'shot' : 'shots'}`,
        winner: winner === player,
        shells: groupSpentShells(state.config, ids),
      };
    }),
    // Ordered so the likeliest action is rightmost.
    buttons: [
      actionButton('Menu', { type: 'menu' }),
      actionButton('Change loadout', { type: 'changeLoadout' }),
      actionButton('Rematch', { type: 'rematch', seed: nextSeed(state.config.seed) }),
    ],
  };
}

function roundOverKicker(state: AppFlowState): string {
  const world = SHIPPED_WORLDS.find((candidate) => candidate.id === state.config.selectedWorldId);
  const turns = state.roundOver?.turns;
  const parts = [
    `Best of ${state.config.rounds}`,
    world?.name ?? 'Random',
    ...(turns === undefined ? [] : [`${turns} ${turns === 1 ? 'turn' : 'turns'}`]),
  ];
  return parts.join(' · ');
}

/**
 * `<crew> wins / the round`, with the verb in the winner's colour. A draw reads `Draw`
 * on its own; an unresolved recap keeps the plain screen label.
 */
function roundOverHeadline(
  config: MatchConfig,
  result: 0 | 1 | 'draw' | null,
): readonly (readonly HeadlineSpan[])[] {
  if (result === 'draw') return Object.freeze([Object.freeze([{ text: 'Draw', accent: false }])]);
  if (result === null) return Object.freeze([Object.freeze([{ text: 'Round over', accent: false }])]);
  return Object.freeze([
    Object.freeze([
      { text: `${crewDisplayName(config, result)} `, accent: false },
      { text: 'wins', accent: true },
    ]),
    Object.freeze([{ text: 'the round', accent: false }]),
  ]);
}

/**
 * Counts, not repeats. `spentShellIdsByPlayer` is a flat list with one entry per shot, and
 * a row per shot makes a long round unreadable.
 */
function groupSpentShells(
  config: MatchConfig,
  ids: readonly string[],
): readonly RoundOverShellModel[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].flatMap(([id, count]) => {
    const shell = config.shells[id];
    return shell ? [{ id, name: shell.name, icon: shell.icon, count }] : [];
  });
}

function actionButton(label: string, action: FlowAction): ActionButtonModel {
  return { label, action, disabled: false };
}

/** The mode this screen only reports; `MAP` is where it can still be switched. */
function selectedModeLabel(state: AppFlowState): string {
  return state.modeOptions.find((option) => option.id === state.config.mode)?.label ??
    state.config.mode;
}

function modeOptionModels(state: AppFlowState): readonly ModeOptionModel[] {
  return state.modeOptions.map((option) => ({
    id: option.id,
    label: option.label,
    disabled: !option.enabled,
    selected: option.id === state.config.mode,
    ...(option.note === undefined ? {} : { note: option.note }),
    action: { type: 'selectMode', mode: option.id },
  }));
}

function cpuTierModels(config: MatchConfig): readonly CpuTierOptionModel[] {
  return CPU_TIERS.map((tier) => ({
    id: tier.id,
    label: tier.name,
    note: `${tier.measuredMedianShotsToHit} shots`,
    disabled: config.mode !== 'cpu',
    selected: tier.id === config.cpuTierId,
    action: { type: 'selectCpuTier', cpuTierId: tier.id },
  }));
}

/**
 * Gravity, field width and wind, read from `spec/worlds.json`. These are exactly what the
 * player is choosing between, and the old tile showed `world.kind` alone and threw them away.
 */
function mapTileModels(
  ids: readonly MatchWorldId[],
  selectedWorldId: MatchWorldId,
): readonly MapTileModel[] {
  return ids.map((id) => {
    const world = SHIPPED_WORLDS.find((candidate) => candidate.id === id);
    if (!world) {
      return {
        id,
        name: 'Random',
        description: 'Seeded shipped battlefield',
        selected: id === selectedWorldId,
        random: true,
        generator: null,
        fieldWidth: 0,
        gravity: 'G ??',
        width: '??? px',
        wind: 'Wind ??',
        accent: null,
        action: { type: 'selectMap', worldId: id },
      } satisfies MapTileModel;
    }
    return {
      id,
      name: world.name,
      description: world.kind,
      selected: id === selectedWorldId,
      random: false,
      generator: world.generator,
      fieldWidth: world.width,
      gravity: `G ${world.gravity.toFixed(2)}`,
      width: `${world.width} px`,
      wind: world.windRange === 0 ? 'No wind' : `Wind ±${world.windRange}`,
      accent: world.palette.accent,
      action: { type: 'selectMap', worldId: id },
    } satisfies MapTileModel;
  });
}



/**
 * The same indexing `drawHowtoScene` uses for its three trajectories, so a card and the arc
 * it describes are always the same colour.
 */
const HISTORICAL_TRAIL_WORLDS = ['rust', 'hollow'] as const;

function howToShotAccent(index: number): string {
  const world = HISTORICAL_TRAIL_WORLDS[index % (HISTORICAL_TRAIL_WORLDS.length + 1)];
  return world ? functionalAccent(world) : HE_SHELL.accent;
}

function readHowToShots(): readonly HowToShotModel[] {
  const record = rawScreens.screens.find((screen) => screen.id === 'HOWTO');
  const text = record && 'teaches' in record ? String(record.teaches) : '';
  const values = [...text.matchAll(/(short|long|hit)\s+(\d+)/g)];
  if (values.length !== 3) throw new Error('Expected three HOWTO trajectories in spec/screens.json');
  return values.map((match, index) => ({
    result: match[1] as HowToShotModel['result'],
    power: Number(match[2]),
    step: `Shot ${String(index + 1).padStart(2, '0')}`,
    accent: howToShotAccent(index),
  }));
}

function readTitleCorner(): readonly string[] {
  const record = rawScreens.screens.find((screen) => screen.id === 'TITLE');
  if (!record || !('corner' in record) || !Array.isArray(record.corner)) {
    throw new Error('Expected TITLE corner controls in spec/screens.json');
  }
  return record.corner.map(String);
}

function nextSeed(seed: number): number {
  return (seed + 1) >>> 0;
}
