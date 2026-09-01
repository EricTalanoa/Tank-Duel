import { describe, expect, it } from 'vitest';
import { CONSTANTS } from './constants';
import { applyBlastDamage, blastDamage, fallDamage } from './damage';
import { HE_SHELL } from './shells';
import { createWorld } from './world';

describe('damage', () => {
  it('deals exactly the minimum fraction at the padded blast edge', () => {
    const edge = HE_SHELL.blastRadius + CONSTANTS.damage.edgePadding;
    expect(blastDamage(HE_SHELL.damage, HE_SHELL.blastRadius, edge)).toBe(
      HE_SHELL.damage * CONSTANTS.damage.minFractionAtEdge,
    );
  });

  it('deals full damage at the center and nothing beyond the edge', () => {
    const edge = HE_SHELL.blastRadius + CONSTANTS.damage.edgePadding;
    expect(blastDamage(HE_SHELL.damage, HE_SHELL.blastRadius, 0)).toBe(HE_SHELL.damage);
    expect(blastDamage(HE_SHELL.damage, HE_SHELL.blastRadius, edge + 1)).toBe(0);
  });

  it('deals no damage for a 40 px fall', () => {
    expect(fallDamage(CONSTANTS.damage.fallDamageThresholdPx)).toBe(0);
  });

  it('deals 0.5 damage for a 41 px fall', () => {
    expect(fallDamage(CONSTANTS.damage.fallDamageThresholdPx + 1)).toBe(0.5);
  });

  it('applies full self-damage with no owner exemption', () => {
    const state = createWorld(29);
    const shooter = state.tanks[0];
    applyBlastDamage(
      state.tanks,
      shooter.x,
      shooter.y + CONSTANTS.tank.damageOriginY,
      HE_SHELL.damage,
      HE_SHELL.blastRadius,
    );
    expect(shooter.health).toBe(CONSTANTS.damage.startingHealth - HE_SHELL.damage);
  });

  it('uses shortest wrapped horizontal distance only when a world width is supplied', () => {
    const width = createWorld(30, { worldId: 'hollow' }).field.width;
    const wrapped = [{ x: width - 3, y: 100, health: CONSTANTS.damage.startingHealth }];
    const bounded = [{ x: width - 3, y: 100, health: CONSTANTS.damage.startingHealth }];
    const impactY = 100 + CONSTANTS.tank.damageOriginY;

    applyBlastDamage(wrapped, 2, impactY, HE_SHELL.damage, HE_SHELL.blastRadius, width);
    applyBlastDamage(bounded, 2, impactY, HE_SHELL.damage, HE_SHELL.blastRadius);

    expect(wrapped[0]?.health).toBeLessThan(CONSTANTS.damage.startingHealth);
    expect(bounded[0]?.health).toBe(CONSTANTS.damage.startingHealth);
  });
});
