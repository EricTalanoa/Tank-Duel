import { CONSTANTS } from './constants';
import { PLAYABLE_WEAPONS, weaponById, type Weapon } from './weapons';

export interface Loadout {
  readonly ids: string[];
}

export interface LoadoutValidation {
  readonly valid: boolean;
  readonly optionalSlotsUsed: number;
}

/**
 * Slots are the only budget. Shells still carry a `cost` in `spec/shells.json` — it is a
 * record of how the twelve were balanced against each other, not a currency the player
 * spends, so any six of them make a legal deck.
 */
export function validateLoadout(loadout: Loadout): LoadoutValidation {
  const optional = loadout.ids.filter((id) => id !== CONSTANTS.loadout.freeShell);
  return {
    valid: loadout.ids[0] === CONSTANTS.loadout.freeShell &&
      new Set(loadout.ids).size === loadout.ids.length &&
      optional.length <= CONSTANTS.loadout.slots,
    optionalSlotsUsed: optional.length,
  };
}

export function createLoadout(ids: readonly string[] = []): Loadout {
  const loadout: Loadout = { ids: [CONSTANTS.loadout.freeShell] };
  for (const id of ids) toggleShell(loadout, id);
  return loadout;
}

export function toggleShell(loadout: Loadout, id: string): void {
  const weapon = weaponById(id);
  if (id === CONSTANTS.loadout.freeShell) return;

  const index = loadout.ids.indexOf(id);
  if (index >= 0) {
    loadout.ids.splice(index, 1);
    return;
  }

  const candidate: Loadout = { ids: [...loadout.ids, weapon.shell.id] };
  if (validateLoadout(candidate).optionalSlotsUsed > CONSTANTS.loadout.slots) {
    throw new Error(`Loadout optional slot limit is ${CONSTANTS.loadout.slots}`);
  }
  loadout.ids.push(weapon.shell.id);
}

export function equippedWeapons(loadout: Loadout): readonly Weapon[] {
  return loadout.ids.map(weaponById);
}

export const DEFAULT_LOADOUT: Loadout = Object.freeze({
  ids: Object.freeze([CONSTANTS.loadout.freeShell]),
}) as Loadout;

export const LOADOUT_CHOICES: readonly Weapon[] = PLAYABLE_WEAPONS.filter(
  (weapon) => weapon.shell.id !== CONSTANTS.loadout.freeShell,
);
