import { describe, expect, it } from 'vitest';
import rawWorlds from '../../spec/worlds.json';
import { createWorld } from '../sim/world';
import { worldRangeHint } from './hud';

describe('first-round world hint', () => {
  it.each(['terra', 'vesper', 'ferrum'] as const)('shows %s own imported range only in round one', (worldId) => {
    const source = rawWorlds.find((world) => world.id === worldId)!;
    const state = createWorld(8, { worldId });
    expect(worldRangeHint(state)).toContain(source.name);
    expect(worldRangeHint(state)).toContain(String(source.derived.rangeAtPower75));
    state.turn++;
    expect(worldRangeHint(state)).toBeNull();
  });
});
