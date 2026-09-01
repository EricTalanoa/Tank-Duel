# Task 3 Report — Wrapped terrain collision and split edits

## Delivered

- Added `DirtyRanges`, `solidAtWrapped`, `carveWrapped`, and `fillWrapped` in `src/sim/terrain.ts`.
- Wrapped circular edits normalize each touched horizontal column, preserve vertical bounds, return split seam ranges with repaint padding, and use shortest wrapped hull membership for fill exclusions.
- Added split-range repaint support through `paintRanges` and `TerrainLayer.repaintRanges`.
- Added `enqueueCollapseRanges` so split terrain ranges activate only their own collapse columns.
- Kept existing non-wrapped terrain functions and world/projectile/camera wiring unchanged.

## TDD evidence

- RED: `npm test -- src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts` failed with five missing wrapped/split API contracts.
- GREEN: the same focused command passed: 3 files, 29 tests.

## Verification

- `npm run build` passed.
- Full suite passed serially with its temporary files and npm cache redirected to D: because C: was full: 37 files, 279 tests.

## Concern

- The C: volume has no free space. The normal parallel full-suite attempt failed with `ENOSPC`; the verified serial rerun used D: temporary storage.

## Fix Round 1

### Changes

- Replaced wrapped terrain circle bound math in `src/sim/terrain.ts` with `Math.floor`/`Math.ceil` helpers so wrapped carve/fill dirty ranges and writes stay correct for finite centres beyond signed 32-bit, including large negative x.
- Added regression coverage in `src/sim/terrain.test.ts` for `carveWrapped` and `fillWrapped` with `x > 2^31` and large negative x, asserting canonical seam writes and split dirty ranges.
- Reworked `src/sim/collapse.ts` so `CollapseQueue` stores sorted active canonical intervals instead of scanning a width-sized bitmap every step.
- Added `CollapseStep.dirtyRanges` for split collapse output while preserving the existing merged `dirty` field for current compilation consumers.
- Extended `src/sim/collapse.test.ts` to verify ascending active interval storage, split dirty propagation, and active-column-only iteration.

### Commands

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm test -- src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts
```

```text
> tank-duel@0.1.0 test
> vitest run src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts

 RUN  v4.1.11 C:/Users/erict/Desktop/Personal Projs/Tank Duel/tank-duel-handoff

 ❯ src/sim/terrain.test.ts (20 tests | 2 failed) 52ms
     × carveWrapped preserves >2^31 centres as the same canonical seam write and dirty ranges 10ms
     × fillWrapped preserves large negative centres as the same canonical seam write and dirty ranges 2ms
 ❯ src/sim/collapse.test.ts (5 tests | 2 failed) 41ms
     × stores only active canonical intervals in ascending order 6ms
     × enqueues split dirty intervals without scanning the untouched middle columns 1ms

 Test Files  2 failed | 1 passed (3)
      Tests  4 failed | 28 passed (32)
```

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm test -- src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts
```

```text
> tank-duel@0.1.0 test
> vitest run src/sim/terrain.test.ts src/render/terrainLayer.test.ts src/sim/collapse.test.ts

 RUN  v4.1.11 C:/Users/erict/Desktop/Personal Projs/Tank Duel/tank-duel-handoff

 Test Files  3 passed (3)
      Tests  32 passed (32)
```

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm run build
```

```text
> tank-duel@0.1.0 build
> tsc --noEmit && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 43 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.65 kB │ gzip:  0.40 kB
dist/assets/index-BCINew1Y.css   1.64 kB │ gzip:  0.74 kB
dist/assets/index-H3Se4yuq.js   53.11 kB │ gzip: 19.92 kB

✓ built in 151ms
```

### Notes

- One intermediate green run exposed a wrong hand-derived row expectation in the new large-negative `fillWrapped` test; the test literal was corrected to include the wrapped `x=0` pixel before the final passing run above.
- No Git repository was present, so no commit or diff-based report was produced.

## Fix Round 2

### Changes

- Removed the legacy merged `CollapseStep.dirty` field from `src/sim/collapse.ts`; collapse now reports only `dirtyRanges`.
- Changed `GameState.terrainDirty` in `src/sim/world.ts` from `DirtyRange | null` to `DirtyRanges`, preserving non-wrapped terrain updates as one-element arrays and merging only overlapping/adjacent intervals on the same side.
- Updated current consumers in `src/render/renderer.ts` and `src/main.ts` to repaint arrays of dirty ranges directly instead of a single merged range.
- Added regression coverage in `src/sim/world.test.ts` and `src/sim/collapse.test.ts` so this round fails if a seam-split collapse range is merged back into one full-width interval or if the legacy `dirty` field reappears.

### Commands

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm test -- src/sim/collapse.test.ts src/sim/world.test.ts src/sim/terrain.test.ts
```

```text
> tank-duel@0.1.0 test
> vitest run src/sim/collapse.test.ts src/sim/world.test.ts src/sim/terrain.test.ts

 RUN  v4.1.11 C:/Users/erict/Desktop/Personal Projs/Tank Duel/tank-duel-handoff

 ❯ src/sim/collapse.test.ts (5 tests | 1 failed) 61ms
     × enqueues split dirty intervals without scanning the untouched middle columns 10ms
 ❯ src/sim/world.test.ts (20 tests | 1 failed) 726ms
     × keeps split collapse dirty ranges split during settle instead of merging them across the field 30ms

 Test Files  2 failed | 1 passed (3)
      Tests  2 failed | 43 passed (45)
```

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm test -- src/sim/collapse.test.ts src/sim/world.test.ts src/sim/terrain.test.ts
```

```text
> tank-duel@0.1.0 test
> vitest run src/sim/collapse.test.ts src/sim/world.test.ts src/sim/terrain.test.ts

 RUN  v4.1.11 C:/Users/erict/Desktop/Personal Projs/Tank Duel/tank-duel-handoff

 Test Files  3 passed (3)
      Tests  45 passed (45)
```

```powershell
$env:TEMP='D:/codex-temp'; $env:TMP='D:/codex-temp'; $env:npm_config_cache='D:/codex-npm-cache'; npm run build
```

```text
> tank-duel@0.1.0 build
> tsc --noEmit && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 43 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.65 kB │ gzip:  0.40 kB
dist/assets/index-BCINew1Y.css   1.64 kB │ gzip:  0.74 kB
dist/assets/index-DiXvBnlB.js   53.35 kB │ gzip: 20.00 kB

✓ built in 102ms
```
