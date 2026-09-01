import { CONSTANTS } from './constants';

export type PlayerIndex = 0 | 1;

export type PlayerLoadouts = readonly [readonly string[], readonly string[]];

export function makePlayerLoadouts(
  playerOne: readonly string[],
  playerTwo: readonly string[],
): PlayerLoadouts {
  if (playerOne[0] !== CONSTANTS.loadout.freeShell || playerTwo[0] !== CONSTANTS.loadout.freeShell) {
    throw new Error('Complete player loadouts require HE in slot one');
  }
  return Object.freeze([
    Object.freeze([...playerOne]),
    Object.freeze([...playerTwo]),
  ] as const);
}
