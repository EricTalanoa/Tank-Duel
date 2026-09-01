import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONSTANTS, MUZZLE_COEFFICIENT, SUBSTEPS, SIM_HZ } from './constants';

/**
 * Guards the "read the spec, don't retype it" rule: these read the JSON off disk at test
 * time and compare it with what the module exposes, so a value that gets copied into code
 * and then drifts from spec/ fails here rather than silently invalidating test-vectors.json.
 */
const spec = JSON.parse(readFileSync(new URL('../../spec/constants.json', import.meta.url), 'utf8'));

describe('constants', () => {
  it('is the spec file, not a copy of it', () => {
    expect(CONSTANTS).toEqual(spec);
  });

  it('re-exports the hot values unchanged', () => {
    expect(MUZZLE_COEFFICIENT).toBe(spec.muzzleCoefficient);
    expect(SUBSTEPS).toBe(spec.substeps);
    expect(SIM_HZ).toBe(spec.simHz);
  });

  it('keeps wind well under gravity — the 35x wind bug is the trap this catches', () => {
    // CLAUDE.md: horizontal accel at max wind is roughly a sixth of gravity. The tuned
    // value sits at gravity / 5.66; the bug had it at six times gravity.
    const maxWindAccel = spec.windCoefficient * 100;
    expect(spec.baseGravity / maxWindAccel).toBeGreaterThan(5);
  });
});
