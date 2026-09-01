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

  it('accepts five optional shells at exactly the point budget', () => {
    const loadout = createLoadout();
    for (const id of ['mortar', 'cluster', 'buster', 'roller', 'sand']) {
      toggleShell(loadout, id);
    }
    expect(equippedWeapons(loadout)[0]?.shell.id).toBe(CONSTANTS.loadout.freeShell);
    expect(validateLoadout(loadout)).toEqual({
      valid: true,
      pointsUsed: CONSTANTS.loadout.points,
      optionalSlotsUsed: CONSTANTS.loadout.slots,
    });
  });

  it('rejects additions beyond the slot or point budget without changing the deck', () => {
    const slotLimited = createLoadout(['mortar', 'cluster', 'buster', 'roller', 'sand']);
    expect(() => toggleShell(slotLimited, 'skipper')).toThrow('optional slot limit');
    expect(validateLoadout(slotLimited).optionalSlotsUsed).toBe(CONSTANTS.loadout.slots);

    const pointLimited = createLoadout(['mirv', 'airburst', 'napalm']);
    expect(() => toggleShell(pointLimited, 'mortar')).toThrow('point limit');
    expect(validateLoadout(pointLimited).pointsUsed).toBe(CONSTANTS.loadout.points);
  });

  it.each(['anvil', 'unknown'])('rejects non-playable shell %s', (id) => {
    expect(() => createLoadout([id])).toThrow(`Unknown playable weapon: ${id}`);
  });
});
