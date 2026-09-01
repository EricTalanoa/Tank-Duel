# Task 1 Brief — Shared wrap coordinate contract

## Context

This is the first implementation checkpoint for Task 10. It establishes pure coordinate helpers used later by terrain, simulation, camera, and rendering. Do not implement Ring, Hollow, terrain edits, camera changes, or rendering in this checkpoint.

## Global constraints

- `spec/*.json` owns every gameplay and generator value; production imports rather than retyping documentation numbers.
- `spec/test-vectors.json` remains immutable golden reference data.
- Projectile/trail x is unbounded; world-owned x is canonical in `[0, width)`.
- Non-wrap behavior must remain unchanged.
- This workspace is not a Git repository; do not attempt commits.
- Follow TDD: write tests, run and capture expected red, implement, run green, and build.

## Files

- Create `src/sim/wrap.ts`.
- Create `src/sim/wrap.test.ts`.

## Required interfaces

- `wrapX(x: number, width: number): number`
- `wrappedDelta(fromX: number, toX: number, width: number): number`
- `nearestWrappedX(canonicalX: number, referenceX: number, width: number): number`
- `visibleCopyRange(viewX: number, viewWidth: number, worldWidth: number): { readonly first: number; readonly last: number }`

## Required behavior

- `wrapX(-1, 1200) === 1199`.
- `wrapX(1200, 1200) === 0`.
- Shortest deltas choose ±300 rather than ±900 for points separated across a 1200 px seam.
- Nearest copies remain adjacent to references beyond three map widths.
- Visible copy indices include exactly the world tiles intersecting the half-open camera interval `[viewX, viewX + viewWidth)`.
- All helpers reject non-positive or non-finite widths with a descriptive error.
- Use positive modulo `((x % width) + width) % width` and derive nearest copies by rounding `(referenceX - canonicalX) / width`.

## Verification

- RED: `npm test -- src/sim/wrap.test.ts` fails because the module/exports are absent.
- GREEN: the focused test passes with pristine output.
- `npm run build` passes.
- Write the full implementation/TDD report to `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-1-report.md`.
