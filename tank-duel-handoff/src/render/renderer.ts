/**
 * Reads state, draws it, owns nothing.
 *
 * The field is a fixed pixel space (`state.field`) letterboxed into whatever size the
 * canvas element happens to be. Resizing the window changes only this transform — never
 * the simulation — which is the invariant Task 9 has to preserve for the camera.
 */
import type { Terrain, DirtyRanges } from '../sim/terrain';
import type { GameState } from '../sim/world';
import { drawHud, type HudChrome, type LoopTelemetry } from './hud';
import { CHROME, monoFont, shade, terrainBandsFor } from './palette';
import { createTerrainLayer } from './terrainLayer';
import { drawFlightEntities, drawWorldEntities } from './entities';
import type { EffectsEngine } from './effects';
import { PLAYABLE_WEAPONS } from '../sim/weapons';
import { cameraForState, type CameraView } from './camera';
import { TERRA, type WorldPhysics } from '../sim/worlds';
import { worldCopyOffsets } from './worldCopies';
import { CONSTANTS } from '../sim/constants';
import { EFFECTS } from './effectConfig';

export interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

export interface Renderer {
  draw(state: GameState, telemetry: LoopTelemetry): void;
  /** Repaint the dirty columns after carve, fill, or collapse changes. */
  terrainChanged(ranges: DirtyRanges): void;
  /** Viewport coordinates to field pixels. Null outside the letterboxed field. */
  screenToField(clientX: number, clientY: number): FieldPoint | null;
}

export interface ScreenTransform {
  readonly canvasLeft: number;
  readonly canvasTop: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly view: CameraView;
}

export function screenPointToWorld(clientX: number, clientY: number, transform: ScreenTransform): FieldPoint | null {
  const localX = (clientX - transform.canvasLeft - transform.offsetX) / transform.scale;
  const localY = (clientY - transform.canvasTop - transform.offsetY) / transform.scale;
  if (localX < 0 || localY < 0 || localX >= transform.view.width || localY >= transform.view.height) return null;
  return { x: localX + transform.view.x, y: localY + transform.view.y };
}

export interface SceneDrawers {
  drawTerrain(offsetX: number): void;
  drawPersistent(offsetX: number): void;
  drawFlight(): void;
}

/** Dispatch exact terrain tiles, overflow-aware persistent tiles, and flight exactly once. */
export function drawSceneCopies(
  view: CameraView,
  worldWidth: number,
  wrap: boolean,
  persistentOverflowPx: number,
  drawers: SceneDrawers,
): void {
  const terrainOffsets = wrap ? worldCopyOffsets(view, worldWidth) : [0];
  const persistentOffsets = wrap
    ? worldCopyOffsets(view, worldWidth, persistentOverflowPx)
    : [0];
  for (const offset of terrainOffsets) drawers.drawTerrain(offset);
  for (const offset of persistentOffsets) drawers.drawPersistent(offset);
  drawers.drawFlight();
}

/** Maximum horizontal reach of canonical visuals, derived from state and spec-backed config. */
function persistentOverflowPx(state: GameState, effects?: EffectsEngine): number {
  const zoneReach = state.fireZones.reduce(
    (largest, zone) => Math.max(largest, zone.halfWidthPx),
    0,
  );
  const tankReach = Math.max(CONSTANTS.tank.hullHalfWidth, CONSTANTS.tank.muzzleOffset);
  const particleReach = effects
    ? EFFECTS.particles.speedMax * EFFECTS.particles.lifetimeFramesMax
      + Math.max(EFFECTS.particles.sparkSize, EFFECTS.particles.debrisSize)
    : 0;
  const flashReach = effects
    ? CONSTANTS.tank.muzzleOffset + EFFECTS.muzzleFlash.radiusPx
    : 0;
  return Math.max(zoneReach, tankReach, particleReach, flashReach)
    + EFFECTS.shake.amplitudePx;
}

/** How far the world's own sky is darkened to make the letterbox read as a bezel. */
const SURROUND_SHADE = 0.55;
/** Keeps the crop caption clear of the canvas edge when the frame reaches it. */
const CAPTION_INSET = 10;

export function createRenderer(
  canvas: HTMLCanvasElement,
  terrain: Terrain,
  effects?: EffectsEngine,
  world: WorldPhysics = TERRA,
  chrome: HudChrome = {},
): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const terrainLayer = createTerrainLayer(terrain, terrainBandsFor(world));
  // Derived from the world's own sky, so the dead bars are right on all six worlds.
  const surround = shade(world.palette.sky[0] ?? TERRA.palette.sky[0]!, SURROUND_SHADE);
  const icons = new Map<string, HTMLImageElement>();
  for (const { shell } of PLAYABLE_WEAPONS) {
    const image = new Image();
    image.src = `/${shell.icon}`;
    icons.set(shell.icon, image);
  }

  // Last letterbox transform, shared with screenToField so input and pixels agree.
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let view: CameraView = { x: 0, y: 0, width: terrain.width, height: terrain.height };

  /** Sizes the backing store to the element's CSS box at device pixel ratio. */
  function resizeToDisplay(): { width: number; height: number; dpr: number } {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    return { width, height, dpr };
  }

  /**
   * When the view does not fill the canvas, frame the play area and print the crop. It
   * turns the dead bars into an instrument bezel and makes the camera legible.
   */
  function drawLetterboxFrame(width: number, height: number): void {
    const frameWidth = view.width * scale;
    const frameHeight = view.height * scale;
    if (frameWidth >= width - 1 && frameHeight >= height - 1) return;

    ctx!.strokeStyle = CHROME.hairline;
    ctx!.lineWidth = 1;
    ctx!.strokeRect(offsetX + 0.5, offsetY + 0.5, frameWidth - 1, frameHeight - 1);

    ctx!.font = monoFont(9);
    ctx!.fillStyle = 'rgba(201,168,124,0.5)';
    ctx!.textAlign = 'right';
    ctx!.textBaseline = 'top';
    // A horizontal letterbox leaves no room below the frame, so the caption moves inside.
    const below = offsetY + frameHeight + 8;
    const outside = below + 10 <= height;
    ctx!.fillText(
      `VIEW ${Math.round(view.width)} × ${Math.round(view.height)}  ·  ${scale.toFixed(2)}×`,
      offsetX + frameWidth - CAPTION_INSET,
      outside ? below : offsetY + frameHeight - 20,
    );
    ctx!.textAlign = 'left';
  }

  /** The world's own four sky stops, at the stop positions this scene has always used. */
  function drawSky(field: GameState['field'], cameraView: CameraView, stops: readonly string[]): void {
    const sky = ctx!.createLinearGradient(0, 0, 0, field.height);
    const positions = [0, 0.45, 0.82, 1];
    positions.forEach((position, index) => {
      const color = stops[index] ?? stops[stops.length - 1];
      if (color) sky.addColorStop(position, color);
    });
    ctx!.fillStyle = sky;
    ctx!.fillRect(cameraView.x, 0, cameraView.width, field.height);
  }

  return {
    draw(state, telemetry) {
      const { width, height, dpr } = resizeToDisplay();
      const { field } = state;
      view = cameraForState(state, { width, height });

      // Letterbox the current camera view, centred and uncropped.
      scale = Math.min(width / view.width, height / view.height);
      offsetX = (width - view.width * scale) / 2;
      offsetY = (height - view.height * scale) / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = surround;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.rect(0, 0, view.width, view.height);
      ctx.clip();

      ctx.translate(-view.x, -view.y);
      drawSky(field, view, state.world.palette.sky);
      ctx.save();
      const shake = effects?.shakeOffset ?? { x: 0, y: 0 };
      ctx.translate(shake.x, shake.y);
      drawSceneCopies(view, field.width, state.world.wrap, persistentOverflowPx(state, effects), {
        drawTerrain(offset) {
          ctx.save();
          ctx.translate(offset, 0);
          ctx.drawImage(terrainLayer.canvas, 0, 0);
          ctx.restore();
        },
        drawPersistent(offset) {
          ctx.save();
          ctx.translate(offset, 0);
          drawWorldEntities(ctx, state);
          effects?.draw(ctx);
          ctx.restore();
        },
        drawFlight() {
          drawFlightEntities(ctx, state);
        },
      });
      ctx.restore();
      ctx.restore();

      drawLetterboxFrame(width, height);
      // Outside the camera transform: the HUD is viewport-sized on every world.
      drawHud(ctx, state, telemetry, icons, { width, height }, chrome);
    },

    terrainChanged(ranges) {
      terrainLayer.repaintRanges(ranges);
    },

    screenToField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return screenPointToWorld(clientX, clientY, {
        canvasLeft: rect.left,
        canvasTop: rect.top,
        offsetX,
        offsetY,
        scale,
        view,
      });
    },
  };
}
