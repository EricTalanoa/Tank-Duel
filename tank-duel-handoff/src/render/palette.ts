/**
 * Render-layer colours from `docs/01-plan.md` §5.
 *
 * Placeholder scope: from Task 8 each world carries its own `palette` in `spec/worlds.json`
 * and the sky bands are read from there. Nothing here is a tuned physics value.
 */
import type { PlayerIndex } from '../sim/playerLoadouts';
import { worldById, type WorldId } from '../sim/worlds';
import { PRESENTATION } from './presentation';

export const PALETTE = {
  void: '#0E1219',
  skyTop: '#171E2B',
  skyUpper: '#2B3A52',
  skyMid: '#6A6E7C',
  horizonHaze: '#C9A87C',
  scrub: '#4A5540',
  dirt: '#5C4A36',
  bedrock: '#34291F',
  danger: '#FF6B35',
  telemetry: '#8FA0B8',
} as const;

export function playerColor(player: PlayerIndex): string {
  return PRESENTATION.players[player].color;
}

/** Returns a functional world accent from the validated world specification. */
export function functionalAccent(world: WorldId): string {
  return worldById(world).palette.accent;
}

/**
 * Terrain bands as RGB, matching the hex above. Depth from the surface picks the band, so
 * a crater exposes darker soil with no extra work.
 */
export const TERRAIN_BANDS = {
  scrub: [74, 85, 64],
  dirt: [92, 74, 54],
  bedrock: [52, 41, 31],
} as const;

/** Monospace with tabular figures: telemetry digits must not jitter as they change. */
export const TELEMETRY_FONT = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
