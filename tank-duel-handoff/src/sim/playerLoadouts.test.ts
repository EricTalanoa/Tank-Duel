import { describe, expect, it } from 'vitest';
import { makePlayerLoadouts } from './playerLoadouts';

describe('player loadouts', () => {
  it('returns a frozen two-player tuple with frozen copied decks', () => {
    const playerOne = ['he', 'mortar'];
    const playerTwo = ['he', 'roller'];

    const loadouts = makePlayerLoadouts(playerOne, playerTwo);
    playerOne.push('cluster');
    playerTwo[1] = 'buster';

    expect(loadouts).toEqual([
      ['he', 'mortar'],
      ['he', 'roller'],
    ]);
    expect(Object.isFrozen(loadouts)).toBe(true);
    expect(Object.isFrozen(loadouts[0])).toBe(true);
    expect(Object.isFrozen(loadouts[1])).toBe(true);
    expect(() => (loadouts[0] as string[]).push('cluster')).toThrow();
  });

  it('requires HE in stable slot one for each complete deck', () => {
    expect(() => makePlayerLoadouts(['mortar'], ['he', 'roller']))
      .toThrow('Player 1 loadout requires HE in slot one');
    expect(() => makePlayerLoadouts(['he', 'mortar'], ['roller']))
      .toThrow('Player 2 loadout requires HE in slot one');
  });

  it('rejects a duplicate id, naming the offender and the player', () => {
    expect(() => makePlayerLoadouts(['he', 'mortar', 'mortar'], ['he', 'roller']))
      .toThrow('Player 1 loadout requires unique shells, got duplicate mortar');
  });

  it('rejects a duplicate in player two’s deck just as in player one’s', () => {
    expect(() => makePlayerLoadouts(['he', 'roller'], ['he', 'mortar', 'mortar']))
      .toThrow('Player 2 loadout requires unique shells, got duplicate mortar');
  });

  it('rejects an id that is not a playable weapon', () => {
    // 'anvil' is a real shell in spec/shells.json that weapons.ts filters out of
    // PLAYABLE_WEAPONS, so it is the honest "exists but is not playable" case.
    expect(() => makePlayerLoadouts(['he', 'anvil'], ['he', 'roller'])).toThrow('anvil');
    expect(() => makePlayerLoadouts(['he', 'roller'], ['he', 'anvil'])).toThrow('anvil');
    expect(() => makePlayerLoadouts(['he', 'nonexistent'], ['he', 'roller']))
      .toThrow('nonexistent');
  });

  it('rejects the duplicated free shell that shipped as a defect earlier in this task', () => {
    // Regression pin: the match runtime prepended 'he' to a deck that already began with
    // 'he'. It was harmless only because toggleShell early-returns on the free shell; the
    // same shape on any other shell is silent data loss through createLoadout's toggle.
    expect(() => makePlayerLoadouts(['he', 'he', 'mortar'], ['he', 'he', 'mortar']))
      .toThrow('duplicate he');
  });
});
