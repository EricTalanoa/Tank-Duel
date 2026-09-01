# Task 5 Standard Shells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the six-shell standard deck with deterministic hook-driven flight, terrain behavior, selection, ammunition, and rendering.

**Architecture:** A spec-backed weapon registry attaches optional data-driven hooks to generic projectiles. The world advances a projectile collection, queues impacts, and resolves every detonation through shared damage and terrain paths before one settle pass.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, Canvas 2D, JSON modules

**Spec:** `docs/superpowers/specs/2026-08-27-task-5-standard-shells-design.md`

## Global Constraints

- `spec/*.json` is the source of truth; gameplay values must be imported, not copied from prose documentation.
- `spec/test-vectors.json` contains immutable golden values and must never be regenerated to fit implementation output.
- Implement Task 5 only and stop at its `Stop here` line in `TASKS.md`.
- Keep simulation deterministic: seeded RNG only, fixed `DT`, and no DOM access under `src/sim/`.
- Use eight normal collision substeps and set repositioned/spawned projectiles to `spec/constants.json -> settle.collisionGraceSubsteps`.
- Damage remains owner-neutral and terrain remains owner-neutral.
- The project directory has no Git metadata, so commit steps are intentionally omitted.

## File Map

- Create `src/sim/weapons.ts`: typed standard-deck registry and generic hook dispatch.
- Create `src/sim/weapons.test.ts`: registry, apex split, burrow, roll, and grace tests.
- Create `src/sim/standard-shells.test.ts`: Task 5 acceptance and full-world integration tests.
- Modify `src/sim/shells.ts`: complete spec-backed shell and hook types.
- Modify `src/sim/ballistics.ts`: generic projectile metadata and substep collision grace.
- Modify `src/sim/ballistics.test.ts`: fixed golden maximum-range coverage and grace regression.
- Modify `src/sim/world.ts`: deck state, selection, multi-projectile flight, queued impacts, shared resolution.
- Modify `src/sim/world.test.ts`: selection, ammunition, phase gating, and backward-compatible HE flow.
- Modify `src/render/entities.ts`: render all live projectiles and child trails.
- Modify `src/render/hud.ts`: selected shell and ammunition.
- Modify `src/input/controls.ts`: stable number-key shell selection callback.
- Modify `src/main.ts`: connect number-key selection to simulation.

---

### Task 1: Spec-Backed Standard Weapon Registry

**Files:**
- Modify: `src/sim/shells.ts`
- Create: `src/sim/weapons.ts`
- Create: `src/sim/weapons.test.ts`

**Interfaces:**
- Consumes: default export of `spec/shells.json`.
- Produces: `STANDARD_SHELL_IDS`, `STANDARD_WEAPONS`, `weaponById(id)`, typed `ShellHooks`, and `Weapon`.

- [ ] **Step 1: Write the failing registry tests**

```ts
import rawShells from '../../spec/shells.json';
import { describe, expect, it } from 'vitest';
import { STANDARD_SHELL_IDS, STANDARD_WEAPONS, weaponById } from './weapons';

describe('standard weapon registry', () => {
  it('loads the prototype deck from shell slots 1 through 6', () => {
    const expected = rawShells.filter((shell) => shell.slot <= 6).map((shell) => shell.id);
    expect(STANDARD_SHELL_IDS).toEqual(expected);
    expect(STANDARD_WEAPONS.map((weapon) => weapon.shell.id)).toEqual(expected);
  });

  it('keeps HE hook-free and preserves spec hook data', () => {
    expect(weaponById('he').hooks).toEqual({});
    expect(weaponById('cluster').hooks.onApex).toEqual(
      rawShells.find((shell) => shell.id === 'cluster')?.hooks?.onApex,
    );
  });
});
```

- [ ] **Step 2: Run `npm test -- src/sim/weapons.test.ts` and verify RED because `weapons.ts` does not exist**

- [ ] **Step 3: Expand shell types and implement the registry**

Define discriminated hook-data types matching the JSON shapes used by the first six
shells. Extend `Shell` with `slot`, `ammo`, `cost`, and optional `hooks`. In
`weapons.ts`, derive the standard deck with `shell.slot <= 6`, freeze its ordered IDs,
and throw for unknown IDs. Do not duplicate shell values in the registry.

```ts
export interface Weapon {
  readonly shell: Shell;
  readonly hooks: ShellHooks;
}

export const STANDARD_WEAPONS: readonly Weapon[] = SHELLS
  .filter((shell) => shell.slot <= 6)
  .map((shell) => ({ shell, hooks: shell.hooks ?? {} }));

export const STANDARD_SHELL_IDS = STANDARD_WEAPONS.map((weapon) => weapon.shell.id);

export function weaponById(id: string): Weapon {
  const weapon = STANDARD_WEAPONS.find((candidate) => candidate.shell.id === id);
  if (!weapon) throw new Error(`Unknown standard weapon: ${id}`);
  return weapon;
}
```

- [ ] **Step 4: Run the focused test and then `npm run test`; verify GREEN**

---

### Task 2: Projectile Metadata and Collision Grace

**Files:**
- Modify: `src/sim/ballistics.ts`
- Modify: `src/sim/ballistics.test.ts`

**Interfaces:**
- Consumes: `CONSTANTS.substeps` and the collision-grace value loaded through `CONSTANTS.settle`.
- Produces: projectile `apexDone`, `collisionGraceSubsteps`, `sourceId`, `mode`, `ageFrames`; `ProjectileStep.substepsAdvanced`.

- [ ] **Step 1: Write a failing grace test**

```ts
it('ignores exactly the configured number of terrain checks after repositioning', () => {
  const projectile = launchProjectile({
    x: 10, y: 10, angleDeg: 0, power: CONSTANTS.power.min,
    direction: 1, shell: HE_SHELL,
  });
  projectile.collisionGraceSubsteps = CONSTANTS.settle.collisionGraceSubsteps;
  let checks = 0;
  stepProjectile(projectile, {
    gravityMultiplier: terraSpec.gravity,
    airDrag: terraSpec.airDrag,
    wind: 0,
    solidAt: () => { checks++; return true; },
  });
  expect(checks).toBe(0);
  expect(projectile.collisionGraceSubsteps).toBe(
    CONSTANTS.settle.collisionGraceSubsteps - CONSTANTS.substeps,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED because the projectile has no grace state**

- [ ] **Step 3: Add generic metadata and decrement grace per substep**

Initialize generic fields in `launchProjectile`. In `stepProjectile`, run integration on
every substep but call `solidAt` only when grace is zero; otherwise decrement grace.
Track the transition from rising to falling without invoking weapon behavior here.

- [ ] **Step 4: Run `npm test -- src/sim/ballistics.test.ts` and verify GREEN with all existing golden tests unchanged**

---

### Task 3: Cluster Apex Hook

**Files:**
- Modify: `src/sim/weapons.ts`
- Modify: `src/sim/weapons.test.ts`

**Interfaces:**
- Consumes: `Projectile`, cluster `onApex` data, and `CONSTANTS.settle.collisionGraceSubsteps`.
- Produces: `runApexHook(projectile): Projectile[] | null`.

- [ ] **Step 1: Write failing split and no-resplit tests**

```ts
it('splits Cluster once into the configured child count', () => {
  const parent = fixtureProjectile('cluster');
  parent.vy = 0.1;
  const children = runApexHook(parent);
  const hook = weaponById('cluster').hooks.onApex;
  expect(children).toHaveLength(hook?.split);
  expect(children?.every((child) => child.apexDone)).toBe(true);
  expect(children?.every((child) =>
    child.collisionGraceSubsteps === CONSTANTS.settle.collisionGraceSubsteps,
  )).toBe(true);
  expect(runApexHook(children![0]!)).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify RED because `runApexHook` is absent**

- [ ] **Step 3: Implement the generic apex dispatcher**

Guard on `projectile.apexDone`, `vy >= 0`, and hook presence. Mark the parent complete,
clone exactly `split` children, distribute `vx` symmetrically around the parent with
`spreadVx`, give every child a new trail starting at the split point, and set every
child's `apexDone` and collision grace. Return `null` for no hook or already-complete
lineages.

- [ ] **Step 4: Run the focused test and verify GREEN**

---

### Task 4: Bunker Buster and Roller Terrain Hooks

**Files:**
- Modify: `src/sim/weapons.ts`
- Modify: `src/sim/weapons.test.ts`

**Interfaces:**
- Consumes: terrain sampling, field bounds, hull boxes, and `Projectile`.
- Produces: `TerrainHookContext`, `TerrainHookResult`, and `runTerrainHitHook(projectile, context)`.

- [ ] **Step 1: Write failing Bunker Buster termination tests**

Test a solid-filled fixture with a known incoming unit vector. Assert `detonate` is true,
travel is no greater than `distancePx`, and x/y never leave the context bounds. Repeat
with an impact one pixel from each relevant map boundary.

```ts
expect(Math.hypot(result.x - start.x, result.y - start.y)).toBeLessThanOrEqual(
  weaponById('buster').hooks.onTerrainHit!.distancePx,
);
expect(result.x).toBeGreaterThanOrEqual(0);
expect(result.x).toBeLessThan(context.width);
```

- [ ] **Step 2: Run the Buster tests and verify RED**

- [ ] **Step 3: Implement bounded burrow**

Normalize incoming velocity once, advance at subpixel increments until the spec distance
is consumed, and clamp at the first map boundary. Return one detonation position and no
live projectile. The hook owns the bound; geometry never owns termination.

- [ ] **Step 4: Run Buster tests and verify GREEN**

- [ ] **Step 5: Write four independently failing Roller termination tests**

Build small deterministic surface fixtures and invoke the same rolling step repeatedly.
Use the spec hook object for fuse, climb, and speed values. Assert distinct terminal
reasons: `fuse`, `climb`, `edge`, and `hull`.

```ts
expect(runRollUntilDone(fuseFixture).reason).toBe('fuse');
expect(runRollUntilDone(climbFixture).reason).toBe('climb');
expect(runRollUntilDone(edgeFixture).reason).toBe('edge');
expect(runRollUntilDone(hullFixture).reason).toBe('hull');
```

- [ ] **Step 6: Run Roller tests and verify RED**

- [ ] **Step 7: Implement rolling as a generic hook mode**

On first impact, switch the projectile to `mode: 'rolling'`, preserve horizontal sign,
set collision grace, and initialize age/start height. Each frame move by
`speedPxPerFrame`, sample the first solid y at the new x, reject upward movement larger
than `climbLimitPx`, then check fuse, field edge, and every hull box independently.
Return a discriminated terminal reason for tests and one detonation on termination.

- [ ] **Step 8: Run weapon tests and verify GREEN**

---

### Task 5: Multi-Projectile World and Shared Resolution

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/world.test.ts`
- Create: `src/sim/standard-shells.test.ts`

**Interfaces:**
- Consumes: all hook dispatchers and standard weapon registry.
- Produces: `projectiles: Projectile[]`, `pendingImpacts: PendingImpact[]`, `selectShell(state, slot)`, per-player deck/ammunition state.

- [ ] **Step 1: Write failing deck selection and ammunition tests**

Assert each player starts with stable slots 1-6, HE ammunition is unlimited, finite
counts equal the imported shell spec, selection is AIM-only, empty finite shells cannot
be selected/fired, and one successful fire decrements exactly once.

```ts
expect(selectShell(state, weaponById('mortar').shell.slot)).toBe(true);
const before = state.players[0].ammo.mortar;
expect(fire(state)).toBe(true);
expect(state.players[0].ammo.mortar).toBe(before - 1);
```

- [ ] **Step 2: Run focused world tests and verify RED**

- [ ] **Step 3: Add player deck state and selection**

Store `selectedShellId` and an ammo record per player. Derive initial counts from
`STANDARD_WEAPONS`. Preserve the existing `projectile` property temporarily as a
read-only compatibility alias to the first live projectile while migrating tests and
rendering. `fire` launches the selected shell and consumes finite ammo only after a
successful launch.

- [ ] **Step 4: Run selection tests and verify GREEN**

- [ ] **Step 5: Write a failing Cluster world-integration test**

Fire Cluster on a flat deterministic fixture, advance through apex and impacts, assert
the parent splits once, at most the configured child count remains live, exactly that
many child impacts are queued, and FLIGHT transitions only after all children terminate.

- [ ] **Step 6: Run the integration test and verify RED**

- [ ] **Step 7: Implement collection-based FLIGHT and queued RESOLVE**

For each live projectile: step normal flight or rolling mode; invoke apex hooks after
integration; invoke terrain hooks on collision; queue ordinary impacts; remove terminated
projectiles. Replace split parents with returned children. Enter RESOLVE only when the
collection is empty. In RESOLVE, process every queued impact through one function that
applies owner-neutral blast damage and the shell terrain effect, merge dirty x ranges,
clear the queue, and enter SETTLE once.

- [ ] **Step 8: Run world and integration tests, then the full suite; verify GREEN**

---

### Task 6: Sandbags Terrain Hook and Dig-Out Integration

**Files:**
- Modify: `src/sim/world.ts`
- Modify: `src/sim/standard-shells.test.ts`

**Interfaces:**
- Consumes: existing `fill(terrain, cx, cy, radius, exclusions)` and tank geometry constants.
- Produces: `tankHullBox(tank): Box` and fill detonation behavior.

- [ ] **Step 1: Write a failing hull-exclusion test**

Place both tanks entirely inside a Sandbags blast circle, resolve a Sandbags impact,
then iterate every integer pixel in both boxes and assert none became solid. Include the
firer's box explicitly and assert terrain outside both boxes was filled.

- [ ] **Step 2: Run the focused test and verify RED because resolution only carves**

- [ ] **Step 3: Implement generic terrain-effect resolution**

Dispatch on the shell's spec `terrain` value, not shell ID. For `fill`, derive both
half-open boxes from `hullHalfWidth`, `hullTop`, and `hullBottom`, then call existing
`fill` with both exclusions. For `carve`, retain existing behavior. Reject unsupported
Task 7 terrain kinds if accidentally selected in the Task 5 deck.

- [ ] **Step 4: Run the hull test and verify GREEN**

- [ ] **Step 5: Write a failing one-frame dig-out integration test**

Fill terrain around a live tank without the exclusion helper to construct a buried
state, set phase to SETTLE, step once, and assert the tank's damage-origin pixel is no
longer solid and gravity did not move it downward first.

- [ ] **Step 6: Run the test and verify whether existing settle behavior passes; if it passes, retain it as the Task 5 regression guard**

- [ ] **Step 7: Run `npm run test` and verify GREEN**

---

### Task 7: Golden Maximum Ranges

**Files:**
- Modify: `src/sim/ballistics.test.ts`

**Interfaces:**
- Consumes: `spec/test-vectors.json -> shellMaxRangeOnTerra`, `spawnGapPx`, and shells from the registry.
- Produces: fixed acceptance coverage for all standard shells.

- [ ] **Step 1: Add the golden range table test**

For each standard shell, launch at power 100 and 45 degrees on flat Terra with no wind,
using the same headless integrator as existing golden tests. Assert the measured range
is within the existing ballistics tolerance of its imported golden value and separately
assert every imported value exceeds imported `spawnGapPx`.

```ts
it.each(Object.entries(vectors.shellMaxRangeOnTerra).filter(([id]) =>
  STANDARD_SHELL_IDS.includes(id),
))('%s crosses the Terra spawn gap', (id, goldenRange) => {
  const actual = flatGroundShot(CONSTANTS.power.max, 45, 0, terraSpec, weaponById(id).shell);
  expect(Math.abs(actual.projectile.x - goldenRange)).toBeLessThanOrEqual(10);
  expect(goldenRange).toBeGreaterThan(vectors.spawnGapPx);
});
```

- [ ] **Step 2: Run the focused test and verify RED if any shell parameter is not flowing through generic ballistics**

- [ ] **Step 3: Make only the minimum generic fixture/API correction required; do not alter golden vectors or shell values**

- [ ] **Step 4: Run ballistics tests and verify GREEN**

---

### Task 8: Controls, HUD, and Rendering

**Files:**
- Modify: `src/input/controls.ts`
- Modify: `src/main.ts`
- Modify: `src/render/entities.ts`
- Modify: `src/render/hud.ts`
- Modify: corresponding input/render tests if present; otherwise add focused tests beside each module.

**Interfaces:**
- Consumes: `selectShell`, `state.projectiles`, active-player selection and ammo.
- Produces: stable keys 1-6 and visible shell/ammunition/projectile state.

- [ ] **Step 1: Write a failing input test for number keys**

Dispatch `Digit1` through `Digit6`, assert each produces the corresponding numeric slot,
and verify repeats/default browser behavior follow the existing aim-control policy.

- [ ] **Step 2: Run the input test and verify RED**

- [ ] **Step 3: Add `onShell(slot: number)` to `attachAimControls` and wire it to `selectShell` in `main.ts`**

- [ ] **Step 4: Run the input test and verify GREEN**

- [ ] **Step 5: Update entity rendering to iterate `state.projectiles`**

Draw each live projectile using its own shell accent. Draw each live child trail while
retaining at most three completed turn-level trail groups per player.

- [ ] **Step 6: Update HUD text from spec-backed state**

Show selected shell name, stable slot, and `∞` or remaining finite ammo. Update the AIM
instruction line to mention keys 1-6 without changing phase gating.

- [ ] **Step 7: Run `npm run build` and fix TypeScript errors without weakening types**

---

### Task 9: Task 5 Acceptance and Interactive Verification

**Files:**
- Modify: `src/sim/standard-shells.test.ts`

**Interfaces:**
- Consumes: complete Task 5 public simulation API.
- Produces: one acceptance-focused suite mirroring `TASKS.md` assertions.

- [ ] **Step 1: Audit acceptance coverage line by line**

Ensure named tests directly cover: standard-shell Terra ranges; one Cluster split and no
re-split; all four Roller exits; Buster distance/boundary exits; Sandbags hull exclusion;
and one-frame dig-out. Add any missing failing test before changing production behavior.

- [ ] **Step 2: Run `npm run test` and resolve failures through red-green cycles**

- [ ] **Step 3: Run `npm run build` and require exit code zero**

- [ ] **Step 4: Start the local Vite server and run a browser smoke test**

Verify shell selection is visible, one finite shot decrements ammo once, Cluster visibly
creates multiple projectiles/trails, Sandbags adds terrain, turns still hand off, and the
browser console has no warnings or errors.

- [ ] **Step 5: Stop the server and stop at Task 5's `Stop here` line**

