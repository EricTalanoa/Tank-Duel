# Task 7: Loadout and Full Roster Design

## Scope

Task 7 expands the playable roster from six to twelve shells, adds a six-shell deck
chosen before play, renders shell icons anywhere a shell is named, and implements the
Task 7 acceptance rules. It stops at Task 7's `Stop here` line. Anvil Round, worlds,
camera, menu flow, CPU play, and custom-game settings remain out of scope.

The twelve playable shells are the existing six plus Skipper, Airburst, Drill Charge,
MIRV, Napalm, and Repair Kit. Although `spec/shells.json` also contains Anvil Round,
Task 7 does not name it among its six additions, so it is not selectable in this task.

## Source of Truth

All behavior, costs, ammunition, icon paths, and hook values come from `spec/*.json`.
The approved spec completion adds `widthPx: 22` to Drill Charge's `onTerrainHit` hook,
matching the checked-in reference implementation. No implementation file repeats that
value.

## Hook Architecture

`src/sim/weapons.ts` remains a data table plus generic hook dispatch. The roster does
not introduce subclasses or shell-ID branches. Projectile state gains explicit generic
hook metadata: split depth, stage age, bounce count, altitude-arm state, and immunity
flags where required. Repositioning hooks always set collision grace from
`spec/constants.json`.

### Skipper

On terrain contact, Skipper follows the scripted model required by `CLAUDE.md`:
preserve forward direction, multiply horizontal velocity by `horizontalRetention`, and
set upward velocity from the retained horizontal speed and `relaunchAngleFactor`.
Surface normals are never consulted. Each bounce increments an explicit counter and
sets collision grace. The fourth terrain contact detonates after exactly the configured
three skips. Tests assert every contact is farther from the firer.

### Airburst

Altitude is `surfaceY(currentX) - projectile.y`. The shell arms only after altitude
meets `armAfterExceedingPx`. Once armed and descending, crossing
`triggerAltitudePx` replaces the parent with the configured number of vertical
bomblets, horizontally spaced by `spacingPx`. Bomblets inherit completed hook state,
have zero horizontal velocity, and receive collision grace. Minimum power/elevation
therefore cannot trigger at the muzzle.

### Drill Charge

The terrain-hit hook terminates flight and queues a normal impact. Resolution applies
ordinary damage, then carves a vertical half-open rectangle using hook `widthPx` and
`depthPx`, clamped at both horizontal edges and the map floor. The terrain API reports
the exact dirty-column range and queues it for collapse.

### MIRV

MIRV uses an explicit `splitDepth` capped by `maxDepth`. At apex the parent creates the
first configured split. After `secondStageAfterFrames`, each first-stage child creates
the configured second-stage children. Second-stage children cannot split. The final
live/impact count is checked against `totalSubmunitions`; malformed hook data fails
initialization rather than creating an unbounded projectile tree.

### Napalm

Detonation creates a surface zone centered at impact x with configured half-width,
damage, and round count. Zones damage live tanks standing within their horizontal range
at the round boundary. A round boundary occurs only when HANDOFF wraps active player
from player 2 back to player 1. Zone damage and timer decrement happen exactly once at
that boundary; expired zones are removed and rendered no further.

### Repair Kit

Repair is a no-flight `onUse` action. Successful use heals the active tank by the
configured amount, capped at the configured health cap, consumes ammunition, records
the player's use turn, and transitions directly to SETTLE/HANDOFF. It is unavailable
when the same player used it on their previous turn. Cooldown state is per player and
selection/UI visibly disables illegal use.

## Loadout Model

`src/sim/loadout.ts` is a pure model. HE is locked, free, and always deck slot 1. A
valid selection contains at most the imported count of optional slots and costs at
most the imported point budget. Equipped shell order is stable for the whole match.
Keys 1-6 address deck positions, not global shell spec slots.

The current local-hotseat setup uses one shared chosen deck for both players. This keeps
match setup concise before Task 11 adds full mode/menu flow. The loadout state API can
still construct different per-player decks later without changing simulation hooks.

The default selection is a valid spec-derived deck so tests and direct simulation
construction remain playable without a DOM.

## Loadout Screen and Icons

`src/ui/loadout.ts` creates a pre-match DOM overlay over the canvas. Cards show the
shell icon, name, cost, ammunition, and mass warning. HE is visibly locked. Clicking a
card toggles it only when the resulting selection remains valid. The deploy button is
enabled only for a valid deck and starts the match with that stable order.

External SVGs are rendered as CSS masks so their `currentColor` design works for
selected, unselected, and disabled states. Every loadout card and in-match deck chip
pairs a shell name with its icon, satisfying the project-wide icon rule.

## In-Match Deck

The six equipped positions never reflow. Each chip shows key, icon, name, remaining
ammo, and non-unit mass. Selecting an empty finite-ammo slot falls back to HE. When the
currently selected shell becomes empty after firing, selection also falls back to HE,
but the spent chip remains in its original position and is greyed out.

## Rendering and Events

Napalm zones render as animated surface fire strips using deterministic presentation
effects; their authoritative lifetime stays in simulation. Split/reposition events use
the existing projectile and presentation pipelines. Repair emits a presentation event
for feedback but does not create a projectile.

## Testing

Implementation follows red-green-refactor and covers:

- loadouts never exceeding the imported point or optional-slot limits;
- HE always present, free, and deck position 1;
- keys 1-6 retaining stable shell identity after ammunition is spent;
- spent selection falling back to HE;
- MIRV producing exactly nine terminal submunitions with depth capped at two;
- minimum-power/elevation Airburst not triggering at the muzzle;
- Skipper making exactly three forward skips with collision grace;
- Drill carving only its spec-defined, boundary-clamped column;
- Napalm damaging/decrementing once per round boundary, not once per player turn;
- Repair cooldown, health cap, no-flight behavior, and finite ammunition;
- icon existence and icon/name pairing on loadout cards and in-match chips;
- all earlier tests, simulation purity, production build, and browser playthrough.

