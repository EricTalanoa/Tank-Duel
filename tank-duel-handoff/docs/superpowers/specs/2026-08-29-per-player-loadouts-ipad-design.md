# Per-Player Loadouts and iPad Landscape Design

## Goal and boundary

Replace the shared local-hotseat deck with independent Player 1 and Player 2 decks, and establish landscape iPad as the product's primary presentation target. This inserted task lands before Task 12 so CPU mode can later replace Player 2's manual deck with a deterministic balanced CPU deck.

This task does not implement CPU aiming or CPU deck generation, Task 13 ammunition behavior, or the planned whole-menu visual overhaul. It makes only the visual changes required for a usable side-by-side iPad loadout and orientation gate.

## Source of truth

Existing values remain owned by `spec/*.json`:

- Point, optional-slot, and free-shell rules continue to come from the existing loadout constants.
- Shell identity, icon, cost, ammunition, and mass continue to come from `spec/shells.json`.
- Screen structure continues to come from `spec/screens.json`.
- Golden values in `spec/test-vectors.json` remain immutable.

Implementation must add machine-readable spec fields for the new two-player loadout structure, landscape-only product orientation, and gameplay player colors before consuming those rules. Production code imports those fields; it does not retype values from this document.

## Player loadout model

Introduce a stable two-entry `PlayerLoadouts` tuple:

1. Player 1 deck.
2. Player 2 deck.

Each player independently receives the full existing loadout budget. HE is free, locked, always present in slot one, and does not consume the optional-shell budget. Optional slots, points, stable shell ordering, enabled-shell filtering, and validation are evaluated separately for each deck. One player's edits can never consume, disable, reorder, or otherwise mutate the other player's deck.

Decks are pre-match controller state, not general persisted `MatchConfig`. Rematch preserves both resolved decks. Change Loadout restores both prior selections. Returning to Menu disposes the active match and clears only controller-owned transient match state according to the existing flow rules.

## Runtime and simulation contract

Replace the single `loadoutIds` runtime/world input with `playerLoadoutIds: PlayerLoadouts`.

The controller passes both decks unchanged to the match runtime. The runtime passes them unchanged to world creation. World creation initializes each arsenal from the corresponding tuple entry instead of cloning one shared deck. Existing input slot behavior remains per active player's deck and retains stable positions 1–6.

The simulation stays pure and deterministic. It does not read orientation, DOM, storage, CSS, or player presentation colors.

Task 12 will add a deterministic balanced CPU-deck generator and substitute its result for the second tuple entry in CPU mode. That behavior is deliberately outside this task.

## Side-by-side iPad loadout

The loadout screen uses one owner and two independent pure loadout models. In landscape it renders two equal panels labelled `Player 1` and `Player 2`. Menus and loadout panels remain visually neutral; Blue/Pink combat identity is not used as the primary menu styling.

Each panel provides:

- its own points and optional-slot status;
- the same enabled-shell pool;
- independent selected, unselected, locked, and unavailable card states;
- HE locked in slot one;
- iPad-sized touch targets and visible keyboard focus.

A single shared Deploy action returns both stable decks and is enabled only when both are valid. Its readiness copy communicates each player's status without relying on color alone. The loadout owner and listeners remain idempotently disposable.

## iPad landscape requirement

Landscape iPad is the required product orientation. Portrait displays a full-screen rotate-device surface and blocks pointer and keyboard interaction with menus, loadout controls, and the match beneath it.

The orientation gate belongs to the UI/application layer. A sufficiently wide landscape desktop viewport remains usable for development and testing. A narrow or portrait viewport receives the same rotate treatment.

Entering the blocked orientation during a match pauses interactive and presentational advancement without resetting configuration, decks, terrain, health, turn state, or ammunition. Returning to landscape resumes the same match state. The simulation itself remains unaware of orientation.

## Gameplay player identity

Player 1 is Blue and Player 2 is Pink during gameplay only. The exact colors are machine-readable spec values.

Player-owned combat presentation uses these identities for:

- tank body;
- health bar;
- active-turn marker;
- aiming indicator;
- projectile/bullet and its player-owned trail;
- directly related player-owned combat feedback.

Terrain, explosions, shell icons, menus, and generic interface accents retain their functional palette. Player identity never relies on color alone: player labels, active borders, and shape or luminance cues remain available.

## Controller and flow behavior

The existing `LOADOUT` flow state remains one screen. Mounting it creates both editors. Deploy transitions once only after both valid decks are returned. At most one loadout owner and one runtime remain active.

The controller stores the selected tuple for the current match lifecycle:

- first deploy starts MATCH with both decks;
- match completion preserves both decks for ROUND_OVER;
- Rematch reuses both decks and changes only the seed;
- Change Loadout remounts both prior decks;
- controller disposal removes the orientation gate, loadout listeners, scenes, view, and runtime idempotently.

## Error handling

- Invalid or unavailable shell IDs are rejected or omitted according to the existing spec-backed loadout validation rules; they never cross between players.
- Deploy remains disabled if either deck is invalid.
- Duplicate deploy callbacks and stale loadout callbacks cannot create a second runtime.
- Orientation changes are idempotent and cannot reset match state.
- Missing visual media-query support falls back to viewport dimensions while keeping landscape desktop development usable.

## Testing and acceptance

Headless tests prove:

- both players independently receive the full spec-backed budget;
- HE is locked and free in both decks;
- editing either deck leaves the other deeply unchanged;
- Deploy returns a stable two-entry tuple and requires two valid decks;
- world creation gives each arsenal its corresponding distinct deck;
- slot controls address the active player's own deck;
- Rematch preserves both decks;
- Change Loadout restores both decks;
- stale callbacks and repeated disposal cannot duplicate owners or runtimes;
- portrait blocks interaction and freezes application/runtime advancement without resetting state;
- returning to landscape resumes the same state;
- Blue/Pink gameplay colors come from spec and retain non-color identity cues.

Browser verification uses an iPad landscape-sized viewport and covers independent side-by-side editing, touch target size, focus visibility, deployment into visibly distinct arsenals, portrait rotate blocking, landscape recovery, Blue/Pink combat presentation, and console health.

Run the complete existing suite, strict TypeScript check, and production Vite build. Do not edit or regenerate `spec/test-vectors.json`.

## Stop condition

Stop when local hotseat players can independently build and deploy distinct decks in the required iPad landscape experience. Do not begin Task 12, Task 13, or the later full visual overhaul in the same implementation session.
