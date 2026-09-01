# Tank Duel — design package

Everything needed to build a 2D turn-based artillery game: 1v1, side view, angle + power
aiming, destructible terrain, 12 shell types, 6 worlds with different gravity.

Nothing here is a sketch. Every trajectory, range figure, and diagram in the docs was
produced by a working simulation using the tuned constants in `spec/constants.json`, and
the design decisions that came out of running it are recorded where they apply.

## Hand it to Claude Code

```
unzip tank-duel-handoff.zip
cd tank-duel-handoff
claude
```

Then:

> Read CLAUDE.md and TASKS.md, then do Task 1.

`CLAUDE.md` is picked up automatically and carries the architecture rules and the list of
bugs already found. `TASKS.md` has ten tasks with assertable acceptance criteria. One task
per session; each ends with a playable game.

## What's in here

```
CLAUDE.md              Architecture rules, non-negotiables, known traps. Read first.
TASKS.md               Ten build tasks with acceptance criteria.

spec/                  Machine-readable. The source of truth — read, don't retype.
  constants.json         Tuned physics and rules
  shells.json            12 shells with hook definitions
  worlds.json            6 worlds with gravity, drag, width, wind, time scale
  generators.json        6 terrain generators
  test-vectors.json      Golden values. Assert against these.
  screens.json           Screen flow and what belongs on each screen
  cpu.json               Bracketing AI: derived gains and measured tier performance

docs/                  Human-readable design. Open in a browser.
  01-plan.md             Engine choice, architecture, build order
  02-playthrough.html    An annotated 11-turn match, every arc simulated
  03-worlds.html         Gravity, atmosphere, terrain generators, map select
  04-ammo.html           12 shells, loadout, the hook model, icon set
  05-flow.html           Screen flow: animated title, mode, map, custom, how to play

assets/icons/          12 SVG icons, 24×24, stroke-only, currentColor
  index.html             Preview sheet at 44 / 24 / 16 / 12 px
  icons.js               All paths as a module

reference/
  prototype.html         Working single-file prototype. Open it and play.
  ammo-demo.html         All 13 shells, animated, with the loadout screen.
```

## Read in this order

1. **`reference/prototype.html`** — play it for two minutes. Everything else makes more
   sense afterwards.
2. **`docs/01-plan.md`** §1 — why TypeScript + Canvas and not Unity.
3. **`docs/02-playthrough.html`** — the annotated match. This is what you're building.
4. **`CLAUDE.md`** then **`TASKS.md`** — then start.

`docs/03-worlds.html` and `docs/04-ammo.html` are needed at Tasks 8 and 7 respectively.
No need to read them up front.

## Four things worth knowing before you start

**The constants were measured, not chosen.** `GRAVITY 0.215`, `MUZZLE 0.160`,
`WIND_K 0.00038`, 8 substeps. Power 70 travels 586 px in 75 frames. Changing any of them
invalidates every golden value in `test-vectors.json`. (The 632 px / 1.3 s figure that
appears in `docs/` is from an earlier tuning pass — see CLAUDE.md.)

**Wind is the easiest thing to get catastrophically wrong.** The first pass had it 35×
too strong — six times gravity horizontally — which made every shot unaimable while still
looking completely plausible on screen. Sanity-check it against gravity, and assert the
drift figures.

**Two design decisions look like bugs and aren't.** A sandbag wall blocks the player who
built it (that symmetry is what makes a zero-damage shell a real decision), and the
Skipper uses a scripted skip rather than physical reflection (the physical version is
non-monotonic and unaimable). Both are documented where they apply. Don't "fix" either.

**Do not add a trajectory preview.** Bracketing — miss short, miss long, split the difference —
is the entire game. A preview that shows where the shot will land deletes it. The barrel direction
and a power bar are the correct amount of feedback; the dotted trail of your last three shots is
the aiming instrument.

**Ship the three narrow worlds before building a camera.** Terra, Vesper and Ferrum are
all ≤ 1000 px wide and already span 0.90–1.75 gravity plus a thick-atmosphere world.
The camera is the expensive part of the worlds feature and it can wait until Task 9.
