import { describe, expect, it } from 'vitest';
import { createWorld, fire, selectShell, step } from './world';
import { makePlayerLoadouts } from './playerLoadouts';
import { weaponById } from './weapons';

describe('Repair Kit', () => {
  it('heals without flight, caps health, consumes ammo, and ends the turn', () => {
    const state = createWorld(101, {
      playerLoadoutIds: makePlayerLoadouts(['he', 'repair'], ['he', 'repair']),
    });
    const hook = weaponById('repair').hooks.onUse!;
    state.tanks[0].health = hook.cap - 1;
    expect(selectShell(state, 2)).toBe(true);
    expect(fire(state)).toBe(true);
    expect(state.projectile).toBeNull();
    expect(state.projectiles).toEqual([]);
    expect(state.tanks[0].health).toBe(hook.cap);
    expect(state.arsenals[0].ammo.repair).toBe(0);
    expect(state.arsenals[0].selectedShellId).toBe('he');
    expect(state.phase).toBe('settle');
  });

  it('cannot be selected on consecutive owner turns', () => {
    const state = createWorld(102, {
      playerLoadoutIds: makePlayerLoadouts(['he', 'repair'], ['he', 'repair']),
    });
    state.arsenals[0].ammo.repair = 2;
    state.tanks[0].health = 1;
    expect(selectShell(state, 2)).toBe(true);
    expect(fire(state)).toBe(true);

    state.phase = 'handoff';
    step(state);
    state.phase = 'handoff';
    step(state);
    expect(state.activePlayer).toBe(0);
    expect(selectShell(state, 2)).toBe(false);
  });
});
