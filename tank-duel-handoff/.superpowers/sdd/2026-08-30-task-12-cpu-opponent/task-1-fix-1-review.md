# Task 1 fix round 1 — scoped independent re-review

## Verdict

**F1: ADDRESSED.** The new consistency check independently measures both CPU gains through the
live Terra/HE projectile path, compares those measurements to parsed `CPU_RULES` only at the test
boundary, and uses a narrow explicit tolerance. No new Critical or Important breakage was found in
this fix round.

## F1 evidence

| Required check | Result | Exact evidence |
| --- | --- | --- |
| Independently derives `rangePerPowerPoint` near its power-75 reference region | PASS | The helper measures flat-ground HE impacts at powers 65 and 85 and divides by their 20-power span: [`src/sim/ballisticsMeasurements.ts:35-42`](../../../src/sim/ballisticsMeasurements.ts). The sample is centered on 75, the reference named by `spec/cpu.json`. |
| Independently derives `driftPerWindUnit` | PASS | The helper measures the same power-75 shot at winds +100 and -100 and divides the displacement by 200: [`src/sim/ballisticsMeasurements.ts:43-46`](../../../src/sim/ballisticsMeasurements.ts). |
| Uses production ballistics/constants, not a CPU-rules mirror | PASS | Measurement imports `launchProjectile`/`stepProjectile`, constants, HE, and Terra only: [`src/sim/ballisticsMeasurements.ts:1-4`](../../../src/sim/ballisticsMeasurements.ts). It runs actual launch/step simulation: [`src/sim/ballisticsMeasurements.ts:11-29`](../../../src/sim/ballisticsMeasurements.ts). `CPU_RULES` appears only in the assertion, not the helper: [`src/sim/cpu.test.ts:58-68`](../../../src/sim/cpu.test.ts). |
| Tolerance is explicit and defensible | PASS | The assertion permits `0.05 px/unit`: [`src/sim/cpu.test.ts:60-68`](../../../src/sim/cpu.test.ts). This accommodates the checked-in rounded gains and fixed-substep landing quantization while leaving only about 0.05 px/unit of stale-physics drift before failure; the fresh measurement assertion passed. |
| Meaningful stale-gain physics change fails visibly | PASS | `stepProjectile` consumes production gravity, wind coefficient, shell drag, substeps, and launch speed: [`src/sim/ballistics.ts:58-65`](../../../src/sim/ballistics.ts), [`src/sim/ballistics.ts:89-108`](../../../src/sim/ballistics.ts). The test compares those live outputs to unchanged spec gains, so a material change to those inputs without recomputing `spec/cpu.json` fails the two assertions at [`src/sim/cpu.test.ts:65-68`](../../../src/sim/cpu.test.ts). |
| No CPU tuning, CPU-spec mutation, or golden mutation | PASS | CPU rules remain parsed from `spec/cpu.json` at [`src/sim/cpu.ts:137-184`](../../../src/sim/cpu.ts); the fix adds the measurement helper and test only. Fresh SHA-256 for `spec/test-vectors.json` is `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`, matching the established baseline. |

## Fresh verification

- Focused CPU/purity/ballistics gate: 3 files, **65/65** tests passed.
- Strict TypeScript: `npx tsc --noEmit` exited 0 with no diagnostics.
- Full suite: 53 files, **442/442** tests passed.

## New Critical/Important breakage

None found.

## Scope note

F2 (left-facing correction coverage) and F3 (negative opening distance) remain deferred Minors,
as directed; they were not re-ranked in this scoped review. No production code was changed by this
review and no subagents were dispatched.
