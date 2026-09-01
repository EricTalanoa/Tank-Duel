import { CONSTANTS } from './constants';
import type { Tank } from './world';
import { nearestWrappedX } from './wrap';

export type PresentationEvent =
  | { readonly type: 'muzzleFlash'; readonly x: number; readonly y: number; readonly shellId: string; readonly accent: string; readonly player: 0 | 1 }
  | { readonly type: 'impact'; readonly x: number; readonly y: number; readonly shellId: string; readonly accent: string; readonly blastRadius: number }
  | { readonly type: 'directHit'; readonly x: number; readonly y: number; readonly shellId: string; readonly player: 0 | 1 };

export function pointInHull(tank: Tank, x: number, y: number, wrapWidth?: number): boolean {
  const tankX = wrapWidth === undefined ? tank.x : nearestWrappedX(tank.x, x, wrapWidth);
  return x >= tankX - CONSTANTS.tank.hullHalfWidth &&
    x < tankX + CONSTANTS.tank.hullHalfWidth &&
    y >= tank.y + CONSTANTS.tank.hullTop &&
    y < tank.y + CONSTANTS.tank.hullBottom;
}

export function drainPresentationEvents(queue: PresentationEvent[]): PresentationEvent[] {
  return queue.splice(0, queue.length);
}
