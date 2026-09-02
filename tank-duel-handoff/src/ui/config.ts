import rawScreens from '../../spec/screens.json';
import { CONSTANTS } from '../sim/constants';
import { CPU_TIERS, type CpuTierId } from '../sim/cpu';
import { resolveGeneratorId, SHIPPED_GENERATORS, type GeneratorId } from '../sim/generators';
import { HE_SHELL, SHELLS, type Shell } from '../sim/shells';
import { PLAYABLE_SHELL_IDS } from '../sim/weapons';
import { SHIPPED_WORLDS, worldById, type WorldId } from '../sim/worlds';
import { PRESENTATION } from '../render/presentation';
import type { Rng } from '../sim/rng';

export type MatchPath = 'quick' | 'custom';
export type MatchMode = 'local' | 'cpu';
export type { CpuTierId } from '../sim/cpu';
export type MatchWorldId = WorldId | 'random';
export type MatchRounds = 1 | 3 | 5;
export type MatchWind = 'off' | 'light' | 'full';
export type MatchTurnTimer = 'off' | '30' | '15';

/** One crew's identity: what the player typed, and the colour their tank is painted. */
export interface CrewConfig {
  readonly name: string;
  readonly color: string;
}

export interface MatchShellConfig {
  readonly name: string;
  readonly icon: string;
  readonly locked: boolean;
  readonly enabled: boolean;
  readonly ammo: number | 'inf';
  readonly defaultAmmo: number | 'inf';
}

export interface MatchConfig {
  readonly path: MatchPath;
  readonly mode: MatchMode;
  readonly cpuTierId: CpuTierId;
  readonly selectedWorldId: MatchWorldId;
  readonly selectedGeneratorId: GeneratorId | null;
  readonly seed: number;
  readonly rounds: MatchRounds;
  readonly wind: MatchWind;
  readonly turnTimer: MatchTurnTimer;
  readonly crews: readonly [CrewConfig, CrewConfig];
  readonly enabledShellIds: readonly string[];
  readonly shells: Readonly<Record<string, MatchShellConfig>>;
}

export interface ResolvedMatchConfig extends MatchConfig {
  readonly worldId: WorldId;
  readonly generatorId: GeneratorId;
}

interface ConfigRecord {
  [key: string]: unknown;
}

interface ScreenRecord extends ConfigRecord {
  readonly id: string;
}

interface AmmoBounds {
  readonly min: number;
  readonly max: number;
}

const SCREEN_RECORDS = rawScreens.screens as readonly ScreenRecord[];

export const MATCH_SCREEN_IDS: readonly string[] = Object.freeze(
  SCREEN_RECORDS.map((screen) => screen.id),
);

export const CPU_TIER_OPTIONS = CPU_TIERS;

export const CPU_TIER_IDS: readonly CpuTierId[] = Object.freeze(
  CPU_TIER_OPTIONS.map((tier) => tier.id),
);

export const CREATE_DEFAULT_CPU_TIER_ID: CpuTierId = CPU_TIER_IDS[
  Math.floor(CPU_TIER_IDS.length / 2)
] ?? 'gunner';

const MAP_SCREEN = screenById('MAP');
const CUSTOM_SCREEN = screenById('CUSTOM');

export const MATCH_AMMO_BOUNDS: AmmoBounds = Object.freeze(
  readAmmoBounds(CUSTOM_SCREEN.ammoCount),
);

export const MATCH_WORLD_OPTIONS: readonly MatchWorldId[] = Object.freeze(
  readStringArray(MAP_SCREEN.options).map((option) => option as MatchWorldId),
);

export const MATCH_ROUND_OPTIONS: readonly MatchRounds[] = Object.freeze(
  parseNumericGroup(CUSTOM_SCREEN.groups, 'rounds') as MatchRounds[],
);

export const MATCH_WIND_OPTIONS: readonly MatchWind[] = Object.freeze(
  parseStringGroup(CUSTOM_SCREEN.groups, 'wind') as MatchWind[],
);

export const MATCH_TURN_TIMER_OPTIONS: readonly MatchTurnTimer[] = Object.freeze(
  parseStringGroup(CUSTOM_SCREEN.groups, 'turnTimer') as MatchTurnTimer[],
);

export const DEFAULT_ENABLED_SHELL_IDS: readonly string[] = Object.freeze(
  [...PLAYABLE_SHELL_IDS],
);

/**
 * `<input maxlength>` and the validator agree on one number: a name long enough to read on
 * a nameplate, short enough not to push the HUD's health bar off its anchor.
 */
export const CREW_NAME_MAX_LENGTH = 14;

/** What crew 2 is called when it is not a person. */
export const CPU_CREW_NAME = 'CPU';

/**
 * The eight tank colours, in the order the picker offers them: the two presentation
 * defaults first, then one accent per shipped world.
 *
 * Only the ordering lives here — every value is read from `spec/`, so a palette change in
 * `worlds.json` or `presentation.json` carries into the picker without a retype.
 */
const CREW_COLOR_WORLD_ORDER: readonly WorldId[] = Object.freeze([
  'terra', 'rust', 'selene', 'ferrum', 'hollow', 'vesper',
]);

export const CREW_COLOR_OPTIONS: readonly string[] = Object.freeze([
  ...PRESENTATION.players.map((player) => player.color),
  ...CREW_COLOR_WORLD_ORDER.map((id) => worldById(id).palette.accent),
]);

export const DEFAULT_CREWS: readonly [CrewConfig, CrewConfig] = freezeCrews([
  { name: '', color: PRESENTATION.players[0].color },
  { name: '', color: PRESENTATION.players[1].color },
]);

const SHIPPED_WORLD_IDS = new Set<string>(SHIPPED_WORLDS.map((world) => world.id));
const SHIPPED_GENERATOR_IDS = new Set<string>(SHIPPED_GENERATORS);
const MATCH_ROUND_SET = new Set<number>(MATCH_ROUND_OPTIONS);
const MATCH_WIND_SET = new Set<string>(MATCH_WIND_OPTIONS);
const MATCH_TURN_TIMER_SET = new Set<string>(MATCH_TURN_TIMER_OPTIONS);
// Rotation and validity are intentionally separate: hidden maps and existing saved links
// remain playable even when they are not offered by Quick Start.
const MATCH_WORLD_SET = new Set<string>([...SHIPPED_WORLD_IDS, 'random']);
const CPU_TIER_SET = new Set<string>(CPU_TIER_IDS);
const SHELLS_BY_ID = new Map<string, Shell>(SHELLS.map((shell) => [shell.id, shell]));

export function createDefaultConfig(): MatchConfig {
  const shells = buildShellConfig(DEFAULT_ENABLED_SHELL_IDS);
  return freezeConfig({
    path: 'quick',
    mode: 'local',
    cpuTierId: CREATE_DEFAULT_CPU_TIER_ID,
    selectedWorldId: MATCH_WORLD_OPTIONS.at(-1) ?? SHIPPED_WORLDS[0]!.id,
    selectedGeneratorId: null,
    seed: 0,
    rounds: MATCH_ROUND_OPTIONS[1] ?? MATCH_ROUND_OPTIONS[0] ?? 3,
    wind: MATCH_WIND_OPTIONS.at(-1) ?? 'full',
    turnTimer: MATCH_TURN_TIMER_OPTIONS[0] ?? 'off',
    crews: DEFAULT_CREWS,
    enabledShellIds: enabledShellIdsFor(shells),
    shells,
  });
}

export function validateConfig(value: unknown): MatchConfig | null {
  if (!isRecord(value)) return null;
  const path = value.path;
  const mode = value.mode;
  const cpuTierId = value.cpuTierId;
  const selectedWorldId = value.selectedWorldId;
  const selectedGeneratorId = value.selectedGeneratorId;
  const seed = value.seed;
  const rounds = value.rounds;
  const wind = value.wind;
  const turnTimer = value.turnTimer;
  const shellValue = value.shells;
  const crewValue = value.crews;

  if (path !== 'quick' && path !== 'custom') return null;
  if (mode !== 'local' && mode !== 'cpu') return null;
  if (typeof cpuTierId !== 'string' || !CPU_TIER_SET.has(cpuTierId)) return null;
  if (typeof selectedWorldId !== 'string' || !MATCH_WORLD_SET.has(selectedWorldId)) return null;
  if (selectedGeneratorId !== null &&
    (typeof selectedGeneratorId !== 'string' || !SHIPPED_GENERATOR_IDS.has(selectedGeneratorId))) {
    return null;
  }
  if (!isUint32(seed)) return null;
  if (typeof rounds !== 'number' || !MATCH_ROUND_SET.has(rounds)) return null;
  if (typeof wind !== 'string' || !MATCH_WIND_SET.has(wind)) return null;
  if (typeof turnTimer !== 'string' || !MATCH_TURN_TIMER_SET.has(turnTimer)) return null;

  const crews = validateCrews(crewValue);
  if (!crews) return null;

  const shells = validateShellConfig(shellValue);
  if (!shells) return null;

  const enabledShellIds = enabledShellIdsFor(shells);
  if ('enabledShellIds' in value && value.enabledShellIds !== undefined) {
    if (!sameStringArray(value.enabledShellIds, enabledShellIds)) return null;
  }

  return freezeConfig({
    path: path as MatchPath,
    mode: mode as MatchMode,
    cpuTierId: cpuTierId as CpuTierId,
    selectedWorldId: selectedWorldId as MatchWorldId,
    selectedGeneratorId: selectedGeneratorId as GeneratorId | null,
    seed,
    rounds: rounds as MatchRounds,
    wind: wind as MatchWind,
    turnTimer: turnTimer as MatchTurnTimer,
    crews,
    enabledShellIds,
    shells,
  });
}

export function resolveMatchConfig(config: MatchConfig, seedRng: Rng): ResolvedMatchConfig {
  const validated = validateConfig(config) ?? createDefaultConfig();
  const worldId = validated.selectedWorldId === 'random'
    ? SHIPPED_WORLDS[seedRng.int(SHIPPED_WORLDS.length)]?.id ?? SHIPPED_WORLDS[0]!.id
    : validated.selectedWorldId;
  const shippedWorldId = SHIPPED_WORLD_IDS.has(worldId) ? worldId : SHIPPED_WORLDS[0]!.id;
  const world = worldById(shippedWorldId as WorldId);
  const generatorId = validated.selectedGeneratorId === null
    ? world.generator
    : resolveGeneratorId(validated.selectedGeneratorId, world.generator);

  return freezeConfig({
    ...validated,
    worldId: world.id,
    generatorId,
  });
}

/**
 * Crew identity, validated the way `validatePresentation` validates the defaults it seeds:
 * six-digit hex, and the two colours distinct. A shared colour makes two tanks, two
 * projectile trails and two health bars indistinguishable, so it is rejected rather than
 * nudged.
 *
 * Names are stored exactly as typed. Trimming here would delete the space the moment a
 * player typed it, making a two-word crew name impossible; the trim happens where a name is
 * read, not where it is written. Absent crews validate to the defaults so a config saved
 * before this screen existed still loads.
 */
function validateCrews(value: unknown): readonly [CrewConfig, CrewConfig] | null {
  if (value === undefined) return DEFAULT_CREWS;
  if (!Array.isArray(value) || value.length !== 2) return null;

  const crews: CrewConfig[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    const { name, color } = candidate;
    if (typeof name !== 'string' || name.length > CREW_NAME_MAX_LENGTH) return null;
    if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) return null;
    crews.push({ name, color });
  }
  if (crews[0]!.color.toUpperCase() === crews[1]!.color.toUpperCase()) return null;
  return freezeCrews([crews[0]!, crews[1]!]);
}

function freezeCrews(crews: readonly [CrewConfig, CrewConfig]): readonly [CrewConfig, CrewConfig] {
  return Object.freeze([Object.freeze(crews[0]), Object.freeze(crews[1])]) as
    readonly [CrewConfig, CrewConfig];
}

/** The one place a crew is turned into text: `CPU`, what was typed, or the default label. */
export function crewDisplayName(config: MatchConfig, player: 0 | 1): string {
  if (player === 1 && config.mode === 'cpu') return CPU_CREW_NAME;
  return config.crews[player].name.trim() || PRESENTATION.players[player].label;
}

export function withCrewName(config: MatchConfig, player: 0 | 1, name: string): MatchConfig {
  const next: CrewConfig[] = [{ ...config.crews[0] }, { ...config.crews[1] }];
  next[player] = { ...next[player]!, name };
  return validateConfig({ ...config, crews: next }) ?? config;
}

/**
 * Taking the other crew's colour swaps rather than being refused. The two must stay
 * distinct, and greying out the colour the opponent holds would make the picker's most
 * obvious move a dead button.
 */
export function withCrewColor(config: MatchConfig, player: 0 | 1, color: string): MatchConfig {
  if (!CREW_COLOR_OPTIONS.includes(color)) return config;
  const other = player === 0 ? 1 : 0;
  const next: CrewConfig[] = [{ ...config.crews[0] }, { ...config.crews[1] }];
  if (next[other]!.color === color) next[other] = { ...next[other]!, color: config.crews[player].color };
  next[player] = { ...next[player]!, color };
  return validateConfig({ ...config, crews: next }) ?? config;
}

/**
 * The CPU's colour is rolled, not picked. Crew 2 is not a person, so a picker on its panel
 * would be one player choosing the opponent's paint; every option except the one crew 1
 * already holds is fair game.
 *
 * The roll comes in as a 0-1 number so this stays pure and the reducer stays deterministic —
 * the controller is the one place that reaches for `Math.random`. Player 1 can still take
 * the colour the CPU landed on: `withCrewColor` swaps the two, so no colour is ever locked
 * behind the opponent.
 */
export function withRolledCpuColor(config: MatchConfig, roll: number): MatchConfig {
  const taken = config.crews[0].color.toUpperCase();
  const options = CREW_COLOR_OPTIONS.filter((color) => color.toUpperCase() !== taken);
  if (options.length === 0) return config;
  const bounded = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  return withCrewColor(config, 1, options[Math.floor(bounded * options.length)]!);
}

function buildShellConfig(enabledShellIds: readonly string[]): Readonly<Record<string, MatchShellConfig>> {
  const enabledSet = new Set(enabledShellIds);
  return Object.freeze(Object.fromEntries(
    SHELLS.map((shell) => [shell.id, buildShellEntry(shell, enabledSet.has(shell.id))]),
  ));
}

function validateShellConfig(value: unknown): Readonly<Record<string, MatchShellConfig>> | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== SHELLS.length) return null;

  const entries: [string, MatchShellConfig][] = [];
  for (const shell of SHELLS) {
    const candidate = value[shell.id];
    if (!isRecord(candidate)) return null;
    if (candidate.name !== undefined && candidate.name !== shell.name) return null;
    if (candidate.icon !== undefined && candidate.icon !== shell.icon) return null;
    if (candidate.defaultAmmo !== undefined && candidate.defaultAmmo !== shell.ammo) return null;
    if (candidate.locked !== undefined && candidate.locked !== isLockedShell(shell)) return null;
    if (typeof candidate.enabled !== 'boolean') return null;
    if (!isValidShellAmmo(shell, candidate.ammo)) return null;
    if (shell.id === HE_SHELL.id && (!candidate.enabled || candidate.ammo !== 'inf')) return null;

    entries.push([shell.id, buildShellEntry(shell, candidate.enabled, candidate.ammo)]);
  }

  for (const key of keys) {
    if (!SHELLS_BY_ID.has(key)) return null;
  }

  return Object.freeze(Object.fromEntries(entries));
}

function buildShellEntry(
  shell: Shell,
  enabled: boolean,
  ammo: number | 'inf' = shell.ammo,
): MatchShellConfig {
  return Object.freeze({
    name: shell.name,
    icon: shell.icon,
    locked: isLockedShell(shell),
    enabled,
    ammo,
    defaultAmmo: shell.ammo,
  });
}

function enabledShellIdsFor(shells: Readonly<Record<string, MatchShellConfig>>): readonly string[] {
  return Object.freeze(
    SHELLS.filter((shell) => shells[shell.id]?.enabled).map((shell) => shell.id),
  );
}

function isLockedShell(shell: Shell): boolean {
  return shell.id === CONSTANTS.loadout.freeShell;
}

function isValidShellAmmo(shell: Shell, ammo: unknown): ammo is number | 'inf' {
  if (shell.id === HE_SHELL.id) return ammo === 'inf';
  return Number.isInteger(ammo) &&
    Number(ammo) >= MATCH_AMMO_BOUNDS.min &&
    Number(ammo) <= MATCH_AMMO_BOUNDS.max;
}

function freezeConfig<T extends { readonly crews?: readonly [CrewConfig, CrewConfig]; readonly shells?: Readonly<Record<string, MatchShellConfig>>; readonly enabledShellIds?: readonly string[] }>(config: T): T {
  if (config.crews) freezeCrews(config.crews);
  if (config.shells) {
    for (const shell of Object.values(config.shells)) Object.freeze(shell);
    Object.freeze(config.shells);
  }
  if (config.enabledShellIds) Object.freeze(config.enabledShellIds);
  return Object.freeze(config);
}

function sameStringArray(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function screenById(id: string): ScreenRecord {
  const screen = SCREEN_RECORDS.find((candidate) => candidate.id === id);
  if (!screen) throw new Error(`Missing ${id} in spec/screens.json`);
  return screen;
}

function parseNumericGroup(groups: unknown, prefix: string): number[] {
  return parseGroup(groups, prefix).map((value) => Number(value));
}

function parseStringGroup(groups: unknown, prefix: string): string[] {
  return parseGroup(groups, prefix);
}

function parseGroup(groups: unknown, prefix: string): string[] {
  if (!isRecord(groups)) throw new Error(`Missing ${prefix} options in spec/screens.json`);
  const matchEntries = Object.values(groups).find((value) =>
    Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry.startsWith(`${prefix} `)),
  );
  if (!Array.isArray(matchEntries)) throw new Error(`Missing ${prefix} options in spec/screens.json`);
  const entry = matchEntries.find((value) => typeof value === 'string' && value.startsWith(`${prefix} `));
  if (typeof entry !== 'string') throw new Error(`Missing ${prefix} options in spec/screens.json`);
  return entry.slice(prefix.length + 1).split('/');
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Expected a string array in spec/screens.json');
  }
  return [...value];
}

function readAmmoBounds(value: unknown): AmmoBounds {
  if (!isRecord(value) || !Number.isInteger(value.min) || !Number.isInteger(value.max)) {
    throw new Error('Expected CUSTOM.ammoCount min/max in spec/screens.json');
  }
  if (Number(value.min) < 1 || Number(value.min) > Number(value.max)) {
    throw new Error('Invalid CUSTOM.ammoCount range in spec/screens.json');
  }
  return {
    min: Number(value.min),
    max: Number(value.max),
  };
}

function isUint32(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
}

function isRecord(value: unknown): value is ConfigRecord {
  return typeof value === 'object' && value !== null;
}
