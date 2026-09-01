# Task 9 Camera and Generators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Rust and Selene, five deterministic terrain generators with validation/fallback, and a phase-aware clamped camera without changing simulation outcomes.

**Architecture:** Spec JSON owns all numeric generator and validation policy values. Pure simulation modules generate and validate terrain using the real ballistics loop; a pure render camera computes a world-space view rectangle that the renderer applies without mutating state.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-08-28-task-9-camera-generators-design.md`

## Global Constraints

- `spec/*.json` is the source of truth; production code imports values rather than retyping documentation numbers.
- `spec/test-vectors.json` is immutable golden reference data and must not be regenerated.
- Task 9 ends at five worlds and five generators (25 combinations); Hollow, wrapping, and Ring remain Task 10.
- Generation, validation, and camera policy remain deterministic and DOM-free.
- This workspace has no Git repository, so each task ends with a test/build checkpoint instead of a commit.

## File Structure

- `spec/generators.json`: generator parameters, validation policy, and known-good fallback seeds.
- `src/sim/generators.ts`: pure heightmap algorithms and generator dispatch.
- `src/sim/terrain.ts`: terrain mask/edit primitives and heightmap-to-mask conversion only.
- `src/sim/terrainValidation.ts`: flatness, bidirectional HE reachability, retry, and fallback orchestration.
- `src/sim/worlds.ts`: five-world registry and world query resolution.
- `src/sim/world.ts`: creation path consumes accepted generated terrain and optional generator selection.
- `src/render/camera.ts`: pure AIM/FLIGHT view calculation and non-wrap clamping.
- `src/render/renderer.ts`: camera transform, HUD separation, and pointer inverse transform.
- `src/main.ts`: resolve the generator query parameter and pass it to world creation.

---

### Task 1: Spec-backed generator configuration

**Files:**
- Modify: `spec/generators.json`
- Create: `src/sim/generators.ts`
- Modify: `src/sim/terrain.ts`
- Create: `src/sim/generators.test.ts`

**Interfaces:**
- Consumes: `Rng.next(): number`, `fillFromHeightmap(terrain, surface): void`.
- Produces: `GeneratorId = 'hills' | 'canyon' | 'craters' | 'plates' | 'spires'`; `SHIPPED_GENERATORS`; `resolveGeneratorId(value, fallback)`; `generateHeightmap(width, height, generator, rng)`; `generate(terrain, generator, rng)`.

- [ ] **Step 1: Move configuration into spec**

  Extend each non-Ring entry with the exact algorithm parameters from the working reference in `docs/03-worlds.html`. Preserve metadata, represent every literal used by production generation in JSON, and add a top-level validation object containing policy values and fallback seeds for all 25 world/generator pairs. Do not alter `spec/test-vectors.json`.

- [ ] **Step 2: Write failing generator tests**

  Add tests that import the JSON, require exactly the five Task 9 IDs, require complete numeric configuration, verify `resolveGeneratorId('ring', 'hills') === 'hills'`, and snapshot deterministic heightmap hashes plus defining shape properties (canyon center depression, plate quantisation, crater depressions/rims, and spire peaks).

- [ ] **Step 3: Confirm the red state**

  Run `npm test -- src/sim/generators.test.ts`. Expect failure because `src/sim/generators.ts` and the expanded schema do not exist.

- [ ] **Step 4: Implement pure generator dispatch**

  Move Hills out of `terrain.ts`; implement midpoint displacement as a shared helper and each Task 9 algorithm as a focused function that reads its literals from the selected JSON entry. Keep Ring outside the exported Task 9 union and throw for unknown IDs.

- [ ] **Step 5: Confirm the green state**

  Run `npm test -- src/sim/generators.test.ts src/sim/terrain.test.ts`, then `npm run build`. Both must pass before continuing.

### Task 2: Five-world registry and selectable generator

**Files:**
- Modify: `src/sim/worlds.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/main.ts`
- Modify: `src/sim/worlds.test.ts`
- Modify: `src/sim/world.test.ts`

**Interfaces:**
- Consumes: `GeneratorId`, `resolveGeneratorId`, world records from `spec/worlds.json`.
- Produces: `WorldId = 'terra' | 'vesper' | 'rust' | 'selene' | 'ferrum'`; typed `WorldPhysics.generator`; `createWorld(seed, { loadoutIds, worldId, generatorId? })`.

- [ ] **Step 1: Write failing registry tests**

  Assert `SHIPPED_WORLDS.map(w => w.id)` contains the five Task 9 worlds in spec order, Rust and Selene import all physics/derived fields verbatim, every default generator is in `SHIPPED_GENERATORS`, and invalid world/generator query values fall back deterministically.

- [ ] **Step 2: Confirm the red state**

  Run `npm test -- src/sim/worlds.test.ts src/sim/world.test.ts`. Expect Rust/Selene lookup and generator-option failures.

- [ ] **Step 3: Expand the typed registry and creation options**

  Add Rust/Selene to `SHIPPED_IDS`, type `WorldPhysics.generator` as `GeneratorId`, resolve `?generator=` once in `main.ts`, and pass the resolved selection into `createWorld`. Use the world's spec generator when no valid override is provided.

- [ ] **Step 4: Confirm the green state**

  Run `npm test -- src/sim/worlds.test.ts src/sim/world.test.ts src/sim/world-ranges.test.ts`, then `npm run build`.

### Task 3: Terrain acceptance, regeneration, and fallback

**Files:**
- Create: `src/sim/terrainValidation.ts`
- Create: `src/sim/terrainValidation.test.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/purity.test.ts`

**Interfaces:**
- Consumes: `generate`, `surfaceY`, `launchProjectile`, `stepProjectile`, HE shell configuration, world physics, spawn/tank constants, and validation policy from spec.
- Produces: `validateSpawnFlatness(terrain, spawnX): boolean`; `hasHeSolution(terrain, world, fromX, toX, direction): boolean`; `validateTerrain(...)`; `generateAcceptedTerrain({ width, height, world, generatorId, seed }): { terrain, acceptedSeed, attempts, usedFallback }`.

- [ ] **Step 1: Write failing validator tests**

  Construct small explicit heightfields to prove flat zones at exactly the imported tolerance pass while one pixel beyond fails. Stub or inject candidate generation to prove a blocked first map is rejected, a later candidate is accepted, retry order is deterministic, and the known-good seed is selected after the imported attempt limit.

- [ ] **Step 2: Write failing real-simulation tests**

  For accepted terrain, assert an HE projectile at the imported validation angle and at least one imported legal power impacts within the imported HE blast radius from left-to-right and right-to-left. Assert a deliberately impassable wall fails at least one direction.

- [ ] **Step 3: Confirm the red state**

  Run `npm test -- src/sim/terrainValidation.test.ts`. Expect module-not-found or missing-export failures.

- [ ] **Step 4: Implement validation with the real ballistics loop**

  Sample `surfaceY` over the configured width around each spawn. For each legal power value, launch HE from the actual tank/muzzle geometry and step against `solidAt(terrain, x, y)` using selected-world gravity, drag, wind policy at deterministic validation wind, and effective HE mass. Accept only if impact distance to target spawn is within HE blast radius in both directions.

- [ ] **Step 5: Implement deterministic candidate progression and fallback**

  Derive each candidate seed from requested seed plus attempt index using existing seeded/hash utilities. After the configured candidate count, generate the pair's spec fallback seed, validate it, and throw a descriptive configuration error if it fails.

- [ ] **Step 6: Wire accepted terrain into world creation**

  Replace direct Hills generation in `createWorld` with `generateAcceptedTerrain`; retain accepted terrain, generator ID, accepted seed, attempt count, and fallback status as inspectable state without changing turn or projectile logic.

- [ ] **Step 7: Verify every combination**

  Parameterize a test over all five worlds and five generators and assert all 25 return accepted terrain with deterministic masks and metadata. Run `npm test -- src/sim/terrainValidation.test.ts src/sim/world.test.ts src/sim/purity.test.ts`, then `npm run build`.

### Task 4: Pure camera policy

**Files:**
- Create: `src/render/camera.ts`
- Create: `src/render/camera.test.ts`

**Interfaces:**
- Consumes: field dimensions, tank positions, active projectile position, phase, viewport aspect ratio, and world wrap flag.
- Produces: `CameraView { x, y, width, height }`; `cameraForState(state, viewport): CameraView`; `clampCamera(view, field): CameraView`.

- [ ] **Step 1: Write failing camera tests**

  Assert AIM views contain both tanks plus imported/spec-derived framing margin; FLIGHT views follow projectile movement; views preserve viewport aspect ratio; and each edge satisfies `x >= 0`, `y >= 0`, `x + width <= field.width`, and `y + height <= field.height` for all five non-wrap worlds.

- [ ] **Step 2: Confirm the red state**

  Run `npm test -- src/render/camera.test.ts`. Expect failure because the camera module does not exist.

- [ ] **Step 3: Implement camera calculation**

  Compute the smallest aspect-correct view around the relevant subjects, clamp oversize views to the whole field, and clamp non-wrap origins to bounds. Keep the module pure and return new immutable values.

- [ ] **Step 4: Confirm the green state**

  Run `npm test -- src/render/camera.test.ts`, then `npm run build`.

### Task 5: Renderer transform and resize invariance

**Files:**
- Modify: `src/render/renderer.ts`
- Create: `src/render/rendererCamera.test.ts`
- Modify: `src/input/controls.test.ts`
- Modify: `src/sim/ballistics.test.ts`

**Interfaces:**
- Consumes: `cameraForState`, `CameraView`.
- Produces: camera-aware `Renderer.draw`; inverse `screenToField` that returns world coordinates; screen-fixed HUD.

- [ ] **Step 1: Write failing transform tests**

  Use a fake canvas/context to draw known AIM and FLIGHT states, then assert the world transform includes camera-origin translation while HUD drawing occurs after restoring world camera state. Assert `screenToField` exactly inverts letterbox plus camera transforms and rejects points outside the visible camera rectangle.

- [ ] **Step 2: Write the resize trajectory regression**

  Launch identical projectiles in two cloned deterministic worlds. Resize/draw one renderer midway, leave the other untouched, then continue equal simulation steps and assert every projectile position/velocity sample and final impact are identical.

- [ ] **Step 3: Confirm the red state**

  Run `npm test -- src/render/rendererCamera.test.ts src/sim/ballistics.test.ts`. Expect camera-transform assertions to fail against whole-field rendering.

- [ ] **Step 4: Apply camera only to world rendering**

  Letterbox the camera view into the canvas, clip to the visible view, translate by negative camera origin, draw sky/terrain/entities/effects in world space, restore, then draw HUD in screen-oriented field coordinates. Store the exact last view and transform for pointer inversion.

- [ ] **Step 5: Confirm the green state**

  Run `npm test -- src/render/rendererCamera.test.ts src/input/controls.test.ts src/sim/ballistics.test.ts`, then `npm run build`.

### Task 6: Integrated verification and Task 9 stop

**Files:**
- Modify only files needed to correct failures discovered by verification; do not add Task 10 behavior.

**Interfaces:**
- Consumes: all Task 9 deliverables.
- Produces: a verified five-world/five-generator build with camera and validation.

- [ ] **Step 1: Run the complete automated suite**

  Run `npm test`. Require every test to pass, including the 25-combination matrix, blocked-map regeneration, resize invariance, and camera bounds.

- [ ] **Step 2: Run the strict production build**

  Run `npm run build`. Require TypeScript and Vite to complete without errors.

- [ ] **Step 3: Browser-test Task 9**

  Start Vite, open Rust/Canyon and Selene/Craters plus representative override combinations, deploy a loadout, aim using pointer input, fire, resize during FLIGHT, and confirm camera tracking, terrain alignment, HUD stability, and a clean console.

- [ ] **Step 4: Re-run verification after browser fixes**

  If browser testing caused any correction, rerun `npm test` and `npm run build` from a fresh command and record their final pass counts/output.

- [ ] **Step 5: Stop at the Task 9 boundary**

  Report the implemented worlds/generators and verification evidence. Do not begin Hollow, wrap logic, seam duplication, or Ring.
