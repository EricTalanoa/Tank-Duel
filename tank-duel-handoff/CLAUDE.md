# CLAUDE.md — Tank Duel

Turn-based 2D artillery game. Two tanks on destructible terrain, angle + power aiming,
multiple shell types, multiple worlds with different gravity. Local hotseat first.

## Stack

TypeScript + Vite + Canvas 2D. **Zero runtime dependencies.** Vitest for tests.
No game engine, no physics library — the whole simulation is ours and that is deliberate.
See `docs/01-plan.md` §1 for why Unity and Phaser were rejected.

## The one architectural rule

`sim/` is pure. No DOM, no Canvas, no `window`, no `Math.random`.
`render/` reads state and draws. It owns nothing.

```
src/
  sim/         world.ts terrain.ts ballistics.ts weapons.ts damage.ts rng.ts
  render/      terrainLayer.ts entities.ts fx.ts hud.ts camera.ts
  input/       controls.ts
  main.ts      fixed-timestep loop
```

Everything downstream depends on this: headless tests, replays, and any future
networking all come free if `sim/` stays pure, and all become impossible if it doesn't.

## Non-negotiables

1. **Fixed timestep.** `DT = 1/60`. Accumulator clamped to 250 ms so alt-tab slows the
   sim rather than fast-forwarding it. Never step with a variable `dt`.
2. **Seeded RNG only.** `mulberry32` in `sim/rng.ts`. One `Math.random()` inside `sim/`
   breaks determinism, replays, and every golden test in `spec/test-vectors.json`.
   Add a lint rule banning it under `sim/`.
3. **Substep collision.** 8 substeps per frame. A power-100 shell moves ~16 px/frame and
   will tunnel through thin terrain without it.
4. **Input only in AIM.** `fire()` returns immediately unless `phase === 'aim'`.
5. **Terrain is never owner-aware.** A wall blocks the player who built it. This is a
   feature — see `docs/02-playthrough.html` turn 8.
6. **Self-damage always applies at full value.** No owner exemption anywhere in the
   damage path, including submunitions.
7. **No hardcoded 1000 or 560.** Field dimensions come from the world object.
8. **A shell is never named without its icon.** Every surface that names a shell — deck chips,
   loadout cards, custom-game rows, deploy summary, round-over recap, tooltips — pairs the name
   with `assets/icons/<id>.svg`. They are `currentColor` stroke icons, so one file works
   selected, unselected and greyed out; there is never a reason to omit one. `shells.json`
   carries the path in each shell's `icon` field. The files live in `public/assets/icons/`,
   which is what makes that path a real URL in both dev and a production build; render them
   as a masked span, never an `<img>` — an SVG loaded as an image gets no inheritable colour,
   so `currentColor` resolves to black and the icon vanishes on a dark panel.

## Traps that already bit this project

These are real bugs found while writing the spec. Do not reintroduce them.

| Trap | Symptom | Guard |
|---|---|---|
| Wind coefficient 35× too high | Every shot unaimable, but plausible on screen | Horizontal wind accel must be ≤ ~1/6 of gravity at max wind. Assert `windDriftAtPower70` in test-vectors. |
| Heavy Mortar at `mass 2.00` | Limited-ammo weapon silently could not cross the spawn gap | On world load, assert every shell's max range > spawn gap. `spec/test-vectors.json → shellMaxRangeOnTerra`. |
| No post-hook collision grace | Skips/splits collapse onto one point; looks like broken physics | Any hook that repositions a projectile sets 14 substeps of collision grace. |
| Physical ricochet | Non-monotonic, unaimable — shells travel backwards | Skipper is a **scripted** skip, not a reflection. Do not "fix" it to physical. See `docs/04-ammo.html` page 04. |

## Prose figures superseded by spec/ (checked 2026-08-27)

`docs/01-plan.md`, `docs/02-playthrough.html`, `docs/04-ammo.html` and `docs/05-flow.html`
quote a range table from an earlier tuning pass. It is 8-40% high and fits no single muzzle
coefficient (the implied value wanders between 0.165 and 0.19). `spec/test-vectors.json`
reproduces to within ~1% straight from `spec/constants.json` under a plain 8-substep
integrator, at a flat 0.160, and `worlds.json -> derived` agrees with it exactly. Where they
disagree, spec wins.

| Figure | Prose docs | spec/ - use this |
|---|---|---|
| Range at power 70, 45 deg, no wind | 632 px / 1.3 s | 586 px / 75 frames |
| Range at power 30/40/50/60/70/80 | 151 / 236 / 344 / 476 / 632 / 810 | 109 / 190 / 300 / 434 / 586 / 769 |
| Wind drift at power 70, wind 100 | 115 px | 104 px |
| Heavy Mortar max range at mass 1.55 | ~794 px | 768 px |
| Lowest power going off a 1000 px map at 45 deg | 85 | 92 |

The prose tables are deliberately left alone: every design argument built on them still
holds, because the *ordering* of the numbers never changed. Only the absolute values moved.

## Spec is the source of truth

`spec/*.json` is machine-readable and generated from the design docs. Read it before
implementing anything. Do not retype values from the HTML docs into code.

- `constants.json` — tuned physics and rules. Changing these invalidates test vectors.
- `shells.json` — 12 shells with hook definitions and icon paths.
- `worlds.json` — 6 worlds with gravity, drag, width, wind, time scale, wrap.
- `generators.json` — 6 terrain generators.
- `test-vectors.json` — **golden values. Assert against these, do not regenerate them.**

## Definition of done for any task

- The acceptance criteria in `TASKS.md` for that task pass.
- New behaviour has a headless test under `src/sim/**/*.test.ts`.
- `npm run test` and `npm run build` both pass.
- No `Math.random` under `sim/`. No DOM access under `sim/`.

## Commands

```
npm run dev     # Vite dev server
npm run test    # Vitest, headless, no browser
npm run build   # production build
```

## Working style

Do one task from `TASKS.md` per session and stop at its "Stop here" line. Each task
leaves the game playable. Do not skip ahead to a later phase because it seems easy —
the ordering exists because later phases assume earlier invariants.

If a design question isn't answered by `spec/` or `docs/`, ask rather than guessing.
Tuning numbers in this project were measured, not chosen, and a plausible-looking guess
is how the wind bug survived as long as it did.
