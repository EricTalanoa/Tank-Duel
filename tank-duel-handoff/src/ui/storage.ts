import { createDefaultConfig, validateConfig, type MatchConfig } from './config';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const MATCH_CONFIG_STORAGE_KEY = 'tank-duel:last-match-config';
export const MATCH_CONFIG_STORAGE_VERSION = 1;

interface StoredMatchConfig {
  readonly path: MatchConfig['path'];
  readonly mode: MatchConfig['mode'];
  readonly cpuTierId: MatchConfig['cpuTierId'];
  readonly selectedWorldId: MatchConfig['selectedWorldId'];
  readonly selectedGeneratorId: MatchConfig['selectedGeneratorId'];
  readonly seed: MatchConfig['seed'];
  readonly rounds: MatchConfig['rounds'];
  readonly wind: MatchConfig['wind'];
  readonly turnTimer: MatchConfig['turnTimer'];
  readonly crews: MatchConfig['crews'];
  readonly enabledShellIds: readonly string[];
  readonly shells: Readonly<Record<string, {
    readonly enabled: boolean;
    readonly ammo: number | 'inf';
  }>>;
}

export function loadLastConfig(storage: StorageLike): MatchConfig {
  const payload = storage.getItem(MATCH_CONFIG_STORAGE_KEY);
  if (!payload) return createDefaultConfig();

  try {
    const parsed = JSON.parse(payload) as { version?: unknown; config?: unknown };
    if (parsed.version !== MATCH_CONFIG_STORAGE_VERSION) return createDefaultConfig();
    return validateConfig(parsed.config) ?? createDefaultConfig();
  } catch {
    return createDefaultConfig();
  }
}

export function saveLastConfig(storage: StorageLike, config: MatchConfig): MatchConfig {
  const validated = validateConfig(config) ?? createDefaultConfig();
  storage.setItem(MATCH_CONFIG_STORAGE_KEY, JSON.stringify({
    version: MATCH_CONFIG_STORAGE_VERSION,
    config: toStoredMatchConfig(validated),
  }));
  return validated;
}

function toStoredMatchConfig(config: MatchConfig): StoredMatchConfig {
  return {
    path: config.path,
    mode: config.mode,
    cpuTierId: config.cpuTierId,
    selectedWorldId: config.selectedWorldId,
    selectedGeneratorId: config.selectedGeneratorId,
    seed: config.seed,
    rounds: config.rounds,
    wind: config.wind,
    turnTimer: config.turnTimer,
    crews: [
      { name: config.crews[0].name, color: config.crews[0].color },
      { name: config.crews[1].name, color: config.crews[1].color },
    ],
    enabledShellIds: [...config.enabledShellIds],
    shells: Object.fromEntries(
      Object.entries(config.shells).map(([id, shell]) => [id, {
        enabled: shell.enabled,
        ammo: shell.ammo,
      }]),
    ),
  };
}
