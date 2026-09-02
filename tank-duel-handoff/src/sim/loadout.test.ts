import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import {
  createLoadout,
  equippedWeapons,
  toggleShell,
  validateLoadout,
} from './loadout';

describe('loadout', () => {
  it('locks the free shell in deck position 1', () => {
    const loadout = createLoadout();
    toggleShell(loadout, CONSTANTS.loadout.freeShell);
    expect(equippedWeapons(loadout)[0]?.shell.id).toBe(CONSTANTS.loadout.freeShell);
  });

  it('accepts any six optional shells, whatever they would once have cost', () => {
    const loadout = createLoadout();
    // The six priciest playable shells: 3+4+3+3+2+2 = 17 under the retired 10-point
    // budget, and a legal deck now that slots are the only limit.
    for (const id of ['mortar', 'mirv', 'airburst', 'napalm', 'drill', 'repair']) {
      toggleShell(loadout, id);
    }
    expect(equippedWeapons(loadout)[0]?.shell.id).toBe(CONSTANTS.loadout.freeShell);
    expect(validateLoadout(loadout)).toEqual({
      valid: true,
      optionalSlotsUsed: CONSTANTS.loadout.slots,
    });
    // Seven in the deck: the free shell plus the six that were picked.
    expect(loadout.ids).toHaveLength(CONSTANTS.loadout.slots + 1);
  });

  it('rejects a seventh optional shell without changing the deck', () => {
    const full = createLoadout(['mortar', 'cluster', 'buster', 'roller', 'sand', 'skipper']);
    expect(() => toggleShell(full, 'mirv')).toThrow('optional slot limit');
    expect(validateLoadout(full).optionalSlotsUsed).toBe(CONSTANTS.loadout.slots);
    expect(full.ids).not.toContain('mirv');
  });

  it.each(['anvil', 'unknown'])('rejects non-playable shell %s', (id) => {
    expect(() => createLoadout([id])).toThrow(`Unknown playable weapon: ${id}`);
  });
});
