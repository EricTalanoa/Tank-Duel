# Task 10 Hollow and Horizontal Wrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Hollow and seamless Ring terrain with continuous multi-lap projectiles, wrapped world interactions, tiled rendering, and an away-facing hit.

**Architecture:** Flight coordinates remain unbounded while terrain, tanks, and persistent state remain canonical. Shared pure wrap helpers bridge those spaces; rendering tiles canonical world visuals under an unbounded camera, and wrapped terrain edits report split dirty ranges.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-08-28-task-10-hollow-wrap-design.md`

## Global Constraints

- `spec/*.json` owns every gameplay and generator value; production imports rather than retyping documentation numbers.
- `spec/test-vectors.json` remains immutable golden reference data.
- Projectile/trail x is unbounded; world-owned x is canonical in `[0, width)`.
- Non-wrap behavior must remain unchanged.
- Hollow ships with Ring only; non-seamless terrain is not selected for a wrapping world.
- This workspace is not a Git repository, so test/build checkpoints replace commits.

## File Structure

- `src/sim/wrap.ts`: coordinate normalization, shortest delta, and nearest-copy helpers.
- `src/sim/generators.ts`: spec-backed Ring generation and shipped registry.
- `src/sim/terrain.ts`: wrapped collision/edit primitives and split dirty ranges.
- `src/sim/worlds.ts`: Hollow registry entry and wrapping-generator constraint.
- `src/sim/world.ts`: wrapped collision, hull hits, damage, hooks, and dirty-range accumulation.
- `src/sim/damage.ts`, `src/sim/presentation.ts`: optional wrapped-distance/hull APIs.
- `src/render/camera.ts`: unbounded Hollow FLIGHT view and nearest-copy AIM framing.
- `src/render/entities.ts`, `src/render/renderer.ts`: visible world-copy tiling and continuous trail rendering.

---

### Task 1: Shared wrap coordinate contract

**Files:**
- Create: `src/sim/wrap.ts`
- Create: `src/sim/wrap.test.ts`

**Interfaces:**
- Produces: `wrapX(x, width): number`; `wrappedDelta(fromX, toX, width): number`; `nearestWrappedX(canonicalX, referenceX, width): number`; `visibleCopyRange(viewX, viewWidth, worldWidth): { first: number; last: number }`.

- [ ] **Step 1: Write failing boundary tests**

  Assert `wrapX(-1, 1200) === 1199`, `wrapX(1200, 1200) === 0`, shortest deltas choose ±300 rather than ±900, nearest copies remain adjacent to references beyond three map widths, and visible copy indices cover only tiles intersecting a camera rectangle.

- [ ] **Step 2: Verify red**

  Run `npm test -- src/sim/wrap.test.ts`. Expect module-not-found failure.

- [ ] **Step 3: Implement pure helpers**

  Use positive modulo `((x % width) + width) % width`; reject non-positive width with a descriptive error; derive nearest copies by rounding `(referenceX - canonicalX) / width`.

- [ ] **Step 4: Verify green**

  Run `npm test -- src/sim/wrap.test.ts` and `npm run build`.

### Task 2: Ring generator and Hollow registry

**Files:**
- Modify: `spec/generators.json`
- Modify: `src/sim/generators.ts`
- Modify: `src/sim/generators.test.ts`
- Modify: `src/sim/worlds.ts`
- Modify: `src/sim/worlds.test.ts`
- Modify: `src/sim/world-ranges.test.ts`
- Modify: `src/sim/terrainValidation.ts`
- Modify: `src/sim/terrainValidation.test.ts`

**Interfaces:**
- Consumes: Ring parameters from spec, `WorldPhysics.wrap`.
- Produces: `GeneratorId` including `'ring'`; `WorldId` including `'hollow'`; `HOLLOW`; Hollow/Ring accepted-terrain fallback.

- [ ] **Step 1: Write failing Ring tests**

  Assert deterministic output and `abs(h[width - 1] - h[0]) <= mean(abs(h[x] - h[x - 1]))`, while also asserting the seam step is nonzero for the chosen seed.

- [ ] **Step 2: Write failing Hollow profile tests**

  Assert Hollow imports gravity, drag, width, wind, time scale, wrap, generator, and golden power-75/power-100 range/frame values from spec/test-vectors without tolerance changes.

- [ ] **Step 3: Verify red**

  Run `npm test -- src/sim/generators.test.ts src/sim/worlds.test.ts src/sim/world-ranges.test.ts`.

- [ ] **Step 4: Add Ring parameters and implementation**

  Put harmonic count, base-height fraction, amplitude numerator/decay, clamp bounds, and integer frequency start in `spec/generators.json`. Generate phases from seeded RNG and sample each integer-period sinusoid at `x / width`.

- [ ] **Step 5: Ship Hollow with Ring**

  Extend typed registries, enforce Ring whenever `world.wrap` is true, measure a passing Hollow/Ring fallback seed with the existing validator, then store and test that seed in spec.

- [ ] **Step 6: Verify green**

  Run the three focused suites plus `src/sim/terrainValidation.test.ts`, then `npm run build`.

### Task 3: Wrapped terrain collision and split edits

**Files:**
- Modify: `src/sim/terrain.ts`
- Modify: `src/sim/terrain.test.ts`
- Modify: `src/render/terrainLayer.ts`
- Modify: `src/render/terrainLayer.test.ts`
- Modify: `src/sim/collapse.ts`

**Interfaces:**
- Produces: `DirtyRanges = readonly DirtyRange[]`; `solidAtWrapped(terrain, x, y)`; `carveWrapped(terrain, cx, cy, r): DirtyRanges`; `fillWrapped(...)`; renderer repaint accepting `DirtyRanges`.

- [ ] **Step 1: Write failing seam collision/edit tests**

  Create terrain with solids at columns 0 and width-1; assert collision through x=-1/width, a crater at x=0 clears both edges, no row-index overflow occurs, and returned dirty ranges are two bounded intervals rather than `[0,width)`.

- [ ] **Step 2: Verify red**

  Run `npm test -- src/sim/terrain.test.ts src/render/terrainLayer.test.ts`.

- [ ] **Step 3: Implement wrapped primitives**

  Normalize each touched x before mask indexing. Coalesce touched canonical columns into one interval when contiguous or two intervals when crossing the seam. Preserve existing bounded functions unchanged for non-wrap callers.

- [ ] **Step 4: Propagate split dirty ranges**

  Make repaint and collapse enqueue iterate each range independently; keep dirty-column work proportional to edited columns.

- [ ] **Step 5: Verify green**

  Run terrain, terrain-layer, and collapse suites, then `npm run build`.

### Task 4: Wrapped simulation interactions and away-facing hit

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/world.test.ts`
- Modify: `src/sim/damage.ts`
- Modify: `src/sim/damage.test.ts`
- Modify: `src/sim/presentation.ts`
- Modify: `src/sim/presentation.test.ts`
- Modify: `src/sim/exotic-projectiles.test.ts`

**Interfaces:**
- Consumes: wrap helpers and wrapped terrain primitives.
- Produces: optional-width `pointInHull(tank, x, y, wrapWidth?)`; optional-width `applyBlastDamage(..., wrapWidth?)`; world collision/edit logic selected by `state.world.wrap`.

- [ ] **Step 1: Write failing wrapped hit/damage tests**

  Assert a point at x=-5 lies in a hull centered near width, blast distance across the seam uses the short horizontal delta, and non-wrap calls retain ordinary distance.

- [ ] **Step 2: Write failing multi-lap and hook tests**

  Assert Hollow projectile x exceeds one and three world widths without normalization, terrain collision receives canonical x, Roller does not terminate merely at a horizontal seam, and a seam impact carves both edges.

- [ ] **Step 3: Write the failing away-facing acceptance test**

  Use a fixed Hollow/Ring seed and spec-legal HE angle/power. Assert initial velocity points away from the opponent’s nearest canonical direction, the projectile crosses a seam, and round simulation reduces the opponent’s health or records a direct hit.

- [ ] **Step 4: Verify red**

  Run world, damage, presentation, and exotic-projectile suites.

- [ ] **Step 5: Implement wrapped interaction dispatch**

  Keep projectile x unbounded; normalize only terrain/hook centers and persistent impact positions. Pass map width into hull and blast calculations only when wrapping. Disable map-edge termination for wrapping projectile modes.

- [ ] **Step 6: Verify green**

  Run focused suites and `npm run build`.

### Task 5: Unbounded camera and tiled rendering

**Files:**
- Modify: `src/render/camera.ts`
- Modify: `src/render/camera.test.ts`
- Modify: `src/render/entities.ts`
- Create: `src/render/worldCopies.ts`
- Create: `src/render/worldCopies.test.ts`
- Modify: `src/render/renderer.ts`
- Modify: `src/render/rendererCamera.test.ts`

**Interfaces:**
- Consumes: `nearestWrappedX`, `visibleCopyRange`, unbounded projectile/trail positions.
- Produces: `worldCopyOffsets(view, width): readonly number[]`; wrap-aware camera rectangles and tiled draw dispatch.

- [ ] **Step 1: Write failing camera tests**

  Assert Hollow FLIGHT views center projectiles beyond x=width and x=3*width without horizontal clamping; Hollow AIM frames the opponent’s nearest copy; vertical bounds remain clamped; non-wrap assertions remain unchanged.

- [ ] **Step 2: Write failing copy-selection tests**

  Assert a camera spanning a seam draws exactly the required adjacent terrain/tank copies and that a trail from x=1100 through x=1300 remains one continuous local polyline rather than a 1200 px screen jump.

- [ ] **Step 3: Verify red**

  Run camera, world-copy, and renderer-camera suites.

- [ ] **Step 4: Implement tiled world drawing**

  Derive finite tile offsets from the camera view. For each offset, translate and draw terrain plus canonical entities; draw unbounded projectiles/trails once in flight coordinates. Normalize screen input only when a canonical interaction consumes it.

- [ ] **Step 5: Verify green**

  Run render suites and `npm run build`.

### Task 6: Integrated verification and Task 10 stop

**Files:**
- Modify only files required by failures found during verification; do not begin Task 11.

**Interfaces:**
- Consumes: all Task 10 deliverables.
- Produces: feature-complete local play through Task 10.

- [ ] **Step 1: Run full automation**

  Run `npm test`. Require all tests to pass, including Ring seam, split carving, continuous trails, and away-facing hit.

- [ ] **Step 2: Run strict build**

  Run `npm run build` and require TypeScript/Vite exit code 0.

- [ ] **Step 3: Browser-test Hollow**

  Open `?world=hollow&generator=ring` with a fixed seed, deploy, fire through at least one seam, inspect camera/terrain/trail continuity, and check console warnings/errors. Also revisit one non-wrap world.

- [ ] **Step 4: Re-run fresh verification after browser corrections**

  If browser testing changes code, rerun the complete suite and strict build from fresh commands.

- [ ] **Step 5: Stop at Task 10**

  Report evidence and explicitly leave Task 11 menu flow, online play, CPU, and custom ammo untouched.
