# Task 8 Worlds Part One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Terra, Vesper, and Ferrum as complete no-camera world profiles with world-owned physics, deterministic reachability overrides, and fixed-step flight scaling.

**Architecture:** Typed runtime world profiles combine authoritative world JSON with shared constants and own all per-world physics. `GameState` carries one selected profile into ballistics and wind handoff, while a separate deterministic validator derives only the mass overrides needed for shells to cross the world's actual spawn gap. Render-loop flight scaling changes integer step count through a fractional accumulator and never changes simulation timestep.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, deterministic fixed-step Canvas simulation

**Spec:** `docs/superpowers/specs/2026-08-28-task-8-worlds-part-one-design.md`

## Global Constraints

- `spec/*.json` is authoritative; import values and never duplicate gameplay numbers from prose.
- `spec/test-vectors.json` is immutable golden reference data.
- Ship only Terra, Vesper, and Ferrum; camera, wide worlds, wrapping, and non-hills generators remain out of scope.
- Preserve fixed `DT`; flight scaling changes integer step count only.
- Keep `src/sim/` free of DOM, Canvas, wall-clock access, and `Math.random`.
- Preserve Task 7 loadouts and all existing tests.
- The project has no Git metadata, so commit steps are omitted.

---

### Task 1: Typed Runtime World Profiles

**Files:**
- Modify: `src/sim/worlds.ts`
- Create: `src/sim/worlds.test.ts`

**Interfaces:**
- Consumes: `spec/worlds.json`, `CONSTANTS.baseGravity`, `CONSTANTS.windCoefficient`.
- Produces: `WorldId`, `WorldPhysics`, `SHIPPED_WORLDS`, `worldById(id)`, and world-owned `baseGravity`, `windCoefficient`, `flightTimeScale`, `windMode`, and `massOverrides`.

- [ ] Write tests asserting `SHIPPED_WORLDS.map(world => world.id)` equals the imported Terra/Vesper/Ferrum IDs, every profile field equals its source JSON value, and unknown/unshipped IDs throw.
- [ ] Run `npm test -- --run src/sim/worlds.test.ts`; verify RED because the runtime profile API is absent.
- [ ] Build immutable runtime profiles from imported JSON and constants; do not add numeric literals representing gameplay values.
- [ ] Run the focused tests; verify GREEN.

### Task 2: World-Owned Ballistics

**Files:**
- Modify: `src/sim/ballistics.ts`, `src/sim/ballistics.test.ts`, `src/sim/world.ts`, `src/sim/turns.test.ts`

**Interfaces:**
- Consumes: `WorldPhysics` from Task 1.
- Produces: `BallisticsEnvironment.world`, projectile `effectiveMass`, and `GameState.world` selected through `CreateWorldOptions.worldId`.

- [ ] Add failing tests showing ballistics uses `world.baseGravity`, `world.gravity`, `world.windCoefficient`, and `world.airDrag`; createWorld widths match imported profiles; fixed wind persists and reroll wind changes through seeded handoff behavior.
- [ ] Run the focused ballistics/world/turn tests and verify the new assertions fail for the expected Terra-global behavior.
- [ ] Change `stepProjectile(projectile, { world, wind, solidAt })` to derive acceleration from the supplied profile and `projectile.effectiveMass`.
- [ ] Resolve `worldId` in `createWorld`, default to Terra, store `state.world`, derive normal field width from it, and use its wind mode during handoff. Keep explicit width/generator overrides for fixtures.
- [ ] Update existing fixtures to pass `TERRA` explicitly where they call ballistics directly.
- [ ] Run focused tests and the full suite; verify GREEN.

### Task 3: Golden World Ranges and Watched Time

**Files:**
- Create: `src/sim/world-ranges.test.ts`

**Interfaces:**
- Consumes: `SHIPPED_WORLDS`, `spec/test-vectors.json -> worldRanges`, and real launch/step ballistics.
- Produces: acceptance coverage for raw range, map-width crossing, and watched duration.

- [ ] Write a flat-ground shot helper using imported power/elevation values and each selected world profile.
- [ ] Assert power-75 and power-100 HE ranges are within the Task 8 tolerances of imported `worldRanges` values, and each power-100 range exceeds its imported world width.
- [ ] Compute watched seconds as imported flight frames divided by imported simulation frequency and imported flight scale; assert each shipped profile lies within the Task 8 bounds.
- [ ] Run the focused test and verify RED wherever world selection is not yet correctly propagated.
- [ ] Make only the minimal production corrections needed, then rerun focused/full tests to GREEN.

### Task 4: Deterministic Shell Reachability Overrides

**Files:**
- Modify: `src/sim/worlds.ts`, `src/sim/ballistics.ts`, `src/sim/world.ts`
- Create: `src/sim/world-validation.test.ts`

**Interfaces:**
- Consumes: `PLAYABLE_WEAPONS`, world width/gravity/drag, launch constants, and real fixed-step ballistics.
- Produces: `validateWorldShellRanges(world)`, immutable `massOverrides`, and `effectiveMassFor(world,shell)`.

- [ ] Write tests deriving each shipped world's spawn gap from `CONSTANTS.spawnInsetPx`; assert every flight-capable shell's validated max range crosses it, Repair is skipped, and a harsher synthetic profile derives an override smaller than imported mass.
- [ ] Run `npm test -- --run src/sim/world-validation.test.ts`; verify RED because validation/overrides do not exist.
- [ ] Implement a deterministic flat-ground range probe and bounded binary search for the largest passing positive mass. Throw with world/shell IDs if even the search floor cannot cross.
- [ ] Populate immutable override tables once during world initialization and set `Projectile.effectiveMass` from `effectiveMassFor` at launch without mutating shell data.
- [ ] Run focused/full tests and verify GREEN.

### Task 5: Integer Flight Step Scaling

**Files:**
- Modify: `src/render/framePolicy.ts`, `src/render/framePolicy.test.ts`, `src/main.ts`

**Interfaces:**
- Consumes: requested fixed steps, pause state, current phase, and `state.world.flightTimeScale`.
- Produces: `createFlightStepScaler()` and `simulationStepsForFrame(scaler, requestedSteps, paused, phase, flightTimeScale)` returning an integer count while retaining fractional carry.

- [ ] Write failing tests showing non-FLIGHT phases return requested steps, paused frames return zero without consuming carry, imported fractional scales accumulate into integer extra steps, and repeated fixed steps produce identical simulation results regardless of render-frame grouping.
- [ ] Run the focused policy tests and verify RED against the current two-argument function.
- [ ] Implement the scaler with private fractional carry; never alter `DT` or simulation state.
- [ ] Create one scaler per match in `main.ts` and pass current phase/world scale each frame.
- [ ] Run focused/full tests and verify GREEN.

### Task 6: Selection, Dimension Audit, and Acceptance

**Files:**
- Modify: `src/main.ts`
- Create or modify: `src/sim/task8-acceptance.test.ts`

**Interfaces:**
- Consumes: URL `world` query parameter and Task 1–5 APIs.
- Produces: reproducible `?world=terra|vesper|ferrum` startup and complete Task 8 acceptance evidence.

- [ ] Add a failing acceptance test mapping each Task 8 assertion to imported values and scan simulation/render production files for hardcoded field-dimension literals outside world configuration.
- [ ] Verify RED before adding URL world selection and correcting any remaining dimension references.
- [ ] Parse the optional world query parameter in `main.ts`; reject invalid/unshipped values by falling back to Terra without guessing another profile.
- [ ] Run `npm test -- --run`; require zero failures.
- [ ] Run `npm run build`; require strict TypeScript and Vite success.
- [ ] Browser-test all three query-selected worlds, confirm no camera is needed, fire representative shots, and require a clean console.
- [ ] Stop at Task 8's “Stop here” line.
