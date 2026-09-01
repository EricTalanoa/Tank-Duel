# Task 10 Checkpoint 4 Report — Wrapped simulation interactions

## Outcome

Checkpoint 4 is implemented in the shared workspace. Wrapping worlds now use modulo terrain
collision and edits, nearest-copy hull collision, shortest wrapped splash/zone distance, and
unbounded projectile/roller/burrow coordinates. Persistent impact and fire-zone x coordinates
are canonical. Non-wrapping horizontal edge behavior remains covered and unchanged. No Task 5
camera or rendering tiling was implemented.

## TDD evidence

All commands used `TEMP=D:\codex-temp`, `TMP=D:\codex-temp`, and
`npm_config_cache=D:\codex-npm-cache` because C: is full.

### RED cycle 1

Command:

`npm test -- src/sim/presentation.test.ts src/sim/damage.test.ts src/sim/weapons.test.ts src/sim/terrain.test.ts src/sim/world.test.ts`

Expected result observed: 9 targeted failures and 62 passes. The failures demonstrated missing
nearest-copy hull checks, wrapped blast distance, wrapped column carving, wrapping Roller and
Bunker Buster behavior, modulo terrain collision, three-lap retention, split seam carving, and
wrapped direct hits.

### GREEN cycle 1

The same command passed: 5 files, 71 tests.

### RED cycle 2

Command:

`npm test -- src/sim/zones.test.ts src/sim/world.test.ts`

Expected result observed: 2 targeted failures and 27 passes. The failures demonstrated linear
fire-zone distance and an uncanonical persistent zone x from an unbounded impact.

The away-facing `fire()` acceptance scenario passed at this integration checkpoint using the HE
demo input imported from `spec/shells.json`; its underlying wrap collision, direct-hit, edge, and
trail branches had already failed in RED cycle 1.

### GREEN cycle 2

The same command passed: 2 files, 29 tests.

### Focused regression verification

Command:

`npm test -- src/sim/world.test.ts src/sim/damage.test.ts src/sim/presentation.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts src/sim/exotic-terrain.test.ts src/sim/terrain.test.ts src/sim/zones.test.ts src/sim/collapse.test.ts`

Result: 9 files, 87 tests passed.

The three-lap test was then strengthened to launch from `fire()` at spec-owned maximum power;
`npm test -- src/sim/world.test.ts` passed 27 tests.

## Final verification

- `npm test`: 37 files, 296 tests passed.
- `npm run build`: TypeScript and Vite completed successfully; 43 modules transformed.
- Production simulation purity scan found no new DOM, Canvas, `window`, or `Math.random` use.
- `spec/test-vectors.json` was not changed or regenerated.

## Changed files

- `src/sim/damage.ts`
- `src/sim/damage.test.ts`
- `src/sim/presentation.ts`
- `src/sim/presentation.test.ts`
- `src/sim/terrain.ts`
- `src/sim/terrain.test.ts`
- `src/sim/weapons.ts`
- `src/sim/weapons.test.ts`
- `src/sim/world.ts`
- `src/sim/world.test.ts`
- `src/sim/zones.ts`
- `src/sim/zones.test.ts`
- `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-4-report.md`
- `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/progress.md`

## Notes and concerns

- The first build attempt exposed one obsolete `EMPTY_RANGE` import after dirty-range dispatch was
  converted to arrays. Removing that import made the strict build green; no runtime behavior was
  involved.
- C: remains effectively full. Verification must continue using the D: temp/cache locations.
- This workspace is not a Git repository, so no commit was created.
- Camera tracking and tiled visual copies are intentionally deferred to checkpoint 5.
