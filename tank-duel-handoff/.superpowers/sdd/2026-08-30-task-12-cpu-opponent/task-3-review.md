# Task 3 independent review — match runtime CPU scheduling

## Verdicts

- **Spec compliance: PASS.** All Task 3 requirements and every item in the review package are met.
- **Code quality: PASS.** The implementation is scoped, uses the established simulation boundaries, and has sufficient real-runtime lifecycle coverage.

## Ranked findings

No P0–P3 findings. No implementation change is required.

## Package audit and exact evidence

| Review-package item | Verdict | Evidence |
| --- | --- | --- |
| Local mode / Player 1 no-op | PASS | `scheduleCpuTurn` returns unless `mode === 'cpu'` and `activePlayer === 1` (`src/app/matchRuntime.ts:216-219`). Runtime tests run four local frames and four CPU-mode Player 1 frames with zero muzzle flashes for both players (`src/app/matchRuntime.test.ts:565-595`). |
| Exactly one Player 2 HE shot | PASS | The coordinator derives the Player 2 HE slot, selects it through `selectShell`, and calls `fire` once (`src/app/matchRuntime.ts:232-241`). The real-world test asserts `projectile.owner === 1`, `shell.id === 'he'`, expected CPU aim, and one Player 2 muzzle flash (`src/app/matchRuntime.test.ts:597-620`); repeated active frames remain at one (`src/app/matchRuntime.test.ts:622-633`). |
| Normal simulation APIs; no direct phase/projectile mutation | PASS | CPU work only invokes `adjustAngle`, `adjustPower`, `selectShell`, and `fire` (`src/app/matchRuntime.ts:235-237`). There is no assignment to `state.phase`, `state.projectile`, or `lastResolvedShotImpact` in the coordinator. World API guards require AIM and prevent a second projectile (`src/sim/world.ts:262-309`, `src/sim/world.ts:312-343`). |
| Observed-impact freshness, ownership, and one-time consumption | PASS | A runtime captures the current impact as its initial stale baseline (`src/app/matchRuntime.ts:144-147`), compares identity before consuming (`:208-214`), accepts only `owner === 1`, and passes the actual impact x plus recorded command/wind to `observeCpuImpact`. World creates a fresh frozen resolved-impact record only for a canonical single impact (`src/sim/world.ts:484-570`). The test observes a real Player 2 impact once, verifies corrected next command, and verifies the later Player 1 impact remains ignored (`src/app/matchRuntime.test.ts:650-671`). |
| Stale / Player 1 rejection | PASS | Identity baseline rejects an impact pre-dating runtime creation; owner guard rejects Player 1 (`src/app/matchRuntime.ts:208-214`). Dedicated tests assert opening-command behavior for both a Player 1 impact and an injected stale Player 2 impact (`src/app/matchRuntime.test.ts:674-714`). |
| Fresh memory on runtime recreation | PASS | CPU memory, last command/wind, and impact baseline are function-local state initialized by each `createMatchRuntime` call (`src/app/matchRuntime.ts:118-147`). The recreation test disposes one runtime and confirms the next runtime receives an opening command (`src/app/matchRuntime.test.ts:717-739`). |
| Seeded RNG | PASS | `chooseCpuCommand` receives `state.rng`, not an unseeded source (`src/app/matchRuntime.ts:223-231`). CPU source consumes only the provided RNG for jitter (`src/sim/cpu.ts:225-254`); targeted CPU tests passed. |
| Pause before/during AIM; resume exactly once | PASS | Frames return before CPU scheduling while paused (`src/app/matchRuntime.ts:244-245`), pause cancels the pending frame, and resume queues one rebased continuation (`:285-297`). The lifecycle test pauses before CPU AIM, calls a stale callback while paused, then resumes through two frames and asserts exactly one CPU fire (`src/app/matchRuntime.test.ts:635-648`). |
| Stale callbacks and disposal | PASS | Frame entry exits when disposed or paused (`src/app/matchRuntime.ts:244-245`); disposal cancels the handle and disposes controls/listeners (`:298-307`). The stale-callback test verifies no fire and no replacement frame after disposal (`src/app/matchRuntime.test.ts:741-754`). |
| Fixed-timestep integration | PASS | Scheduling is invoked after every existing fixed simulation step, with a zero-step AIM continuation only when no step was requested (`src/app/matchRuntime.ts:250-262`). Existing clock/frame-policy, rendering, effects, and completion sequencing remain unchanged outside this insertion. |
| No UI-flow scope creep / correct main plumbing | PASS | Baseline comparison shows only `matchRuntime.ts`, its tests, and two forwarding fields in `main.ts` changed. `main.ts:46-56` forwards existing resolved `mode` and `cpuTierId`; it adds no menu, loadout, or controller behavior. |
| Spec and golden immutability | PASS | `spec/test-vectors.json` SHA-256 is `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`; `spec/cpu.json` SHA-256 is `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`, matching the checkpoint report. Baseline comparison identifies no spec changes. |
| Tests exercise real runtime behavior rather than CPU mocks | PASS | `matchRuntime.test.ts` creates a real world (`src/app/matchRuntime.test.ts:77-79`) and its injected runtime `step` delegates to real `stepWorld` while recording actual resolved impacts (`:150-177`). CPU turn tests use the production `chooseCpuCommand`, `fire`, and fixed-step world behavior; only browser-facing renderer/audio/frame dependencies are harnessed. |

## Independent verification

Executed on 2026-08-31 with `TEMP` and `TMP` set to `D:\codex-temp`:

```text
npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/cpu.test.ts src/sim/world.test.ts
3 test files passed; 71 tests passed.

npx tsc --noEmit
exit 0; no diagnostics.

npm test -- --configLoader runner
54 test files passed; 466 tests passed.
```

The final full-suite result resolves the implementation report's earlier concern that its complementary command produced only a `RUN` header.

## Concerns

None for Task 3. Browser/UI flow remains intentionally out of scope for this runtime-only checkpoint and is assigned to Task 4/Task 5.
