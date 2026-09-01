# SDD ledger — plan: docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md

Ruling: This workspace is not a Git repository, and the approved plan forbids initializing Git. Use this isolated plan directory, checkpoint reports, explicit changed-file inventories, and before/after file snapshots for review packages — cost if wrong: review provenance is less compact than commit-range diffs.

Ruling: `PlayerLoadouts` contains each complete stable deck including locked HE in slot one. World creation must not prepend HE again — cost if wrong: callers expecting optional-only arrays require mechanical migration.

## Preflight interface/conflict scan

| Tasks | Producer → consumer / shared surface | Finding |
|---|---|---|
| 1 → 2 | `PlayerLoadouts`, `PLAYER_COUNT` → world options | Consistent; full decks include HE. |
| 1 → 4 | presentation player labels and LOADOUT screen spec → two-panel UI | Consistent; labels are neutral. |
| 1 → 5 | orientation/minimum width → gate | Consistent; 800×600 is blocked because width is below spec 900. |
| 1 → 6 | player colors → render identity | Consistent; render-only import. |
| 2 → 3 | `CreateWorldOptions.playerLoadoutIds` → runtime | Consistent; old shared option removed after migration. |
| 2 ↔ 6 | `world.ts` arsenal work vs projectile owner work | Same file, separate responsibilities; Task 6 adds owner after Task 2 stabilizes world tuple input. |
| 3 → 4 | controller `onDeploy(PlayerLoadouts)` / initial tuple → DOM owner | Consistent; Task 4 supplies Task 3's interface. Temporary test harness adapters are allowed until Task 4 lands. |
| 3 → 5 | runtime `setPaused` → orientation gate | Consistent and idempotent. |
| 3 → 7 | controller/runtime integration → acceptance | Consistent. |
| 4 → 7 | side-by-side UI → iPad browser acceptance | Consistent. |
| 5 → 7 | gate/pause lifecycle → orientation acceptance | Consistent. |
| 6 → 7 | spec-backed colors/projectile owner → combat acceptance | Consistent. |
| 1 | Tests vs implementation/files | Self-consistent; exact new spec values are supplied and golden file excluded. |
| 2 | Tests vs implementation/files | Self-consistent; identical-deck callers migrate through `makePlayerLoadouts`. |
| 3 | Tests vs implementation/files | Self-consistent; pause and tuple contracts are both explicit. |
| 4 | Tests vs implementation/files | Self-consistent; independent models plus one owner/deploy. |
| 5 | Tests vs implementation/files | Self-consistent; policy, inert DOM, scene/runtime pause are separated. |
| 6 | Tests vs implementation/files | Self-consistent after plan self-review made projectile ownership concrete. |
| 7 | Tests vs implementation/files | Self-consistent; fresh full gate follows browser/review fixes. |

Task 1: fix round 1/5 (1 addressed, 0 open — exact registry/player key validation; non-Git snapshots task-1-fix-1-baseline → current files).
Task 1: complete (non-Git checkpoint, review clean after fix round 1; focused/purity 37/37, presentation 10/10, typecheck clean).
Task 2: implementation complete (25 sim files / 255 tests passed; typecheck clean). Independent review dispatched but paused before verdict at user-requested stop. Resume from task-2-brief.md, task-2-report.md, and task-2-review-package.md; do not start Task 3 until both review verdicts are resolved.

Ruling: `makePlayerLoadouts` is the enforcement boundary for complete-deck validity (HE in slot one, no duplicates, playable ids only), chosen by the user over materialising decks literally in `makeArsenal` — cost if wrong: a deck reaching `createWorld` by a path that bypasses the constructor is still silently repaired by `createLoadout`'s toggle semantics.

Task 2: fix round 1/3 (2 addressed, 0 open — spec review found the runtime adapter prepended a second `'he'` onto a deck that already began with `'he'`, so every production match built `['he','he',...]`; and the default-deck test proved independence but not completeness. Non-Git snapshots task-2-fix-1-baseline -> current files).
Task 2: fix round 2/3 (5 addressed, 0 open — code-quality review: runtime fixture was not production-emittable (`anvil` is filtered out of `PLAYABLE_WEAPONS` and the deck cost 12 against a budget of 10) and carried a comment claiming it was faithful; default tuple was the only one not built by `makePlayerLoadouts`; `makeArsenal` was a needless closure; redundant `?? []` assertions; default-deck aliasing check weaker than its neighbour. Snapshots task-2-fix-2-baseline -> current files).
Task 2: fix round 3/3 (1 addressed, 0 open — user-approved boundary hardening of `makePlayerLoadouts` per the ruling above, with a permanent regression pin on the `['he','he','mortar']` shape that shipped. Snapshots task-2-fix-3-baseline -> current files). Three review Minors applied directly by the coordinator afterwards: validation errors now name the player, the bare `weaponById` call is commented, and the regression pin asserts `'duplicate he'` rather than any throw.
Task 2: complete (non-Git checkpoint). Both gates clean on re-review: spec compliance PASS, code quality PASS with no Critical or Important findings. Full suite 49 files / 395 tests, `tsc --noEmit` clean, `spec/test-vectors.json` SHA-256 unchanged at D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8.

Carried into Task 3:
- `makeArsenal` still materialises through `createLoadout`, which repairs silently. Both production producers are now provably clean, so this is narrowed rather than closed. Decide whether `createWorld` honours a deck literally when the runtime's shared API is replaced.
- `matchRuntime.ts:108` still hands the same array reference to both players. Correct today because `makePlayerLoadouts` copies each deck, but per-player loadouts are not yet actually per-player at that call site — this is exactly what Task 3 replaces.
- `matchRuntime.test.ts` now imports `deploymentShellIds` from `src/ui/loadout.ts`, so that module must stay import-safe (no module-scope DOM access) or the test dies at import.
- `src/ui/loadout.ts:76` still duplicates the `STANDARD_WEAPONS.map(...)` derivation that `world.ts` dropped. Fold into Task 3 or 4 when `src/ui/` is opened.

Task 3: fix round 1/5 (1 addressed, 0 open — paused runtime now suppresses aim, power, fire, shell, and audio unlock; scoped re-review clean).
Task 3: complete (non-Git checkpoint, spec/code review clean after fix round 1; focused 47/47, full 49 files / 399 tests, typecheck clean).
Task 4: complete (non-Git checkpoint). Independent review: spec compliance PASS and code quality PASS with no Critical, Important, or Minor findings. Focused 27/27, full suite 49 files / 406 tests, `tsc --noEmit` clean, Vite production build clean, and `spec/test-vectors.json` SHA-256 unchanged at D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8.

Next checkpoint: Task 5, iPad orientation/minimum-width gate and pause-preserving lifecycle. Not started.

Task 5: in progress.

Task 5: complete (non-Git checkpoint). Independent review: spec compliance PASS and code quality PASS with no findings. Focused 39/39, full suite 50 files / 416 tests, `tsc --noEmit` clean, Vite production build clean, and golden SHA-256 unchanged at D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8.

Task 6: in progress.

Task 6: minor (deferred to final review): ownership test weakens type-level coverage with casts and an optional owner shape.
Task 6: minor (deferred to final review): identity test aggregates both players instead of pinning every surface owner-to-color mapping.
Task 6: minor (deferred to final review): checkpoint report lacks a complete changed-file inventory.

Task 6: fix round 1/5 (2 addressed, 1 new Important — gameplay-only TITLE/HOWTO boundary restored; canonical `PlayerIndex` reused; fix introduced duplicated functional color literals). Focused 65/65, full 423/423, TypeScript clean.
Task 6: fix round 2/5 (1 addressed, 0 open — functional TITLE/HOWTO colors now resolve through one spec-backed render contract rather than duplicated literals). Focused 66/66, full 424/424, TypeScript clean.
Task 6: complete (non-Git checkpoint; scoped re-review clean after fix round 2). Golden SHA-256 unchanged at D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8. Three Minor observations carried into final review.

Task 7: in progress.

Task 7: complete (non-Git final checkpoint). Automated gate: 52 files / 424 tests, TypeScript clean, Vite build clean, golden SHA-256 unchanged. Browser acceptance: iPad landscape side-by-side independent decks, distinct deployed arsenals, 44px+ touch targets, visible focus, portrait inert/ARIA gate, landscape state recovery, Blue/Pink combat identity, and zero console warnings/errors. Final whole-task review: spec compliance PASS, code quality PASS, acceptance evidence PASS. Two non-blocking Minor test-strength observations retained. Stop before original Task 12.
