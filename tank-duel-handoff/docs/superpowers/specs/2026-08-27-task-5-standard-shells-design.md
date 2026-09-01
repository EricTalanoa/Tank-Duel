# Task 5: Standard Shells Design

## Scope

Task 5 adds the six-shell prototype deck: HE Shell, Heavy Mortar, Cluster Bomb,
Bunker Buster, Roller, and Sandbags. It ends at the Task 5 `Stop here` line in
`TASKS.md`. Later roster, loadout, world, camera, effects, menu, CPU, and custom-game
features remain out of scope.

All gameplay values are loaded from `spec/*.json`. Golden values in
`spec/test-vectors.json` are fixed reference outputs and will not be regenerated.

## Architecture

`src/sim/weapons.ts` will expose a typed, data-driven registry derived from
`spec/shells.json`. A weapon is data plus optional hook handlers matching the hook
categories in `docs/04-ammo.html`: apex, terrain hit, and detonation. The shared
simulation will invoke hooks without subclasses and without switching on weapon IDs.
HE remains the proof that a shell with no hooks uses the ordinary path.

Projectile state will support multiple simultaneous projectiles and carry only the
generic metadata needed by hooks: apex completion, collision-grace substeps,
parent/child identity, and hook-owned bounded state. Any hook that repositions or
spawns a projectile sets collision grace from
`spec/constants.json -> settle.collisionGraceSubsteps`.

The world continues to own phase transitions. FLIGHT ends only when every active
projectile has terminated. RESOLVE processes all queued impacts through one shared
detonation path, then SETTLE runs once for the combined result.

## Weapon Behaviors

- **HE Shell:** existing ordinary flight, blast damage, and terrain carving.
- **Heavy Mortar:** ordinary flight and detonation with its own spec-defined mass,
  drag, radius, damage, and ammunition.
- **Cluster Bomb:** its apex hook replaces the parent with exactly the configured
  number of children. Children inherit `apexDone: true`, so they cannot split again.
  Child horizontal velocities use the configured spread and receive collision grace.
- **Bunker Buster:** its terrain-hit hook advances along the normalized incoming
  velocity, ignoring terrain during the bounded burrow. It detonates no farther than
  the configured distance and stops early at a map boundary.
- **Roller:** its terrain-hit hook converts flight into bounded surface travel. It
  samples terrain to move in the incoming horizontal direction and terminates when
  any independent guard fires: fuse expiry, climb limit, map edge, or either tank's
  hull box. Conversion receives collision grace.
- **Sandbags:** ordinary impact damage is zero. Its detonation hook fills the
  configured circular terrain region but skips every pixel inside either tank's hull
  box, including the firer's. Existing settle order digs tanks out before gravity.

All impacts use the existing owner-neutral damage path, preserving full self-damage.

## Selection and Ammunition

The match state will expose the six standard weapons as a stable deck, track each
finite ammunition count from the shell spec, and retain HE as unlimited. The active
player can select an available shell only during AIM. Firing consumes one finite
round, records the selected shell on the projectile, and leaves stable slot-to-shell
mapping intact. The HUD will show the active shell and remaining ammunition.

This is match-level shell selection only. Task 7's point-budget loadout builder is not
part of Task 5.

## Rendering

The renderer will draw every active projectile and its trail. Split children may have
individual live trails, while the completed shot remains one turn-level ghost trail
collection for the firing player. Existing tank, terrain, health, phase, and wind
rendering remain unchanged except for shell/ammunition HUD information.

## Failure and Termination Rules

Every hook has an explicit finite bound. Cluster can trigger only once per lineage;
burrow is bounded by distance and map edges; roller is bounded independently by fuse,
climb, edge, and hull collision. Missing or malformed shell hook data fails when the
spec-backed registry is initialized rather than silently falling back to guessed
behavior.

## Testing Strategy

Implementation follows red-green-refactor. Tests will first fail against the wished-for
public behavior, then receive the minimum implementation.

Coverage includes:

- every `shellMaxRangeOnTerra` golden value exceeding `spawnGapPx`;
- Cluster splitting exactly once with no child re-split;
- collision grace on all repositioning/spawning hooks;
- all four Roller termination paths independently;
- Bunker Buster distance and boundary termination;
- Sandbags excluding both hull boxes;
- a Sandbags-buried tank digging out within one settle frame;
- selection, finite ammunition consumption, and phase gating;
- multi-projectile FLIGHT-to-RESOLVE integration and shared damage/terrain resolution;
- the existing Task 1-4 suite remaining green.

Final verification will run the complete test suite, TypeScript production build, and
an interactive browser smoke test of shell selection and representative hook behavior.

