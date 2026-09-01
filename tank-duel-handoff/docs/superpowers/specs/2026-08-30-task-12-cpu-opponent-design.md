# Task 12 CPU Opponent Design

## Goal and boundary

Add single-player play against a deterministic Player 2 CPU at Recruit, Gunner, and Veteran
difficulties. The CPU brackets from its own observed impacts using the exact algorithm and tier data
in `spec/cpu.json`.

This task does not implement Task 13 ammunition configuration, online play, additional CPU shell
strategy, adaptive difficulty, or the planned menu/page visual overhaul.

## Source of truth

`spec/cpu.json` owns the algorithm, derived gains, tier IDs/names, jitter, wind skill, measured
shots-to-hit targets, hit definition, power clamp, and fixed opening elevation. Production code
strictly parses and imports these values rather than copying them from prose.

Physics, world properties, shell definitions, loadout budgets, and presentation continue to come
from their existing `spec/*.json` registries. `spec/test-vectors.json` remains immutable.

## Pure CPU model

Create a pure simulation-layer CPU module with no DOM, Canvas, wall-clock, storage, or unseeded
randomness. It exposes:

- a strict CPU registry parsed from `spec/cpu.json`;
- immutable CPU observation state containing only the CPU's prior impact, prior wind, and prior
  command data required by the published correction formula;
- a deterministic command function producing elevation and power for one CPU shot;
- an observation function that records the actual resolved impact of the CPU's own projectile.

The opening command uses the opening-shot formula from the spec and fixed spec elevation. Later
commands apply the observed miss correction and wind-delta correction exactly as written, then the
spec clamp and tier jitter. Derived gains are consumed from the registry and covered by consistency
tests against the current range table/constants so stale gains fail visibly rather than being
silently hand-tuned.

The CPU may use the target's current x-coordinate only to compute the opening distance and to score
whether an observed impact was short/long or within the hit definition. It must never call a true
trajectory solver, inspect a future impact, or receive a solved power with noise added. After the
opening shot, correction is based on the CPU's own last impact, its own direction, wind delta, and
tier skill.

Jitter consumes the match's seeded simulation RNG. Identical seeds, worlds, tiers, observations,
and state produce identical commands.

## CPU deck and shell behavior

The inserted per-player-loadout architecture requires a complete Player 2 deck in CPU mode. Because
Task 12 specifies aiming but no shell-selection strategy, the CPU receives the existing spec-backed
standard six-shell deck as its deterministic balanced deck and always selects HE for automated
bracketing shots. This avoids inventing unmeasured weapon tactics while leaving a valid, inspectable
CPU arsenal for future work.

Player 1 retains a full independent loadout budget. In CPU mode the loadout surface exposes only the
human editor plus a neutral read-only CPU-deck summary; Player 2 cannot manually edit the CPU deck.
The shared Deploy action returns Player 1's chosen deck and the deterministic CPU deck as the stable
two-entry tuple. Local mode retains both editable side-by-side panels unchanged.

## Runtime and observation flow

CPU mode is carried through the existing resolved match configuration. The controller enables the
CPU mode option and tier selection, preserves the tier through map selection, loadout, match,
round-over, rematch, storage, and change-loadout flows, and supplies the deterministic CPU deck as
Player 2's tuple entry.

The match runtime owns CPU scheduling but not CPU math. When the game enters AIM for Player 2, it:

1. requests a pure command from the CPU model;
2. applies the returned elevation/power through normal simulation controls;
3. selects HE through the normal stable arsenal slot contract;
4. fires through the existing `fire` entry point exactly once.

No direct world mutation bypasses normal aim/fire guards. Repeated frames, pause/resume, orientation
blocking, stale callbacks, and disposal cannot duplicate a CPU shot. CPU mode never automates
Player 1.

Projectile impacts gain enough ownership metadata at the simulation observation boundary to
distinguish the CPU's own resolved shot from Player 1, submunitions, and unrelated presentation
events. The observation is recorded only after the CPU shot resolves. Missing or non-CPU impacts do
not update CPU memory. Rematch starts fresh CPU observation state with the new seed while preserving
mode, tier, and decks.

## UI and accessibility

The existing `1 v CPU` option becomes enabled and loses its Task 12 placeholder note. Recruit,
Gunner, and Veteran labels come from `spec/cpu.json`. CPU tier controls use semantic buttons or
radios with visible focus and selected state; no tier is communicated by color alone.

Quick Start remains exactly two clicks from TITLE to ROUND_INTRO. Selecting CPU is performed on the
existing mode/map surface without adding a third screen. Custom Game remains one setup screen.
Landscape iPad, portrait inertness, safe-area behavior, and local-mode layout remain intact.

## Error handling and invariants

- Strict parsing rejects missing, duplicate, reordered, non-finite, or invalid CPU registry data.
- Power is clamped by spec only after correction and before tier jitter, matching the published
  algorithm order; tests pin boundary behavior.
- CPU scheduling is a no-op outside CPU mode, outside Player 2 AIM, while paused, or after disposal.
- A shot without a valid CPU-owned impact leaves the prior observation unchanged.
- CPU logic never reads DOM state and never uses `Math.random`.
- Existing local play, per-player loadouts, orientation pause, deterministic physics, and golden
  values remain unchanged.

## Testing and acceptance

Headless tests prove:

- strict spec parsing and source-of-truth consumption;
- deterministic opening and correction commands for seeded observations;
- correction reads actual prior CPU impacts rather than a solved trajectory;
- Recruit applies no wind correction and Veteran applies the full correction;
- 500 seeded trials per tier produce mean shots-to-hit within the spec tolerance;
- CPU logic has no DOM/Canvas/`Math.random` dependency;
- the CPU deck is deterministic, complete, valid, and independent from Player 1's deck;
- local mode still offers two independent editable decks;
- runtime fires exactly once per Player 2 AIM and does nothing for Player 1/local mode/paused state;
- rematch preserves tier/decks while resetting CPU observation memory;
- stale callbacks and repeated disposal cannot duplicate CPU owners or shots.

Browser acceptance verifies all three tier controls, one-player loadout plus CPU deck summary,
automatic Player 2 aiming/firing, portrait pause/resume without duplicate fire, rematch flow, local
mode regression, visible focus, touch sizing, and console health.

Run the full Vitest suite, strict TypeScript check, and production Vite build. Verify
`spec/test-vectors.json` is unchanged.

## Stop condition

Stop when single-player works at all three spec-defined difficulties and Task 12 acceptance criteria
pass. Do not begin Task 13 or the later visual overhaul in the same implementation session.
