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
import { CHROME, displayFont, monoFont, playerColor } from './palette';

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

export interface DeckChipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Distance from any viewport edge to the block anchored against it. */
const MARGIN = 32;
const TOP_SCRIM = 96;
const BOTTOM_SCRIM = 230;

const NAMEPLATE = { tagWidth: 36, tagHeight: 20, tagY: 30, barWidth: 190, barHeight: 16, barY: 32, gap: 14 } as const;
const SOLUTION = { width: 340, height: 190 } as const;
const DECK = { width: 108, height: 82, gap: 10 } as const;
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
export function deckChipLayout(viewport: Viewport, count: number): readonly DeckChipRect[] {
  const available = viewport.width - MARGIN - (MARGIN + SOLUTION.width + 16);
  const natural = DECK.width * count + DECK.gap * (count - 1);
  const width = natural <= available
    ? DECK.width
    : Math.max(1, Math.floor((available - DECK.gap * (count - 1)) / count));
  const x0 = viewport.width - MARGIN - (width * count + DECK.gap * (count - 1));
  const y = viewport.height - MARGIN - DECK.height;
  return Array.from({ length: count }, (_, index) => ({
    x: x0 + index * (width + DECK.gap),
    y,
    width,
    height: DECK.height,
  }));
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
  icons: ReadonlyMap<string, HTMLImageElement> = new Map(),
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
  drawDeck(ctx, state, icons, viewport);
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

  const active = state.activePlayer === player;
  ctx.font = monoFont(10);
  ctx.fillStyle = active ? CHROME.action : CHROME.dim;
  ctx.fillText(active ? 'YOUR TURN' : 'WAITING', left ? tagX : anchor, 58);
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
  const x = MARGIN;
  const y = viewport.height - MARGIN - SOLUTION.height;

  drawPanel(ctx, x, y, SOLUTION.width, SOLUTION.height);
  ctx.fillStyle = CHROME.action;
  ctx.fillRect(x, y, 3, SOLUTION.height);

  ctx.font = monoFont(10, 700);
  ctx.fillStyle = CHROME.sand;
  ctx.fillText(track('FIRING SOLUTION'), x + 22, y + 18);

  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText('ANGLE', x + 22, y + 46);
  ctx.fillText('POWER', x + 190, y + 46);

  ctx.font = displayFont(46, 800);
  ctx.fillStyle = CHROME.paper;
  ctx.fillText(`${active.aim.angleDeg.toFixed(0)}°`, x + 22, y + 60);
  ctx.fillStyle = CHROME.action;
  ctx.fillText(active.aim.power.toFixed(0), x + 190, y + 60);

  const barWidth = SOLUTION.width - 44;
  const barY = y + 128;
  drawMeter(ctx, {
    x: x + 22,
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
    ctx.fillRect(x + 22 + (barWidth / 10) * tick, barY + 11, 1, 5);
  }

  drawWind(ctx, state, x, y);
}

/**
 * Wind, read from the active player's point of view. The raw sign is field-relative, so a
 * tank facing left has a positive wind blowing back at it: the tag flips with
 * `tank.direction`, not with the sign.
 */
function drawWind(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText('WIND', x + 22, y + 160);

  if (state.world.windRange === 0) {
    ctx.font = monoFont(13);
    ctx.fillText('NONE — VACUUM', x + 74, y + 157);
    return;
  }

  ctx.font = monoFont(14, 700);
  ctx.fillStyle = CHROME.sand;
  ctx.fillText(Math.abs(state.wind).toFixed(0), x + 74, y + 157);

  const relative = state.wind * state.tanks[state.activePlayer].direction;
  const direction = relative >= 0 ? 1 : -1;
  const arrowX = x + 124;
  const arrowY = y + 164;
  const tail = direction > 0 ? arrowX : arrowX + 38;
  const tip = direction > 0 ? arrowX + 38 : arrowX;
  ctx.strokeStyle = CHROME.sand;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tail, arrowY);
  ctx.lineTo(tip - direction * 7, arrowY);
  ctx.stroke();
  ctx.fillStyle = CHROME.sand;
  ctx.beginPath();
  ctx.moveTo(tip, arrowY);
  ctx.lineTo(tip - direction * 8, arrowY - 4.5);
  ctx.lineTo(tip - direction * 8, arrowY + 4.5);
  ctx.closePath();
  ctx.fill();

  ctx.font = monoFont(9);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText(direction > 0 ? 'DOWNRANGE' : 'AGAINST YOU', x + 176, y + 160);
}

function drawDeck(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  icons: ReadonlyMap<string, HTMLImageElement>,
  viewport: Viewport,
): void {
  const chips = deckChipModels(state);
  const layout = deckChipLayout(viewport, chips.length);

  chips.forEach((chip, index) => {
    const { x, y, width, height } = layout[index]!;
    ctx.globalAlpha = chip.spent || chip.locked ? 0.35 : 1;
    ctx.fillStyle = chip.selected ? CHROME.chipSelected : CHROME.chip;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = chip.selected ? CHROME.action : CHROME.hairlineChip;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    if (chip.selected) {
      ctx.fillStyle = CHROME.action;
      ctx.fillRect(x, y, width, 3);
    }

    ctx.font = monoFont(10, 700);
    ctx.fillStyle = chip.selected ? CHROME.action : CHROME.dim;
    ctx.fillText(String(chip.key), x + 10, y + 12);

    const image = icons.get(chip.icon);
    if (image?.complete && image.naturalWidth > 0) ctx.drawImage(image, x + width - 36, y + 10, 26, 26);

    ctx.font = monoFont(10);
    ctx.fillStyle = chip.selected ? CHROME.actionText : CHROME.muted;
    ctx.fillText(chipName(chip.name), x + 10, y + 44);

    ctx.font = monoFont(16, 700);
    ctx.fillStyle = chip.selected ? CHROME.paper : CHROME.sand;
    ctx.fillText(chip.ammo === 'inf' ? '∞' : String(chip.ammo), x + 10, y + 58);

    // Mass changes the firing solution, so it earns its place; 1.00 tells you nothing.
    if (chip.mass !== 1) {
      ctx.font = monoFont(10);
      ctx.fillStyle = CHROME.dim;
      ctx.textAlign = 'right';
      ctx.fillText(`M${chip.mass}`, x + width - 10, y + 62);
      ctx.textAlign = 'left';
    }
  });

  ctx.globalAlpha = 1;
  const first = layout[0];
  if (!first) return;
  ctx.font = monoFont(10);
  ctx.fillStyle = CHROME.dim;
  ctx.fillText('1–6 SELECT   ←→ ANGLE   ↑↓ POWER   SHIFT COARSE   SPACE FIRE', first.x, first.y - 20);
}

/** A chip is 108px wide; a long name gets its first word rather than being clipped. */
function chipName(name: string): string {
  const upper = name.toUpperCase();
  return upper.length > 12 ? upper.split(' ')[0]! : upper;
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
