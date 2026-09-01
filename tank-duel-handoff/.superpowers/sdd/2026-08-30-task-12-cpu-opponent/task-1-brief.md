# Task 1 brief — strict CPU registry and pure bracketing model

Implement Task 1 from the approved Task 12 plan with strict TDD.

## Authority and boundaries

- Read `spec/cpu.json` and `docs/superpowers/specs/2026-08-30-task-12-cpu-opponent-design.md`.
- `spec/cpu.json` owns every algorithm value; production must not duplicate its numbers.
- Never edit or regenerate `spec/test-vectors.json`.
- CPU code belongs under `src/sim/`, uses seeded `Rng`, and imports no DOM, Canvas, UI, render, wall-clock, or `Math.random`.
- This checkpoint does not change world state, runtime, controller, menus, loadout, or Task 13 behavior.

## Files and interfaces

- Create `src/sim/cpu.ts` and `src/sim/cpu.test.ts`.
- Produce `CpuTierId`, `CpuTier`, frozen `CPU_TIERS`, `CPU_RULES`, `cpuTierById(id)`, and strict `parseCpuSpec(value: unknown)`.
- Produce immutable `CpuMemory` with `lastImpactX`, `lastWind`, and `lastAppliedPower`; `createCpuMemory()`, `observeCpuImpact(...)`, and `chooseCpuCommand(...)`.
- `chooseCpuCommand` consumes tier, memory, opening distance, target x, direction, wind, and seeded `Rng`; it returns immutable elevation/power.

## Required behavior

- Strict parser accepts the checked-in JSON and rejects missing/extra keys, wrong algorithm order,
  duplicate/reordered tiers, invalid IDs/names, non-finite or out-of-range values, malformed measured
  records, invalid hit definition, gains, clamp, or elevation.
- Opening power follows the spec opening formula and fixed elevation.
- Later power starts from `memory.lastAppliedPower`, adds observed miss correction and wind-delta
  correction with parsed gains/tier skill, clamps in the published order, then applies proportional
  seeded jitter.
- Positive error means short according to the CPU's firing direction.
- Recruit applies no wind correction; Veteran applies it fully.
- Identical inputs/seeds produce identical commands. Input memory and returned records are frozen;
  no target-derived true solution is used after the opening command.
- Tests must independently derive literal expectations and name the production mutation they catch.

## TDD and verification

1. Add registry tests and run them before `cpu.ts`; record expected module-missing RED.
2. Implement the minimal strict registry and reach GREEN.
3. Add command/memory tests and record behavioral RED before command implementation.
4. Implement minimal command/memory behavior and refactor only while green.
5. Run with TEMP/TMP on D:\codex-temp:
   `npm test -- --configLoader runner src/sim/cpu.test.ts src/sim/purity.test.ts`
   and `npx tsc --noEmit`.
6. Verify the golden SHA-256 remains the established value.

Write full RED/GREEN evidence, commands/counts, equations/operation order, changed files,
source-of-truth/purity/golden audit, self-review, and concerns to `task-1-report.md` in this plan
workspace. Do not initialize Git and do not dispatch subagents.
