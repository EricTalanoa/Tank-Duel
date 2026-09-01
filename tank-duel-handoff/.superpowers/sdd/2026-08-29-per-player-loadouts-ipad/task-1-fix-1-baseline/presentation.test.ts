import { describe, expect, it } from 'vitest';
import { PRESENTATION, validatePresentation } from './presentation';

describe('presentation registry', () => {
  it('defines the landscape iPad presentation with two labelled, distinct players', () => {
    expect(PRESENTATION.targetDevice).toBe('iPad');
    expect(PRESENTATION.requiredOrientation).toBe('landscape');
    expect(PRESENTATION.minimumLandscapeWidthPx).toBe(900);
    expect(PRESENTATION.players).toEqual([
      { id: 0, label: 'Player 1', color: '#4DA3FF' },
      { id: 1, label: 'Player 2', color: '#FF5CA8' },
    ]);
    expect(new Set(PRESENTATION.players.map((player) => player.color)).size).toBe(2);
  });

  it.each([
    { targetDevice: 'desktop' },
    { requiredOrientation: 'portrait' },
    { minimumLandscapeWidthPx: 0 },
    { players: [{ id: 0, label: 'Player 1', color: '#4DA3FF' }] },
    { players: [{ id: 0, label: '', color: '#4DA3FF' }, { id: 1, label: 'Player 2', color: '#FF5CA8' }] },
    { players: [{ id: 0, label: 'Player 1', color: '#4DA3FF' }, { id: 2, label: 'Player 2', color: '#FF5CA8' }] },
    { players: [{ id: 0, label: 'Player 1', color: '#4DA3FF' }, { id: 1, label: 'Player 2', color: 'pink' }] },
  ])('rejects a malformed presentation registry: %j', (invalid) => {
    expect(() => validatePresentation({ ...PRESENTATION, ...invalid })).toThrow();
  });
});
