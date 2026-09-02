import { CONSTANTS } from '../sim/constants';
import type { GameState, Tank } from '../sim/world';
import { playerColor, tankTones, tonesFrom } from './palette';
import type { PlayerIndex } from '../sim/playerLoadouts';
import { surfaceY } from '../sim/terrain';
import { wrapX } from '../sim/wrap';

/** Neutral running gear: the tracks read as machinery, not as the player's colour. */
const TANK_RUNNING_GEAR = '#161C25';
const TANK_RAIL_BED = '#0A0E14';
const TANK_RAIL_TICK = 'rgba(14,18,25,0.85)';
const TANK_RAIL_HEIGHT = 3.5;
const ACTION_ACCENT = '#FF8C42';

export function drawEntities(ctx: CanvasRenderingContext2D, state: GameState): void {
  drawWorldEntities(ctx, state);
  drawFlightEntities(ctx, state);
}

/** Draw canonical world-owned entities. The renderer supplies the world-copy offset. */
export function drawWorldEntities(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  drawFireZones(ctx, state);
  for (const tank of state.tanks) drawTank(ctx, state, tank);
  ctx.restore();
}

/** Draw unbounded flight data exactly once, without a canonical tile offset. */
export function drawFlightEntities(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  for (const tank of state.tanks) drawTrails(ctx, tank);
  for (const projectile of state.projectiles) {
    ctx.fillStyle = playerColor(projectile.owner);
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFireZones(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const zone of state.fireZones) {
    ctx.fillStyle = zone.accent;
    for (let x = zone.x - zone.halfWidthPx; x <= zone.x + zone.halfWidthPx; x += 8) {
      const terrainX = state.world.wrap ? wrapX(x, state.terrain.width) : x;
      const y = surfaceY(state.terrain, terrainX);
      const height = 5 + Math.abs(Math.sin((x + state.frame) * 0.18)) * 7;
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x, y - height);
      ctx.lineTo(x + 3, y);
      ctx.fill();
    }
  }
}

function drawTrails(ctx: CanvasRenderingContext2D, tank: Tank): void {
  for (let index = 0; index < tank.trails.length; index++) {
    const trail = tank.trails[index];
    if (!trail || trail.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(trail[0]!.x, trail[0]!.y);
    for (let point = 1; point < trail.length; point++) ctx.lineTo(trail[point]!.x, trail[point]!.y);
    ctx.globalAlpha = 0.25 + ((index + 1) / tank.trails.length) * 0.35;
    ctx.strokeStyle = playerColor(tank.player);
    ctx.fillStyle = playerColor(tank.player);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 7]);
    ctx.stroke();

    // Mark where the shot landed. Bracketing is read off past impacts, and a dashed line
    // end is much harder to place than a point.
    const last = trail[trail.length - 1]!;
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

/**
 * Flat-vector tank inside the unchanged 30x25 hull box.
 *
 * Every coordinate below is inside `CONSTANTS.tank`'s box and nothing here feeds collision,
 * damage origin or ballistics - this is a silhouette, not a shape the simulation reads.
 * The body is drawn under `scale(tank.direction, 1)` so it mirrors for player 2; the barrel
 * is drawn after the restore, from the real pivot and muzzle offset, so it is not mirrored
 * twice.
 */
function drawTank(ctx: CanvasRenderingContext2D, state: GameState, tank: Tank): void {
  drawTankSilhouette(ctx, {
    x: tank.x,
    y: tank.y,
    direction: tank.direction,
    player: tank.player,
    angleDeg: tank.aim.angleDeg,
    health: tank.health,
    active: state.activePlayer === tank.player && state.phase === 'aim',
  });
}

/** A tank drawn from a plain descriptor, so the title and how-to scenes draw the real one. */
export interface TankSilhouette {
  readonly x: number;
  readonly y: number;
  readonly direction: 1 | -1;
  readonly player: PlayerIndex;
  readonly angleDeg: number;
  readonly health: number;
  /** Draws the turn reticle. */
  readonly active: boolean;
  /** Omits the health rail, for scenes with no match state behind them. */
  readonly hideHealth?: boolean;
  /**
   * Paints this colour instead of the player's. Only the crew-setup preview uses it: that
   * screen is choosing a colour, so it must show the swatch under the cursor rather than
   * whatever the match config currently holds.
   */
  readonly color?: string;
}

export function drawTankSilhouette(ctx: CanvasRenderingContext2D, tank: TankSilhouette): void {
  const { base, dark, light } = tank.color === undefined
    ? tankTones(tank.player)
    : tonesFrom(tank.color);
  const pivotY = tank.y + CONSTANTS.tank.turretPivotY;
  const angle = (tank.angleDeg * Math.PI) / 180;
  const muzzleX = tank.x + Math.cos(angle) * CONSTANTS.tank.muzzleOffset * tank.direction;
  const muzzleY = pivotY - Math.sin(angle) * CONSTANTS.tank.muzzleOffset;

  ctx.globalAlpha = tank.health > 0 ? 1 : 0.35;
  ctx.save();
  ctx.translate(tank.x, tank.y);
  ctx.scale(tank.direction, 1);

  // Contact shadow: without it the silhouette floats above the ground it is standing on.
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 3.5, 16, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = TANK_RUNNING_GEAR;
  fillPolygon(ctx, [[-14.5, -3], [14.5, -3], [15, 0.5], [13, 3], [-13, 3], [-15, 0.5]]);
  ctx.fillStyle = dark;
  for (let wheel = 0; wheel < 5; wheel++) {
    ctx.beginPath();
    ctx.arc(-10.5 + wheel * 5.25, 0.2, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(-14.5, -3.6, 29, 1.2);

  // Hull. The sloped glacis is the whole read: it says which way the tank points even with
  // the barrel vertical.
  ctx.fillStyle = base;
  fillPolygon(ctx, [[-13.5, -3.4], [-13.5, -9], [-9, -12.4], [6.5, -12.4], [14, -7.4], [14, -3.4]]);
  ctx.fillStyle = light;
  ctx.fillRect(-9, -12.4, 15.5, 1.1);
  ctx.fillStyle = dark;
  fillPolygon(ctx, [[6.5, -12.4], [14, -7.4], [14, -3.4], [9.5, -3.4]]);

  // Turret peaks at -19.4, inside hullTop -22.
  ctx.fillStyle = base;
  fillPolygon(ctx, [[-5.5, -12.4], [-3.5, -19.4], [3.5, -19.4], [5.5, -12.4]]);
  ctx.fillStyle = light;
  ctx.fillRect(-3.5, -19.4, 7, 1);
  ctx.restore();

  // Barrel: three passes along the real pivot-to-muzzle line, ending in a muzzle brake.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4.4;
  strokeSegment(ctx, tank.x, pivotY, muzzleX, muzzleY);
  ctx.strokeStyle = base;
  ctx.lineWidth = 2.4;
  strokeSegment(ctx, tank.x, pivotY, muzzleX, muzzleY);
  ctx.strokeStyle = light;
  ctx.lineWidth = 4.6;
  const brakeLength = CONSTANTS.tank.muzzleOffset - 3.5;
  strokeSegment(
    ctx,
    tank.x + Math.cos(angle) * brakeLength * tank.direction,
    pivotY - Math.sin(angle) * brakeLength,
    muzzleX,
    muzzleY,
  );

  ctx.globalAlpha = 1;
  if (!tank.hideHealth) drawHealthRail(ctx, tank, base);
  if (tank.active) drawTurnBrackets(ctx, tank);
}

/** Quarter ticks so a player reads "about half" without doing arithmetic. */
function drawHealthRail(ctx: CanvasRenderingContext2D, tank: TankSilhouette, base: string): void {
  const width = CONSTANTS.tank.hullHalfWidth * 2;
  const x = tank.x - CONSTANTS.tank.hullHalfWidth;
  const y = tank.y + CONSTANTS.tank.hullTop - 8;
  ctx.fillStyle = TANK_RAIL_BED;
  ctx.fillRect(x, y, width, TANK_RAIL_HEIGHT);
  ctx.fillStyle = base;
  ctx.fillRect(
    x,
    y,
    width * (Math.max(0, tank.health) / CONSTANTS.damage.startingHealth),
    TANK_RAIL_HEIGHT,
  );
  ctx.fillStyle = TANK_RAIL_TICK;
  for (let tick = 1; tick < 4; tick++) ctx.fillRect(x + (tick * width) / 4, y, 1, TANK_RAIL_HEIGHT);
}

/** A reticle rather than a selection box, so it does not compete with the hull outline. */
function drawTurnBrackets(ctx: CanvasRenderingContext2D, tank: TankSilhouette): void {
  const length = 5;
  const left = tank.x - 20;
  const right = tank.x + 20;
  const top = tank.y + CONSTANTS.tank.hullTop - 2;
  const bottom = tank.y + 6;
  ctx.strokeStyle = ACTION_ACCENT;
  ctx.lineWidth = 1.5;
  const corners: readonly (readonly [number, number, number, number])[] = [
    [left, top, 1, 1],
    [right, top, -1, 1],
    [left, bottom, 1, -1],
    [right, bottom, -1, -1],
  ];
  for (const [x, y, towardX, towardY] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + towardX * length, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + towardY * length);
    ctx.stroke();
  }
}

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
): void {
  ctx.beginPath();
  ctx.moveTo(points[0]![0], points[0]![1]);
  for (let index = 1; index < points.length; index++) ctx.lineTo(points[index]![0], points[index]![1]);
  ctx.closePath();
  ctx.fill();
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
