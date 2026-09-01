# Task 2 independent review — owned impacts and CPU trials

## Verdicts

- **Spec compliance: PASS (under the authorized canonical-protocol ledger ruling).** The literal historical `TASKS.md` ±0.5 requirement is not met by any tier; this is an explicit, accepted deviation described below, not a hidden substitution.
- **Code quality: PASS.** The implementation is small, typed, deterministic, strict at its protocol boundary, and uses the production simulation path. One Minor evidence-retention concern remains.

## Scope and authority inspected

Read the Task 2 review package and brief; the Task 12 design and implementation plan; the Task 12 SDD ledger; `TASKS.md`; `task-2-report.md`; the preserved Task 2 `world.ts` and `world.test.ts` baselines; `spec/cpu.json`, `spec/cpu-trials.json`, and `spec/test-vectors.json`; and every reported current Task 2 file:

- `src/sim/cpuTrials.ts`, `src/sim/cpuTrials.test.ts`, `src/sim/world.ts`, and `src/sim/world.test.ts`.
- The direct `PendingImpact` fixture updates in `src/sim/collapse.test.ts`, `src/sim/presentation.test.ts`, `src/sim/standard-shells.test.ts`, and `src/sim/turns.test.ts`.
- The referenced CPU/ballistics authorities and evidence: `src/sim/cpu.ts`, `src/sim/cpu.test.ts`, `src/sim/ballisticsMeasurements.ts`, `src/sim/ballistics.ts`, `src/sim/ballistics.test.ts`, and `src/sim/purity.test.ts`.

The baseline-to-current diff shows the only production `world.ts` changes are owner carriage plus the resolved observation; no pre-existing physics, damage, terrain, collision, or RNG path was altered.

## Ledger ruling treatment

The ledger contains three rulings. The two benchmark-specific rulings are applied as follows:

1. The harness must use real seeded match geometry, production HE ballistics, and production wind sequencing while keeping gains exactly `spec/cpu.json`-owned and untuned. The code complies: `runCpuTrial` creates Terra through `createWorld`, produces a normal CPU command, calls normal `fire`, and advances normal `step` (`src/sim/cpuTrials.ts:252-297`). `cpuTrials.ts` imports parsed CPU rules rather than supplying a gain or a solver.
2. Because the original historical trial distribution is absent, preserve `spec/cpu.json` as historical metadata and use a separate explicit canonical protocol, while reporting the deltas. This is the authorized resolution. `spec/cpu-trials.json` supplies the 500-seed cohort, alternating seat, real Terra/world sequence, HE, a 15-shot cap, cap-inclusive failures, and recorded aggregates; `parseCpuTrialsSpec` validates and freezes it (`src/sim/cpuTrials.ts:123-201`). The test asserts both canonical reproduction and the intentional difference from historical values (`src/sim/cpuTrials.test.ts:87-108`).

The generic non-Git provenance ruling is also respected: the preserved baseline and explicit report inventory replace a commit-range diff.

### Literal historical criterion

`TASKS.md:283` requires each 500-trial mean to be within ±0.5 of `spec/cpu.json`. The current canonical results do **not** satisfy that literal historical acceptance target:

| Tier | Historical mean | Canonical mean | Absolute delta | Literal ±0.5 |
| --- | ---: | ---: | ---: | --- |
| Recruit | 5.600 | 4.500 | 1.100 | FAIL |
| Gunner | 3.700 | 2.904 | 0.796 | FAIL |
| Veteran | 2.800 | 2.194 | 0.606 | FAIL |

This is visible rather than concealed: the historical spec remains hash-identical to the recorded value and the canonical test requires the mismatch. Under the second benchmark-specific ledger ruling, the canonical protocol is the authorized Task 2 acceptance contract; without that ruling, this would be an Important spec failure.

## Ranked findings

### Critical

None.

### Important

1. **Accepted ledger exception — literal historical statistical gate is unmet.** Evidence is the table above, `TASKS.md:283`, `spec/cpu.json`, and `spec/cpu-trials.json`. The second benchmark-specific ledger ruling expressly authorizes this replacement because the historical distribution is not specified. It does not change this review's PASS verdict, but Task 12's final review must retain the qualification until a reference protocol is supplied.

### Minor

1. **The raw unbounded full-suite command has no final runner payload.** `task-2-report.md` records this limitation. It is not a coverage gap: the fresh focused gate passed 5/5 files and 109/109 tests, and the fresh complementary gate passed 53/53 files and 449/449 tests. The repository contains 54 test files, so their union covers every current test file. Preserve the limitation in subsequent reporting rather than claiming the raw unbounded command completed.

## Package-bullet audit

| Required review item | Verdict and exact evidence |
| --- | --- |
| Strict protocol parsing | PASS. Exact top-level and nested keys, finite/integer bounds, seed-contiguity, alternating seats, fixed world/sequence/shell/failure values, tier identity/order, and frozen results are implemented at `src/sim/cpuTrials.ts:86-201`; malformed-root, extra-tier-field, cohort, seat, and aggregate tests are at `src/sim/cpuTrials.test.ts:24-45`. |
| Canonical measured values were recorded without tuning production gains | PASS, subject to non-Git provenance limitation. `cpuTrials.ts` reads `CPU_RULES`/`CPU_TIERS` and contains no gain literals; production rules parse `spec/cpu.json` (`src/sim/cpu.ts:170-184`) and the live-ballistics stale-gain check passes (`src/sim/cpu.test.ts:58-69`). Canonical values are external protocol data, not CPU-control inputs. |
| 15-shot-cap interpretation | PASS. `spec/cpu-trials.json` declares `shotCap: 15`; the parser reads it (`src/sim/cpuTrials.ts:174-197`) and the attempt loop is bounded by it (`:261-298`). This corrects the historical `70/500` denominator misreading without changing `spec/cpu.json`. |
| Failure inclusion | PASS. Every trial contributes `shots.length` to the mean (`src/sim/cpuTrials.ts:319-327`), including cap failures. The focused test verifies failed trials are cap-length and remain in the population (`src/sim/cpuTrials.test.ts:74-85`). |
| Real production world, HE, and resolved-impact feedback | PASS. The harness uses `createWorld`, checks selected HE, calls ordinary `fire`/`step`, and supplies only the returned resolved owned impact to `observeCpuImpact` (`src/sim/cpuTrials.ts:252-297`). No alternate ballistic equation or target solver is present. |
| Both CPU directions | PASS. The protocol assigns player 0 to even seeds and player 1 to odd seeds; `initialCpuOwner` applies that parity (`src/sim/cpuTrials.ts:203-206`). The canonical 0–499 inclusive cohort exercises 250 trials in each direction. |
| Seeded determinism | PASS. Each run creates its world from the supplied seed and passes `state.rng` into the CPU command (`src/sim/cpuTrials.ts:252-276`); exact replay is tested at `src/sim/cpuTrials.test.ts:48-55`. |
| Owner timing, canonicalization, and persistence | PASS. `queueImpact` copies `Projectile.owner` while canonicalizing the queued x (`src/sim/world.ts:436-446`); the state initializes null (`:227-229`) and sets a frozen observation only after resolve (`:483-570`). Both owners, timing, wrapped x, and persistence are tested at `src/sim/world.test.ts:171-244`. |
| Ambiguous multi-impact rejection | PASS. A resolved observation is created only when the full resolved batch has exactly one impact (`src/sim/world.ts:483-570`); the split HE batch regression is at `src/sim/world.test.ts:248-256`. |
| Owner-neutral physics | PASS. The baseline diff adds owner only to `PendingImpact` and the post-resolution record. The owner is not read by ballistics, terrain hooks, damage, collision, or RNG; the resolve loop's sole use is observation construction (`src/sim/world.ts:436-443`, `:483-570`). |
| No solver, DOM, or `Math.random` | PASS. `cpuTrials.ts` delegates trajectory execution to the production world and has no solver; the simulation purity gate passed. The pure CPU correction only uses prior observed impact and seeded RNG (`src/sim/cpu.ts:225-253`). |
| Historical spec preservation and golden immutability | PASS for current recorded hashes. SHA-256 values match `task-2-report.md`: `spec/cpu.json` `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`; `spec/cpu-trials.json` `C1B62881321B59D94220D7253556563F372A37ECCB44E26873BB9A55CF41736F`; `spec/test-vectors.json` `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`. |
| TDD evidence | PASS with the Minor evidence-retention concern. The report records owned-impact RED then GREEN and missing-module/protocol RED then GREEN; the preserved `world` baseline lacks the added state/metadata and the current tests pin the resulting behavior. Raw historical terminal payloads are not retained. |
| Focused plus remainder gate coverage | PASS. Fresh reviewer runs: focused command, exit 0, 5 files / 109 tests; complementary exclusion command, exit 0, 53 files / 449 tests; `npx tsc --noEmit`, exit 0. A current file inventory reports 54 test files, so the two commands validly cover the full suite without double-counting `cpuTrials.test.ts` as coverage. |

## Reviewer checks

```text
PASS  npm test -- --configLoader runner src/sim/cpuTrials.test.ts src/sim/cpu.test.ts src/sim/world.test.ts src/sim/ballistics.test.ts src/sim/purity.test.ts
      5 files, 109 tests, exit 0 (47.92 s)

PASS  npm test -- --exclude src/sim/cpuTrials.test.ts
      53 files, 449 tests, exit 0

PASS  npx tsc --noEmit
      exit 0, no diagnostics

PASS  SHA-256 checks for cpu.json, cpu-trials.json, and test-vectors.json
PASS  Static ownership/purity/source-boundary audit
```

## Conclusion and concerns

Task 2 is accepted under the authorized canonical-protocol ruling. Keep two explicit qualifications for later Task 12 work: the literal historical ±0.5 target remains unmet, and the runner did not provide a final payload for the raw unbounded full-suite command. Neither is concealed by the Task 2 implementation or its split-gate evidence.
