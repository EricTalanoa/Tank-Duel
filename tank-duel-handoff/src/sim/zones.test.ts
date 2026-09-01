import { describe, expect, it } from 'vitest';
import { createWorld, step } from './world';
import { applyRoundBoundaryZones, createFireZone } from './zones';
import { weaponById } from './weapons';
import { CONSTANTS } from './constants';

describe('Napalm fire zones', () => {
  it('uses imported scorch values and ticks only on a full-round handoff', () => {
    const shell = weaponById('napalm').shell;
    const hook = shell.hooks?.onDetonate;
    if (!hook || hook.type !== 'scorch') throw new Error('Napalm scorch hook missing');
    const state = createWorld(91);
    state.fireZones.push(createFireZone(state.tanks[0].x, shell));
    expect(state.fireZones[0]).toMatchObject({
      x: state.tanks[0].x,
      halfWidthPx: hook.halfWidthPx,
      damagePerRound: hook.damagePerRound,
      roundsRemaining: hook.rounds,
    });

    state.phase = 'handoff';
    step(state);
    expect(state.activePlayer).toBe(1);
    expect(state.tanks[0].health).toBe(100);
    expect(state.fireZones[0]?.roundsRemaining).toBe(hook.rounds);

    state.phase = 'handoff';
    step(state);
    expect(state.activePlayer).toBe(0);
    expect(state.tanks[0].health).toBe(100 - hook.damagePerRound);
    expect(state.fireZones[0]?.roundsRemaining).toBe(hook.rounds - 1);

    for (let round = 1; round < hook.rounds; round++) {
      state.activePlayer = 1;
      state.phase = 'handoff';
      step(state);
    }
    expect(state.fireZones).toEqual([]);
  });

  it('damages across the seam only when a wrapping width is supplied', () => {
    const shell = weaponById('napalm').shell;
    const width = createWorld(92, { worldId: 'hollow' }).field.width;
    const wrappedTarget = { x: width - 2, health: CONSTANTS.damage.startingHealth };
    const boundedTarget = { x: width - 2, health: CONSTANTS.damage.startingHealth };

    applyRoundBoundaryZones([createFireZone(2, shell)], [wrappedTarget], width);
    applyRoundBoundaryZones([createFireZone(2, shell)], [boundedTarget]);

    expect(wrappedTarget.health).toBeLessThan(CONSTANTS.damage.startingHealth);
    expect(boundedTarget.health).toBe(CONSTANTS.damage.startingHealth);
  });
});
