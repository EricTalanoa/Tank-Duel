import { CONSTANTS } from './constants';
import { weaponById } from './weapons';

export type PlayerIndex = 0 | 1;

export type PlayerLoadouts = readonly [readonly string[], readonly string[]];

/**
 * Rejects a deck the arsenal builder would otherwise silently repair. `createLoadout` is
 * a toggle builder, so a duplicate id removes the shell rather than adding it twice —
 * `['he', 'mortar', 'mortar']` yields `['he']`. Failing here makes that data loss loud at
 * the boundary instead of invisible downstream.
 *
 * Errors name the player, because from here on the two decks differ and "which side" is
 * the first question a failure raises.
 */
function validateDeck(deck: readonly string[], player: PlayerIndex): void {
  const who = `Player ${player + 1}`;
  if (deck[0] !== CONSTANTS.loadout.freeShell) {
    throw new Error(`${who} loadout requires HE in slot one`);
  }
  const seen = new Set<string>();
  for (const id of deck) {
    if (seen.has(id)) {
      throw new Error(`${who} loadout requires unique shells, got duplicate ${id}`);
    }
    seen.add(id);
    weaponById(id); // throws on an id that is not a playable weapon
  }
}

export function makePlayerLoadouts(
  playerOne: readonly string[],
  playerTwo: readonly string[],
): PlayerLoadouts {
  validateDeck(playerOne, 0);
  validateDeck(playerTwo, 1);
  return Object.freeze([
    Object.freeze([...playerOne]),
    Object.freeze([...playerTwo]),
  ] as const);
}
