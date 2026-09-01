import { CONSTANTS } from './constants';
import { wrappedDelta } from './wrap';

export function blastDamage(baseDamage: number, blastRadius: number, distance: number): number {
  const edge = blastRadius + CONSTANTS.damage.edgePadding;
  if (distance > edge) return 0;
  const fraction = Math.max(
    CONSTANTS.damage.minFractionAtEdge,
    1 - distance / edge,
  );
  return baseDamage * fraction;
}

export function fallDamage(dropPx: number): number {
  const excess = dropPx - CONSTANTS.damage.fallDamageThresholdPx;
  return excess > 0 ? excess * CONSTANTS.damage.fallDamagePerPx : 0;
}

export interface DamageTarget {
  readonly x: number;
  readonly y: number;
  health: number;
}

export function applyBlastDamage(
  targets: readonly DamageTarget[],
  x: number,
  y: number,
  baseDamage: number,
  blastRadius: number,
  wrapWidth?: number,
): void {
  for (const target of targets) {
    if (target.health <= 0) continue;
    const dx = wrapWidth === undefined
      ? target.x - x
      : wrappedDelta(x, target.x, wrapWidth);
    const distance = Math.hypot(
      dx,
      target.y + CONSTANTS.tank.damageOriginY - y,
    );
    const amount = blastDamage(baseDamage, blastRadius, distance);
    if (amount > 0) target.health = Math.max(0, target.health - Math.round(amount));
  }
}
