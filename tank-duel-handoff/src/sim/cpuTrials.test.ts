import { describe, expect, it } from 'vitest';
import rawCpuTrialsSpec from '../../spec/cpu-trials.json';
import { cpuTierById, type CpuTierId } from './cpu';
import {
  CPU_TRIAL_PROTOCOL,
  measureCpuTier,
  parseCpuTrialsSpec,
  runCpuTrial,
  type CpuTierMeasurement,
} from './cpuTrials';

const TRIAL_COUNT = CPU_TRIAL_PROTOCOL.trialCount;
const measurements = new Map<CpuTierId, CpuTierMeasurement>();

function measure(tierId: CpuTierId): CpuTierMeasurement {
  const cached = measurements.get(tierId);
  if (cached) return cached;
  const result = measureCpuTier(tierId, TRIAL_COUNT);
  measurements.set(tierId, result);
  return result;
}

describe('CPU trial harness', () => {
  it('strictly parses the canonical protocol and rejects incomplete or mismatched records', () => {
    const missingTopLevel = structuredClone(rawCpuTrialsSpec);
    delete (missingTopLevel as { trialCount?: unknown }).trialCount;

    const additionalTierField = structuredClone(rawCpuTrialsSpec);
    (additionalTierField.tiers[0]! as Record<string, unknown>).extra = true;

    const mismatchedCohort = structuredClone(rawCpuTrialsSpec);
    mismatchedCohort.trialCount--;

    const duplicateSeat = structuredClone(rawCpuTrialsSpec);
    duplicateSeat.cpuSeat.oddPlayer = duplicateSeat.cpuSeat.evenPlayer;

    const malformedAggregate = structuredClone(rawCpuTrialsSpec);
    malformedAggregate.tiers[0]!.meanShotsToHit = Number.NaN;

    expect(CPU_TRIAL_PROTOCOL).toEqual(parseCpuTrialsSpec(rawCpuTrialsSpec));
    expect(() => parseCpuTrialsSpec(missingTopLevel)).toThrow('Invalid CPU trials spec root');
    expect(() => parseCpuTrialsSpec(additionalTierField)).toThrow('Invalid CPU trials spec tiers[0]');
    expect(() => parseCpuTrialsSpec(mismatchedCohort)).toThrow('Invalid CPU trials spec trialCount');
    expect(() => parseCpuTrialsSpec(duplicateSeat)).toThrow('Invalid CPU trials spec cpuSeat');
    expect(() => parseCpuTrialsSpec(malformedAggregate)).toThrow('Invalid CPU trials spec tiers[0].meanShotsToHit');
  });

  it('replays a seeded CPU trial exactly', () => {
    const first = runCpuTrial(0x7a12, 'gunner');
    const second = runCpuTrial(0x7a12, 'gunner');

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.shots)).toBe(true);
  });

  it('feeds each resolved owned impact into the following production CPU command', () => {
    const trial = Array.from({ length: 30 }, (_, seed) => runCpuTrial(seed, 'veteran')).find(
      (candidate) => candidate.shots.length >= 2 && candidate.shots[0]?.impact !== null,
    );
    expect(trial).toBeDefined();
    if (!trial) return;

    const first = trial.shots[0]!;
    const second = trial.shots[1]!;
    expect(first.impact).not.toBeNull();
    expect(second.memoryBefore).toEqual({
      lastImpactX: first.impact!.x,
      lastWind: first.wind,
      lastAppliedPower: first.command.power,
    });
  });

  it('counts every capped failure in the measured population', () => {
    const result = measure('veteran');
    const failures = result.trials.filter((trial) => trial.failed);

    expect(result.trials).toHaveLength(TRIAL_COUNT);
    expect(failures).toHaveLength(result.failedTrialCount);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.every((trial) => trial.shots.length === trial.shotCap)).toBe(true);
    expect(result.meanShotsToHit).toBe(
      result.trials.reduce((total, trial) => total + trial.shots.length, 0) / TRIAL_COUNT,
    );
  }, 30_000);

  it.each(CPU_TRIAL_PROTOCOL.tiers)('reproduces the canonical 500-trial distribution for %s', (tier) => {
    const result = measure(tier.id);
    const historical = cpuTierById(tier.id);
    if (!historical) throw new Error(`Historical CPU tier ${tier.id} is missing`);
    const mismatches: string[] = [];
    if (result.medianShotsToHit !== tier.medianShotsToHit) {
      mismatches.push(`median protocol=${tier.medianShotsToHit} actual=${result.medianShotsToHit}`);
    }
    if (result.failedTrialCount !== tier.failedTrialCount) {
      mismatches.push(`failures protocol=${tier.failedTrialCount} actual=${result.failedTrialCount}`);
    }
    if (result.meanShotsToHit !== tier.meanShotsToHit) {
      mismatches.push(`mean protocol=${tier.meanShotsToHit} actual=${result.meanShotsToHit}`);
    }

    expect(result.trials).toHaveLength(TRIAL_COUNT);
    expect(result.trials[0]?.seed).toBe(CPU_TRIAL_PROTOCOL.seedRange.start);
    expect(result.trials.at(-1)?.seed).toBe(CPU_TRIAL_PROTOCOL.seedRange.end);
    expect(mismatches).toEqual([]);
    expect(result.meanShotsToHit).not.toBe(historical.measuredMeanShotsToHit);
    expect(result.failedTrialCount).not.toBe(Number(historical.measuredFailedIn15.split('/')[0]));
  }, 30_000);
});
