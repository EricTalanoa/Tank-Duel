import { describe, expect, it } from 'vitest';
import { deckChipLayout } from './hud';
import { SHIPPED_WORLDS } from '../sim/worlds';

describe('deck HUD layout', () => {
  it.each(SHIPPED_WORLDS)('keeps all six chips inside $name field width', (world) => {
    const chips = deckChipLayout(world.width, 6);
    expect(chips).toHaveLength(6);
    expect(chips.every((chip) => chip.x >= 0 && chip.x + chip.width <= world.width)).toBe(true);
  });
});
