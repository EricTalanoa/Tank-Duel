# Task 3 brief — match runtime CPU scheduling

Implement Task 3 from the approved Task 12 plan with strict TDD.

## Authority and boundaries

- Read current `src/sim/cpu.ts`, `src/sim/cpuTrials.ts`, `src/sim/world.ts`, approved Task 12 design,
  and this brief.
- CPU math stays in `sim/cpu.ts`; runtime owns scheduling/observation only.
- CPU mode is already present in `ResolvedMatchConfig` as `mode` and `cpuTierId`; Task 4 will enable
  its UI flow. Do not implement menu/loadout/controller changes here except necessary `main.ts`
  runtime plumbing.
- Use Player 2 only, HE only, normal `selectShell`/aim adjustment/`fire` guards, seeded world RNG,
  and `lastResolvedShotImpact`; never mutate projectile/phase directly or use a solver.
- Preserve local mode, pause/orientation, fixed timestep, disposal, and golden vectors.

## Required TDD behavior

Before production changes, add runtime tests proving:

- local mode never automates either player;
- CPU mode never automates Player 1;
- Player 2 AIM produces one command and one normal HE fire;
- repeated frames cannot duplicate a shot;
- pause before/during CPU AIM suppresses scheduling, resume fires exactly once;
- only a new Player 2-owned resolved impact is consumed once before the next command;
- Player 1 or stale impact is ignored;
- runtime recreation/rematch starts fresh CPU memory;
- disposal/stale frame callbacks cannot fire.

Record expected RED before implementation.

Implement a runtime-owned coordinator that detects CPU Player 2 AIM, calls `chooseCpuCommand`,
applies returned angle/power through guarded simulation APIs, selects HE via stable arsenal slot, and
calls normal `fire` once. Track the consumed resolved-impact identity. CPU work occurs only in the
same active fixed-step loop and is no-op while paused/disposed.

## Files and verification

- Modify `src/app/matchRuntime.ts`, `.test.ts`, and `src/main.ts` only.
- Run with TEMP/TMP on D:\codex-temp:
  `npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/cpu.test.ts src/sim/world.test.ts`
- Then run the complementary/full regression gate and `npx tsc --noEmit`.
- Never edit specs or `spec/test-vectors.json`.

Write RED/GREEN evidence, exact fire/command/observation counts, pause/resume/disposal behavior,
local-mode proof, changed files, purity/source-of-truth/golden audit, self-review, and concerns to
`task-3-report.md`. Do not initialize Git or dispatch subagents.
