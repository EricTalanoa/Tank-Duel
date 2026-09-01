import { CONSTANTS } from '../sim/constants';
import type { GameState, Tank } from '../sim/world';
import { PALETTE, playerColor } from './palette';
import { surfaceY } from '../sim/terrain';
import { wrapX } from '../sim/wrap';

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
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 7]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

function drawTank(ctx: CanvasRenderingContext2D, state: GameState, tank: Tank): void {
  const color = playerColor(tank.player);
  const pivotY = tank.y + CONSTANTS.tank.turretPivotY;
  const angle = (tank.aim.angleDeg * Math.PI) / 180;
  const muzzleX = tank.x + Math.cos(angle) * CONSTANTS.tank.muzzleOffset * tank.direction;
  const muzzleY = pivotY - Math.sin(angle) * CONSTANTS.tank.muzzleOffset;
  const hullX = tank.x - CONSTANTS.tank.hullHalfWidth;
  const hullY = tank.y + CONSTANTS.tank.hullTop;
  const hullWidth = CONSTANTS.tank.hullHalfWidth * 2;
  const hullHeight = CONSTANTS.tank.hullBottom - CONSTANTS.tank.hullTop;

  ctx.globalAlpha = tank.health > 0 ? 1 : 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(hullX, hullY, hullWidth, hullHeight);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tank.x, pivotY);
  ctx.lineTo(muzzleX, muzzleY);
  ctx.stroke();

  if (state.activePlayer === tank.player && state.phase === 'aim') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(hullX - 3, hullY - 3, hullWidth + 6, hullHeight + 6);
  }

  ctx.globalAlpha = 1;
  const healthY = hullY - 8;
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(hullX, healthY, hullWidth, 4);
  ctx.fillStyle = color;
  ctx.fillRect(
    hullX,
    healthY,
    hullWidth * (Math.max(0, tank.health) / CONSTANTS.damage.startingHealth),
    4,
  );
}
