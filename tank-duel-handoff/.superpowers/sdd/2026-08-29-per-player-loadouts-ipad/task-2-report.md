# Task 2 Report — Independent world arsenals

## Status

DONE

## Scope

- Replaced `CreateWorldOptions.loadoutIds` with `playerLoadoutIds?: PlayerLoadouts`.
- Each world arsenal is now constructed independently from its matching complete deck; defaults use the complete standard deck for each player without inserting HE a second time.
- Migrated direct world callers mechanically. The pre-Task-3 runtime boundary still accepts its existing optional-shell input and converts it to two identical complete tuples immediately before calling `createWorld`.
- Did not change controller ownership, UI loadout behavior, orientation, player colors, specifications, or golden vectors.

## RED evidence

Initial failing tests added: distinct supplied decks, non-aliased slots/ammo, and key 2 selecting the active player's own second shell after a handoff.

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/world.test.ts src/sim/turns.test.ts
```

Result before the world implementation: exit 1; 1 failed / 1 passed test file; 3 failed / 35 passed tests. The failures showed the old shared/default deck was used for both supplied tuple entries and slot 2 still selected Player 1's mortar after handoff.

The required default-deck non-aliasing check was then added in a separate test-first cycle. With the production implementation removed, the same command returned exit 1; 1 failed / 1 passed test file; 4 failed / 35 passed tests. Its distinct expected failure was that the two default arsenal `slots` arrays were the same object.

## GREEN and final verification

Focused GREEN:

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim/world.test.ts src/sim/turns.test.ts
```

Result: exit 0; 2 passed test files; 39 passed tests.

Complete simulation suite:

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner src/sim
```

Result: exit 0; 25 passed test files; 255 passed tests.

Strict TypeScript check:

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
```

Result: exit 0; no diagnostics.

## Changed files

- `src/sim/world.ts`
- `src/sim/world.test.ts`
- `src/sim/repair.test.ts`
- `src/ui/loadout.test.ts`
- `src/app/matchRuntime.ts`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-report.md`

`src/sim/standard-shells.test.ts` and `src/sim/exotic-projectiles.test.ts` required no migration because neither supplies the removed world option.

## Old-option migration proof

- `rg -n -U "interface CreateWorldOptions \\{[\\s\\S]{0,500}loadoutIds" src/sim/world.ts` returned no matches: `CreateWorldOptions` has no `loadoutIds` member.
- `rg -n "\\bloadoutIds\\b" src/sim -g '*.ts'` returned no matches after the internal helper parameter was renamed to `deckIds`.
- Direct old world callers in `repair.test.ts` and `loadout.test.ts` now pass `makePlayerLoadouts(['he', ...ids], ['he', ...ids])`; the runtime direct caller performs the same conversion at the world boundary.
- Remaining `loadoutIds` references are exclusively the pre-Task-3 shared runtime/controller/UI contract and its test harness. They are not `CreateWorldOptions` aliases and are intentionally retained for Task 3's tuple-plumbing migration.

## Non-aliasing proof

- The distinct-deck test asserts each arsenal's slot IDs equal the matching `PlayerLoadouts` tuple entry.
- It asserts `arsenals[0].slots !== arsenals[1].slots` and `arsenals[0].ammo !== arsenals[1].ammo`.
- After setting Player 1 mortar ammunition to zero, Player 2 has no mortar entry and retains finite roller ammunition.
- The default-deck test independently asserts HE is slot one in both decks and that both slot arrays and ammo maps are distinct objects.
- The handoff test selects slot 2 as Player 1 mortar, hands off, then selects slot 2 as Player 2 roller.

## Self-review

- `world.ts` derives default IDs from `STANDARD_WEAPONS`, whose existing stable deck already contains HE. Passing that full deck through `createLoadout` preserves the single leading HE rather than prepending a second one.
- `makeArsenal` calls `createLoadout` and `equippedWeapons` separately for each tuple entry, so neither the slot array nor ammo record can be shared.
- The world-facing old option is fully removed; TypeScript exposed and the implementation migrated every direct world caller in scope.
- `spec/test-vectors.json` was not changed or regenerated; its SHA-256 remains `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- No DOM/browser imports were added to `src/sim`, and no Git repository was initialized or commit claimed.

## Concerns

The existing shared `loadoutIds` runtime/controller/UI contract remains until the dedicated Task 3 tuple-plumbing checkpoint. It is mechanically converted at the direct world boundary and cannot act as a `CreateWorldOptions` compatibility alias.
