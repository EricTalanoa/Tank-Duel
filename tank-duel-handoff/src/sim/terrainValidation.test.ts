import { describe, expect, test } from 'vitest';
import raw from '../../spec/generators.json';
import { CONSTANTS } from './constants';
import { createTerrain, fillFromHeightmap } from './terrain';
import { HOLLOW, TERRA } from './worlds';
import { generateAcceptedTerrain, generateTerrainCandidate, hasHeSolution, selectAcceptedTerrain, validateSpawnFlatness, validateTerrain } from './terrainValidation';
import { SHIPPED_GENERATORS } from './generators';
import { SHIPPED_WORLDS } from './worlds';

function terrainFromSurface(width: number, height: number, fn: (x: number) => number) {
  const terrain = createTerrain(width, height);
  fillFromHeightmap(terrain, Float32Array.from({ length: width }, (_, x) => fn(x)));
  return terrain;
}

function firstDiff(left: Uint8Array, right: Uint8Array): number {
  if (left.length !== right.length) return -2;
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return index;
  return -1;
}

describe('terrain validation', () => {
  test('spawn flatness accepts the configured tolerance and rejects one pixel more', () => {
    const spawn = CONSTANTS.spawnInsetPx;
    const passing = terrainFromSurface(TERRA.width, 560, (x) => x === spawn
      ? 400 : 400 + raw.validation.spawnFlatnessTolerancePx);
    const failing = terrainFromSurface(TERRA.width, 560, (x) => x === spawn
      ? 400 : 401 + raw.validation.spawnFlatnessTolerancePx);
    expect(validateSpawnFlatness(passing, spawn)).toBe(true);
    expect(validateSpawnFlatness(failing, spawn)).toBe(false);
  });

  test('real 45-degree HE simulation reaches across flat terrain', () => {
    const terrain = terrainFromSurface(TERRA.width, 560, () => 500);
    expect(hasHeSolution(terrain, TERRA, CONSTANTS.spawnInsetPx, TERRA.width - CONSTANTS.spawnInsetPx, 1)).toBe(true);
    expect(hasHeSolution(terrain, TERRA, TERRA.width - CONSTANTS.spawnInsetPx, CONSTANTS.spawnInsetPx, -1)).toBe(true);
    expect(validateTerrain(terrain, TERRA).accepted).toBe(true);
  });

  test('rejects a map whose central wall blocks 45-degree HE shots', () => {
    const terrain = terrainFromSurface(TERRA.width, 560, (x) => x > 470 && x < 530 ? 80 : 500);
    expect(validateTerrain(terrain, TERRA).accepted).toBe(false);
  });

  test('regenerates a blocked map and accepts the next valid candidate', () => {
    const blocked = terrainFromSurface(TERRA.width, 560, (x) => x > 470 && x < 530 ? 80 : 500);
    const flat = terrainFromSurface(TERRA.width, 560, () => 500);
    const result = selectAcceptedTerrain(TERRA, [{ terrain: blocked, seed: 1 }, { terrain: flat, seed: 2 }], { terrain: flat, seed: 3 });
    expect(result).toMatchObject({ acceptedSeed: 2, attempts: 2, usedFallback: false });
  });

  test('generates byte-identical candidates from the same generator and seed', () => {
    const first = generateTerrainCandidate(TERRA, 'hills', 1597, 560);
    const second = generateTerrainCandidate(TERRA, 'hills', 1597, 560);
    expect(firstDiff(first.terrain.mask, second.terrain.mask)).toBe(-1);
  });

  test('uses Ring when a wrapping world receives a non-seamless generator override', () => {
    const overridden = generateTerrainCandidate(HOLLOW, 'plates', 1597, 560);
    const ring = generateTerrainCandidate(HOLLOW, 'ring', 1597, 560);
    expect(firstDiff(overridden.terrain.mask, ring.terrain.mask)).toBe(-1);
  });

  test('Hollow Ring fallback seed passes the real validator', () => {
    const fallbackSeed = (raw.validation.fallbackSeeds as Record<string, number>)['hollow:ring'];
    if (fallbackSeed === undefined) throw new Error('Missing hollow:ring fallback seed');
    const fallback = generateTerrainCandidate(HOLLOW, 'ring', fallbackSeed, CONSTANTS.fieldHeight);
    expect(Number.isInteger(fallbackSeed)).toBe(true);
    expect(validateTerrain(fallback.terrain, HOLLOW).accepted).toBe(true);
  });

  test.each(SHIPPED_WORLDS.flatMap((world) => SHIPPED_GENERATORS.map((generator) => [world, generator] as const)))('$0.id with $1 produces accepted terrain', (world, generator) => {
    const result = generateAcceptedTerrain({ world, generatorId: generator, requestedSeed: 0x51ee7, height: 560 });
    expect(validateTerrain(result.terrain, world).accepted).toBe(true);
  });
});
