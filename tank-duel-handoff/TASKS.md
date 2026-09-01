# TASKS.md — build order

Thirteen tasks. Each is roughly one Claude Code session and each ends with a playable game.
Work them in order and stop at the **Stop here** line.

Acceptance criteria in `[assert]` blocks refer to `spec/test-vectors.json`. Those values
came from a working reference implementation — treat them as fixed and make the code match,
never the other way round.

---

## Task 1 — Skeleton

**Goal:** an empty field that runs a deterministic loop at a fixed timestep.

Create the Vite + TypeScript project, the `sim/` and `render/` split from `CLAUDE.md`,
`sim/rng.ts` (mulberry32), the fixed-timestep loop in `main.ts`, and Vitest.

Load `spec/constants.json` into typed constants — do not retype the numbers.

```
[assert] Two runs with the same seed produce an identical sequence of 1000 RNG values.
[assert] A simulated 5-second frame gap advances the sim by at most 250 ms of steps.
[assert] `npm run test` runs with no browser.
```

**Stop here.** Blank canvas, loop running, tests green.

---

## Task 2 — Terrain

**Goal:** generate, render, and destroy terrain.

`sim/terrain.ts` holds a `Uint8Array` mask, width × height, 1 = solid. Implement
`solidAt`, `carve`, `fill`, and the `hills` generator from `spec/generators.json`.

`render/terrainLayer.ts` paints into an offscreen `ImageData` and repaints only dirty
column ranges on carve. Colour by depth from the surface: scrub → dirt → bedrock.

```
[assert] Carving at x=0 and x=width-1 reads and writes nothing outside the mask.
[assert] Repaint after a crater touches only columns within the crater's x range ±1.
[assert] Same seed produces a byte-identical mask.
```

**Stop here.** You can click to blow holes in a hillside.

---

## Task 3 — Ballistics

**Goal:** one shell, fired, landing where the reference says it lands.

`sim/ballistics.ts` with 8 substeps, gravity × mass, wind acceleration, and optional
air drag (`vx *= 1-drag` per frame, zero on Terra). Add the HE Shell from `spec/shells.json`.

Draw the arc and keep the last 3 trails per player as dotted ghost lines. **Build the
ghost trails now, not later** — bracketing is the game and the trail is the instrument.

```
[assert] terraFlatGroundRange45NoWind — every power from 30 to 80 within ±5 px.
[assert] windDriftAtPower70 — drift at wind ±100 within ±10 px of ±104.
[assert] angleSweepAtPower75 — max range at 45°; 30° and 60° shorter and near-equal.
[assert] A shell at power 100 does not pass through terrain 4 px thick.
```

**Stop here.** You can fire and watch it land correctly.

---

## Task 4 — Turns

**Goal:** a complete, winnable round.

Two tanks, health 100, the five phases from `docs/02-playthrough.html` page 03
(AIM → FLIGHT → RESOLVE → SETTLE → HANDOFF), damage with linear falloff to 25% at the
blast edge, fall damage, wind reroll per turn, and a win condition.

Settle order matters: **dig out before gravity.** Reverse them and a buried tank
soft-locks the turn.

```
[assert] Blast damage at exactly the radius edge is 25% of base, never 0.
[assert] A 40 px fall does 0 damage; 41 px does 0.5.
[assert] Self-damage applies at full value — no owner exemption.
[assert] Calling fire() during FLIGHT or SETTLE is a no-op. Holding fire for 3 s fires once.
[assert] Settle always exits within 600 frames from any state.
[assert] A double KO resolves to a draw, and the draw path is reachable in a test.
```

**Stop here.** Two people can play a full round.

---

## Task 5 — Standard shells

**Goal:** the six-shell deck from the prototype.

Add Heavy Mortar, Cluster Bomb, Bunker Buster, Roller, Sandbags. Implement `weapons.ts`
as a **data table with hooks**, not subclasses — see `docs/04-ammo.html` page 04 and the
`hooks` field in `spec/shells.json`.

Every hook that repositions a projectile must set 14 substeps of collision grace.

```
[assert] shellMaxRangeOnTerra — every shell exceeds spawnGapPx (700).
[assert] Cluster splits exactly once. Submunitions never re-split.
[assert] Roller terminates on all four of: fuse, climb limit, map edge, hull contact.
[assert] Bunker Buster burrow terminates within its distance or at a map boundary.
[assert] Sandbags never writes a solid pixel inside any hull box, including the firer's.
[assert] A tank buried by Sandbags climbs out within one settle frame.
```

**Stop here.** This is the game from `docs/02-playthrough.html`. Play the reference match
against it and check the numbers roughly match.

---

## Task 6 — Feel

**Goal:** make it good rather than correct.

Particles, screen shake, 9-frame hitstop on direct hits, muzzle flash, sound, animated
terrain collapse (dirty columns only, capped at 2 px/frame so it pours rather than snaps).

Honour `prefers-reduced-motion`: drop shake and hitstop, cut particles by 75%, keep
trajectory animation — that's information, not decoration.

```
[assert] prefers-reduced-motion removes shake and hitstop but keeps arcs animating.
[assert] Terrain collapse processes only dirty columns.
[assert] Frame time stays under 16 ms during a 44 px blast with full particles.
```

**Stop here.** It should feel worth playing now.

---

## Task 7 — Loadout and the full roster

**Goal:** 12 shells, 6 equipped.

Add Skipper, Airburst, Drill Charge, MIRV, Napalm, Repair Kit. Build the loadout screen:
10 points, 5 slots, HE always free and always slot 1.

Wire the icons from `assets/icons/` — they use `currentColor`, so one file works
selected, unselected, and greyed out.

Read the Skipper note in `CLAUDE.md` before implementing it.

```
[assert] MIRV splits exactly twice. Exactly 9 submunitions, never more. Depth capped at 2.
[assert] Airburst at minimum power and elevation does not detonate at the muzzle.
[assert] Skipper bounces exactly 3 times and every skip lands further from the firer.
[assert] Napalm zones decrement once per round in HANDOFF, not once per turn per player.
[assert] Repair Kit cannot be used on consecutive turns and never heals above 100.
[assert] A loadout can never exceed 10 points or 5 slots.
[assert] Keys 1-6 map to the same shell all match, including after shells are spent.
```

**Stop here.** Full roster, real deckbuilding.

---

## Task 8 — Worlds, part one (no camera)

**Goal:** three worlds, zero camera work.

Move `GRAVITY`, `WIND_K`, wind range, air drag, and map width off module constants and
onto a world object. Add the flight time scale (extra integer sim steps during FLIGHT only).

Ship **Terra, Vesper, Ferrum** — all ≤ 1000 px wide, so no camera is needed. That already
gives a 0.90–1.75 gravity spread plus a thick-atmosphere world that plays completely
differently.

Add the per-world validation: assert every shell can cross that world's spawn gap, and
override mass where it can't. On Ferrum, mortar mass 1.55 × gravity 1.75 = 2.71× effective
and it fails without an override.

```
[assert] worldRanges — each world's power-75 and power-100 ranges within ±10 px.
[assert] Each world's power-100 range exceeds its map width.
[assert] Watched flight time after scaling is between 1.0 s and 2.2 s on every world.
[assert] Time scaling changes step count only, never step size — identical terrain at any scale.
[assert] Every shell can cross every shipped world's spawn gap, or has an override.
[assert] No hardcoded 1000 or 560 outside world definitions.
```

**Stop here.** Three worlds, first-round hint showing the world's own range figure.

---

## Task 9 — Camera and generators

**Goal:** the wide worlds and the terrain shapes.

`render/camera.ts` — follows the shell in flight, frames both tanks in AIM. This is the
gate for Rust, Selene, and Hollow.

Add the remaining generators from `spec/generators.json`, plus terrain validation:
reject any map where both spawns aren't flat within 16 px over a 50 px window, or where
no 45° HE solution exists from either side. Regenerate up to 20 times, then fall back to
a known-good seed.

```
[assert] Terrain validation rejects a blocked map and regenerates.
[assert] Resizing the window mid-flight does not alter the trajectory.
[assert] Camera never shows outside the map on a non-wrapping world.
```

**Stop here.** Five worlds, six generators, 30 combinations.

---

## Task 10 — Hollow and the wrap

**Goal:** the standout mechanic.

Modulo x in collision, carve, render, and camera. Add the `ring` generator, which must be
seamless — five sinusoids with integer periods over the map width.

On Hollow a power-100 shot travels 3971 px across a 1200 px map: three full laps. You can
hit someone by aiming away from them.

```
[assert] Ring seam: the step from h[width-1] to h[0] is no larger than the mean adjacent step.
         (Do not assert it is near zero — it should be one normal step, not a flat spot.)
[assert] A shell crossing the seam has a continuous trail and carves across the boundary.
[assert] A shot fired away from the enemy on Hollow can hit them.
```

**Stop here.** Feature complete for local play.

---

## Not in scope

Online play. The sim is deterministic and separate from rendering, so when you want it,
turn-based state sync is the answer — send `{angle, power, shellId}` and let both clients
run the identical sim. Full lockstep is overkill for a turn game. Do not start this before
Task 10.

---

## Task 11 — Menu flow

**Goal:** everything between the URL and the first shot.

Build TITLE, MODE, MAP, CUSTOM, HOWTO and ROUND_OVER from `spec/screens.json`.
`docs/05-flow.html` is a working interactive version — match its structure, not its styling.

The title screen's idle animation is canvas, no assets: embers, drifting cloud bands, sweeping
beams, waving flags, twinkling stars, a pulsing muzzle glow, and a periodic exchange of fire.
It doubles as an ambient perf test — if the loop stutters here it will stutter in a match.

Quick Start is two screens. Custom Game is one. Do not add a third.

```
[assert] Quick Start reaches ROUND_INTRO in exactly two clicks from TITLE.
[assert] Random is a selectable tile in the map grid, not a menu item.
[assert] ROUND_OVER's Rematch keeps all settings and only changes the seed.
[assert] HE cannot be disabled in Custom Game.
[assert] Custom-game ammunition rows and the deploy summary both render shell icons.
[assert] Last-used settings persist across reloads (localStorage, outside sim/).
```

**Stop here.** The game has a front door.

---

## Task 12 — CPU opponent

**Goal:** 1 v CPU at three difficulties.

Implement exactly the algorithm in `spec/cpu.json`. The gains are derived from the range table —
do not hand-tune them, and recompute them if the constants ever change.

The CPU must **observe its own impact and correct**, never receive the true firing solution with
error added. The measured tier separation only exists because it brackets like a player does.

```
[assert] Over 500 seeded trials, each tier's mean shots-to-hit is within ±0.5 of spec/cpu.json.
[assert] The CPU never reads the target's position to compute a solution — only its own last impact.
[assert] Recruit never applies wind correction; Veteran applies it fully.
[assert] The CPU is a sim-layer function: no DOM access, seeded RNG only.
```

**Stop here.** Single player works.

---

## Task 13 — Custom game and ammo rules

**Goal:** per-match ammunition configuration.

Per-shell enable toggles and ammo counts 1–9, plus rounds, wind, turn timer, terrain generator
and seed. HE is locked on and unlimited.

When more than six shells are enabled, the loadout step (Task 7) is what narrows them to a deck
of six. Enabling shells and picking a deck are different steps and must stay that way.

```
[assert] A config with every shell disabled except HE is playable.
[assert] Ammo counts outside 1-9 are rejected at the UI, not silently clamped in sim.
[assert] Custom settings survive a Rematch.
```

**Stop here.** Feature complete for local play including single player.
