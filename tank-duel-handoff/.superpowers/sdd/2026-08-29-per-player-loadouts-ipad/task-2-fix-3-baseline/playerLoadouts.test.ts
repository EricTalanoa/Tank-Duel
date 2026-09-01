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
    expect(() => makePlayerLoadouts(['mortar'], ['he', 'roller'])).toThrow('HE in slot one');
    expect(() => makePlayerLoadouts(['he', 'mortar'], ['roller'])).toThrow('HE in slot one');
  });
});
