# Task 2 brief — owned resolved impacts and CPU trial harness

Implement Task 2 from the approved Task 12 plan using strict TDD.

## Authority and ruling

- Read the approved Task 12 design, `spec/cpu.json`, current `src/sim/cpu.ts`, and
  `src/sim/ballisticsMeasurements.ts`.
- Production gains remain exactly spec-owned and must never be tuned to the trial output.
- Ruling: use real seeded match spawn geometry, production HE ballistics, and production wind
  sequencing. The reference trial distribution is absent from `spec/cpu.json`; if those published
  means cannot be reproduced, report the exact mismatch/missing assumption instead of changing
  spec/golden data or inventing gains.
- Never edit `spec/test-vectors.json`; keep all code pure under `src/sim/`; no DOM/Canvas/UI/render,
  `Math.random`, or alternate true-solution solver.

## Files and interfaces

- Modify `src/sim/world.ts` and `src/sim/world.test.ts`.
- Create `src/sim/cpuTrials.ts` and `src/sim/cpuTrials.test.ts`.
- Modify only directly exposed projectile/impact fixtures.
- Produce frozen `ResolvedShotImpact { owner: PlayerIndex; x: number; y: number }` and
  `GameState.lastResolvedShotImpact: ResolvedShotImpact | null`.
- Add owner to pending impacts from `Projectile.owner`; update the last resolved observation only
  after canonical resolution. Owner must not affect physics, damage, terrain, collision, or RNG.
- Produce `runCpuTrial(seed, tierId)` and `measureCpuTier(tierId, trialCount)` using production CPU
  commands and real fixed-step HE ballistics.

## Required TDD behavior

1. Before production changes, add owned-impact tests for both players, resolve timing, canonical x,
   persistence until the next owned shot, and rejection of split/multiple impacts as the HE CPU
   observation; run and record RED.
2. Implement minimal pending/resolved owner metadata and reach GREEN.
3. Before trial implementation, add deterministic trial tests, failure-at-cap accounting, no dropped
   failures, real observation feedback, and the 500-trial means for all parsed tiers; run and record
   RED.
4. Implement the trial harness with production CPU/ballistics only. Each seed uses a deterministic
   legal target geometry/direction/wind sequence; stops at parsed hit distance or published cap.
5. If means do not meet ±0.5, diagnose the reference-assumption gap. Do not tune gains, change
   targets, discard failed trials, or regenerate goldens to force green.

## Verification/report

Run with TEMP/TMP on D:\codex-temp:

`npm test -- --configLoader runner src/sim/cpuTrials.test.ts src/sim/cpu.test.ts src/sim/world.test.ts src/sim/ballistics.test.ts src/sim/purity.test.ts`

Then full suite and `npx tsc --noEmit`. Record all 1,500 trial means/medians/failure counts, RED/GREEN
evidence, failure accounting, impact ownership proof, physics-neutral audit, source-of-truth/golden
hash, changed files, self-review, and concerns in `task-2-report.md`.

Do not initialize Git and do not dispatch subagents.
