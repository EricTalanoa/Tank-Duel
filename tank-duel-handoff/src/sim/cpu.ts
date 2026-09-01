import rawCpuSpec from '../../spec/cpu.json';
import { CONSTANTS } from './constants';
import type { Rng } from './rng';

export type CpuTierId = 'recruit' | 'gunner' | 'veteran';

export interface CpuTier {
  readonly id: CpuTierId;
  readonly name: string;
  readonly jitter: number;
  readonly windSkill: number;
  readonly measuredMedianShotsToHit: number;
  readonly measuredMeanShotsToHit: number;
  readonly measuredFailedIn15: string;
}

export interface CpuRules {
  readonly rangePerPowerPoint: number;
  readonly driftPerWindUnit: number;
  readonly hitDistancePx: number;
  readonly minPower: number;
  readonly maxPower: number;
  readonly openingElevationDeg: number;
}

export interface ParsedCpuSpec {
  readonly tiers: readonly CpuTier[];
  readonly rules: CpuRules;
}

export interface CpuMemory {
  readonly lastImpactX: number | null;
  readonly lastWind: number | null;
  readonly lastAppliedPower: number | null;
}

export type CpuObservation = CpuMemory;

export interface CpuCommand {
  readonly elevationDeg: number;
  readonly power: number;
}

interface CompleteCpuMemory extends CpuMemory {
  readonly lastImpactX: number;
  readonly lastWind: number;
  readonly lastAppliedPower: number;
}

export interface ChooseCpuCommandOptions {
  readonly tierId: CpuTierId;
  readonly memory: CpuMemory;
  readonly distance: number;
  readonly targetX: number;
  readonly direction: -1 | 1;
  readonly wind: number;
  readonly rng: Rng;
}

const TIER_IDENTITIES: readonly (readonly [CpuTierId, string])[] = Object.freeze([
  Object.freeze(['recruit', 'Recruit'] as const),
  Object.freeze(['gunner', 'Gunner'] as const),
  Object.freeze(['veteran', 'Veteran'] as const),
]);

const OPENING_ALGORITHM = /^Opening shot: power = sqrt\(distance \* baseGravity\) \/ muzzleCoefficient, elevation fixed at (\d+(?:\.\d+)?)\.$/;
const CORRECTION_ALGORITHM = /^Every shot after: power \+= error \* \(1 \/ rangePerPowerPoint\) \+ \(wind - lastWind\) \* \(-driftPerWindUnit \/ rangePerPowerPoint\) \* dir \* windSkill$/;
const ERROR_ALGORITHM = /^error = \(targetX - lastImpactX\) \* dir, positive meaning the shot fell short\.$/;
const CLAMP_ALGORITHM = /^Clamp power to (\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?), then apply the tier's jitter\.$/;
const HIT_DEFINITION = /^impact within (\d+(?:\.\d+)?) px of the target tank$/;

function fail(path: string, message: string): never {
  throw new Error(`Invalid CPU spec ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(path, `must contain exactly ${expected.join(', ')}`);
  }
}

function finiteNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(path, `must be a finite number in ${minimum}..${maximum}`);
  }
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(path, 'must be a non-empty string');
  return value;
}

function parseMeasured(value: unknown, path: string): Pick<CpuTier, 'measuredMedianShotsToHit' | 'measuredMeanShotsToHit' | 'measuredFailedIn15'> {
  const measured = record(value, path);
  exactKeys(measured, ['medianShotsToHit', 'meanShotsToHit', 'failedIn15'], path);
  const median = finiteNumber(measured.medianShotsToHit, `${path}.medianShotsToHit`, 1, 15);
  if (!Number.isInteger(median)) fail(`${path}.medianShotsToHit`, 'must be an integer');
  const mean = finiteNumber(measured.meanShotsToHit, `${path}.meanShotsToHit`, median, 15);
  const failed = nonEmptyString(measured.failedIn15, `${path}.failedIn15`);
  const failureMatch = /^(\d+)\/(\d+)$/.exec(failed);
  if (!failureMatch || failureMatch[2] !== '500' || Number(failureMatch[1]) > 500) {
    fail(`${path}.failedIn15`, 'must be a failure count over 500 trials');
  }
  return Object.freeze({
    measuredMedianShotsToHit: median,
    measuredMeanShotsToHit: mean,
    measuredFailedIn15: failed,
  });
}

function parseTiers(value: unknown): readonly CpuTier[] {
  if (!Array.isArray(value) || value.length !== TIER_IDENTITIES.length) fail('tiers', 'must contain exactly three tiers');
  const tiers = value.map((entry, index) => {
    const tier = record(entry, `tiers[${index}]`);
    exactKeys(tier, ['id', 'name', 'jitter', 'windSkill', 'measured'], `tiers[${index}]`);
    const [id, name] = TIER_IDENTITIES[index]!;
    if (tier.id !== id || tier.name !== name) fail(`tiers[${index}]`, `must be ${id}/${name}`);
    return Object.freeze({
      id,
      name,
      jitter: finiteNumber(tier.jitter, `tiers[${index}].jitter`, 0, 1),
      windSkill: finiteNumber(tier.windSkill, `tiers[${index}].windSkill`, 0, 1),
      ...parseMeasured(tier.measured, `tiers[${index}].measured`),
    });
  });
  return Object.freeze(tiers);
}

function parseRules(value: Record<string, unknown>): CpuRules {
  const algorithm = value.algorithm;
  if (!Array.isArray(algorithm) || algorithm.length !== 4 || algorithm.some((entry) => typeof entry !== 'string')) {
    fail('algorithm', 'must contain the four supported operation records');
  }
  const opening = OPENING_ALGORITHM.exec(algorithm[0]!);
  if (!opening || !CORRECTION_ALGORITHM.test(algorithm[1]!) || !ERROR_ALGORITHM.test(algorithm[2]!)) {
    fail('algorithm', 'must preserve the published operation order');
  }
  const clamp = CLAMP_ALGORITHM.exec(algorithm[3]!);
  if (!clamp) fail('algorithm', 'must end with the published clamp-before-jitter operation');

  const gains = record(value.derivedGains, 'derivedGains');
  exactKeys(gains, ['rangePerPowerPoint', 'driftPerWindUnit', '$comment'], 'derivedGains');
  nonEmptyString(gains.$comment, 'derivedGains.$comment');
  const hit = HIT_DEFINITION.exec(nonEmptyString(value.hitDefinition, 'hitDefinition'));
  if (!hit) fail('hitDefinition', 'must declare a pixel distance from the target tank');

  const openingElevationDeg = finiteNumber(Number(opening[1]), 'algorithm opening elevation', 1, 90);
  const minPower = finiteNumber(Number(clamp[1]), 'algorithm clamp minimum', 0, Number.MAX_VALUE);
  const maxPower = finiteNumber(Number(clamp[2]), 'algorithm clamp maximum', minPower, Number.MAX_VALUE);
  if (minPower === maxPower) fail('algorithm clamp', 'minimum must be lower than maximum');

  return Object.freeze({
    rangePerPowerPoint: finiteNumber(gains.rangePerPowerPoint, 'derivedGains.rangePerPowerPoint', Number.MIN_VALUE, Number.MAX_VALUE),
    driftPerWindUnit: finiteNumber(gains.driftPerWindUnit, 'derivedGains.driftPerWindUnit', Number.MIN_VALUE, Number.MAX_VALUE),
    hitDistancePx: finiteNumber(Number(hit[1]), 'hitDefinition distance', Number.MIN_VALUE, Number.MAX_VALUE),
    minPower,
    maxPower,
    openingElevationDeg,
  });
}

export function parseCpuSpec(value: unknown): ParsedCpuSpec {
  const spec = record(value, 'root');
  exactKeys(spec, ['$comment', 'algorithm', 'derivedGains', 'tiers', 'hitDefinition', '$warning'], 'root');
  nonEmptyString(spec.$comment, '$comment');
  nonEmptyString(spec.$warning, '$warning');
  return Object.freeze({
    tiers: parseTiers(spec.tiers),
    rules: parseRules(spec),
  });
}

const PARSED_CPU_SPEC = parseCpuSpec(rawCpuSpec);

export const CPU_TIERS: readonly CpuTier[] = PARSED_CPU_SPEC.tiers;
export const CPU_RULES: CpuRules = PARSED_CPU_SPEC.rules;

export function cpuTierById(id: string): CpuTier | null {
  return CPU_TIERS.find((tier) => tier.id === id) ?? null;
}

export function createCpuMemory(): CpuMemory {
  return Object.freeze({
    lastImpactX: null,
    lastWind: null,
    lastAppliedPower: null,
  });
}

function memoryIsComplete(memory: CpuMemory): memory is CompleteCpuMemory {
  return memory.lastImpactX !== null && memory.lastWind !== null && memory.lastAppliedPower !== null;
}

function finite(value: number, path: string): void {
  if (!Number.isFinite(value)) throw new Error(`${path} must be finite`);
}

export function observeCpuImpact(
  memory: CpuMemory,
  command: CpuCommand,
  impactX: number,
  wind: number,
): CpuMemory {
  if (!memoryIsComplete(memory) && (memory.lastImpactX !== null || memory.lastWind !== null || memory.lastAppliedPower !== null)) {
    throw new Error('CPU memory must be empty or complete');
  }
  finite(command.power, 'CPU command power');
  finite(impactX, 'CPU impact x');
  finite(wind, 'CPU impact wind');
  return Object.freeze({
    lastImpactX: impactX,
    lastWind: wind,
    lastAppliedPower: command.power,
  });
}

export function chooseCpuCommand(options: ChooseCpuCommandOptions): CpuCommand {
  const tier = cpuTierById(options.tierId);
  if (!tier) throw new Error(`Unknown CPU tier: ${options.tierId}`);
  finite(options.distance, 'CPU opening distance');
  finite(options.targetX, 'CPU target x');
  finite(options.wind, 'CPU wind');

  if (!memoryIsComplete(options.memory)) {
    if (options.memory.lastImpactX !== null || options.memory.lastWind !== null || options.memory.lastAppliedPower !== null) {
      throw new Error('CPU memory must be empty or complete');
    }
    return Object.freeze({
      elevationDeg: CPU_RULES.openingElevationDeg,
      power: Math.sqrt(options.distance * CONSTANTS.baseGravity) / CONSTANTS.muzzleCoefficient,
    });
  }

  const observedError = (options.targetX - options.memory.lastImpactX) * options.direction;
  const windDelta = options.wind - options.memory.lastWind;
  const correctedPower = options.memory.lastAppliedPower
    + observedError * (1 / CPU_RULES.rangePerPowerPoint)
    + windDelta * (-CPU_RULES.driftPerWindUnit / CPU_RULES.rangePerPowerPoint) * options.direction * tier.windSkill;
  const clampedPower = Math.min(CPU_RULES.maxPower, Math.max(CPU_RULES.minPower, correctedPower));
  const jitteredPower = clampedPower * (1 + options.rng.range(-tier.jitter, tier.jitter));

  return Object.freeze({
    elevationDeg: CPU_RULES.openingElevationDeg,
    power: jitteredPower,
  });
}
