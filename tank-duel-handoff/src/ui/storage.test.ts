import { describe, expect, it } from 'vitest';
import {
  createDefaultConfig,
  type MatchConfig,
} from './config';
import {
  MATCH_CONFIG_STORAGE_KEY,
  MATCH_CONFIG_STORAGE_VERSION,
  loadLastConfig,
  saveLastConfig,
  type StorageLike,
} from './storage';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & {
  readonly map: Map<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function withPayload(config: unknown, version = MATCH_CONFIG_STORAGE_VERSION): string {
  return JSON.stringify({ version, config });
}

describe('match config storage', () => {
  it('round-trips a valid config through versioned storage', () => {
    const storage = createMemoryStorage();
    const defaults = createDefaultConfig();
    const config: MatchConfig = {
      ...defaults,
      path: 'custom',
      selectedWorldId: 'vesper',
      selectedGeneratorId: 'spires',
      rounds: 5,
      wind: 'light',
      turnTimer: '15',
      seed: 0x1234abcd,
      shells: {
        ...defaults.shells,
        cluster: {
          ...defaults.shells.cluster!,
          ammo: 7,
          enabled: true,
        },
      },
    };

    saveLastConfig(storage, config);

    expect(storage.map.get(MATCH_CONFIG_STORAGE_KEY)).toContain('"version":1');
    expect(loadLastConfig(storage)).toEqual(config);
  });

  it.each([
    ['missing payload', null],
    ['wrong version', withPayload(createDefaultConfig(), 99)],
    ['invalid json', '{'],
    ['unknown world id', withPayload({ ...createDefaultConfig(), selectedWorldId: 'bogus' })],
    ['invalid generator id', withPayload({ ...createDefaultConfig(), selectedGeneratorId: 'bogus' })],
    ['inconsistent enabled shell ids', withPayload({
      ...createDefaultConfig(),
      enabledShellIds: createDefaultConfig().enabledShellIds.filter((id) => id !== 'sand'),
    })],
    ['missing shell key', withPayload({
      ...createDefaultConfig(),
      shells: Object.fromEntries(
        Object.entries(createDefaultConfig().shells).filter(([id]) => id !== 'mortar'),
      ),
    })],
    ['extra shell key', withPayload({
      ...createDefaultConfig(),
      shells: {
        ...createDefaultConfig().shells,
        bonus: createDefaultConfig().shells.he,
      },
    })],
    ['malformed shell entry', withPayload({
      ...createDefaultConfig(),
      shells: {
        ...createDefaultConfig().shells,
        mortar: true,
      },
    })],
    ['disabled he', withPayload({
      ...createDefaultConfig(),
      shells: {
        ...createDefaultConfig().shells,
        he: {
          ...createDefaultConfig().shells.he,
          enabled: false,
        },
      },
    })],
    ['ammo below range', withPayload({
      ...createDefaultConfig(),
      shells: {
        ...createDefaultConfig().shells,
        mortar: {
          ...createDefaultConfig().shells.mortar,
          ammo: 0,
        },
      },
    })],
  ])('falls back to defaults for %s', (_label, payload) => {
    const storage = createMemoryStorage(
      payload === null ? {} : { [MATCH_CONFIG_STORAGE_KEY]: payload },
    );

    expect(loadLastConfig(storage)).toEqual(createDefaultConfig());
  });
});
