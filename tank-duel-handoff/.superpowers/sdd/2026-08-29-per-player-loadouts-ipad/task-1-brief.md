# Task 1 Brief — Machine-readable presentation and two-player contracts

## Context

This is checkpoint 1 of `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`. Read `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md` for binding intent. Do not implement later checkpoints.

## Files

- Create `spec/presentation.json`.
- Modify `spec/constants.json` and `spec/screens.json`.
- Create `src/render/presentation.ts` and `.test.ts`.
- Modify `src/sim/constants.ts` and `.test.ts`.
- Create `src/sim/playerLoadouts.ts` and `.test.ts`.
- Write the implementation report to `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-report.md`.

## Exact source-of-truth changes

Create `spec/presentation.json`:

```json
{
  "targetDevice": "iPad",
  "requiredOrientation": "landscape",
  "minimumLandscapeWidthPx": 900,
  "players": [
    { "id": 0, "label": "Player 1", "color": "#4DA3FF" },
    { "id": 1, "label": "Player 2", "color": "#FF5CA8" }
  ]
}
```

Add `"players": 2` under `constants.json → loadout`. Add a `LOADOUT` record to `screens.json` with `layout: "side-by-side"`, `players: ["Player 1", "Player 2"]`, and `deploy: "shared"`. Do not alter existing paths, values, or `spec/test-vectors.json`.

## Interfaces

Produce:

```ts
export const PLAYER_COUNT = CONSTANTS.loadout.players;
export type PlayerIndex = 0 | 1;
export type PlayerLoadouts = readonly [readonly string[], readonly string[]];
export function makePlayerLoadouts(
  playerOne: readonly string[],
  playerTwo: readonly string[],
): PlayerLoadouts;
```

`makePlayerLoadouts` returns a frozen outer tuple and frozen copied inner decks. Complete decks include HE in stable slot one.

Create a strict `PRESENTATION` registry that exposes `targetDevice`, `requiredOrientation`, `minimumLandscapeWidthPx`, and exactly two players. Validate IDs 0/1, non-empty labels, CSS six-digit hex colors, `landscape`, and a positive integer minimum width. Production imports JSON values rather than duplicating them.

## TDD and verification

First add tests proving constants players = 2, `PLAYER_COUNT` matches it, presentation orientation/labels/distinct colors, strict malformed-shape rejection as appropriate to existing registry patterns, and immutable tuple copying. Run focused tests in RED before implementation.

Run after implementation:

`npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts src/sim/purity.test.ts`

Use D: temp/cache if C: fullness interferes. Report exact commands/counts, changed files, RED evidence, source-of-truth audit, self-review, and concerns.

## Constraints

- `spec/*.json` is authoritative; never edit/regenerate golden vectors.
- No DOM/browser imports in `src/sim/`.
- No CPU, Task 13, orientation gate, two-panel UI, runtime/world tuple plumbing, or color-consumer migration yet.
- Workspace is non-Git; do not initialize Git or claim commits.
- Do not spawn subagents or reviewers.
