# Task 1 Report — Machine-readable presentation and two-player contracts

## Status

DONE

## Scope completed

- Added the authoritative iPad-landscape/player presentation JSON.
- Added the two-player loadout constant and `LOADOUT` screen record.
- Added a strict spec-backed presentation registry.
- Added immutable, copied two-player loadout tuples, including the HE-in-slot-one invariant.
- Did not implement CPU, Task 13, orientation gating, UI panels, runtime/world tuple plumbing, or color-consumer migration.

## RED evidence

Command:

```powershell
npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts src/sim/purity.test.ts
```

Result before implementation: exit 1; 3 failed / 23 passed tests across 3 failed / 1 passed test files. The failures proved the missing `loadout.players` spec value, missing presentation registry, and missing player-loadout module.

After the initial implementation, self-review identified that `makePlayerLoadouts` did not enforce HE as stable slot one. The added regression test was run first:

```powershell
npm test -- --configLoader runner src/sim/playerLoadouts.test.ts
```

Result before the invariant implementation: exit 1; 1 failed / 1 passed test. The failure was `expected [Function] to throw an error` for a deck without HE in slot one.

## Final verification

Command:

```powershell
npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts src/sim/purity.test.ts
```

Result: exit 0. `npx tsc --noEmit` completed with no diagnostics. Vitest reported 4 passed test files and 35 passed tests.

## Source-of-truth audit

- `spec/presentation.json` is the sole source for the iPad target, required orientation, minimum width, player IDs, labels, and colors. `src/render/presentation.ts` imports it directly and validates it before exporting `PRESENTATION`.
- `spec/constants.json → loadout.players` is `2`; `PLAYER_COUNT` reads `CONSTANTS.loadout.players` rather than a duplicated number.
- `spec/screens.json` contains exactly one `LOADOUT` record with `layout: "side-by-side"`, `players: ["Player 1", "Player 2"]`, and `deploy: "shared"`.
- No values or paths in `spec/test-vectors.json` were edited or regenerated. Its observed SHA-256 during the audit was `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- `src/sim/` has no DOM/browser imports; the required `src/sim/purity.test.ts` passed.

## Changed files

- `spec/constants.json`
- `spec/screens.json`
- `spec/presentation.json`
- `src/sim/constants.ts`
- `src/sim/constants.test.ts`
- `src/sim/playerLoadouts.ts`
- `src/sim/playerLoadouts.test.ts`
- `src/render/presentation.ts`
- `src/render/presentation.test.ts`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-report.md`

## Self-review

- The presentation validator rejects malformed target/orientation, non-positive/non-integer width, wrong player count, empty labels, IDs other than ordered 0/1, invalid six-digit CSS hex colors, and duplicate player colors.
- `makePlayerLoadouts` makes independent frozen copies of both decks and rejects either deck when the spec-backed free shell is not first.
- Production scope is limited to checkpoint 1; no later-checkpoint files or behavior were changed.
- The workspace was treated as non-Git: no repository initialization, commit, or commit claim was made.

## Concerns

None.

## Fix round 1 — Exact presentation registry shape

Reviewer finding addressed: strict JSON validation previously accepted unknown top-level and player-object keys.

### RED

Regression cases added to `src/render/presentation.test.ts`:

- an unknown top-level `unexpected` key;
- an unknown `unexpected` key on Player 1.

Command:

```powershell
npm test -- --configLoader runner src/render/presentation.test.ts
```

Output/result: exit 1; 1 failed test file; 2 failed / 8 passed tests. Both cases failed with `AssertionError: expected [Function] to throw an error`, confirming that the validator accepted the unexpected keys before the fix.

### GREEN

Implemented a shared `hasExactKeys` check at both registry boundaries. The presentation object now allows only `targetDevice`, `requiredOrientation`, `minimumLandscapeWidthPx`, and `players`; each player object now allows only `id`, `label`, and `color`.

Focused presentation command:

```powershell
npm test -- --configLoader runner src/render/presentation.test.ts
```

Output/result: exit 0; 1 passed test file; 10 passed tests.

Checkpoint focused/purity and TypeScript command:

```powershell
npx tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm test -- --configLoader runner src/render/presentation.test.ts src/sim/playerLoadouts.test.ts src/sim/constants.test.ts src/sim/purity.test.ts
```

Output/result: exit 0; `npx tsc --noEmit` completed with no diagnostics. Vitest reported 4 passed test files and 37 passed tests.
