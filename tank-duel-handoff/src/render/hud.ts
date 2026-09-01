/**
 * HUD. Task 1 draws only the loop telemetry — proof the fixed timestep is running and
 * that a stalled frame is clamped rather than fast-forwarded.
 */
import type { GameState } from '../sim/world';
import { simSeconds } from '../sim/world';
import { CONSTANTS } from '../sim/constants';
import { PALETTE, playerColor, TELEMETRY_FONT } from './palette';

export interface LoopTelemetry {
  /** Steps run on the most recent frame. */
  readonly stepsThisFrame: number;
  /** Render interpolation fraction, 0..1. */
  readonly alpha: number;
}

export interface DeckChipModel {
  readonly key: number;
  readonly name: string;
  readonly icon: string;
  readonly ammo: number | 'inf';
  readonly mass: number;
  readonly selected: boolean;
  readonly spent: boolean;
}

export interface DeckChipRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export function deckChipLayout(fieldWidth: number, count: number): readonly DeckChipRect[] {
  const wide = fieldWidth >= 800;
  const columns = wide ? 3 : 2;
  const x0 = wide ? 490 : 220;
  const gap = 4;
  const width = Math.floor((fieldWidth - x0 - gap * (columns - 1)) / columns);
  return Array.from({ length: count }, (_, index) => ({
    x: x0 + (index % columns) * (width + gap),
    y: 12 + Math.floor(index / columns) * 46,
    width,
  }));
}

export function deckChipModels(state: GameState): readonly DeckChipModel[] {
  const arsenal = state.arsenals[state.activePlayer];
  return arsenal.slots.map((weapon, index) => {
    const ammo = arsenal.ammo[weapon.shell.id] ?? 0;
    return {
      key: index + 1,
      name: weapon.shell.name,
      icon: weapon.shell.icon,
      ammo,
      mass: weapon.shell.mass,
      selected: weapon.shell.id === arsenal.selectedShellId,
      spent: ammo === 0,
    };
  });
}

export function worldRangeHint(state: GameState): string | null {
  return state.turn === 1
    ? `${state.world.name} RANGE AT POWER 75: ${state.world.derived.rangeAtPower75} PX`
    : null;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  telemetry: LoopTelemetry,
  icons: ReadonlyMap<string, HTMLImageElement> = new Map(),
  viewport: { readonly width: number; readonly height: number } = state.field,
): void {
  const active = state.tanks[state.activePlayer];
  const arsenal = state.arsenals[state.activePlayer];
  const selected = arsenal.slots.find((weapon) => weapon.shell.id === arsenal.selectedShellId);
  const ammo = selected ? arsenal.ammo[selected.shell.id] : undefined;
  const result = state.roundResult === 'draw'
    ? 'DRAW'
    : state.roundResult === null
      ? null
      : `PLAYER ${state.roundResult + 1} WINS`;
  const lines = [
    `SEED  ${state.seed.toString(16).padStart(8, '0')}`,
    `FRAME ${state.frame.toString().padStart(7, ' ')}`,
    `SIM   ${simSeconds(state).toFixed(2).padStart(7, ' ')}s`,
    `STEPS ${telemetry.stepsThisFrame.toString().padStart(7, ' ')}`,
    `ALPHA ${telemetry.alpha.toFixed(2).padStart(7, ' ')}`,
    `FIELD ${state.field.width} x ${state.field.height}`,
    `TURN  ${state.turn.toString().padStart(7, ' ')}  PLAYER ${state.activePlayer + 1}`,
    `PHASE ${state.phase.toUpperCase().padStart(11, ' ')}`,
    `ANGLE ${active.aim.angleDeg.toFixed(0).padStart(7, ' ')} deg`,
    `POWER ${active.aim.power.toFixed(0).padStart(7, ' ')}`,
    `AMMO  ${ammo === 'inf' ? '∞' : (ammo ?? '?')}`,
    `WIND  ${state.wind.toFixed(0).padStart(7, ' ')}`,
    worldRangeHint(state) ?? '',
    `P1 HP ${state.tanks[0].health.toFixed(1).padStart(7, ' ')}  P2 HP ${state.tanks[1].health.toFixed(1).padStart(7, ' ')}`,
    result ?? (state.phase === 'aim' ? '1-6 shell  ARROWS aim  SHIFT coarse  SPACE fire' : 'INPUT LOCKED'),
  ];

  ctx.save();
  ctx.font = TELEMETRY_FONT;
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.telemetry;
  lines.forEach((line, i) => ctx.fillText(line, 12, 12 + i * 16));

  drawDeck(ctx, deckChipModels(state), icons, viewport.width);

  const barWidth = CONSTANTS.power.max;
  const barX = 12;
  const barY = viewport.height - 18;
  ctx.strokeStyle = PALETTE.telemetry;
  ctx.strokeRect(barX, barY, barWidth, 6);
  ctx.fillStyle = playerColor(state.activePlayer);
  ctx.fillRect(barX, barY, (active.aim.power / CONSTANTS.power.max) * barWidth, 6);
  ctx.restore();
}

function drawDeck(
  ctx: CanvasRenderingContext2D,
  chips: readonly DeckChipModel[],
  icons: ReadonlyMap<string, HTMLImageElement>,
  fieldWidth: number,
): void {
  const layout = deckChipLayout(fieldWidth, chips.length);
  chips.forEach((chip, index) => {
    const { x, y, width: chipWidth } = layout[index]!;
    ctx.globalAlpha = chip.spent ? 0.35 : 1;
    ctx.fillStyle = '#111923CC';
    ctx.fillRect(x, y, chipWidth, 42);
    ctx.strokeStyle = chip.selected ? '#FF8C42' : '#607080';
    ctx.strokeRect(x, y, chipWidth, 42);
    const image = icons.get(chip.icon);
    if (image?.complete && image.naturalWidth > 0) ctx.drawImage(image, x + 7, y + 9, 24, 24);
    ctx.fillStyle = PALETTE.telemetry;
    ctx.fillText(`${chip.key} ${chip.name}`, x + 36, y + 6);
    ctx.fillText(`AMMO ${chip.ammo === 'inf' ? '∞' : chip.ammo}${chip.mass === 1 ? '' : `  M ${chip.mass}`}`, x + 36, y + 22);
  });
  ctx.globalAlpha = 1;
}
