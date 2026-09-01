import rawScreens from '../../spec/screens.json';
import { SHIPPED_GENERATORS, type GeneratorId } from '../sim/generators';
import { SHELLS } from '../sim/shells';
import { SHIPPED_WORLDS } from '../sim/worlds';
import {
  MATCH_AMMO_BOUNDS,
  MATCH_ROUND_OPTIONS,
  MATCH_TURN_TIMER_OPTIONS,
  MATCH_WIND_OPTIONS,
  type MatchConfig,
  type MatchMode,
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
  readonly buttons: readonly ActionButtonModel[];
  readonly corner: readonly string[];
}

export interface ModeOptionModel {
  readonly id: MatchMode;
  readonly label: string;
  readonly disabled: boolean;
  readonly note?: string;
  readonly action: FlowAction;
}

export interface ModeScreenModel {
  readonly id: 'MODE';
  readonly label: string;
  readonly step: string;
  readonly options: readonly ModeOptionModel[];
}

export interface MapTileModel {
  readonly id: MatchWorldId;
  readonly name: string;
  readonly description: string;
  readonly selected: boolean;
  readonly action: FlowAction;
}

export interface MapScreenModel {
  readonly id: 'MAP';
  readonly label: string;
  readonly step: string;
  readonly tiles: readonly MapTileModel[];
  readonly modeOptions: readonly ModeOptionModel[];
}

export interface CustomShellRowModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
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
  readonly startAction: FlowAction;
}

export interface ShellSummaryModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly ammo: number | 'inf';
  readonly ammoLabel: string;
}

export interface RoundIntroScreenModel {
  readonly id: 'ROUND_INTRO';
  readonly label: string;
  readonly worldName: string;
  readonly generatorName: string;
  readonly rounds: MatchRounds;
  readonly wind: MatchWind;
  readonly turnTimer: MatchTurnTimer;
  readonly shells: readonly ShellSummaryModel[];
  readonly action: FlowAction;
}

export interface HowToShotModel {
  readonly result: 'short' | 'long' | 'hit';
  readonly power: number;
}

export interface HowToScreenModel {
  readonly id: 'HOWTO';
  readonly label: string;
  readonly shots: readonly HowToShotModel[];
  readonly backAction: FlowAction;
  readonly playAction: FlowAction;
}

export interface RoundOverPlayerModel {
  readonly label: string;
  readonly shells: readonly Pick<ShellSummaryModel, 'id' | 'name' | 'icon'>[];
}

export interface RoundOverScreenModel {
  readonly id: 'ROUND_OVER';
  readonly label: string;
  readonly players: readonly RoundOverPlayerModel[];
  readonly buttons: readonly ActionButtonModel[];
}

export function buildTitleScreenModel(): TitleScreenModel {
  return {
    id: 'TITLE',
    label: 'Tank Duel',
    buttons: [
      actionButton('Quick Start', { type: 'quickStart' }),
      actionButton('Custom Game', { type: 'openCustom' }),
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
    options: state.modeOptions.map((option) => ({
      id: option.id,
      label: option.label,
      disabled: !option.enabled,
      ...(option.note === undefined ? {} : { note: option.note }),
      action: { type: 'selectMode', mode: option.id },
    })),
  };
}

export function buildMapScreenModel(state: AppFlowState): MapScreenModel {
  return {
    id: 'MAP',
    label: 'Choose battlefield',
    step: '2 / 2',
    tiles: mapTileModels(state.mapOptions, state.config.selectedWorldId),
    modeOptions: state.modeOptions.map((option) => ({
      id: option.id,
      label: option.label,
      disabled: option.id === 'cpu' || !option.enabled,
      ...(option.note === undefined ? {} : { note: option.note }),
      action: { type: 'selectMode', mode: option.id },
    })),
  };
}

export function buildCustomScreenModel(config: MatchConfig): CustomScreenModel {
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
        locked,
        enabled: shellConfig.enabled,
        ammo: shellConfig.ammo,
        ammoLabel: ammoLabel(shellConfig.ammo),
        toggleDisabled: locked,
        countDisabled: locked || !shellConfig.enabled,
      };
    }),
    startAction: { type: 'startCustom' },
  };
}

export function buildRoundIntroScreenModel(config: MatchConfig): RoundIntroScreenModel {
  const resolvedWorldId = 'worldId' in config && typeof config.worldId === 'string'
    ? config.worldId
    : config.selectedWorldId;
  const world = SHIPPED_WORLDS.find((candidate) => candidate.id === resolvedWorldId);
  const resolvedGeneratorId = 'generatorId' in config && typeof config.generatorId === 'string'
    ? config.generatorId
    : config.selectedGeneratorId ?? world?.generator ?? null;

  return {
    id: 'ROUND_INTRO',
    label: 'Ready to deploy',
    worldName: world?.name ?? 'Random',
    generatorName: resolvedGeneratorId ?? 'Default',
    rounds: config.rounds,
    wind: config.wind,
    turnTimer: config.turnTimer,
    shells: config.enabledShellIds.map((id) => shellSummary(config, id)),
    action: { type: 'openLoadout' },
  };
}

export function buildHowToScreenModel(): HowToScreenModel {
  return {
    id: 'HOWTO',
    label: 'How to play',
    shots: readHowToShots(),
    backAction: { type: 'back' },
    playAction: { type: 'playFromHowTo' },
  };
}

export function buildRoundOverScreenModel(state: AppFlowState): RoundOverScreenModel {
  return {
    id: 'ROUND_OVER',
    label: 'Round over',
    players: (state.roundOver?.spentShellIdsByPlayer ?? []).map((ids, index) => ({
      label: `Player ${index + 1}`,
      shells: ids.flatMap((id) => {
        const shell = state.config.shells[id];
        return shell ? [{ id, name: shell.name, icon: shell.icon }] : [];
      }),
    })),
    buttons: [
      actionButton('Rematch', { type: 'rematch', seed: nextSeed(state.config.seed) }),
      actionButton('Change loadout', { type: 'changeLoadout' }),
      actionButton('Menu', { type: 'menu' }),
    ],
  };
}

function actionButton(label: string, action: FlowAction): ActionButtonModel {
  return { label, action, disabled: false };
}

function mapTileModels(
  ids: readonly MatchWorldId[],
  selectedWorldId: MatchWorldId,
): readonly MapTileModel[] {
  return ids.map((id) => {
    const world = SHIPPED_WORLDS.find((candidate) => candidate.id === id);
    return {
      id,
      name: world?.name ?? 'Random',
      description: world?.kind ?? 'Seeded shipped battlefield',
      selected: id === selectedWorldId,
      action: { type: 'selectMap', worldId: id },
    };
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

function readHowToShots(): readonly HowToShotModel[] {
  const record = rawScreens.screens.find((screen) => screen.id === 'HOWTO');
  const text = record && 'teaches' in record ? String(record.teaches) : '';
  const values = [...text.matchAll(/(short|long|hit)\s+(\d+)/g)];
  if (values.length !== 3) throw new Error('Expected three HOWTO trajectories in spec/screens.json');
  return values.map((match) => ({
    result: match[1] as HowToShotModel['result'],
    power: Number(match[2]),
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
