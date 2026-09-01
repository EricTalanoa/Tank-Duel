import { expect, test } from 'vitest';
import type { GameState } from '../sim/world';
import { CONSTANTS } from '../sim/constants';
import { HOLLOW } from '../sim/worlds';
import { drawFlightEntities } from './entities';
import { drawSceneCopies, screenPointToWorld } from './renderer';

test('inverts letterbox and camera origin into world coordinates', () => {
  const point = screenPointToWorld(509, 150, {
    canvasLeft: 10,
    canvasTop: 10,
    offsetX: 0,
    offsetY: 0,
    scale: 0.5,
    view: { x: 500, y: 0, width: 1000, height: 560 },
  });
  expect(point).toEqual({ x: 1498, y: 280 });
});

test('rejects a point outside the visible camera rectangle', () => {
  expect(screenPointToWorld(0, 0, {
    canvasLeft: 10,
    canvasTop: 10,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    view: { x: 500, y: 0, width: 1000, height: 560 },
  })).toBeNull();
});

test('dispatches canonical layers per visible tile and the unbounded flight layer once', () => {
  const terrainOffsets: number[] = [];
  const persistentOffsets: number[] = [];
  let flightDraws = 0;

  drawSceneCopies(
    { x: HOLLOW.width - 100, y: 0, width: 400, height: CONSTANTS.fieldHeight },
    HOLLOW.width,
    true,
    0,
    {
      drawTerrain: (offset) => terrainOffsets.push(offset),
      drawPersistent: (offset) => persistentOffsets.push(offset),
      drawFlight: () => { flightDraws++; },
    },
  );

  expect(terrainOffsets).toEqual([0, HOLLOW.width]);
  expect(persistentOffsets).toEqual([0, HOLLOW.width]);
  expect(flightDraws).toBe(1);
});

test('expands only persistent copies for a seam-crossing footprint at a tile boundary', () => {
  const terrainOffsets: number[] = [];
  const persistentOffsets: number[] = [];
  let flightDraws = 0;

  drawSceneCopies(
    { x: HOLLOW.width + 1, y: 0, width: 200, height: CONSTANTS.fieldHeight },
    HOLLOW.width,
    true,
    70,
    {
      drawTerrain: (offset) => terrainOffsets.push(offset),
      drawPersistent: (offset) => persistentOffsets.push(offset),
      drawFlight: () => { flightDraws++; },
    },
  );

  expect(terrainOffsets).toEqual([HOLLOW.width]);
  expect(persistentOffsets).toEqual([0, HOLLOW.width]);
  expect(flightDraws).toBe(1);
});

test('draws a seam-crossing trail as one continuous unbounded polyline', () => {
  const path: Array<readonly [string, number, number]> = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo(x: number, y: number) { path.push(['moveTo', x, y]); },
    lineTo(x: number, y: number) { path.push(['lineTo', x, y]); },
    stroke() {},
    setLineDash() {},
  } as unknown as CanvasRenderingContext2D;
  const trail = [{ x: 1100, y: 180 }, { x: 1210, y: 170 }, { x: 1300, y: 190 }];
  const state = {
    tanks: [
      { player: 0, trails: [trail] },
      { player: 1, trails: [] },
    ],
    projectiles: [],
  } as unknown as GameState;

  drawFlightEntities(ctx, state);

  expect(path).toEqual([
    ['moveTo', 1100, 180],
    ['lineTo', 1210, 170],
    ['lineTo', 1300, 190],
  ]);
});
