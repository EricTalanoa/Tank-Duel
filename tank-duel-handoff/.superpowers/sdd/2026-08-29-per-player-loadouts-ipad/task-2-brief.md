# Task 2 Brief — Independent world arsenals

## Context

Checkpoint 1 is complete. Implement checkpoint 2 only from `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md` and the binding design. `src/sim/playerLoadouts.ts` exports `PlayerLoadouts`, `PlayerIndex`, `PLAYER_COUNT`, and `makePlayerLoadouts`. Ruling: each tuple entry is a complete stable deck including HE in slot one; world creation must not prepend HE again.

## Files and boundary

- Modify `src/sim/world.ts`, `world.test.ts`, and direct world callers/tests exposed by TypeScript failures that use the old `loadoutIds` option.
- Expected direct tests include `repair.test.ts`, `standard-shells.test.ts`, and `exotic-projectiles.test.ts`; migrate other old-option callers mechanically when found.
- Write `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-report.md`.
- Do not change runtime/controller/UI/orientation/colors yet.

## Required interface

Replace the old shared option completely:

```ts
export interface CreateWorldOptions {
  readonly width?: number;
  readonly height?: number;
  readonly generator?: GeneratorId;
  readonly worldId?: WorldId;
  readonly playerLoadoutIds?: PlayerLoadouts;
}
```

No `loadoutIds` compatibility alias remains after migration. Defaults must produce two independent valid complete decks. Construct each arsenal separately so slot arrays and ammo maps never alias.

## TDD requirements

First add failing tests using distinct decks such as:

```ts
const playerLoadoutIds = makePlayerLoadouts(
  ['he', 'mortar', 'cluster'],
  ['he', 'roller', 'sand'],
);
const state = createWorld(71, { playerLoadoutIds });
expect(state.arsenals[0].slots.map(({ shell }) => shell.id)).toEqual(playerLoadoutIds[0]);
expect(state.arsenals[1].slots.map(({ shell }) => shell.id)).toEqual(playerLoadoutIds[1]);
```

Prove ammo/slots do not alias and slot key 2 selects each active player's own second shell after handoff. Capture RED before implementation.

Migrate old tests that intentionally want identical decks using `makePlayerLoadouts(['he', ...ids], ['he', ...ids])`. Do not retype points/slots or regenerate golden vectors.

## Verification

Run focused RED/GREEN, then `npm test -- --configLoader runner src/sim` and `npx tsc --noEmit`. Use D: temp/cache as needed. Report exact commands/counts, all changed files, old-option search proof, non-aliasing proof, self-review, and concerns.

## Constraints

- `spec/*.json` authoritative; never edit `spec/test-vectors.json`.
- Sim remains pure and deterministic with no DOM/browser imports.
- Complete tuple decks include HE exactly once in slot one.
- Non-Git workspace: do not initialize Git or claim commits.
- Do not spawn subagents or reviewers.
