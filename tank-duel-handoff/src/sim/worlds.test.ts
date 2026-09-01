import { describe, expect, it } from 'vitest';
import rawWorlds from '../../spec/worlds.json';
import { CONSTANTS } from './constants';
import { HOLLOW, resolveWorldId, SHIPPED_WORLDS, worldById } from './worlds';

describe('shipped world profiles', () => {
  it('ships all six world profiles with values loaded from spec', () => {
    expect(SHIPPED_WORLDS.map((world) => world.id)).toEqual(['terra', 'vesper', 'rust', 'selene', 'ferrum', 'hollow']);
    for (const world of SHIPPED_WORLDS) {
      const source = rawWorlds.find((candidate) => candidate.id === world.id)!;
      expect(world).toMatchObject({
        gravity: source.gravity,
        airDrag: source.airDrag,
        width: source.width,
        windRange: source.windRange,
        windMode: source.windMode,
        flightTimeScale: source.flightTimeScale,
        wrap: source.wrap,
        generator: source.generator,
        kind: source.kind,
        palette: source.palette,
        derived: source.derived,
        baseGravity: CONSTANTS.baseGravity,
        windCoefficient: CONSTANTS.windCoefficient,
      });
    }
  });

  it.each(['unknown'])('rejects unshipped world %s', (id) => {
    expect(() => worldById(id)).toThrow(`Unknown shipped world: ${id}`);
  });

  it('resolves shipped URL values and falls back to Terra', () => {
    expect(resolveWorldId('vesper')).toBe('vesper');
    expect(resolveWorldId('ferrum')).toBe('ferrum');
    expect(resolveWorldId('rust')).toBe('rust');
    expect(resolveWorldId('selene')).toBe('selene');
    expect(resolveWorldId('hollow')).toBe('hollow');
    expect(resolveWorldId(null)).toBe('terra');
  });

  it('exports Hollow with its seamless Ring profile', () => {
    const hollowSpec = rawWorlds.find((world) => world.id === 'hollow');
    if (!hollowSpec) throw new Error('Missing hollow profile in spec/worlds.json');
    expect(HOLLOW).toBe(worldById('hollow'));
    expect(HOLLOW).toMatchObject({
      wrap: hollowSpec.wrap,
      generator: hollowSpec.generator,
      width: hollowSpec.width,
    });
  });
});
