/**
 * Match HUD, drawn in **viewport pixels** rather than field pixels.
 *
 * It used to be drawn inside the camera transform, so its scale was a function of how far
 * apart the tanks were and how wide the world was: 12px text landed at 17.9px on Ferrum and
 * 6.9px on Selene, a 2.6x spread, unreadable at one end and overflowing the letterbox at the
 * other. `renderer.ts` now calls this outside the transform and passes the CSS-pixel
 * viewport, so the HUD is the same physical size on every world and the deck needs no
 * field-width column branching.
 *
 * Layout is specified at 1194x834 (iPad landscape, per `spec/presentation.json`). Anchors
 * are measured from the viewport edges, so a different viewport moves the blocks rather
 * than resizing them.
 */
import type { GameState, Tank } from '../sim/world';
import { simSeconds } from '../sim/world';
import type { WorldPhysics } from '../sim/worlds';
import { CONSTANTS } from '../sim/constants';
import { CHROME, displayFont, monoFont, playerColor, playerLabel } from './palette';

export interface LoopTelemetry {
  /** Steps run on the most recent frame. */
  readonly stepsThisFrame: number;
  /** Render interpolation fraction, 0..1. */
  readonly alpha: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Chrome the simulation does not own. Rounds and the turn timer are match-level settings,
 * so the HUD omits each one until something supplies it rather than inventing a value.
 */
export interface HudChrome {
  readonly round?: { readonly index: number; readonly total: number };
  /** Seconds left on the turn timer. Omitted entirely when the timer is `off`. */
  readonly timerSeconds?: number;
  /** Loop telemetry ships off; it is a dev aid, not something a player needs every turn. */
  readonly showTelemetry?: boolean;
}

export interface DeckChipModel {
  readonly key: number;
  readonly name: string;
  readonly icon: string;
  readonly ammo: number | 'inf';
  readonly mass: number;
  readonly selected: boolean;
  readonly spent: boolean;
  /** Repair Kit under its consecutive-turn lock: greyed, so the rule is visible. */
  readonly locked: boolean;
}

/** Distance from any viewport edge to the block anchored against it. */
const MARGIN = 32;
const TOP_SCRIM = 96;
const BOTTOM_SCRIM = 230;

const NAMEPLATE = {
  tagWidth: 36, tagHeight: 20, tagY: 30, barWidth: 190, barHeight: 16, barY: 32, gap: 14,
  /**
   * The crew name is anchored to the viewport edge and the turn state sits inboard of it, so
   * the name needs a column of its own: 14 characters — the cap `CREW_NAME_MAX_LENGTH` puts on
   * it — at mono 10px, with enough slack that a fallback mono still clears the state label.
   */
  identityY: 58, nameColumn: 104,
} as const;
const SOLUTION = { x: 354, width: 220, height: 122, bottomClearance: 12 } as const;
const TELEMETRY_PANEL = { width: 210, height: 92, y: 110 } as const;

/**
 * Letter-spacing survives `fillText` only by being in the string, so tracked labels get a
 * space between characters. Numbers keep their tight form - `G 1.00`, not `G 1 . 0 0` -
 * because a spaced-out figure stops reading as one quantity.
 */
export function track(text: string): string {
  const numeric = (character: string | undefined): boolean =>
    character !== undefined && /[0-9.]/.test(character);
  let out = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (index > 0 && !numeric(character) && !numeric(text[index - 1])) out += ' ';
    out += character;
  }
  return out;
}

/**
 * Deck chips, right-aligned against the viewport edge. No `fieldWidth` and no responsive
 * column count: the deck is anchored to the screen, so one row always fits.
 *
 * Chips shrink only if the firing-solution panel would otherwise be underneath them, which
 * cannot happen at the 1194px design width and only bites near the 900px landscape floor.
 */
export function firingSolutionLayout(viewport: Viewport): Readonly<{
  x: number; y: number; width: number; height: number;
}> {
  return {
    x: SOLUTION.x,
    y: viewport.height - SOLUTION.bottomClearance - SOLUTION.height,
    width: SOLUTION.width,
    height: SOLUTION.height,
  };
}

export function deckChipModels(state: GameState): readonly DeckChipModel[] {
  const arsenal = state.arsenals[state.activePlayer];
  return arsenal.slots.map((weapon, index) => {
    const ammo = arsenal.ammo[weapon.shell.id] ?? 0;
    const useHook = weapon.shell.hooks?.onUse;
    const locked = useHook !== undefined
      && arsenal.lastRepairTurn !== null
      && state.turn - arsenal.lastRepairTurn <= useHook.cooldownTurns;
    return {
      key: index + 1,
      name: weapon.shell.name,
      icon: weapon.shell.icon,
      ammo,
      mass: weapon.shell.mass,
      selected: weapon.shell.id === arsenal.selectedShellId,
      spent: ammo === 0,
      locked,
    };
  });
}

/** The permanent world strip: what the player is fighting on, in one line. */
export function worldStripText(world: WorldPhysics): string {
  return track(
    `${world.name.toUpperCase()} · ${world.kind.toUpperCase()} · G ${world.gravity.toFixed(2)} · ${world.width} PX`,
  );
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  telemetry: LoopTelemetry,
  _icons: ReadonlyMap<string, HTMLImageElement> = new Map(),
  viewport: Viewport = state.field,
  chrome: HudChrome = {},
): void {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;

  drawScrims(ctx, viewport);
  drawNameplate(ctx, state, 0, viewport);
  drawNameplate(ctx, state, 1, viewport);
  drawCentre(ctx, state, viewport, chrome);
  drawFiringSolution(ctx, state, viewport);
  if (chrome.showTelemetry) drawTelemetry(ctx, state, telemetry, viewport);

  ctx.restore();
}

/** Two gradients, so HUD text holds against any sky without a panel behind every label. */
function drawScrims(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  const top = ctx.createLinearGradient(0, 0, 0, TOP_SCRIM);
  top.addColorStop(0, `rgba(${CHROME.scrim},0.94)`);
  top.addColorStop(1, `rgba(${CHROME.scrim},0)`);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, viewport.width, TOP_SCRIM);

  const bottom = ctx.createLinearGradient(0, viewport.height, 0, viewport.height - BOTTOM_SCRIM);
  bottom.addColorStop(0, `rgba(${CHROME.scrim},0.88)`);
  bottom.addColorStop(1, `rgba(${CHROME.scrim},0)`);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, viewport.height - BOTTOM_SCRIM, viewport.width, BOTTOM_SCRIM);
}

/** P1 anchored left, P2 mirrored from the right edge. */
function drawNameplate(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  player: 0 | 1,
  viewport: Viewport,
): void {
  const tank: Tank = state.tanks[player];
  const color = playerColor(player);
  const left = player === 0;
  const anchor = left ? MARGIN : viewport.width - MARGIN;
  const tagX = left ? anchor : anchor - NAMEPLATE.tagWidth;
  const barX = left
    ? anchor + NAMEPLATE.tagWidth + NAMEPLATE.gap
    : anchor - NAMEPLATE.tagWidth - NAMEPLATE.gap - NAMEPLATE.barWidth;
  const health = Math.max(0, Math.round(tank.health));

  ctx.fillStyle = color;
  ctx.fillRect(tagX, NAMEPLATE.tagY, NAMEPLATE.tagWidth, NAMEPLATE.tagHeight);
  ctx.fillStyle = '#0E1219';
  ctx.font = monoFont(12, 700);
  ctx.textAlign = 'center';
  ctx.fillText(`P${player + 1}`, tagX + NAMEPLATE.tagWidth / 2, NAMEPLATE.tagY + 4);
  ctx.textAlign = 'left';

  drawMeter(ctx, {
    x: barX,
    y: NAMEPLATE.barY,
    width: NAMEPLATE.barWidth,
    height: NAMEPLATE.barHeight,
    fraction: health / CONSTANTS.damage.startingHealth,
    fill: color,
    ticks: 4,
  });

  ctx.font = monoFont(15, 700);
  ctx.fillStyle = CHROME.paper;
  ctx.textAlign = left ? 'left' : 'right';
  ctx.fillText(
    String(health),
    left ? barX + NAMEPLATE.barWidth + 12 : barX - 12,
    NAMEPLATE.barY + 1,
  );

  // Who this is, then whether it is their turn: the crew name reads at the outer edge, in
  // that crew's own colour, so the two nameplates are told apart before either is read.
  const active = state.activePlayer === player;
  ctx.font = monoFont(10, 700);
  ctx.fillStyle = color;
  ctx.fillText(playerLabel(player).toUpperCase(), left ? tagX : anchor, NAMEPLATE.identityY);
  ctx.font = monoFont(10);
  ctx.fillStyle = active ? CHROME.action : CHROME.dim;
  ctx.fillText(
    active ? 'YOUR TURN' : 'WAITING',
    left ? tagX + NAMEPLATE.nameColumn : anchor - NAMEPLATE.nameColumn,
    NAMEPLATE.identityY,
  );
  ctx.textAlign = 'left';
}

/** Round, turn, optional timer and the world strip, all centred on the viewport. */
function drawCentre(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewport: Viewport,
  chrome: HudChrome,
): void {
  const centre = viewport.width / 2;
  const pad = (value: number): string => String(value).padStart(2, '0');
  const turnLine = chrome.round
    ? `ROUND ${pad(chrome.round.index)} OF ${pad(chrome.round.total)} · TURN ${pad(state.turn)}`
    : `TURN ${pad(state.turn)}`;

  ctx.textAlign = 'center';
  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.sand;
  ctx.fillText(track(turnLine), centre, 22);

  // The timer is off by default; when it is off the round/turn line simply sits alone.
  if (chrome.timerSeconds !== undefined) {
    const seconds = Math.max(0, Math.round(chrome.timerSeconds));
    ctx.font = monoFont(30, 700);
    ctx.fillStyle = CHROME.paper;
    ctx.fillText(`${Math.floor(seconds / 60)}:${pad(seconds % 60)}`, centre, 36);
  }

  ctx.font = monoFont(10);
  ctx.fillStyle = state.world.palette.accent;
  ctx.fillText(worldStripText(state.world), centre, 74);
  drawWind(ctx, state, centre, 90);
  ctx.textAlign = 'left';
}

/**
 * Angle and power as the largest type on screen. They are the two numbers the game is
 * about, and in the old HUD they were lines nine and ten of a fifteen-line telemetry dump.
 */
function drawFiringSolution(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewport: Viewport,
): void {
  const active = state.tanks[state.activePlayer];
  const { x, y, width, height } = firingSolutionLayout(viewport);

  drawPanel(ctx, x, y, width, height);
  ctx.fillStyle = CHROME.action;
  ctx.fillRect(x, y, 3, height);

  ctx.font = monoFont(10, 700);
  ctx.fillStyle = CHROME.sand;
  ctx.fillText(track('FIRING SOLUTION'), x + 20, y + 14);

  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText('ANGLE', x + 20, y + 38);
  ctx.fillText('POWER', x + 120, y + 38);

  ctx.font = displayFont(36, 800);
  ctx.fillStyle = CHROME.paper;
  ctx.fillText(`${active.aim.angleDeg.toFixed(0)}°`, x + 20, y + 50);
  ctx.fillStyle = CHROME.action;
  ctx.fillText(active.aim.power.toFixed(0), x + 120, y + 50);

  const barWidth = width - 36;
  const barY = y + 91;
  drawMeter(ctx, {
    x: x + 20,
    y: barY,
    width: barWidth,
    height: 11,
    fraction: (active.aim.power - CONSTANTS.power.min)
      / (CONSTANTS.power.max - CONSTANTS.power.min),
    fill: CHROME.action,
    ticks: 0,
  });
  ctx.fillStyle = CHROME.hairlineFaint;
  for (let tick = 1; tick < 10; tick++) {
    ctx.fillRect(x + 20 + (barWidth / 10) * tick, barY + 11, 1, 4);
  }

}

/**
 * Wind, read from the active player's point of view. The raw sign is field-relative, so a
 * tank facing left has a positive wind blowing back at it: the tag flips with
 * `tank.direction`, not with the sign.
 */
function drawWind(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  ctx.textAlign = 'center';
  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.dim;

  if (state.world.windRange === 0) {
    ctx.fillText(track('WIND · NONE — VACUUM'), x, y);
    return;
  }

  const relative = state.wind * state.tanks[state.activePlayer].direction;
  const direction = relative >= 0 ? 1 : -1;
  const arrow = direction > 0 ? '→' : '←';
  const bearing = direction > 0 ? 'DOWNRANGE' : 'AGAINST YOU';
  ctx.font = monoFont(11, 700);
  ctx.fillStyle = CHROME.sand;
  ctx.fillText(`WIND · ${Math.abs(state.wind).toFixed(0)} ${arrow} ${bearing}`, x, y);
}

/**
 * Everything the old HUD printed unconditionally - seed, frame, sim seconds, substeps,
 * alpha, field size - lives here and ships off.
 */
function drawTelemetry(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  telemetry: LoopTelemetry,
  viewport: Viewport,
): void {
  const x = viewport.width - MARGIN - TELEMETRY_PANEL.width;
  const y = TELEMETRY_PANEL.y;
  drawPanel(ctx, x, y, TELEMETRY_PANEL.width, TELEMETRY_PANEL.height);

  ctx.font = monoFont(10, 700);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText(track('TELEMETRY'), x + 14, y + 12);

  ctx.font = monoFont(11);
  ctx.fillStyle = CHROME.muted;
  const lines = [
    `SEED  ${state.seed.toString(16).padStart(8, '0')}`,
    `FRAME ${state.frame.toString().padStart(9, ' ')}`,
    `SIM   ${simSeconds(state).toFixed(2).padStart(8, ' ')}s`,
    `STEPS ${telemetry.stepsThisFrame.toString().padStart(9, ' ')}`,
    `ALPHA ${telemetry.alpha.toFixed(2).padStart(9, ' ')}`,
    `FIELD ${state.field.width} x ${state.field.height}`,
  ];
  lines.forEach((line, index) => ctx.fillText(line, x + 14, y + 32 + index * 14));
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = CHROME.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = CHROME.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

interface MeterOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fraction: number;
  readonly fill: string;
  /** Divisions marked inside the bar, so a value reads without arithmetic. 0 for none. */
  readonly ticks: number;
}

function drawMeter(ctx: CanvasRenderingContext2D, meter: MeterOptions): void {
  const { x, y, width, height } = meter;
  ctx.fillStyle = CHROME.meterBed;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = CHROME.hairlineStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = meter.fill;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, meter.fraction)), height);
  ctx.fillStyle = CHROME.meterTick;
  for (let tick = 1; tick < meter.ticks; tick++) {
    ctx.fillRect(x + (width / meter.ticks) * tick, y, 1, height);
  }
}
