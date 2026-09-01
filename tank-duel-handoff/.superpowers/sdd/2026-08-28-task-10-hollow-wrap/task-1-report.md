# Task 1 Report — Shared wrap coordinate contract

## Implementation

Implemented the four pure shared coordinate helpers required by the brief in `src/sim/wrap.ts`:

- `wrapX(x, width)` uses positive modulo to normalize coordinates into `[0, width)`.
- `wrappedDelta(fromX, toX, width)` returns the shortest signed horizontal displacement.
- `nearestWrappedX(canonicalX, referenceX, width)` selects the nearest unbounded copy using `Math.round((referenceX - canonicalX) / width)`.
- `visibleCopyRange(viewX, viewWidth, worldWidth)` returns the finite copy-index range intersecting the half-open camera interval `[viewX, viewX + viewWidth)`.
- All width inputs are rejected when non-positive or non-finite with the descriptive error `width must be a finite number greater than 0`.

No Ring, Hollow, terrain, camera, rendering, or other later-task behavior was implemented.

## Files changed

- Created `src/sim/wrap.ts`.
- Created `src/sim/wrap.test.ts`.
- Created this report file.

## Commands and results

### RED evidence

Command:

```text
npm test -- src/sim/wrap.test.ts
```

Result: failed as expected before implementation because `./wrap` was absent:

```text
Error: Cannot find module './wrap' imported from .../src/sim/wrap.test.ts
Test Files  1 failed (1)
Tests  no tests
EXIT_CODE=1
```

### GREEN evidence

Command:

```text
npm test -- src/sim/wrap.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests  5 passed (5)
EXIT_CODE=0
```

Command:

```text
npm run build
```

Result: TypeScript check and Vite production build passed with exit code 0.

Command:

```text
npm test
```

Result:

```text
Test Files  37 passed (37)
Tests  256 passed (256)
EXIT_CODE=0
```

## Self-review

- Tests cover negative and boundary normalization, shortest seam deltas in both directions, nearest copies multiple map widths away, half-open visible-copy boundaries including negative view coordinates, and invalid widths for every helper.
- Production code is pure TypeScript under `src/sim`; it has no DOM, Canvas, randomness, or external dependencies.
- The implementation is limited to the exact Task 1 files and does not alter spec data or later-task systems.
- The visible range uses `floor(viewX / worldWidth)` and `ceil((viewX + viewWidth) / worldWidth) - 1`, so an interval ending exactly at a tile boundary excludes the next tile.

## Concerns

None. The workspace is not a Git repository, so no commit was attempted.
