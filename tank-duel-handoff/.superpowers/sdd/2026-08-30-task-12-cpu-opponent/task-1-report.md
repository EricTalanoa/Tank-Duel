# Task 12 / Task 1 — strict CPU registry and pure bracketing model

## Scope and outcome

Created the pure CPU registry/model only in `src/sim/cpu.ts` with its focused tests in
`src/sim/cpu.test.ts`. No runtime, controller, UI, world-state, loadout, Task 13, or golden-vector
files were changed. No Git repository was initialized and no subagents were used.

## TDD evidence

### RED 1 — strict registry

Before `src/sim/cpu.ts` existed, created the eight registry/parser tests and ran:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/sim/cpu.test.ts
```

Result: exit 1; 1 failed suite, 0 tests executed. The expected failure was:

```text
Cannot find module './cpu' imported from src/sim/cpu.test.ts
```

This proves the registry checks were present before production code. The tests independently pin
the JSON registry's literal values and ordered identities, and mutate cloned checked-in JSON to
exercise missing/extra keys, algorithm ordering, duplicate/reordered tiers, invalid names/ranges,
non-finite gains, malformed measured records, hit definition, clamp ordering, and elevation.

### GREEN 1 — strict registry

Implemented the strict parser and frozen registry. The first implementation run exposed an actual
parser defect: the checked-in correction algorithm line intentionally has no trailing full stop,
while the initial parser required one. The parser was corrected. A second test-fixture correction
replaced structurally valid alternate source values with genuinely invalid inverted clamp and zero
elevation fixtures; this keeps the parser source-of-truth rather than retyping CPU numbers in
production.

Final registry command result: exit 0; 1 test file, 8 tests passed.

### RED 2 — command and memory model

Added seven focused command/memory tests before adding their production functions, then reran the
same command.

Result: exit 1; 15 tests total, 8 registry tests passed and 7 command/memory tests failed. The
expected failures were `TypeError` messages for missing `createCpuMemory`, `chooseCpuCommand`, and
`observeCpuImpact` functions. The failures cover opening power/elevation, direction sign, Recruit
wind skill, Veteran wind skill, clamp-before-jitter ordering, seeded reproducibility, and immutable
observation state.

### GREEN 2 — command and memory model

Implemented only the missing pure functions using parsed rules and seeded `Rng`.

Result: exit 0; 1 test file, 15 tests passed.

## Algorithm and operation order

All CPU-specific values come from parsed `spec/cpu.json` data. The opening command has no jitter:

```text
power = sqrt(distance * CONSTANTS.baseGravity) / CONSTANTS.muzzleCoefficient
elevationDeg = CPU_RULES.openingElevationDeg
```

For an observed prior impact, the exact order is:

```text
error = (targetX - lastImpactX) * direction
windDelta = wind - lastWind
corrected = lastAppliedPower
  + error * (1 / rangePerPowerPoint)
  + windDelta * (-driftPerWindUnit / rangePerPowerPoint) * direction * windSkill
clamped = min(maxPower, max(minPower, corrected))
power = clamped * (1 + rng.range(-jitter, jitter))
```

`observeCpuImpact` writes the real command's applied power with the resolved impact/wind into a new
frozen memory record; it never derives a value from target geometry. The positive-is-short test has
the hand-derived literal expected result `52.55449691838114`; the full Veteran wind test pins
`44.54653555451306`; and the clamp-before-jitter test pins `99.36445274064317`.

## Verification

After type-only corrections, ran the required commands with `TEMP` and `TMP` set to
`D:\codex-temp`:

```powershell
npm test -- --configLoader runner src/sim/cpu.test.ts src/sim/purity.test.ts
npx tsc --noEmit
```

Result: exit 0. Vitest: 2 files passed, 37 tests passed. TypeScript: exit 0 with no diagnostics.

## Source-of-truth, purity, and golden audit

- `src/sim/cpu.ts` imports `spec/cpu.json` once at module load and exposes its parsed, frozen data.
  CPU gains, tier data, hit definition, clamp, and elevation are parsed rather than copied as
  production numbers.
- The opening formula uses the existing spec-backed `CONSTANTS.baseGravity` and
  `CONSTANTS.muzzleCoefficient`.
- The only randomness is the injected simulation `Rng`; no DOM, Canvas, UI, render, wall-clock, or
  `Math.random` reference/import was found. The purity suite passed.
- `spec/test-vectors.json` SHA-256 is unchanged from the established value:
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.

## Changed files

- `src/sim/cpu.ts` — strict registry parser, frozen registry, immutable observation memory, and pure
  bracketing command model.
- `src/sim/cpu.test.ts` — 15 strict registry/model tests.
- `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-1-report.md` — this evidence report.

## Independent self-review

- **Spec compliance: PASS.** The exported registry/parser/memory/command interfaces exist; parsing
  is strict; all records are frozen; the opening and correction models preserve the published order;
  later shots use observed impact memory rather than a true trajectory solution; and the scoped
  verification/purity/golden checks pass.
- **Code quality: PASS.** The module is self-contained under `src/sim`, has no side effects beyond
  parsing its checked-in registry, validates incomplete observation records, uses literal,
  behavior-oriented tests, and has no unrelated edits.

## Concerns

None for this checkpoint. Task 2 remains responsible for supplying CPU-owned resolved impacts and
for validating the measured 500-trial acceptance targets against real ballistics.

## Fix Round 1 — F1 derived-gain consistency

### Scope

Addressed only review finding **F1**. Added the reusable pure production measurement helper
`src/sim/ballisticsMeasurements.ts` and one focused CPU-registry test. No gain was tuned, and
`spec/cpu.json` and `spec/test-vectors.json` were not edited. Review minors F2 (left-facing
correction coverage) and F3 (negative opening distance) remain deferred as instructed.

### RED

Added the consistency test before the helper, then ran:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/sim/cpu.test.ts
```

Result: exit 1; one failed suite and zero tests. The expected unsupported-derivation failure was:

```text
Cannot find module './ballisticsMeasurements' imported from src/sim/cpu.test.ts
```

### Independent derivation and tolerance

`deriveTerraCpuGains()` runs live `launchProjectile`/`stepProjectile` trajectories for an HE shell
on Terra's flat ground at the production midpoint elevation. It does not import or read CPU rules.

```text
rangePerPowerPoint = (range(power 85, wind 0) - range(power 65, wind 0)) / 20
driftPerWindUnit  = (range(power 75, wind +100) - range(power 75, wind -100)) / 200
```

The centered 65–85 power sample is symmetric around the spec's power-75 reference region and
reduces fixed-substep landing quantization. The measured values are approximately 17.833 px/power
and 1.184 px/wind. The test compares these independent production-ballistics measurements to the
parsed CPU gains with an explicit `0.05 px/unit` tolerance. That allowance covers the checked-in
rounded gains and frame quantization while being ten times tighter than Task 12's ±0.5 statistical
acceptance tolerance. A change to launch speed, gravity, wind coefficient, step physics, HE flight,
or Terra profile now makes a stale CPU gain fail visibly.

### GREEN and verification

After adding the helper, the CPU test passed: 1 file, 16 tests, exit 0.

Fresh required verification used `TEMP`/`TMP = D:\codex-temp`:

```powershell
npm test -- --configLoader runner src/sim/cpu.test.ts src/sim/purity.test.ts src/sim/ballistics.test.ts
npx tsc --noEmit
npm test
```

Results: focused CPU/purity/ballistics gate exit 0 with 3 files and 65 tests passed; strict
TypeScript exit 0 with no diagnostics; full suite exit 0 with 53 files and 442 tests passed.

### Fix-round audit

- The helper only imports pure simulation modules and has no DOM, Canvas, UI, render, wall-clock,
  or unseeded-random dependency; the purity suite covers it.
- It measures live physics rather than reproducing `CPU_RULES` arithmetic, so this is a stale-gain
  regression check rather than a mirror assertion.
- `spec/test-vectors.json` remains unchanged; its SHA-256 is still
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
