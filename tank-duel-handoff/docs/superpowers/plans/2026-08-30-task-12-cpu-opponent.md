# Task 12 CPU Opponent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic single-player play against Recruit, Gunner, and Veteran CPUs that bracket from their own observed impacts.

**Architecture:** A strict pure `sim/cpu.ts` registry and decision model consumes `spec/cpu.json`. World state exposes only resolved owned impacts; match runtime schedules Player 2 commands through normal aim/select/fire APIs. Existing controller/loadout flow supplies a human Player 1 deck and deterministic standard CPU deck while preserving local play.

**Tech Stack:** TypeScript, Vitest, Canvas 2D, Vite, seeded Mulberry32 simulation RNG.

**Spec:** `docs/superpowers/specs/2026-08-30-task-12-cpu-opponent-design.md`

## Global Constraints

- `spec/*.json` is the source of truth; production imports every CPU value and never retypes it.
- Never edit or regenerate `spec/test-vectors.json`.
- CPU logic stays under `src/sim/`, uses seeded RNG only, and imports no DOM/Canvas/render/UI module.
- CPU correction uses its own resolved impact; never call or embed a true firing-solution solver.
- CPU Player 2 receives the existing spec-backed standard six-shell deck and fires HE only.
- Local mode retains two independently editable decks and all iPad orientation behavior.
- Do not implement Task 13, online play, extra shell strategy, adaptive difficulty, or the visual overhaul.
- This workspace is not a Git repository. Use checkpoint reports, preserved baselines, and independent reviews; do not initialize Git.
- Use `D:\codex-temp` for TEMP/TMP and fresh D: build output because C: is full.

---

### Task 1: Strict CPU registry and pure bracketing model

**Files:**
- Create: `src/sim/cpu.ts`
- Create: `src/sim/cpu.test.ts`
- Create: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-1-report.md`

**Interfaces:**
- Produces: `CpuTierId`, `CpuTier`, `CPU_TIERS`, `cpuTierById(id)`.
- Produces: `CpuObservation`, `CpuCommand`, `createCpuMemory()`, `observeCpuImpact(...)`, and `chooseCpuCommand(...)`.
- Consumes: `Rng`, current wind/direction, opening distance, and actual prior impact error; no world mutation.

- [ ] **Step 1: Write strict-registry RED tests**

Add tests that expect ordered IDs/names from the JSON, finite positive gains, exactly three unique
tiers, bounded jitter/wind skill, parsed hit distance, parsed power bounds, and fixed opening
elevation. Add malformed-fixture tests through an exported `parseCpuSpec(value: unknown)` testable
boundary; reject missing/extra keys, duplicate/reordered tier IDs, non-finite numbers, invalid
measured values, and algorithm text that cannot be mapped to the supported operation order.

```ts
expect(CPU_TIERS.map(({ id, name }) => [id, name])).toEqual([
  ['recruit', 'Recruit'],
  ['gunner', 'Gunner'],
  ['veteran', 'Veteran'],
]);
expect(() => parseCpuSpec({ tiers: [] })).toThrow(/tiers/i);
```

- [ ] **Step 2: Run the registry test and confirm RED**

Run: `npm test -- --configLoader runner src/sim/cpu.test.ts`

Expected: FAIL because `src/sim/cpu.ts` does not exist.

- [ ] **Step 3: Implement strict parsing from `spec/cpu.json`**

Parse the JSON once at module load. Expose frozen records only. Do not duplicate any numeric value;
extract the power bounds and opening elevation from the supported algorithm records/text through a
strict parser that fails if the published shape changes.

```ts
export type CpuTierId = 'recruit' | 'gunner' | 'veteran';

export interface CpuTier {
  readonly id: CpuTierId;
  readonly name: string;
  readonly jitter: number;
  readonly windSkill: number;
  readonly measuredMeanShotsToHit: number;
}
```

- [ ] **Step 4: Write deterministic command RED tests**

Pin opening direction/elevation, correction sign, clamp-before-jitter ordering, zero Recruit wind
correction, full Veteran wind correction, seeded jitter reproducibility, and immutable memory.
Use literal hand-derived fixtures sourced in setup from the parsed registry—not copied spec numbers
in production.

```ts
const first = chooseCpuCommand({
  tierId: 'recruit', memory: createCpuMemory(), distance: 700,
  targetX: 800, direction: 1, wind: 100, rng: createRng(12),
});
expect(first.elevationDeg).toBe(CPU_RULES.openingElevationDeg);
```

- [ ] **Step 5: Implement the pure observation/command model**

```ts
export interface CpuMemory {
  readonly lastImpactX: number | null;
  readonly lastWind: number | null;
  readonly lastAppliedPower: number | null;
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
```

Opening power follows the spec formula. Later power starts from `memory.lastAppliedPower`,
adds observed impact error and wind delta corrections using parsed gains/tier skill, clamps in the
published order, then applies seeded proportional jitter. `observeCpuImpact` stores the command's
actual applied power alongside its impact/wind; it is never inferred from target geometry.

- [ ] **Step 6: Verify Task 1 and purity**

Run:

```powershell
npm test -- --configLoader runner src/sim/cpu.test.ts src/sim/purity.test.ts
npx tsc --noEmit
```

Expected: PASS; static audit finds no `Math.random`, DOM, Canvas, UI, or render import in CPU code.

- [ ] **Step 7: Report and independently review checkpoint 1**

Record RED/GREEN output, parser contract, command equations, source-of-truth audit, changed files,
golden hash, and concerns. Require separate spec-compliance and code-quality PASS verdicts.

---

### Task 2: Owned resolved-impact observation and CPU trial harness

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/world.test.ts`
- Create: `src/sim/cpuTrials.ts`
- Create: `src/sim/cpuTrials.test.ts`
- Modify only projectile/impact fixtures exposed by the new required owner field
- Create: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-2-report.md`

**Interfaces:**
- Produces: `ResolvedShotImpact { owner: PlayerIndex; x: number; y: number }`.
- Produces: `GameState.lastResolvedShotImpact: ResolvedShotImpact | null`.
- Produces: `runCpuTrial(seed, tierId)` and `measureCpuTier(tierId, trialCount)` for acceptance only.
- Consumes: Task 1 command/observation model and real ballistics/world constants.

- [ ] **Step 1: Write owned-impact RED tests**

Fire an HE shot for each player and assert the resolved observation records canonical impact x/y and
projectile owner. Assert it updates only after resolve, survives until the next owned shot resolves,
and split/multiple impacts do not masquerade as the HE CPU observation.

```ts
expect(state.lastResolvedShotImpact).toEqual({ owner: 1, x: expectedX, y: expectedY });
```

- [ ] **Step 2: Run world tests and confirm RED**

Run: `npm test -- --configLoader runner src/sim/world.test.ts`

Expected: FAIL because resolved impact ownership is not exposed.

- [ ] **Step 3: Carry owner through pending resolution**

Add owner to `PendingImpact`, set it from `Projectile.owner` in `queueImpact`, and update
`lastResolvedShotImpact` from the resolved canonical impact. Do not use owner in damage, terrain,
collision, RNG, or physics decisions.

- [ ] **Step 4: Write 500-trial statistical RED tests**

Build trials from real fixed-step HE ballistics on the spec/world range domain. Each trial uses one
seeded RNG stream, starts from a seeded legal target distance/direction/wind sequence, feeds only
actual impacts back into Task 1 memory, and stops at the parsed hit distance or published shot cap.

```ts
for (const tier of CPU_TIERS) {
  const result = measureCpuTier(tier.id, 500);
  expect(Math.abs(result.meanShotsToHit - tier.measuredMeanShotsToHit)).toBeLessThanOrEqual(0.5);
}
```

Failed-in-cap trials count at the cap for the mean exactly as the reference contract requires; pin
that accounting in a unit test so statistical targets cannot be matched by dropping failures.

- [ ] **Step 5: Implement the deterministic trial harness**

Use the production CPU model and production ballistics; do not add an alternate solved trajectory.
Keep the harness pure and test-only/acceptance-oriented. If the published measured means cannot be
reproduced from the real model, stop and report the exact missing reference assumption rather than
tuning gains or changing golden values.

- [ ] **Step 6: Verify Task 2**

Run:

```powershell
npm test -- --configLoader runner src/sim/cpuTrials.test.ts src/sim/cpu.test.ts src/sim/world.test.ts src/sim/ballistics.test.ts src/sim/purity.test.ts
npx tsc --noEmit
```

Expected: all three tier means satisfy ±0.5 and world/ballistics regressions remain unchanged.

- [ ] **Step 7: Report and independently review checkpoint 2**

Include all 1,500 trial aggregates, failure accounting, proof that production gains were not tuned,
owner-neutral physics audit, golden hash, and both review verdicts.

---

### Task 3: Match runtime CPU scheduling

**Files:**
- Modify: `src/app/matchRuntime.ts`
- Modify: `src/app/matchRuntime.test.ts`
- Modify: `src/main.ts`
- Create: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-3-report.md`

**Interfaces:**
- Extends runtime options with `mode`/`cpuTierId` through existing resolved config.
- Consumes: `chooseCpuCommand`, CPU memory, and `GameState.lastResolvedShotImpact`.
- Produces: exactly-once Player 2 automated aim/select/fire behavior.

- [ ] **Step 1: Write runtime lifecycle RED tests**

Cover local mode no-op; CPU mode Player 1 no-op; one CPU shot on Player 2 AIM; no duplicate fire on
repeated frames; pause-before-AIM; pause during AIM; resume exactly once; impact observation before
the next CPU command; and disposal/stale runtime no-op.

- [ ] **Step 2: Run runtime tests and confirm RED**

Run: `npm test -- --configLoader runner src/app/matchRuntime.test.ts`

Expected: FAIL because runtime has no CPU owner.

- [ ] **Step 3: Add a runtime-owned CPU turn coordinator**

Keep CPU math in `sim/cpu.ts`. At Player 2 AIM in CPU mode, select the HE slot by stable arsenal
position, apply angle/power through `adjustAngle`/`adjustPower` deltas (or a new guarded sim command
that preserves AIM guards), and call `fire` once. Track the observed `lastResolvedShotImpact` identity
so one impact is consumed once. Reset CPU memory when runtime is recreated for rematch.

- [ ] **Step 4: Preserve pause/frame semantics**

CPU scheduling runs only inside the same active fixed-step loop and is suppressed while paused or
disposed. Orientation resume schedules one normal continuation and cannot fire twice.

- [ ] **Step 5: Verify Task 3**

Run:

```powershell
npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/cpu.test.ts src/sim/world.test.ts
npx tsc --noEmit
```

- [ ] **Step 6: Report and independently review checkpoint 3**

Document exact fire counts, observation consumption, pause/resume/disposal behavior, local-mode
regression, source boundaries, and both review verdicts.

---

### Task 4: CPU mode flow, tier controls, and deterministic deck

**Files:**
- Modify: `src/ui/config.ts`, `src/ui/config.test.ts`
- Modify: `src/ui/flow.ts`, `src/ui/flow.test.ts`
- Modify: `src/ui/screenModels.ts`, `src/ui/screenModels.test.ts`
- Modify: `src/ui/appView.ts`, `src/ui/appView.test.ts`
- Modify: `src/ui/loadout.ts`, `src/ui/loadout.test.ts`, `src/ui/loadout.css`
- Modify: `src/app/controller.ts`, `src/app/controller.test.ts`
- Modify: `src/main.ts`
- Create: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-4-report.md`

**Interfaces:**
- Produces enabled CPU mode selection and spec-backed tier options.
- Produces `cpuPlayerLoadoutIds(): readonly string[]` from existing standard-shell registry.
- Extends loadout owner with mode-aware human editor plus read-only CPU summary.
- Controller always supplies a complete `PlayerLoadouts` tuple to runtime.

- [ ] **Step 1: Write flow/config RED tests**

Assert CPU is enabled, has no Task 12 note, tier labels/order come from the strict CPU registry,
selection persists through map/custom/round-over/rematch/storage, Quick Start remains two actions,
and local mode remains unchanged.

- [ ] **Step 2: Write loadout/controller RED tests**

Assert CPU mode mounts one editable Player 1 panel plus one neutral read-only CPU deck summary;
Player 1 edits cannot mutate CPU deck; Deploy returns `[humanDeck, cpuDeck]`; standard CPU deck is
complete/valid/frozen; Change Loadout restores only human selection; rematch reuses both values.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```powershell
npm test -- --configLoader runner src/ui/flow.test.ts src/ui/screenModels.test.ts src/ui/appView.test.ts src/ui/loadout.test.ts src/app/controller.test.ts
```

Expected: failures name disabled CPU mode, missing tier actions, and two-editable-panel assumption.

- [ ] **Step 4: Enable CPU mode and tier selection**

Use `CPU_TIERS` from `sim/cpu.ts` as the single tier registry; remove the parallel cast-based CPU
tier parsing from `ui/config.ts`. Add explicit flow actions for selecting mode/tier. Preserve screen
count: CPU selection occurs on the existing mode/map surface and does not add a screen.

- [ ] **Step 5: Implement deterministic CPU deck boundary**

Build the CPU deck from `STANDARD_SHELL_IDS` through `makePlayerLoadouts`/existing validation. Never
copy shell IDs, point limits, slot counts, or HE identity. Local mode still accepts both editable
decks; CPU mode replaces tuple entry 1 at controller ownership boundaries regardless of any stale UI
callback value.

- [ ] **Step 6: Render human editor plus CPU summary**

Reuse shell icons and neutral loadout styling. The summary lists the CPU tier and complete CPU deck,
has no editable shell controls, and remains accessible at 44x44 touch/focus standards where
interactive controls exist. Portrait blocking remains owned by the existing orientation gate.

- [ ] **Step 7: Verify Task 4**

Run focused tests, then:

```powershell
npm test -- --configLoader runner src/ui src/app/controller.test.ts src/app/matchRuntime.test.ts
npx tsc --noEmit
```

- [ ] **Step 8: Report and independently review checkpoint 4**

Record click counts, local/CPU loadout DOM evidence, tuple/deck immutability, storage/rematch behavior,
icons/accessibility, source-of-truth audit, and both review verdicts.

---

### Task 5: Integrated Task 12 acceptance and stop

**Files:**
- Modify only files required by acceptance/review failures, using a failing regression first
- Create: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/task-5-report.md`
- Update: `.superpowers/sdd/2026-08-30-task-12-cpu-opponent/progress.md`

**Interfaces:**
- Consumes all Task 1-4 deliverables.
- Produces verified single-player play at all three tiers and no Task 13 behavior.

- [ ] **Step 1: Run the fresh complete automated gate**

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner
npx tsc --noEmit
npx vite build --outDir D:\codex-temp\tank-duel-task-12-final --emptyOutDir
Get-FileHash -Algorithm SHA256 spec\test-vectors.json
```

Expected: zero failures, clean strict typecheck/build, unchanged established golden hash.

- [ ] **Step 2: Record statistical acceptance**

Run 500 fresh seeded trials for each tier and record mean/median/failure count. Each mean must be
within ±0.5 of its parsed spec target. Record Recruit zero-wind and Veteran full-wind focused proof.

- [ ] **Step 3: Browser-test iPad CPU flow**

At 1194x834, test Recruit/Gunner/Veteran selection, two-click Quick Start, one human editor plus CPU
summary, shell icons, touch/focus, automatic Player 2 aim/fire, distinct arsenals, rematch, and local
two-editor regression. Confirm console warning/error list is empty.

- [ ] **Step 4: Browser-test orientation lifecycle**

Rotate during Player 2 AIM/flight to 834x1194. Confirm the inert rotate surface is the only
interactive content, no CPU duplicate shot occurs, and returning to landscape resumes the same
terrain/health/turn/ammo/CPU observation state.

- [ ] **Step 5: Run final independent whole-task review**

Review against `TASKS.md` Task 12, `spec/cpu.json`, all `spec/*.json`, the approved design and this
plan. Explicitly audit no true-solution solver, no DOM/Math.random in sim, source-of-truth usage,
500-trial methodology, CPU deck boundary, pause/disposal lifecycle, local-mode regression, golden
immutability, and exclusion of Task 13/visual overhaul.

- [ ] **Step 6: Repeat the complete gate after any source fix**

Any source change requires a failing regression, scoped re-review, and a fresh Step 1 command.

- [ ] **Step 7: Write final evidence and stop**

Write automated/statistical/browser/review/changed-file/limitation evidence to `task-5-report.md`,
mark progress complete, and stop at Task 12's line: “Single player works.” Do not begin Task 13.
