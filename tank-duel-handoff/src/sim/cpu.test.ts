import { describe, expect, it } from 'vitest';
import rawCpuSpec from '../../spec/cpu.json';
import { deriveTerraCpuGains } from './ballisticsMeasurements';
import { createRng } from './rng';
import {
  CPU_RULES,
  CPU_TIERS,
  chooseCpuCommand,
  createCpuMemory,
  cpuTierById,
  observeCpuImpact,
  parseCpuSpec,
} from './cpu';

function specFixture(): Record<string, unknown> {
  return structuredClone(rawCpuSpec) as Record<string, unknown>;
}

describe('CPU registry', () => {
  it('catches a registry implementation that reorders or renames the advertised CPU tiers', () => {
    expect(CPU_TIERS.map(({ id, name }) => [id, name])).toEqual([
      ['recruit', 'Recruit'],
      ['gunner', 'Gunner'],
      ['veteran', 'Veteran'],
    ]);
    expect(cpuTierById('gunner')).toMatchObject({ id: 'gunner', name: 'Gunner' });
    expect(cpuTierById('unknown')).toBeNull();
  });

  it('catches a registry implementation that exposes mutable tier or rule records', () => {
    expect(Object.isFrozen(CPU_TIERS)).toBe(true);
    expect(Object.isFrozen(CPU_TIERS[0])).toBe(true);
    expect(Object.isFrozen(CPU_RULES)).toBe(true);
  });

  it('catches a parser implementation that does not consume the checked-in numeric registry values', () => {
    expect(CPU_RULES).toMatchObject({
      rangePerPowerPoint: 17.8,
      driftPerWindUnit: 1.15,
      hitDistancePx: 30,
      minPower: 15,
      maxPower: 100,
      openingElevationDeg: 45,
    });
    expect(CPU_TIERS).toHaveLength(3);
    expect(CPU_TIERS.every((tier) => (
      Number.isFinite(tier.jitter)
      && tier.jitter >= 0
      && tier.jitter <= 1
      && Number.isFinite(tier.windSkill)
      && tier.windSkill >= 0
      && tier.windSkill <= 1
      && Number.isFinite(tier.measuredMeanShotsToHit)
      && tier.measuredMeanShotsToHit > 0
    ))).toBe(true);
  });

  it('catches stale derived gains after a production range or wind-physics change', () => {
    const measured = deriveTerraCpuGains();
    // The centered samples span enough of the 75-power reference region to average the
    // fixed-substep landing quantization, while 0.05 px/unit is 10x tighter than Task 12's
    // ±0.5 statistical-acceptance tolerance.
    const tolerancePxPerUnit = 0.05;

    expect(Math.abs(CPU_RULES.rangePerPowerPoint - measured.rangePerPowerPoint))
      .toBeLessThanOrEqual(tolerancePxPerUnit);
    expect(Math.abs(CPU_RULES.driftPerWindUnit - measured.driftPerWindUnit))
      .toBeLessThanOrEqual(tolerancePxPerUnit);
  });

  it('catches a parser implementation that accepts missing or extra root keys', () => {
    const missing = specFixture();
    delete missing.hitDefinition;
    expect(() => parseCpuSpec(missing)).toThrow(/hitDefinition/i);

    const extra = specFixture();
    extra.unapproved = true;
    expect(() => parseCpuSpec(extra)).toThrow(/root|unapproved/i);
  });

  it('catches a parser implementation that accepts the wrong algorithm operation order', () => {
    const fixture = specFixture();
    const algorithm = fixture.algorithm as string[];
    fixture.algorithm = [algorithm[1]!, algorithm[0]!, algorithm[2]!, algorithm[3]!];
    expect(() => parseCpuSpec(fixture)).toThrow(/algorithm/i);
  });

  it('catches a parser implementation that accepts duplicate or reordered tier IDs', () => {
    const duplicate = specFixture();
    const duplicateTiers = duplicate.tiers as Array<Record<string, unknown>>;
    duplicateTiers[1]!.id = 'recruit';
    expect(() => parseCpuSpec(duplicate)).toThrow(/tier|id/i);

    const reordered = specFixture();
    const reorderedTiers = reordered.tiers as Array<Record<string, unknown>>;
    reordered.tiers = [reorderedTiers[1]!, reorderedTiers[0]!, reorderedTiers[2]!];
    expect(() => parseCpuSpec(reordered)).toThrow(/tier|id/i);
  });

  it('catches a parser implementation that accepts invalid tier names, ranges, or non-finite values', () => {
    const invalidName = specFixture();
    ((invalidName.tiers as Array<Record<string, unknown>>)[0]!).name = 'Cadet';
    expect(() => parseCpuSpec(invalidName)).toThrow(/tier|name/i);

    const invalidJitter = specFixture();
    ((invalidJitter.tiers as Array<Record<string, unknown>>)[0]!).jitter = 1.1;
    expect(() => parseCpuSpec(invalidJitter)).toThrow(/jitter/i);

    const nonFiniteGain = specFixture();
    ((nonFiniteGain.derivedGains as Record<string, unknown>).rangePerPowerPoint) = Infinity;
    expect(() => parseCpuSpec(nonFiniteGain)).toThrow(/rangePerPowerPoint/i);
  });

  it('catches a parser implementation that accepts malformed measured records or hit/clamp/elevation definitions', () => {
    const malformedMeasured = specFixture();
    delete ((malformedMeasured.tiers as Array<Record<string, unknown>>)[0]!.measured as Record<string, unknown>).failedIn15;
    expect(() => parseCpuSpec(malformedMeasured)).toThrow(/measured|failedIn15/i);

    const malformedHit = specFixture();
    malformedHit.hitDefinition = 'impact close enough';
    expect(() => parseCpuSpec(malformedHit)).toThrow(/hitDefinition/i);

    const malformedClamp = specFixture();
    const clampAlgorithm = malformedClamp.algorithm as string[];
    clampAlgorithm[3] = 'Clamp power to 100..15, then apply the tier\'s jitter.';
    expect(() => parseCpuSpec(malformedClamp)).toThrow(/algorithm|clamp/i);

    const malformedElevation = specFixture();
    const elevationAlgorithm = malformedElevation.algorithm as string[];
    elevationAlgorithm[0] = 'Opening shot: power = sqrt(distance * baseGravity) / muzzleCoefficient, elevation fixed at 0.';
    expect(() => parseCpuSpec(malformedElevation)).toThrow(/algorithm|elevation/i);
  });
});

describe('CPU bracketing commands', () => {
  it('catches an opening-command implementation that does not use the published formula and elevation', () => {
    const command = chooseCpuCommand({
      tierId: 'recruit',
      memory: createCpuMemory(),
      distance: 700,
      targetX: 800,
      direction: -1,
      wind: 100,
      rng: createRng(12),
    });

    expect(command).toEqual({ elevationDeg: 45, power: 76.6740259149081 });
    expect(Object.isFrozen(command)).toBe(true);
  });

  it('catches a correction implementation that reverses the positive-is-short firing-direction sign', () => {
    const memory = Object.freeze({ lastImpactX: 700, lastWind: 0, lastAppliedPower: 50 });
    const command = chooseCpuCommand({
      tierId: 'recruit',
      memory,
      distance: 1,
      targetX: 800,
      direction: 1,
      wind: 0,
      rng: createRng(12),
    });

    expect(command.power).toBeCloseTo(52.55449691838114, 12);
    expect(memory).toEqual({ lastImpactX: 700, lastWind: 0, lastAppliedPower: 50 });
  });

  it('catches an implementation that gives Recruit a wind correction', () => {
    const memory = Object.freeze({ lastImpactX: 800, lastWind: 20, lastAppliedPower: 50 });
    const calm = chooseCpuCommand({
      tierId: 'recruit', memory, distance: 1, targetX: 800, direction: 1, wind: 20, rng: createRng(12),
    });
    const windy = chooseCpuCommand({
      tierId: 'recruit', memory, distance: 1, targetX: 800, direction: 1, wind: 100, rng: createRng(12),
    });

    expect(windy).toEqual(calm);
  });

  it('catches an implementation that omits Veteran’s full wind-delta correction', () => {
    const command = chooseCpuCommand({
      tierId: 'veteran',
      memory: Object.freeze({ lastImpactX: 800, lastWind: 20, lastAppliedPower: 50 }),
      distance: 1,
      targetX: 800,
      direction: 1,
      wind: 100,
      rng: createRng(12),
    });

    expect(command.power).toBeCloseTo(44.54653555451306, 12);
  });

  it('catches an implementation that jitters before clamping', () => {
    const command = chooseCpuCommand({
      tierId: 'veteran',
      memory: Object.freeze({ lastImpactX: -1000, lastWind: 0, lastAppliedPower: 99 }),
      distance: 1,
      targetX: 1000,
      direction: 1,
      wind: 0,
      rng: createRng(12),
    });

    expect(command.power).toBeCloseTo(99.36445274064317, 12);
  });

  it('catches an implementation that uses unseeded randomness', () => {
    const options = {
      tierId: 'gunner' as const,
      memory: Object.freeze({ lastImpactX: 750, lastWind: -10, lastAppliedPower: 60 }),
      distance: 1,
      targetX: 800,
      direction: 1 as const,
      wind: 30,
    };

    expect(chooseCpuCommand({ ...options, rng: createRng(99) }))
      .toEqual(chooseCpuCommand({ ...options, rng: createRng(99) }));
  });

  it('catches an observation implementation that mutates memory or drops the actual applied command power', () => {
    const memory = createCpuMemory();
    const command = Object.freeze({ elevationDeg: 45, power: 62.5 });
    const observed = observeCpuImpact(memory, command, 743, -35);

    expect(memory).toEqual({ lastImpactX: null, lastWind: null, lastAppliedPower: null });
    expect(observed).toEqual({ lastImpactX: 743, lastWind: -35, lastAppliedPower: 62.5 });
    expect(Object.isFrozen(memory)).toBe(true);
    expect(Object.isFrozen(observed)).toBe(true);
  });
});
