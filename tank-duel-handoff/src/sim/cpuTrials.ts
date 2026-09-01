import rawCpuTrialsSpec from '../../spec/cpu-trials.json';
import {
  CPU_RULES,
  CPU_TIERS,
  chooseCpuCommand,
  createCpuMemory,
  cpuTierById,
  observeCpuImpact,
  type CpuCommand,
  type CpuMemory,
  type CpuTierId,
} from './cpu';
import type { PlayerIndex } from './playerLoadouts';
import { HE_SHELL } from './shells';
import {
  createWorld,
  fire,
  step,
  type GameState,
  type ResolvedShotImpact,
} from './world';

const MAX_FRAMES_PER_SHOT = 20_000;

export interface CpuTrialShot {
  readonly command: CpuCommand;
  readonly memoryBefore: CpuMemory;
  readonly wind: number;
  readonly impact: ResolvedShotImpact | null;
}

export interface CpuTrial {
  readonly seed: number;
  readonly tierId: CpuTierId;
  readonly cpuOwner: PlayerIndex;
  readonly shotCap: number;
  readonly shots: readonly CpuTrialShot[];
  readonly hit: boolean;
  readonly failed: boolean;
}

export interface CpuTierMeasurement {
  readonly tierId: CpuTierId;
  readonly trialCount: number;
  readonly trials: readonly CpuTrial[];
  readonly meanShotsToHit: number;
  readonly medianShotsToHit: number;
  readonly failedTrialCount: number;
}

export interface CpuTrialProtocolTier {
  readonly id: CpuTierId;
  readonly meanShotsToHit: number;
  readonly medianShotsToHit: number;
  readonly failedTrialCount: number;
}

export interface CpuTrialProtocol {
  readonly schemaVersion: 1;
  readonly seedRange: { readonly start: number; readonly end: number };
  readonly trialCount: number;
  readonly cpuSeat: {
    readonly strategy: 'seed-parity';
    readonly evenPlayer: PlayerIndex;
    readonly oddPlayer: PlayerIndex;
  };
  readonly world: {
    readonly id: 'terra';
    readonly terrain: 'real-seeded';
    readonly spawns: 'production';
  };
  readonly sequence: {
    readonly wind: 'production';
    readonly handoff: 'production-skip-non-cpu-action';
  };
  readonly shellId: string;
  readonly shotCap: number;
  readonly failureAccounting: 'include-cap-shot';
  readonly tiers: readonly CpuTrialProtocolTier[];
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid CPU trials spec ${path}: ${message}`);
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

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be an integer in ${minimum}..${maximum}`);
  }
  return value;
}

function finite(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(path, `must be a finite number in ${minimum}..${maximum}`);
  }
  return value;
}

function fixedString<T extends string>(value: unknown, path: string, expected: T): T {
  if (value !== expected) fail(path, `must be ${expected}`);
  return expected;
}

function player(value: unknown, path: string): PlayerIndex {
  if (value !== 0 && value !== 1) fail(path, 'must be player 0 or 1');
  return value;
}

function parseTiers(value: unknown, trialCount: number, shotCap: number): readonly CpuTrialProtocolTier[] {
  if (!Array.isArray(value) || value.length !== CPU_TIERS.length) {
    fail('tiers', `must contain exactly ${CPU_TIERS.length} tiers`);
  }
  return Object.freeze(value.map((entry, index) => {
    const tier = record(entry, `tiers[${index}]`);
    exactKeys(tier, ['id', 'meanShotsToHit', 'medianShotsToHit', 'failedTrialCount'], `tiers[${index}]`);
    const historical = CPU_TIERS[index];
    if (!historical || tier.id !== historical.id) fail(`tiers[${index}].id`, `must be ${historical?.id ?? 'known'}`);
    return Object.freeze({
      id: historical.id,
      meanShotsToHit: finite(tier.meanShotsToHit, `tiers[${index}].meanShotsToHit`, 1, shotCap),
      medianShotsToHit: integer(tier.medianShotsToHit, `tiers[${index}].medianShotsToHit`, 1, shotCap),
      failedTrialCount: integer(tier.failedTrialCount, `tiers[${index}].failedTrialCount`, 0, trialCount),
    });
  }));
}

export function parseCpuTrialsSpec(value: unknown): CpuTrialProtocol {
  const spec = record(value, 'root');
  exactKeys(spec, [
    'schemaVersion',
    'seedRange',
    'trialCount',
    'cpuSeat',
    'world',
    'sequence',
    'shellId',
    'shotCap',
    'failureAccounting',
    'tiers',
  ], 'root');
  if (spec.schemaVersion !== 1) fail('schemaVersion', 'must be 1');

  const seedRange = record(spec.seedRange, 'seedRange');
  exactKeys(seedRange, ['start', 'end'], 'seedRange');
  const start = integer(seedRange.start, 'seedRange.start', 0, 0xffffffff);
  const end = integer(seedRange.end, 'seedRange.end', start, 0xffffffff);
  const trialCount = integer(spec.trialCount, 'trialCount', 1, 0xffffffff);
  if (trialCount !== end - start + 1) fail('trialCount', 'must equal the inclusive seed range length');

  const cpuSeat = record(spec.cpuSeat, 'cpuSeat');
  exactKeys(cpuSeat, ['strategy', 'evenPlayer', 'oddPlayer'], 'cpuSeat');
  const evenPlayer = player(cpuSeat.evenPlayer, 'cpuSeat.evenPlayer');
  const oddPlayer = player(cpuSeat.oddPlayer, 'cpuSeat.oddPlayer');
  if (evenPlayer === oddPlayer) fail('cpuSeat', 'must alternate between distinct players');

  const world = record(spec.world, 'world');
  exactKeys(world, ['id', 'terrain', 'spawns'], 'world');
  const sequence = record(spec.sequence, 'sequence');
  exactKeys(sequence, ['wind', 'handoff'], 'sequence');
  const shotCap = integer(spec.shotCap, 'shotCap', 1, 100);

  return Object.freeze({
    schemaVersion: 1,
    seedRange: Object.freeze({ start, end }),
    trialCount,
    cpuSeat: Object.freeze({
      strategy: fixedString(cpuSeat.strategy, 'cpuSeat.strategy', 'seed-parity'),
      evenPlayer,
      oddPlayer,
    }),
    world: Object.freeze({
      id: fixedString(world.id, 'world.id', 'terra'),
      terrain: fixedString(world.terrain, 'world.terrain', 'real-seeded'),
      spawns: fixedString(world.spawns, 'world.spawns', 'production'),
    }),
    sequence: Object.freeze({
      wind: fixedString(sequence.wind, 'sequence.wind', 'production'),
      handoff: fixedString(sequence.handoff, 'sequence.handoff', 'production-skip-non-cpu-action'),
    }),
    shellId: fixedString(spec.shellId, 'shellId', HE_SHELL.id),
    shotCap,
    failureAccounting: fixedString(spec.failureAccounting, 'failureAccounting', 'include-cap-shot'),
    tiers: parseTiers(spec.tiers, trialCount, shotCap),
  });
}

export const CPU_TRIAL_PROTOCOL = parseCpuTrialsSpec(rawCpuTrialsSpec);

function initialCpuOwner(seed: number): PlayerIndex {
  return (seed >>> 0) % 2 === 0
    ? CPU_TRIAL_PROTOCOL.cpuSeat.evenPlayer
    : CPU_TRIAL_PROTOCOL.cpuSeat.oddPlayer;
}

function currentPhase(state: GameState): GameState['phase'] {
  return state.phase;
}

function moveToCpuAim(state: GameState, cpuOwner: PlayerIndex): boolean {
  while (state.phase === 'settle') step(state);
  if (state.phase === 'round_over') return false;

  if (state.phase === 'handoff') step(state);
  if (currentPhase(state) !== 'aim') {
    throw new Error(`CPU trial expected AIM or HANDOFF, received ${currentPhase(state)}`);
  }
  if (state.activePlayer === cpuOwner) return true;

  state.phase = 'handoff';
  step(state);
  if (currentPhase(state) !== 'aim' || state.activePlayer !== cpuOwner) {
    throw new Error('CPU trial could not advance to the CPU player');
  }
  return true;
}

function resolveFiredShot(state: GameState, cpuOwner: PlayerIndex): ResolvedShotImpact | null {
  const previousImpact = state.lastResolvedShotImpact;
  for (let frame = 0; frame < MAX_FRAMES_PER_SHOT && state.phase === 'flight'; frame++) step(state);
  if (state.phase !== 'resolve') {
    throw new Error(`CPU trial flight did not reach resolution within ${MAX_FRAMES_PER_SHOT} frames`);
  }
  step(state);
  const impact = state.lastResolvedShotImpact;
  return impact !== previousImpact && impact?.owner === cpuOwner ? impact : null;
}

function hitTarget(impact: ResolvedShotImpact | null, targetX: number, hitDistancePx: number): boolean {
  return impact !== null && Math.abs(impact.x - targetX) <= hitDistancePx;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const rightMiddle = ordered.length / 2;
  return (ordered[rightMiddle - 1]! + ordered[rightMiddle]!) / 2;
}

export function runCpuTrial(seed: number, tierId: CpuTierId): CpuTrial {
  const tier = cpuTierById(tierId);
  if (!tier) throw new Error(`Unknown CPU tier: ${tierId}`);
  const state = createWorld(seed, { worldId: CPU_TRIAL_PROTOCOL.world.id });
  const cpuOwner = initialCpuOwner(seed);
  const shotCap = CPU_TRIAL_PROTOCOL.shotCap;
  const shots: CpuTrialShot[] = [];
  let memory = createCpuMemory();

  for (let attempt = 0; attempt < shotCap; attempt++) {
    if (!moveToCpuAim(state, cpuOwner)) break;
    const shooter = state.tanks[cpuOwner];
    const target = state.tanks[cpuOwner === 0 ? 1 : 0];
    const targetX = target.x;
    const memoryBefore = memory;
    const wind = state.wind;
    const command = chooseCpuCommand({
      tierId,
      memory,
      distance: Math.abs(targetX - shooter.x),
      targetX,
      direction: shooter.direction,
      wind,
      rng: state.rng,
    });
    state.aim.angleDeg = command.elevationDeg;
    state.aim.power = command.power;
    if (state.arsenals[cpuOwner].selectedShellId !== CPU_TRIAL_PROTOCOL.shellId) {
      throw new Error(`CPU trial requires ${CPU_TRIAL_PROTOCOL.shellId} as the selected shell`);
    }
    if (!fire(state)) throw new Error('CPU trial could not fire HE from AIM');

    const impact = resolveFiredShot(state, cpuOwner);
    shots.push(Object.freeze({ command, memoryBefore, wind, impact }));
    if (hitTarget(impact, targetX, CPU_RULES.hitDistancePx)) {
      return Object.freeze({
        seed: seed >>> 0,
        tierId,
        cpuOwner,
        shotCap,
        shots: Object.freeze(shots),
        hit: true,
        failed: false,
      });
    }
    if (impact) memory = observeCpuImpact(memory, command, impact.x, wind);
  }

  return Object.freeze({
    seed: seed >>> 0,
    tierId,
    cpuOwner,
    shotCap,
    shots: Object.freeze(shots),
    hit: false,
    failed: true,
  });
}

export function measureCpuTier(tierId: CpuTierId, trialCount: number): CpuTierMeasurement {
  if (trialCount !== CPU_TRIAL_PROTOCOL.trialCount) {
    throw new Error(`CPU trial count must be the canonical ${CPU_TRIAL_PROTOCOL.trialCount}`);
  }
  const trials = Array.from(
    { length: trialCount },
    (_, index) => runCpuTrial(CPU_TRIAL_PROTOCOL.seedRange.start + index, tierId),
  );
  const shotCounts = trials.map((trial) => trial.shots.length);
  const failedTrialCount = trials.filter((trial) => trial.failed).length;
  return Object.freeze({
    tierId,
    trialCount,
    trials: Object.freeze(trials),
    meanShotsToHit: shotCounts.reduce((total, count) => total + count, 0) / trialCount,
    medianShotsToHit: median(shotCounts),
    failedTrialCount,
  });
}
