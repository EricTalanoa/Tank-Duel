# Task 4 Brief — Wrapped simulation and away-facing hit

## Context

Tasks 1–3 established wrap helpers, Hollow/Ring registration, wrapped terrain primitives, and split dirty-range propagation. This checkpoint wires horizontal wrapping into simulation while preserving unbounded projectile and trail x coordinates. Camera tiling and visual-copy rendering remain Task 5.

## Global constraints

- `spec/*.json` owns gameplay values; production imports them. Never copy numeric values from docs into production code.
- `spec/test-vectors.json` is immutable golden reference.
- Projectile and trail x coordinates remain unbounded for their complete lifetime.
- Persistent world-owned coordinates remain canonical in `[0, width)`.
- Non-wrapping worlds must retain existing behavior.
- No Git repository exists; do not commit.
- Follow TDD and record RED/GREEN evidence.

## Required behavior

1. In a wrapping world, terrain collision uses `solidAtWrapped`; non-wrap worlds retain `solidAt` and horizontal out-of-bounds termination.
2. Direct hull collision tests the nearest wrapped copy of each canonical tank hull. Extend shared hull helpers with an optional world width or an equally explicit wrapped API.
3. Splash damage measures shortest wrapped horizontal distance. Non-wrap damage remains unchanged.
4. Keep projectile/trail x unbounded throughout flight. Normalize x only when writing persistent world state or indexing terrain.
5. Terrain-changing impacts on a wrapping world use `carveWrapped`/`fillWrapped`, feed every returned interval to collapse, and preserve split dirty ranges end-to-end.
6. Disable horizontal map-edge termination for all wrapping-world projectile behaviors, including exotic projectile paths; preserve vertical/floor termination rules and all non-wrap edge rules.
7. Add a deterministic Hollow scenario in which a tank fires away from the opponent, the shell crosses the seam, and the opponent is hit. Assert the hit and the unbounded projectile/trail path rather than relying on rendering.

## Likely files

- `src/sim/world.ts`, `src/sim/world.test.ts`
- `src/sim/damage.ts` and tests
- `src/sim/presentation.ts` or hull helper module and tests
- exotic projectile modules/tests where horizontal bounds are enforced
- only directly required shared types/fixtures

## Scope guard

Do not implement camera tracking, tiled terrain/tank rendering, or visual seam copies in this checkpoint. Do not regenerate golden vectors. If a behavior is not determined by spec or the approved design, report it instead of inventing a gameplay constant.

## Verification

- Establish focused RED tests before implementation.
- GREEN the directly affected simulation suites.
- Run `npm run build`.
- Run full `npm test` once after focused green, with TEMP/TMP/npm cache redirected to `D:`.
- Write `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-4-report.md` with changed files, RED/GREEN commands, full verification, and concerns.
