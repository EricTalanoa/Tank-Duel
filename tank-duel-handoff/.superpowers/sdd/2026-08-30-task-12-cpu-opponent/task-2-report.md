# Task 12 / Task 2 — owned resolved impacts and CPU trials

## Status

**DONE.** Task 2 now has a strict, machine-readable canonical trial protocol. Historical
`spec/cpu.json` remains unchanged and is asserted only as historical metadata; CPU gains were not
tuned and no solver, target, or golden was changed.

## Scope and changed files

- `spec/cpu-trials.json` — new ruling-authorized canonical protocol and 500-trial aggregates.
- `src/sim/cpuTrials.ts` — strict protocol parser plus protocol-driven Terra/cap/cohort/seat/shell
  execution; still uses only production CPU/world behavior.
- `src/sim/cpuTrials.test.ts` — strict parser RED/GREEN, canonical aggregate acceptance, and
  historical-delta assertions.
- `src/sim/world.ts`, `src/sim/world.test.ts` — Task 2 owned resolved-impact state/coverage.
- `src/sim/collapse.test.ts`, `src/sim/presentation.test.ts`, `src/sim/standard-shells.test.ts`,
  `src/sim/turns.test.ts` — only directly exposed `PendingImpact` fixtures gained required owner
  metadata.
- This report.

No existing specification or golden changed, including `spec/cpu.json` and
`spec/test-vectors.json`. This is not a Git repository; Git was not initialized and no subagents
were used.

## Original Task 2 TDD evidence

1. **Owned impact RED:** six new `world.test.ts` tests failed before production changes because
   `lastResolvedShotImpact` and pending-impact owner metadata were absent. **GREEN:** the same
   file passed 36/36 after the minimal metadata path was added.
2. **Trial harness RED:** `cpuTrials.test.ts` failed to import `./cpuTrials` before that module
   existed. **GREEN:** deterministic replay, real owned-impact feedback, and cap-inclusive
   failure accounting passed using the production world pipeline.

The owned-impact tests cover both players, metadata copied from `Projectile.owner`, update only
after canonical resolution, wrapped canonical x, frozen records, persistence, and rejection of a
split/multiple HE-impact batch as CPU feedback.

## Fix round 1 — canonical protocol

### RED

Before creating the new protocol, added strict parser and canonical-aggregate tests and ran:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/sim/cpuTrials.test.ts --testNamePattern "strictly parses"
```

Result: exit 1; the expected RED was `Cannot find module '../../spec/cpu-trials.json'`.

After the first protocol draft, canonical aggregate RED runs exposed an existing cap defect: the
old harness parsed `70/500` as a 500-shot cap (the denominator) rather than the required 15-shot
cap. The new protocol's explicit `shotCap: 15` corrected that protocol interpretation without
changing any CPU gain. Fresh real-match measurements were then recorded below.

### Exact canonical schema

```json
{
  "schemaVersion": 1,
  "seedRange": { "start": 0, "end": 499 },
  "trialCount": 500,
  "cpuSeat": { "strategy": "seed-parity", "evenPlayer": 0, "oddPlayer": 1 },
  "world": { "id": "terra", "terrain": "real-seeded", "spawns": "production" },
  "sequence": {
    "wind": "production",
    "handoff": "production-skip-non-cpu-action"
  },
  "shellId": "he",
  "shotCap": 15,
  "failureAccounting": "include-cap-shot",
  "tiers": [
    { "id": "recruit", "meanShotsToHit": 4.5, "medianShotsToHit": 3, "failedTrialCount": 6 },
    { "id": "gunner", "meanShotsToHit": 2.904, "medianShotsToHit": 2, "failedTrialCount": 1 },
    { "id": "veteran", "meanShotsToHit": 2.194, "medianShotsToHit": 2, "failedTrialCount": 3 }
  ]
}
```

`parseCpuTrialsSpec()` imports this JSON in production and rejects missing/extra keys,
non-finite aggregates, non-contiguous cohort size, non-alternating seat records, malformed tiers,
wrong Terra/terrain/spawn/sequence/shell/failure-accounting records, and mismatched CPU tier
identity/order. Parsed records are frozen. `measureCpuTier()` only accepts the canonical trial
count and uses the protocol seed range; the harness selects the parsed Terra world and HE shell,
uses the parsed seat parity and 15-shot cap, and retains cap failures in all aggregate samples.

### GREEN

- Strict parser test: 1 passed, exit 0.
- Each canonical 500-trial tier acceptance: 1 passed, exit 0.
- Trial mechanics (seeded replay, real impact feedback, cap accounting): 3 passed, exit 0.
- Required focused gate: 5 files, 109 tests passed, exit 0.

## Canonical aggregates and historical deltas

Each tier runs seeds 0–499, real accepted Terra terrain/spawns, alternating CPU seat by seed
parity, the production HE `fire`/fixed-step `step`/resolve path, production wind and handoff
behavior with the non-CPU action skipped, and 15 cap-inclusive shots. The CPU consumes only the
seeded simulation RNG.

| Tier | Historical `cpu.json` mean / median / failures | Canonical mean / median / failures | Mean delta |
| --- | --- | --- | ---: |
| Recruit | 5.6 / 5 / 70 | 4.500 / 3 / 6 | -1.100 |
| Gunner | 3.7 / 3 / 18 | 2.904 / 2 / 1 | -0.796 |
| Veteran | 2.8 / 2 / 11 | 2.194 / 2 / 3 | -0.606 |

Tests assert the canonical values from `cpu-trials.json` and also assert each mean/failure count
differs from the parsed historical `cpu.json` metadata. The historical values are no longer an
acceptance target and were not rewritten.

## Fresh verification

All commands used `TEMP` and `TMP` set to `D:\codex-temp`.

- `npm test -- --configLoader runner src/sim/cpuTrials.test.ts src/sim/cpu.test.ts src/sim/world.test.ts src/sim/ballistics.test.ts src/sim/purity.test.ts`
  — exit 0; 5 files, 109 tests passed.
- `npm test -- --exclude src/sim/cpuTrials.test.ts` — exit 0; 53 files, 449 tests passed.
  Together with the focused gate, every suite has fresh passing evidence.
- `npm test` and `npm test -- --maxWorkers=4` were also invoked, but this runner facade returned
  only Vitest's `RUN` header rather than a final payload for each long unbounded run.
- `npx tsc --noEmit` — exit 0; no diagnostics.

## Purity, physics-neutrality, and hashes

- Owner metadata is only queued and recorded after resolution; it does not affect projectile
  physics, terrain, collision, damage, or RNG.
- The trial harness imports no direct ballistic solver and uses no DOM, Canvas, wall-clock, or
  `Math.random`; the purity gate passes.
- `spec/cpu.json` SHA-256: `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`.
- `spec/cpu-trials.json` SHA-256: `C1B62881321B59D94220D7253556563F372A37ECCB44E26873BB9A55CF41736F`.
- `spec/test-vectors.json` SHA-256: `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8` (unchanged).

## Self-review and concerns

- **Strict protocol source of truth:** PASS. The new file—not historical strings—drives cohort,
  cap, seat, world, shell, sequencing contract, failure accounting, and aggregate acceptance.
- **Untuned production behavior:** PASS. The correction fixes cap interpretation only; CPU gains,
  target geometry, physics, and goldens are unchanged.
- **Concern:** unbounded full-suite command output is not available through this runner facade,
  although the focused CPU-trial gate and full remaining-suite gate both pass and cover every test
  file.

## Fix round 1 completion note

No further benchmark was run. Canonical protocol coverage completed successfully through the fresh
focused command (5 files, 109 tests, exit 0) and the complementary full-remainder command
excluding the already-covered CPU trial file (53 files, 449 tests, exit 0); TypeScript also passed.
The exact unbounded command `npm test` remains incomplete as verification evidence because both
invocations returned only Vitest's `RUN` header through this runner facade and never returned a
summary or exit payload. Accordingly, this round is **DONE_WITH_CONCERNS**, not an assertion that
the raw unbounded command completed.
