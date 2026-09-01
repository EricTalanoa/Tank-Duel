import raw from '../../spec/generators.json';
import { launchProjectile, stepProjectile } from './ballistics';
import { CONSTANTS } from './constants';
import { HE_SHELL } from './shells';
import { createRng, hashSeed } from './rng';
import { createTerrain, generate, solidAt, surfaceY, type Terrain } from './terrain';
import { resolveGeneratorId, type GeneratorId } from './generators';
import { effectiveMassFor } from './worldValidation';
import type { WorldPhysics } from './worlds';

export interface TerrainValidationResult {
  readonly accepted: boolean;
  readonly leftFlat: boolean;
  readonly rightFlat: boolean;
  readonly leftSolution: boolean;
  readonly rightSolution: boolean;
}

export interface TerrainCandidate { readonly terrain: Terrain; readonly seed: number; readonly rngState?: number }
export interface AcceptedTerrain {
  readonly terrain: Terrain;
  readonly acceptedSeed: number;
  readonly rngState?: number;
  readonly attempts: number;
  readonly usedFallback: boolean;
}

export function generateTerrainCandidate(
  world: WorldPhysics,
  generatorId: GeneratorId,
  seed: number,
  height: number,
  width = world.width,
): TerrainCandidate {
  const resolvedGeneratorId = resolveGeneratorId(generatorId, world.generator);
  const terrain = createTerrain(width, height);
  const rng = createRng(seed);
  generate(terrain, resolvedGeneratorId, rng);
  return { terrain, seed: seed >>> 0, rngState: rng.getState() };
}

export interface GenerateAcceptedTerrainOptions {
  readonly world: WorldPhysics;
  readonly generatorId: GeneratorId;
  readonly requestedSeed: number;
  readonly height: number;
  readonly width?: number;
}

export function generateAcceptedTerrain(options: GenerateAcceptedTerrainOptions): AcceptedTerrain {
  const width = options.width ?? options.world.width;
  const generatorId = resolveGeneratorId(options.generatorId, options.world.generator);
  const candidates: TerrainCandidate[] = [];
  for (let attempt = 0; attempt < raw.validation.maxAttempts; attempt++) {
    const seed = attempt === 0
      ? options.requestedSeed >>> 0
      : hashSeed(`${options.requestedSeed >>> 0}:${attempt}`);
    candidates.push(generateTerrainCandidate(options.world, generatorId, seed, options.height, width));
  }
  const key = `${options.world.id}:${generatorId}`;
  const fallbackSeed = (raw.validation.fallbackSeeds as Readonly<Record<string, number>>)[key];
  if (fallbackSeed === undefined) throw new Error(`Missing fallback seed for ${key} in spec/generators.json`);
  const fallback = generateTerrainCandidate(options.world, generatorId, fallbackSeed, options.height, width);
  return selectAcceptedTerrain(options.world, candidates, fallback);
}

export function selectAcceptedTerrain(
  world: WorldPhysics,
  candidates: readonly TerrainCandidate[],
  fallback: TerrainCandidate,
): AcceptedTerrain {
  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index] as TerrainCandidate;
    if (validateTerrain(candidate.terrain, world).accepted) {
      return { terrain: candidate.terrain, acceptedSeed: candidate.seed, ...(candidate.rngState === undefined ? {} : { rngState: candidate.rngState }), attempts: index + 1, usedFallback: false };
    }
  }
  if (!validateTerrain(fallback.terrain, world).accepted) {
    throw new Error(`Known-good fallback seed ${fallback.seed} failed validation for ${world.id}`);
  }
  return { terrain: fallback.terrain, acceptedSeed: fallback.seed, ...(fallback.rngState === undefined ? {} : { rngState: fallback.rngState }), attempts: candidates.length, usedFallback: true };
}

export function validateSpawnFlatness(terrain: Terrain, spawnX: number): boolean {
  const half = raw.validation.spawnSampleWidthPx / 2;
  const first = Math.max(0, Math.ceil(spawnX - half));
  const last = Math.min(terrain.width - 1, Math.floor(spawnX + half));
  let minimum = terrain.height;
  let maximum = 0;
  for (let x = first; x <= last; x++) {
    const y = surfaceY(terrain, x);
    minimum = Math.min(minimum, y);
    maximum = Math.max(maximum, y);
  }
  return maximum - minimum <= raw.validation.spawnFlatnessTolerancePx;
}

export function hasHeSolution(
  terrain: Terrain,
  world: WorldPhysics,
  fromX: number,
  targetX: number,
  direction: -1 | 1,
): boolean {
  const angle = raw.validation.testAngleDeg * Math.PI / 180;
  const pivotY = surfaceY(terrain, fromX) - 1 + CONSTANTS.tank.turretPivotY;
  for (let power = CONSTANTS.power.min; power <= CONSTANTS.power.max; power += CONSTANTS.power.fineStep) {
    const projectile = launchProjectile({
      x: fromX + Math.cos(angle) * CONSTANTS.tank.muzzleOffset * direction,
      y: pivotY - Math.sin(angle) * CONSTANTS.tank.muzzleOffset,
      angleDeg: raw.validation.testAngleDeg,
      power,
      direction,
      shell: HE_SHELL,
      owner: 0,
      effectiveMass: effectiveMassFor(world, HE_SHELL),
    });
    for (let frame = 0; frame < 10_000; frame++) {
      if (stepProjectile(projectile, { world, wind: 0, solidAt: (x, y) => solidAt(terrain, x, y) }).hit) {
        if (Math.abs(projectile.x - targetX) <= HE_SHELL.blastRadius) return true;
        break;
      }
      if (projectile.x < -terrain.width || projectile.x > terrain.width * 2) break;
    }
  }
  return false;
}

export function validateTerrain(terrain: Terrain, world: WorldPhysics): TerrainValidationResult {
  const leftX = CONSTANTS.spawnInsetPx;
  const rightX = terrain.width - CONSTANTS.spawnInsetPx;
  const leftFlat = validateSpawnFlatness(terrain, leftX);
  const rightFlat = validateSpawnFlatness(terrain, rightX);
  const leftSolution = leftFlat && rightFlat && hasHeSolution(terrain, world, leftX, rightX, 1);
  const rightSolution = leftFlat && rightFlat && hasHeSolution(terrain, world, rightX, leftX, -1);
  return {
    accepted: leftFlat && rightFlat && leftSolution && rightSolution,
    leftFlat,
    rightFlat,
    leftSolution,
    rightSolution,
  };
}
