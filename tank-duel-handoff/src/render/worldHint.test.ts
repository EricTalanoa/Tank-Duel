import { describe, expect, it } from 'vitest';
import rawWorlds from '../../spec/worlds.json';
import { SHIPPED_WORLDS } from '../sim/worlds';
import { worldStripText } from './hud';

describe('world strip', () => {
  it.each(SHIPPED_WORLDS)('builds $name\'s strip from its own spec entry', (world) => {
    // Break caught: gravity, width or kind being retyped into the HUD instead of read
    // from spec/worlds.json, or the strip losing the figures the player is choosing between.
    const source = rawWorlds.find((entry) => entry.id === world.id)!;
    const strip = worldStripText(world).replace(/ /g, '');

    expect(strip).toContain(source.name.toUpperCase());
    expect(strip).toContain(source.kind.toUpperCase().replace(/ /g, ''));
    expect(strip).toContain(`G${source.gravity.toFixed(2)}`);
    expect(strip).toContain(`${source.width}PX`);
  });
});
