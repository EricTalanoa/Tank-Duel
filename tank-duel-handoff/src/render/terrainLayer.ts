/**
 * Terrain painted once into an offscreen canvas, then repainted a few columns at a time.
 *
 * A full repaint is width × height pixel writes every carve; the dirty-column repaint is
 * the crater's width plus two. That difference is the whole reason this layer exists.
 *
 * `paintColumns` is a plain function over an RGBA byte array with no Canvas in sight, so
 * the repaint bounds are testable headlessly.
 */
import type { DirtyRange, DirtyRanges, Terrain } from '../sim/terrain';
import { TERRAIN_BANDS } from './palette';

/** Depth-from-surface bands, transcribed from `reference/prototype.html` → `paintColumns`. */
const BANDS = {
  /** Scrub occupies the top few pixels of any surface. */
  scrubDepth: 5,
  /** Dirt runs to here, then fades toward bedrock. */
  dirtDepth: 34,
  /** Depth over which dirt reaches full bedrock. */
  bedrockFade: 260,
  /** Peak-to-peak per-pixel grain, so the bands do not read as flat paint. */
  grain: 16,
} as const;

/** Deterministic per-pixel grain. Stable across repaints, so a recarved column looks identical. */
function hashNoise(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) >>> 0;
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
  return ((n >>> 16) & 255) / 255;
}

/**
 * Paints columns `[x0, x1)` of `terrain` into `pixels` (RGBA, width × height × 4).
 *
 * Empty pixels get alpha 0 and keep whatever RGB they had — `putImageData` replaces rather
 * than composites, so those bytes can never reach the screen and writing them is wasted
 * work. Compare rendered output, not raw bytes, when asserting on this buffer.
 */
export function paintColumns(
  pixels: Uint8ClampedArray,
  terrain: Terrain,
  x0: number,
  x1: number,
): void {
  const { mask, width, height } = terrain;
  const from = Math.max(0, x0 | 0);
  const to = Math.min(width, x1 | 0);
  const { scrub, dirt, bedrock } = TERRAIN_BANDS;

  for (let x = from; x < to; x++) {
    let depth = 0;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      if (mask[y * width + x] !== 1) {
        depth = 0;
        pixels[i + 3] = 0;
        continue;
      }

      depth++;
      let r: number;
      let g: number;
      let b: number;
      if (depth <= BANDS.scrubDepth) {
        [r, g, b] = scrub;
      } else if (depth <= BANDS.dirtDepth) {
        [r, g, b] = dirt;
      } else {
        const k = Math.min(1, (depth - BANDS.dirtDepth) / BANDS.bedrockFade);
        r = dirt[0] + (bedrock[0] - dirt[0]) * k;
        g = dirt[1] + (bedrock[1] - dirt[1]) * k;
        b = dirt[2] + (bedrock[2] - dirt[2]) * k;
      }

      const n = (hashNoise(x, y) - 0.5) * BANDS.grain;
      pixels[i] = r + n;
      pixels[i + 1] = g + n;
      pixels[i + 2] = b + n;
      pixels[i + 3] = 255;
    }
  }
}

/** Paint each dirty interval independently, preserving split seam edits. */
export function paintRanges(
  pixels: Uint8ClampedArray,
  terrain: Terrain,
  ranges: DirtyRanges,
): void {
  for (const range of ranges) paintColumns(pixels, terrain, range.x0, range.x1);
}

export interface TerrainLayer {
  /** Draw this onto the field. */
  readonly canvas: HTMLCanvasElement;
  /** Repaint one dirty column range after a carve or fill. */
  repaint(range: DirtyRange): void;
  /** Repaint each split dirty range after a wrapped carve or fill. */
  repaintRanges(ranges: DirtyRanges): void;
  /** Repaint everything — on generation, or when the terrain is replaced. */
  repaintAll(): void;
}

export function createTerrainLayer(terrain: Terrain): TerrainLayer {
  const canvas = document.createElement('canvas');
  canvas.width = terrain.width;
  canvas.height = terrain.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Offscreen 2D context unavailable');
  const image = ctx.createImageData(terrain.width, terrain.height);

  function flush(x0: number, x1: number): void {
    if (x1 <= x0) return;
    paintColumns(image.data, terrain, x0, x1);
    // Only the dirty rect is uploaded, not the whole image.
    ctx!.putImageData(image, 0, 0, x0, 0, x1 - x0, terrain.height);
  }

  const layer: TerrainLayer = {
    canvas,
    repaint: (range) => flush(range.x0, range.x1),
    repaintRanges: (ranges) => {
      for (const range of ranges) flush(range.x0, range.x1);
    },
    repaintAll: () => flush(0, terrain.width),
  };

  layer.repaintAll();
  return layer;
}
