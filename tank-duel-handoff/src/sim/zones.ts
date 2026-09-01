import type { Shell } from './shells';
import { wrappedDelta } from './wrap';

export interface FireZone {
  readonly x: number;
  readonly halfWidthPx: number;
  readonly damagePerRound: number;
  readonly accent: string;
  roundsRemaining: number;
}

interface ZoneTarget { readonly x: number; health: number }

export function createFireZone(x: number, shell: Shell): FireZone {
  const hook = shell.hooks?.onDetonate;
  if (!hook || hook.type !== 'scorch') throw new Error(`${shell.id} has no scorch hook`);
  return {
    x,
    halfWidthPx: hook.halfWidthPx,
    damagePerRound: hook.damagePerRound,
    accent: shell.accent,
    roundsRemaining: hook.rounds,
  };
}

export function applyRoundBoundaryZones(
  zones: FireZone[],
  targets: readonly ZoneTarget[],
  wrapWidth?: number,
): void {
  for (const zone of zones) {
    for (const target of targets) {
      const dx = wrapWidth === undefined
        ? target.x - zone.x
        : wrappedDelta(zone.x, target.x, wrapWidth);
      if (target.health > 0 && Math.abs(dx) <= zone.halfWidthPx) {
        target.health = Math.max(0, target.health - zone.damagePerRound);
      }
    }
    zone.roundsRemaining--;
  }
  for (let index = zones.length - 1; index >= 0; index--) {
    if (zones[index]!.roundsRemaining <= 0) zones.splice(index, 1);
  }
}
