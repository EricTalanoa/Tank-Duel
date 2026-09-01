# Task 10: Hollow and Horizontal Wrap Design

**Date:** 2026-08-28
**Status:** Approved in chat; awaiting written-spec review

## Scope

Task 10 ships Hollow and the Ring terrain generator, then makes horizontal wrapping consistent across ballistics, terrain collision and edits, direct hits and splash distance, trails, effects, rendering, and camera policy.

This task stops at the Task 10 boundary. It does not add menu flow, online play, CPU behavior, or custom-game ammunition rules.

## Coordinate Model

Projectile flight and trail points use an unbounded horizontal coordinate. A shell may travel from x=150 through x=3750 on a 1200 px Hollow map without its stored trajectory jumping at a seam. This preserves lap count and makes the trail intrinsically continuous.

World-owned data remains canonical in `[0, width)`:

- terrain mask columns;
- tank positions;
- terrain edit coordinates;
- persistent zones and settled effects.

Any interaction between unbounded flight space and canonical world space uses shared pure wrap helpers:

- `wrapX(x, width)` maps an x coordinate into `[0, width)`;
- `wrappedDelta(fromX, toX, width)` returns the shortest signed horizontal displacement;
- `nearestWrappedX(canonicalX, referenceX, width)` returns the copy of a canonical point nearest an unbounded reference.

Non-wrapping worlds continue using ordinary coordinates and distances.

## Ring Generator

Ring uses the working reference algorithm from `docs/03-worlds.html`: five sinusoids whose frequencies are integer periods over the map width. Every numeric generator parameter is added to `spec/generators.json` and imported by production code.

Sampling treats the heightfield as periodic. The step from `height[width - 1]` to `height[0]` must be no larger than the mean adjacent step. The seam is one normal sample step, not an artificially duplicated endpoint or flat spot.

Ring joins the shipped generator registry only in Task 10. Hollow uses Ring by default. Generator validation receives a measured, spec-owned fallback seed for Hollow/Ring. Hollow with non-seamless generators is not shipped: a wrapping world requires a seamless generator to prevent terrain collision and rendering jumps.

## Ballistics and Collision

`Projectile.x` remains unbounded during Hollow flight. Gravity, wind, drag, substeps, flight scaling, and velocity integration are unchanged.

For a wrapping world, terrain collision evaluates `solidAt(terrain, wrapX(projectile.x, width), projectile.y)`. Map-edge termination rules are disabled for wrapping flight and rolling behavior; fuse, climb, terrain, and hull termination still apply.

Tank hull checks compare the projectile against the nearest wrapped tank copy. This makes a shell that crosses x=0 capable of direct-hitting a tank near x=width without teleporting either object.

## Terrain Edits and Damage

Circular terrain edits on wrapping worlds operate modulo width. A crater centered near either seam writes the circle’s overflow into columns at the opposite edge. Dirty ranges may therefore contain two canonical column intervals; terrain repaint handling must represent and repaint both without broadening to the entire terrain.

Column edits and other horizontal terrain hooks normalize their center before applying their existing bounded operation. Any hook whose horizontal footprint can cross the seam applies the same split-range rule as circular edits.

Splash damage uses shortest wrapped horizontal distance while retaining ordinary vertical distance. Self-damage and all existing damage falloff rules remain unchanged.

## Trails, Effects, and Rendering

Trail points stay in unbounded flight space. Rendering selects the world copies intersecting the camera view and draws each trail segment against the corresponding tiled copy. No line is drawn from one visible edge directly across the screen to the other.

Terrain, tanks, fire zones, explosions, and other world-owned visuals are drawn at every `canonicalX + k * width` position intersecting the camera view. The renderer uses finite visible-copy bounds derived from the camera rectangle; it does not create duplicated simulation entities.

Impact state normalizes to canonical x before persistent terrain, damage, or zone updates. One-shot flight effects may retain the nearest visible wrapped copy so they appear where the player saw the impact.

## Camera

On Hollow during FLIGHT, the camera follows the shell’s unbounded x position. It does not clamp horizontally, and the renderer supplies tiled world copies beneath it. Vertical bounds remain clamped to the field.

During AIM, the active tank is the reference point and the opposing tank is represented by its nearest wrapped copy. The camera frames those two copies, presenting their shortest circular separation. Pointer inversion returns the viewed unbounded x coordinate, which input consumers normalize before interacting with canonical world state.

All non-wrapping camera behavior remains exactly as implemented in Task 9.

## Away-Facing Hits

The acceptance shot is deterministic and spec-backed: on Hollow, a seeded HE shot is fired in the direction opposite the opponent’s nearest canonical position, crosses at least one horizontal seam, and hits the opponent through a wrapped hull or splash interaction. The test records the shot input, confirms travel direction and seam crossing, and asserts damage or direct-hit resolution rather than merely checking a range formula.

## Verification

Automated tests cover:

- wrap helper boundary and negative-coordinate behavior;
- Ring determinism and seam-step acceptance;
- Hollow’s imported physics and golden range/time values;
- terrain collision on both sides of the seam;
- wrapped crater writes and split dirty repaint ranges;
- continuous unbounded trails across multiple laps;
- nearest-copy hull collision and wrapped splash distance;
- rolling/hook behavior at a wrapping edge;
- FLIGHT camera following beyond one map width;
- AIM framing via the shortest wrapped tank copies;
- a deterministic away-facing Hollow shot hitting the opponent;
- unchanged non-wrap regression coverage;
- the complete test suite and strict production build.

Browser verification exercises Hollow/Ring in AIM and FLIGHT, observes at least one seam crossing, checks camera/terrain continuity, and confirms a clean console.

## Task Boundary

Stop after Hollow, Ring, and wrapping local play are implemented and verified. Do not start Task 11 menu flow or any feature listed after Task 10.
