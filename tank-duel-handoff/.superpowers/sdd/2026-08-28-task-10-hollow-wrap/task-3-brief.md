# Task 3 Brief — Wrapped terrain collision and split edits

## Context

Tasks 1–2 provide wrap helpers, Ring, and Hollow. This checkpoint adds terrain-layer primitives for wrapped collision/edits and efficient split repaint ranges. Do not wire world projectile/damage behavior or camera/render tiling yet; those are Tasks 4–5.

## Global constraints

- `spec/*.json` and immutable `spec/test-vectors.json` remain authoritative.
- Flight x is unbounded; terrain mask x is canonical.
- Non-wrap terrain functions and their existing edge behavior must remain unchanged.
- Wrapped edits must not broaden a seam-crossing change to the entire terrain.
- Terrain repaint/collapse work remains proportional to dirty columns.
- No Git repository exists; do not commit.
- Follow TDD and report red/green evidence.

## Files

- Modify `src/sim/terrain.ts` and `src/sim/terrain.test.ts`.
- Modify `src/render/terrainLayer.ts` and `src/render/terrainLayer.test.ts`.
- Modify `src/sim/collapse.ts` and its tests only as required by split-range propagation.

## Interfaces

- `export type DirtyRanges = readonly DirtyRange[]`.
- `solidAtWrapped(terrain: Terrain, x: number, y: number): boolean` delegates vertical semantics to `solidAt` but wraps horizontal x with `wrapX`.
- `carveWrapped(terrain, cx, cy, r): DirtyRanges`.
- `fillWrapped(terrain, cx, cy, r, exclusions?): DirtyRanges`.
- Preserve existing `solidAt`, `carve`, `fill`, `carveColumn`, `DirtyRange`, and non-wrap behavior.

Wrapped circular edits must normalize each touched x before indexing. A circle centered at either seam must affect the opposite edge without writing outside the mask or wrapping rows. Return one canonical dirty interval if contiguous, or two intervals when the footprint crosses the seam. Each interval keeps the existing one-column repaint padding where possible and must remain within `[0,width]`.

Hull exclusion boxes passed to `fillWrapped` are canonical. A wrapped copy of an excluded hull must remain empty at either side of the seam; use shortest wrapped horizontal membership rather than duplicating boxes into simulation state.

Adapt the terrain layer with either `repaintRanges(ranges: DirtyRanges)` or an overload that iterates each range. Adapt collapse queue callers/helpers to enqueue each interval independently. Existing single-range APIs may remain as convenience wrappers.

## Tests

- Collision: solids at columns 0 and width-1 are visible through x=width and x=-1.
- Carve centered at x=0 clears both edges and leaves middle columns unchanged.
- Fill centered at x=width-1 writes both edges while respecting wrapped hull exclusions.
- No row-index overflow/cross-row corruption.
- Seam-crossing edit returns two bounded ranges, never `[0,width)`.
- Terrain repaint changes only those split ranges and matches a full repaint visually.
- Collapse queue receives/handles both intervals without scanning untouched middle columns.
- Existing non-wrap edge tests remain green.

## Verification

- RED: focused terrain/terrain-layer/collapse tests fail before implementation.
- GREEN: `npm test -- src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts`.
- `npm run build`.
- Full `npm test` once.
- Report to `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-3-report.md`.
