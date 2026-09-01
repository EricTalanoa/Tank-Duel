import { expect, test } from 'vitest';
import type { GameState } from '../sim/world';
import { createWorld } from '../sim/world';
import type { PresentationEvent } from '../sim/presentation';
import { HE_SHELL } from '../sim/shells';
import { PRESENTATION } from './presentation';
import * as palette from './palette';
const { tankTones } = palette;
import { drawFlightEntities, drawWorldEntities } from './entities';
import { drawHud } from './hud';
import { createEffects } from './effects';
import { motionPolicy } from './motion';

type PlayerColor = (player: 0 | 1) => string;

class RecordingContext {
  fillStyle = '';
  strokeStyle = '';
  globalAlpha = 1;
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  font = '';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  readonly fills: Array<{ readonly color: string; readonly width: number; readonly height: number }> = [];
  readonly strokes: string[] = [];
  readonly strokeRects: string[] = [];
  readonly arcs: string[] = [];
  readonly images: string[] = [];

  save(): void {}
  restore(): void {}
  translate(): void {}
  scale(): void {}
  ellipse(): void { this.fills.push({ color: this.fillStyle, width: 0, height: 0 }); }
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  setLineDash(): void {}
  fillRect(_x: number, _y: number, width: number, height: number): void {
    this.fills.push({ color: this.fillStyle, width, height });
  }
  stroke(): void { this.strokes.push(this.strokeStyle); }
  strokeRect(): void { this.strokeRects.push(this.strokeStyle); }
  arc(): void { this.arcs.push(this.fillStyle); }
  fill(): void { this.fills.push({ color: this.fillStyle, width: 0, height: 0 }); }
  fillText(): void {}
  drawImage(): void { this.images.push(this.fillStyle); }
}

function combatState(activePlayer: 0 | 1): GameState {
  return {
    activePlayer,
    phase: 'aim',
    fireZones: [],
    tanks: [
      {
        player: 0, x: 100, y: 200, direction: 1, health: 50, aim: { angleDeg: 45, power: 70 },
        trails: [[{ x: 1, y: 1 }, { x: 2, y: 2 }]],
      },
      {
        player: 1, x: 300, y: 200, direction: -1, health: 50, aim: { angleDeg: 45, power: 70 },
        trails: [[{ x: 3, y: 3 }, { x: 4, y: 4 }]],
      },
    ],
    projectiles: [
      { x: 120, y: 120, owner: 0, shell: HE_SHELL },
      { x: 280, y: 120, owner: 1, shell: HE_SHELL },
    ],
  } as unknown as GameState;
}

test('maps each player index to its presentation color', () => {
  // Break caught: removing or misrouting the render-layer player identity mapping.
  const playerColor = (palette as unknown as { readonly playerColor: PlayerColor }).playerColor;

  expect(playerColor(0)).toBe(PRESENTATION.players[0].color);
  expect(playerColor(1)).toBe(PRESENTATION.players[1].color);
});

test('renders every player-owned combat surface with its owner color', () => {
  // Break caught: a body, health fill, aim, projectile, or trail uses a shell/shared color.
  const colors = PRESENTATION.players.map((player) => player.color);
  const playerZero = new RecordingContext();
  drawWorldEntities(playerZero as unknown as CanvasRenderingContext2D, combatState(0));
  drawFlightEntities(playerZero as unknown as CanvasRenderingContext2D, combatState(0));

  for (const player of [0, 1] as const) {
    const { base, dark, light } = tankTones(player);
    // Hull and turret in the base tone, their shading and highlight derived from it.
    expect(playerZero.fills.some((fill) => fill.color === base)).toBe(true);
    expect(playerZero.fills.some((fill) => fill.color === dark)).toBe(true);
    expect(playerZero.fills.some((fill) => fill.color === light)).toBe(true);
    // Health rail fill.
    expect(playerZero.fills.some((fill) => fill.color === base && fill.height === 3.5)).toBe(true);
    // Barrel passes and the projectile.
    expect(playerZero.strokes).toContain(base);
    expect(playerZero.arcs).toContain(base);
  }
  expect(colors).toEqual([tankTones(0).base, tankTones(1).base]);
});

test('brackets only the active tank, in the shared action accent', () => {
  // Break caught: the turn marker returning to a per-player colour, or marking both tanks.
  for (const active of [0, 1] as const) {
    const context = new RecordingContext();
    drawWorldEntities(context as unknown as CanvasRenderingContext2D, combatState(active));
    // Four corner brackets, one stroked path each, on exactly one tank.
    expect(context.strokes.filter((color) => color === '#FF8C42')).toHaveLength(4);
    expect(context.strokeRects).toHaveLength(0);
  }
});

test('keeps shell feedback functional while player muzzle and HUD feedback follow player identity', () => {
  // Break caught: shell icons/explosions inherit player identity, or player feedback inherits shell accents.
  const colors = PRESENTATION.players.map((player) => player.color);
  const effects = createEffects(7, motionPolicy(false));
  const events: PresentationEvent[] = [
    { type: 'muzzleFlash', x: 10, y: 10, shellId: 'he', accent: '#E8B33C', player: 0 },
    { type: 'muzzleFlash', x: 20, y: 20, shellId: 'he', accent: '#E8B33C', player: 1 },
    { type: 'impact', x: 30, y: 30, shellId: 'he', accent: '#E8B33C', blastRadius: 20 },
  ];
  effects.consume(events);
  const effectsContext = new RecordingContext();
  effects.draw(effectsContext as unknown as CanvasRenderingContext2D);
  expect(effectsContext.arcs).toEqual(expect.arrayContaining(colors));
  expect(effectsContext.fills.some((fill) => fill.color === '#E8B33C')).toBe(true);

  const world = createWorld(7);
  const hudContext = new RecordingContext();
  const icon = { complete: true, naturalWidth: 1 } as HTMLImageElement;
  const icons = new Map([[world.arsenals[0].slots[0]!.shell.icon, icon]]);
  drawHud(hudContext as unknown as CanvasRenderingContext2D, world, { stepsThisFrame: 1, alpha: 0 }, icons);
  world.activePlayer = 1;
  drawHud(hudContext as unknown as CanvasRenderingContext2D, world, { stepsThisFrame: 1, alpha: 0 }, icons);
  expect(hudContext.fills.map((fill) => fill.color)).toEqual(expect.arrayContaining(colors));
  expect(hudContext.strokeRects).toContain('#FF8C42');
  expect(hudContext.images).toHaveLength(2);
});
