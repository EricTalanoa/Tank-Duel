# Task 7 Loadout and Full Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the twelve-shell Task 7 roster with a valid six-position loadout, stable controls, icons, and every exotic/utility hook.

**Architecture:** Spec-backed weapon data drives generic hook dispatch and a pure loadout model. Simulation owns equipped decks, projectiles, zones, cooldowns, and terrain effects; a DOM loadout overlay and Canvas deck HUD read that state without owning gameplay.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, Canvas 2D, DOM/CSS masks

**Spec:** `docs/superpowers/specs/2026-08-28-task-7-loadout-roster-design.md`

## Global Constraints

- `spec/*.json` is authoritative; never copy gameplay values from prose into code.
- Add approved Drill `widthPx` to `spec/shells.json`; import it everywhere else.
- Playable roster is HE through Napalm plus Repair, excluding Anvil.
- Skipper is scripted forward motion, never physical reflection.
- Any projectile-spawning/repositioning hook sets imported collision grace.
- HE is free, always equipped, and deck position 1; five optional positions share the imported point budget.
- Every UI surface naming a shell renders its imported icon.
- No DOM/Canvas/`Math.random` under `src/sim/`; preserve fixed-step determinism.
- The project has no Git metadata, so commit steps are omitted.

---

### Task 1: Full Roster Types and Drill Spec Completion

**Files:** Modify `spec/shells.json`, `src/sim/shells.ts`, `src/sim/weapons.ts`; test `src/sim/weapons.test.ts`.

**Produces:** `PLAYABLE_WEAPONS`, typed skip/airburst/drill/MIRV/scorch/heal hooks, and startup hook validation.

- [ ] Write a failing test asserting playable IDs are `he,mortar,cluster,buster,roller,sand,skipper,airburst,drill,mirv,napalm,repair`, Anvil is absent, and Drill exposes numeric `widthPx`.
- [ ] Run `npm test -- src/sim/weapons.test.ts`; verify RED.
- [ ] Add `widthPx: 22` to Drill's spec hook, define discriminated hook types, replace `STANDARD_WEAPONS` internals with `PLAYABLE_WEAPONS`, and retain the old export as the first-six compatibility view.
- [ ] Validate MIRV's split counts multiply to `totalSubmunitions` and throw on malformed spec data.
- [ ] Run focused tests and full suite; verify GREEN.

### Task 2: Pure Loadout Model

**Files:** Create `src/sim/loadout.ts`, `src/sim/loadout.test.ts`.

**Produces:** `createLoadout(ids?)`, `toggleShell(loadout,id)`, `validateLoadout`, `equippedWeapons`, `DEFAULT_LOADOUT`.

- [ ] Write failing tests proving HE is locked at position 1, optional selections cannot exceed `CONSTANTS.loadout.slots`, total cost cannot exceed `CONSTANTS.loadout.points`, and Anvil/unknown IDs are rejected.
- [ ] Include this behavior test:

```ts
const loadout = createLoadout();
for (const id of ['mortar', 'cluster', 'buster', 'roller', 'sand']) toggleShell(loadout, id);
expect(equippedWeapons(loadout)[0]?.shell.id).toBe(CONSTANTS.loadout.freeShell);
expect(validateLoadout(loadout)).toEqual({ valid: true, pointsUsed: 10, optionalSlotsUsed: 5 });
```

- [ ] Verify RED, implement the minimal immutable-ID model using spec costs, then verify GREEN.

### Task 3: Stable Match Decks and Ammo Fallback

**Files:** Modify `src/sim/world.ts`, `src/sim/world.test.ts`, `src/input/controls.ts`, `src/input/controls.test.ts`.

**Produces:** `CreateWorldOptions.loadoutIds`, six-position `Arsenal.slots`, deck-position selection, and HE fallback.

- [ ] Write failing tests that construct a chosen six-shell deck, map keys 1-6 to those exact IDs, spend a finite shell to zero, keep its position, and fall back selection to HE.
- [ ] Verify RED.
- [ ] Initialize both player arsenals from `createLoadout`, make `selectShell` accept deck position rather than global spec slot, and fall back after spent selection/fire.
- [ ] Derive accepted keyboard digits from the active six deck positions rather than global shell slots.
- [ ] Run world/input tests and full suite; verify GREEN.

### Task 4: Scripted Skipper

**Files:** Modify `src/sim/ballistics.ts`, `src/sim/weapons.ts`, `src/sim/weapons.test.ts`.

**Produces:** projectile `bounceCount`, scripted skip handling, and terminal contact after configured skips.

- [ ] Write a failing test using flat terrain that records contact x values and asserts exactly three repositioning bounces, every x farther in firing direction, retained velocity from hook data, and collision grace after each bounce.
- [ ] Verify RED.
- [ ] Add `bounceCount`; on contact before `maxBounces`, retain horizontal direction and multiply speed by `horizontalRetention`, set `vy = -abs(vx) * relaunchAngleFactor`, increment count, and set collision grace. Detonate on the next contact.
- [ ] Run focused tests and verify GREEN.

### Task 5: Airburst and MIRV Staging

**Files:** Modify `src/sim/ballistics.ts`, `src/sim/weapons.ts`, `src/sim/world.ts`; test `src/sim/exotic-projectiles.test.ts`.

**Produces:** `runAltitudeHook`, staged `runApexHook`, `splitDepth`, `stageAgeFrames`, and `altitudeArmed`.

- [ ] Write a failing minimum-power/minimum-elevation Airburst test proving no split occurs at the muzzle.
- [ ] Write a failing armed/descent test proving exactly the configured bomblets appear at configured spacing with zero horizontal velocity and collision grace.
- [ ] Write a failing MIRV test advancing a real parent and children until exactly nine terminal children exist; assert no child has depth above imported `maxDepth`.
- [ ] Verify RED.
- [ ] Implement altitude arming from `surfaceY(x)-y`, descending trigger, and vertical bomblet replacement.
- [ ] Extend apex dispatch for MIRV first stage and age-based second stage, validating final count against `totalSubmunitions`.
- [ ] Integrate both dispatchers into collection-based FLIGHT and verify focused/full suites GREEN.

### Task 6: Drill Column Terrain Effect

**Files:** Modify `src/sim/terrain.ts`, `src/sim/terrain.test.ts`, `src/sim/world.ts`; test `src/sim/exotic-terrain.test.ts`.

**Produces:** `carveColumn(terrain,cx,cy,width,depth): DirtyRange` and generic `terrain:'column'` resolution.

- [ ] Write failing tests at center, left edge, right edge, and floor; assert only the imported width/depth rectangle changes and no out-of-bounds access occurs.
- [ ] Verify RED.
- [ ] Implement clamped half-open column carving and dispatch it from shell terrain type using typed hook values.
- [ ] Queue the exact dirty range for collapse; verify focused/full suites GREEN.

### Task 7: Napalm Zones

**Files:** Create `src/sim/zones.ts`, `src/sim/zones.test.ts`; modify `src/sim/world.ts`, `src/render/entities.ts`.

**Produces:** `FireZone`, `createFireZone`, `applyRoundBoundaryZones`, `GameState.fireZones`.

- [ ] Write failing tests proving a zone is created from imported hook data, does not decrement on player-1-to-player-2 HANDOFF, damages/decrements once on player-2-to-player-1 wrap, and expires after imported rounds.
- [ ] Verify RED.
- [ ] Add generic scorch detonation and round-boundary processing before wind/next AIM.
- [ ] Render active zones as deterministic surface flame strips without changing zone lifetime in render code.
- [ ] Run focused/full suites and verify GREEN.

### Task 8: Repair Kit No-Flight Action

**Files:** Modify `src/sim/world.ts`, `src/sim/shells.ts`; test `src/sim/repair.test.ts`.

**Produces:** per-player `lastRepairTurn`, generic `onUse` execution, and cooldown selection state.

- [ ] Write failing tests proving Repair creates no projectile, heals by imported amount, caps at imported cap, consumes ammo, ends the turn, and cannot be used on consecutive owner turns.
- [ ] Verify RED.
- [ ] Add typed `noFlight` and heal hook; branch `fire` through generic on-use behavior before launch and record owner turn.
- [ ] Disable illegal selection/use and preserve HE fallback; verify focused/full suites GREEN.

### Task 9: Loadout Overlay and Icon Deck

**Files:** Create `src/ui/loadout.ts`, `src/ui/loadout.css`, `src/ui/loadout.test.ts`; modify `index.html`, `src/main.ts`, `src/render/hud.ts`.

**Produces:** `mountLoadout(root,options)`, shared deck deployment, icon/name cards, and stable in-match chips.

- [ ] Write DOM-independent markup-model tests asserting every card/chip that includes a shell name also includes its imported icon path and disabled/spent state.
- [ ] Verify RED.
- [ ] Build a pre-match overlay with CSS-mask SVG icons, budget/slot counters, locked HE, toggle guards, and deploy callback.
- [ ] Delay world/renderer loop startup until deployment; pass chosen IDs into `createWorld` for both arsenals.
- [ ] Replace text-only HUD shell row with six stable icon chips, visible ammo/mass, selection, and spent greying.
- [ ] Run tests/build and verify GREEN.

### Task 10: Task 7 Acceptance and Browser Verification

**Files:** Create/modify `src/sim/task7-acceptance.test.ts` and affected UI tests only.

- [ ] Audit each Task 7 assertion: MIRV 9/depth 2; Airburst muzzle safety; Skipper three forward skips; Napalm once per round; Repair cooldown/cap; loadout points/slots; stable keys after spent ammo.
- [ ] Add any missing acceptance test first and watch it fail before correcting production behavior.
- [ ] Run `npm run test`; require zero failures.
- [ ] Run `npm run build`; require exit zero and strict types.
- [ ] Browser-test loadout constraints/icons, deployment, all six equipped keys, representative exotic shots, spent fallback, Repair, handoff, and clean console.
- [ ] Stop at Task 7's `Stop here` line.

