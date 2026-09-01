/**
 * Render-layer colours from `docs/01-plan.md` §5.
 *
 * Placeholder scope: from Task 8 each world carries its own `palette` in `spec/worlds.json`
 * and the sky bands are read from there. Nothing here is a tuned physics value.
 */
import type { PlayerIndex } from '../sim/playerLoadouts';
import { worldById, type WorldId, type WorldPhysics } from '../sim/worlds';
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

export type Rgb = readonly [number, number, number];

export interface TerrainBands {
  readonly scrub: Rgb;
  readonly dirt: Rgb;
  readonly bedrock: Rgb;
}

/**
 * Terrain bands as RGB, matching the hex above. Depth from the surface picks the band, so
 * a crater exposes darker soil with no extra work.
 *
 * These are Terra's colours and stay as the fallback for callers with no world in hand.
 * Everything that has one goes through `terrainBandsFor`.
 */
export const TERRAIN_BANDS: TerrainBands = {
  scrub: [74, 85, 64],
  dirt: [92, 74, 54],
  bedrock: [52, 41, 31],
};

/** How far bedrock sits below the world's own ground colour. */
export const BEDROCK_SHADE = 0.5;

/**
 * Terrain bands derived from a world's own palette, so Selene's grey and Ferrum's
 * near-black ground are the ground you dig through rather than Terra's brown everywhere.
 * Band depths and the grain do not move — only the three colours.
 */
export function terrainBandsFor(world: WorldPhysics): TerrainBands {
  const ground = parseHex(world.palette.ground);
  return {
    scrub: parseHex(world.palette.edge),
    dirt: ground,
    bedrock: [ground[0] * BEDROCK_SHADE, ground[1] * BEDROCK_SHADE, ground[2] * BEDROCK_SHADE],
  };
}

/**
 * The two families the UI uses, with fallbacks so a failed webfont load degrades rather
 * than breaks. JetBrains Mono is tabular by default, which is why the old TELEMETRY_FONT's
 * intent - digits must not jitter as they change - survives every number moving to it.
 */
const MONO_STACK = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const DISPLAY_STACK = 'Archivo, system-ui, sans-serif';

/** Every number, label and telemetry string. */
export function monoFont(sizePx: number, weight = 400): string {
  return `${weight} ${sizePx}px ${MONO_STACK}`;
}

/** Display and UI text. */
export function displayFont(sizePx: number, weight = 400): string {
  return `${weight} ${sizePx}px ${DISPLAY_STACK}`;
}

/** Monospace with tabular figures: telemetry digits must not jitter as they change. */
export const TELEMETRY_FONT = monoFont(12);

/**
 * Chrome tones shared by the HUD and the menus. Sand rather than white for every hairline:
 * it is what keeps a 1px rule legible on Ferrum's red sky and Selene's near-black one.
 *
 * One rule holds throughout: orange is never a surface. It appears as a 1px border, a 3px
 * bar, a fill inside a meter, a small square, or text - never as a panel background.
 */
export const CHROME = {
  paper: '#F6EADC',
  sand: '#C9A87C',
  muted: '#8FA0B8',
  dim: '#7F8B9C',
  action: '#FF8C42',
  actionText: '#FFC39D',
  panel: 'rgba(13,17,23,0.90)',
  chip: 'rgba(11,15,21,0.92)',
  chipSelected: 'rgba(31,23,17,0.95)',
  meterBed: 'rgba(8,11,16,0.9)',
  meterTick: 'rgba(8,11,16,0.8)',
  hairline: 'rgba(201,168,124,0.22)',
  hairlineStrong: 'rgba(201,168,124,0.3)',
  hairlineChip: 'rgba(201,168,124,0.24)',
  hairlineFaint: 'rgba(201,168,124,0.35)',
  scrim: '8,11,16',
} as const;

/** Parses `#rrggbb` into 0-255 components. Throws on anything else, so a typo fails loudly. */
export function parseHex(hex: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Expected a six-digit hex colour, got ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Multiplies a colour toward black. `factor` 0.62 is the shading step this design uses. */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * factor, g * factor, b * factor);
}

/** Lifts a colour toward white by `amount`, 0..1. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Shading and highlight steps for the tank silhouette, derived so a palette change carries. */
export const TANK_SHADE = 0.62;
export const TANK_TINT = 0.38;

export interface TankTones {
  readonly base: string;
  readonly dark: string;
  readonly light: string;
}

/** Three tones per player from the one colour `spec/presentation.json` declares. */
export function tankTones(player: PlayerIndex): TankTones {
  const base = playerColor(player);
  return { base, dark: shade(base, TANK_SHADE), light: tint(base, TANK_TINT) };
}
