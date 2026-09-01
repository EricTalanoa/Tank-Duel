import { describe, expect, it } from 'vitest';
import { deckChipLayout } from './hud';
import { SHIPPED_WORLDS } from '../sim/worlds';
import { PRESENTATION } from './presentation';

/** The design viewport: iPad landscape, per `spec/presentation.json`. */
const IPAD = { width: 1194, height: 834 } as const;
const NARROWEST = { width: PRESENTATION.minimumLandscapeWidthPx, height: 700 } as const;

describe('deck HUD layout', () => {
  it('measures identically on every world — the deck is anchored to the screen', () => {
    // Break caught: the deck going back to a field-width layout, which made chips 2.6x
    // bigger on Ferrum than on Selene and overflowed the letterbox on the narrow worlds.
    const reference = JSON.stringify(deckChipLayout(IPAD, 6));
    for (const _world of SHIPPED_WORLDS) expect(JSON.stringify(deckChipLayout(IPAD, 6))).toBe(reference);
  });

  it('right-aligns six chips at the design size and clears the firing-solution panel', () => {
    const chips = deckChipLayout(IPAD, 6);
    expect(chips).toHaveLength(6);
    expect(chips.every((chip) => chip.width === 108 && chip.height === 82)).toBe(true);
    expect(chips[5]!.x + chips[5]!.width).toBe(IPAD.width - 32);
    // 32px margin + 340px firing solution + a 16px gutter.
    expect(chips[0]!.x).toBeGreaterThanOrEqual(32 + 340 + 16);
  });

  it.each([...SHIPPED_WORLDS.map((world) => world.id)])(
    'keeps every chip on screen and clear of the firing solution on %s',
    () => {
      for (const viewport of [IPAD, NARROWEST]) {
        const chips = deckChipLayout(viewport, 6);
        expect(chips.every((chip) => chip.x >= 32 + 340 + 16)).toBe(true);
        expect(chips.every((chip) => chip.x + chip.width <= viewport.width - 32)).toBe(true);
        expect(chips.every((chip) => chip.y + chip.height <= viewport.height - 32)).toBe(true);
      }
    },
  );
});
