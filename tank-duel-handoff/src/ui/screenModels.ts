import rawScreens from '../../spec/screens.json';
import { CPU_TIERS } from '../sim/cpu';
import { functionalAccent } from '../render/palette';
import { HE_SHELL } from '../sim/shells';
import { PRESENTATION } from '../render/presentation';
import { SHIPPED_GENERATORS, type GeneratorId } from '../sim/generators';
import { SHELLS } from '../sim/shells';
import { SHIPPED_WORLDS, type WindMode, type WorldPhysics } from '../sim/worlds';
import {
  CPU_CREW_NAME,
  CREW_COLOR_OPTIONS,
  CREW_NAME_MAX_LENGTH,
  CREW_SCREEN_STEP,
  MATCH_AMMO_BOUNDS,
  MATCH_ROUND_OPTIONS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WIND_OPTIONS,
  crewLabel,
  crewsNamed,
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
  readonly step: string;
  readonly options: readonly ModeOptionModel[];
  readonly cpuTiers: readonly CpuTierOptionModel[];
}

export interface CrewSwatchModel {
  readonly value: string;
  /** Named for a screen reader: the swatch is a colour, so the hex is the only label there is. */
  readonly label: string;
  readonly selected: boolean;
}

export interface CrewPanelModel {
  readonly player: 0 | 1;
  /** `P1` / `P2`, tinted with this crew's colour. */
  readonly tag: string;
  /** `Player 1` / `Player 2`, or `CPU` once player 2 is the machine. */
  readonly label: string;
  /** What the field holds: what was typed, or the CPU's fixed name. */
  readonly name: string;
  readonly placeholder: string;
  readonly nameDisabled: boolean;
  readonly nameMaxLength: number;
  readonly color: string;
  /** The chosen hex, as the panel header prints it. */
  readonly colorLabel: string;
  readonly swatchGroupLabel: string;
  readonly swatches: readonly CrewSwatchModel[];
  /** Preview aim, stored 0-180 absolute; player 2's is mirrored per `spec/constants.json`. */
  readonly previewAngleDeg: number;
  readonly previewDirection: 1 | -1;
}

export interface CrewScreenModel {
  readonly id: 'CREW';
  readonly label: string;
  readonly kicker: string;
  readonly step: string;
  readonly crews: readonly [CrewPanelModel, CrewPanelModel];
  /** The matchup once both crews are named, and what is still missing until then. */
  readonly status: string;
  readonly ready: boolean;
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
  readonly step: string;
  readonly tiles: readonly MapTileModel[];
  readonly modeOptions: readonly ModeOptionModel[];
  readonly cpuTiers: readonly CpuTierOptionModel[];
}

export interface CustomShellRowModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** `3 PT`, or `LOCKED` for the free shell. */
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

export interface ShellSummaryModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly ammo: number | 'inf';
  readonly ammoLabel: string;
}

export interface BriefingEntry {
  readonly term: string;
  readonly value: string;
}

export interface RoundIntroScreenModel {
  readonly id: 'ROUND_INTRO';
  readonly label: string;
  readonly worldName: string;
  readonly generatorName: string;
  readonly rounds: MatchRounds;
  readonly wind: MatchWind;
  readonly turnTimer: MatchTurnTimer;
  /** The same data the terms always carried, said in full rather than in one word. */
  readonly briefing: readonly BriefingEntry[];
  readonly shells: readonly ShellSummaryModel[];
  readonly action: FlowAction;
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
  return {
    id: 'MODE',
    label: 'Choose mode',
    step: '1 / 2',
    options: modeOptionModels(state),
    cpuTiers: cpuTierModels(state.config),
  };
}

/**
 * The two crews, facing each other: player 1 on the left aiming right, player 2 on the right
 * aiming left. Both preview angles are stored absolute, which is why the mirrored panel reads
 * 128 rather than 52.
 */
const CREW_PREVIEW_ANGLE_DEG = 52;

export function buildCrewScreenModel(state: AppFlowState): CrewScreenModel {
  const { config } = state;
  const ready = crewsNamed(config);
  return {
    id: 'CREW',
    label: 'Name your crews',
    kicker: `Quick start · ${modeOptionModels(state).find((option) => option.selected)?.label ?? ''}`,
    step: CREW_SCREEN_STEP,
    crews: Object.freeze([crewPanelModel(config, 0), crewPanelModel(config, 1)]) as
      readonly [CrewPanelModel, CrewPanelModel],
    status: ready
      ? `${crewLabel(config, 0)} vs ${crewLabel(config, 1)}`.toUpperCase()
      : 'Name both crews to continue',
    ready,
    backAction: { type: 'back' },
    continueAction: { type: 'confirmCrews' },
  };
}

function crewPanelModel(config: MatchConfig, player: 0 | 1): CrewPanelModel {
  const crew = config.crews[player];
  const isCpu = player === 1 && config.mode === 'cpu';
  const label = isCpu ? CPU_CREW_NAME : PRESENTATION.players[player].label;
  return {
    player,
    tag: `P${player + 1}`,
    label,
    // The CPU names itself, so the field shows that name rather than an empty box the
    // player cannot fill in. Whatever crew 2 typed in local mode is kept in config.
    name: isCpu ? CPU_CREW_NAME : crew.name,
    placeholder: label,
    nameDisabled: isCpu,
    nameMaxLength: CREW_NAME_MAX_LENGTH,
    color: crew.color,
    colorLabel: crew.color.toUpperCase(),
    swatchGroupLabel: `${PRESENTATION.players[player].label} tank colour`,
    swatches: CREW_COLOR_OPTIONS.map((value) => ({
      value,
      label: `${value.toUpperCase()} for ${PRESENTATION.players[player].label}`,
      selected: value.toUpperCase() === crew.color.toUpperCase(),
    })),
    previewAngleDeg: player === 0 ? CREW_PREVIEW_ANGLE_DEG : 180 - CREW_PREVIEW_ANGLE_DEG,
    previewDirection: player === 0 ? 1 : -1,
  };
}

export function buildMapScreenModel(state: AppFlowState): MapScreenModel {
  return {
    id: 'MAP',
    label: 'Choose battlefield',
    step: '2 / 2',
    tiles: mapTileModels(state.mapOptions, state.config.selectedWorldId),
    modeOptions: modeOptionModels(state),
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
        costLabel: locked ? 'Locked' : `${shell.cost} pt`,
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

function worldLabel(id: MatchWorldId): string {
  return SHIPPED_WORLDS.find((world) => world.id === id)?.name ?? 'Random';
}

export function buildRoundIntroScreenModel(config: MatchConfig): RoundIntroScreenModel {
  const resolvedWorldId = 'worldId' in config && typeof config.worldId === 'string'
    ? config.worldId
    : config.selectedWorldId;
  const world = SHIPPED_WORLDS.find((candidate) => candidate.id === resolvedWorldId);
  const resolvedGeneratorId = 'generatorId' in config && typeof config.generatorId === 'string'
    ? config.generatorId
    : config.selectedGeneratorId ?? world?.generator ?? null;

  const worldName = world?.name ?? 'Random';
  const generatorName = resolvedGeneratorId ?? 'Default';
  return {
    id: 'ROUND_INTRO',
    label: 'Ready to deploy',
    worldName,
    generatorName,
    rounds: config.rounds,
    wind: config.wind,
    turnTimer: config.turnTimer,
    briefing: Object.freeze([
      { term: 'Crews', value: `${crewLabel(config, 0)} vs ${crewLabel(config, 1)}` },
      { term: 'World', value: world ? `${world.name} — ${lowerFirst(world.kind)}` : worldName },
      { term: 'Terrain', value: capitalize(generatorName) },
      { term: 'Rounds', value: `Best of ${config.rounds}` },
      { term: 'Wind', value: windDescription(config.wind, world) },
      { term: 'Turn timer', value: turnTimerDescription(config.turnTimer) },
    ]),
    shells: config.enabledShellIds.map((id) => shellSummary(config, id)),
    action: { type: 'openLoadout' },
  };
}

/**
 * Wind said in full: the setting, then the world's own behaviour and range from
 * `spec/worlds.json`. Nothing here describes behaviour the sim does not have — a vacuum
 * world reads as a vacuum whatever the setting says.
 */
function windDescription(wind: MatchWind, world: WorldPhysics | undefined): string {
  if (wind === 'off') return 'Off';
  if (!world) return capitalize(wind);
  if (world.windRange === 0) return 'None — vacuum';
  return `${capitalize(wind)} — ${WIND_MODE_PHRASE[world.windMode]}, ±${world.windRange}`;
}

const WIND_MODE_PHRASE: Readonly<Record<WindMode, string>> = Object.freeze({
  reroll: 'rerolls each turn',
  fixed: 'fixed for the match',
  none: 'no wind',
});

function turnTimerDescription(turnTimer: MatchTurnTimer): string {
  return turnTimer === 'off' ? 'Off' : `${turnTimer} seconds per turn`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
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
        label: crewLabel(state.config, player),
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
      { text: `${crewLabel(config, result)} `, accent: false },
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

function shellSummary(config: MatchConfig, id: string): ShellSummaryModel {
  const shell = config.shells[id];
  if (!shell) throw new Error(`Missing shell config for ${id}`);
  return {
    id,
    name: shell.name,
    icon: shell.icon,
    ammo: shell.ammo,
    ammoLabel: ammoLabel(shell.ammo),
  };
}

function ammoLabel(ammo: number | 'inf'): string {
  return ammo === 'inf' ? '∞' : String(ammo);
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
