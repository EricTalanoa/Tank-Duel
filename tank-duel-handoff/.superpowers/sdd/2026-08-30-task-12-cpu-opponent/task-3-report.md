# Task 12 / Task 3 — match runtime CPU scheduling

## Status

**DONE_WITH_CONCERN.** The runtime owns CPU scheduling and observation, while CPU math remains in
`src/sim/cpu.ts`. It automates only Player 2 in CPU mode through the normal world APIs.

## Strict TDD evidence

### RED (before production changes)

Added the runtime lifecycle/scheduling tests before changing `src/app/matchRuntime.ts` or
`src/main.ts`, then ran:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/app/matchRuntime.test.ts
```

Result: exit 1; 18 tests total, 6 new CPU tests failed and 12 existing lifecycle tests passed.
The expected failures showed Player 2 remained in AIM with no projectile/muzzle flash and pause
resume did not produce a CPU fire. This established the missing runtime coordinator before the
production implementation.

### GREEN

After the minimal coordinator and `main.ts` plumbing, the same focused runtime suite passed:

```text
Test Files  1 passed (1)
Tests       19 passed (19)
```

The required Task 3 verification then passed:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/cpu.test.ts src/sim/world.test.ts
```

Result: exit 0; 3 files, 71 tests passed. `npx tsc --noEmit` also exited 0 with no diagnostics.

## Behavior evidence

- **Local mode:** four active frames produce 0 Player 1 fires and 0 Player 2 fires.
- **CPU mode / Player 1:** four active Player 1 AIM frames produce 0 automated fires for either
  player. Human Player 1 remains the only source of the opening shot.
- **One CPU AIM:** one Player 1 normal shot reaches Player 2’s turn; the coordinator emits exactly
  1 command and 1 normal HE fire. The launched projectile has `owner: 1` and `shell.id: 'he'`.
- **Repeated frames:** four further active frames retain exactly 1 Player 2 muzzle flash/fire for
  that AIM; normal `fire` has moved the state to flight and prevents duplication.
- **Observations:** the harness captures exactly 1 real Player 2 resolved-impact identity during
  the first CPU shot. The coordinator’s identity guard consumes that new Player 2 identity once;
  the later current Player 1 impact is `owner: 0` and is ignored before the next command. The next
  Player 2 command/firing count is 2 total and uses a corrected (non-opening) power. A runtime
  created with a pre-existing Player 2 impact treats it as stale: 0 observations and one opening
  command.
- **Pause/resume:** paused Player 2 AIM schedules 0 commands/fires, including a stale queued
  callback. Resume schedules exactly 1 command/fire; an additional resumed frame does not
  duplicate it.
- **Recreation/rematch:** a new runtime starts with fresh CPU memory and emits the opening command
  (1 command, 1 Player 2 fire), independent of an earlier disposed runtime.
- **Disposal:** disposing at Player 2 AIM before the queued callback produces 0 CPU fires and no
  replacement frame. Repeated disposal remains covered by the existing lifecycle tests.

## Implementation and scope

- `src/app/matchRuntime.ts`
  - Extends runtime config with the existing resolved `mode` and `cpuTierId` values.
  - Holds per-runtime CPU memory, the prior CPU command/wind, and resolved-impact identity.
  - Runs scheduling only inside the active fixed-step frame loop; uses `chooseCpuCommand`, seeded
    `state.rng`, `adjustAngle`, `adjustPower`, stable HE arsenal-slot selection, `selectShell`, and
    normal `fire`.
- `src/app/matchRuntime.test.ts`
  - Adds RED/GREEN coverage for local/Player 1 no-op, HE fire, duplication, pause/resume,
    CPU-only/new-impact observation, Player 1/stale impact rejection, recreation, and stale
    disposal callbacks.
- `src/main.ts`
  - Forwards `config.mode` and `config.cpuTierId` to the match runtime; no menu, loadout, or
    controller flow changed.
- This report.

No specs, golden vectors, world code, CPU math, UI flow, loadout, controller, or Git repository
state were changed. No subagents were dispatched.

## Source-of-truth, purity, and golden audit

- The runtime imports command/memory functions and `CpuTierId` from `sim/cpu.ts`; it does not copy
  CPU constants or implement a solver.
- The command uses `state.rng`, the live tank positions/direction/wind, and the owned
  `lastResolvedShotImpact` source of truth. It does not mutate phase/projectiles directly.
- HE is located by stable Player 2 arsenal position, then selected and fired through guarded world
  APIs.
- `src/sim/cpu.ts` still has no `Math.random`, DOM, Canvas, window, document, render, or UI import.
- `spec/test-vectors.json` SHA-256 remains
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- `spec/cpu.json` SHA-256 remains
  `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`.

## Self-review

**PASS.** The coordinator is runtime-owned, is unreachable in local mode, cannot automate Player
1, resets with the runtime, and is gated by the existing frame-level pause/disposal checks. It
observes only a new Player 2 identity before choosing the next command, preserves normal fixed-step
scheduling and disposal, and leaves Task 4 UI/loadout/controller work untouched.

## Concern

The complementary suite command was run with:

```powershell
npm test -- --configLoader runner --exclude src/app/matchRuntime.test.ts --exclude src/sim/cpu.test.ts --exclude src/sim/world.test.ts
```

but this runner facade returned only Vitest’s `RUN` header and no final pass/fail payload, so it is
not completion evidence. The required focused gate (71/71) and strict TypeScript check are fresh,
successful evidence; the full-remainder result needs re-running in an environment that returns
Vitest’s completion summary before claiming whole-suite green.
