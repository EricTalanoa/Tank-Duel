# SDD ledger — plan: docs/superpowers/plans/2026-08-29-task-11-menu-flow.md

## Environment

- Shared workspace; no Git repository, so snapshot review packages and test/build evidence replace commits.
- C: has zero free bytes. Use Vite `--configLoader runner`, D: temp/cache, and D: build output.
- Authority: `docs/superpowers/specs/2026-08-29-task-11-menu-flow-design.md`, then `spec/*.json`.

## Preflight interface scan

| Tasks | Shared interface/file | Finding |
|---|---|---|
| 1 → 2 | `MatchConfig` consumed by `AppFlowState` | Clean: config precedes navigation. |
| 1 → 4 | spec-backed config consumed by screen models | Clean. |
| 1 → 6 | storage/config consumed by controller | Clean. |
| 2 → 4 | reducer screen/actions consumed by view | Clean. |
| 2 → 6 | reducer consumed by controller | Clean. |
| 3 → 6 | disposable match runtime consumed by controller | Clean. |
| 3, 6 | `src/main.ts` | Clean: Task 3 extracts runtime; Task 6 reduces composition root. |
| 4 → 6 | `mountAppView` and model builders | Clean. |
| 4, 6 | loadout/controller handoff | Clean: view retains stable icon/slot model. |
| 5 → 6 | disposable title/how-to scenes | Clean. |
| 1 | config/storage tests versus implementation | Clean. |
| 2 | flow acceptance tests versus reducer | Clean. |
| 3 | lifecycle tests versus runtime ownership | Clean. |
| 4 | model/DOM tests versus views | Clean. |
| 5 | scene tests versus animation modules | Clean. |
| 6 | integration tests versus controller | Clean. |
| 7 | verification versus Task 11 boundary | Clean. |

## Rulings

- Ruling: Quick Start applies local mode and opens MAP, so map selection is click two — approved design resolves the two-click acceptance while MODE remains available to expose disabled Task 12 CPU — cost if wrong: flow tests/reference expectations may require MODE in the active path.
- Ruling: snapshot review replaces Git ranges — repository metadata is absent — cost if wrong: reviewers have weaker provenance, mitigated by briefs, reports, exact file lists, and fresh tests.
- Ruling: default enabled ammunition remains the existing six-shell standard deck — it preserves current playable startup and stable slots while spec does not name another default — cost if wrong: expected Custom defaults may require changing enabled flags later.
- Ruling: HOWTO Play enters quick/local MAP — it follows the approved two-click active flow rather than routing through an otherwise optional MODE screen — cost if wrong: the reference HTML routes Play to MODE and may be expected literally.

Task 1: fix round 1/5 (3 addressed, 0 open; no Git)
Task 1: complete (spec-backed config/storage; 17 focused tests green; review clean)
Task 2: fix round 1/5 (3 addressed, 0 open; no Git)
Task 2: complete (pure full-path reducer; 8 focused + 20 purity tests green; review clean)
Task 3: fix round 1/5 (2 addressed, 0 open; no Git)
Task 3: complete (disposable match runtime; 68 focused tests green; review clean)
Task 4: fix round 1/5 (1 addressed, 0 open; no Git)
Task 4: complete (screen models/view/loadout; 10 fix-focused tests green; review clean)
Task 5: fix round 1/5 (3 addressed, 0 open; no Git)
Task 5: complete (title/HOWTO scenes; 32 focused tests and production build green; review clean)
Task 6: complete after one review fix round. Random resolves at selection time; rematch preserves the resolved world/generator and changes only the seed. Controller suite 7/7, focused regressions 36/36, typecheck/build green, independent re-review clean.
Task 7: complete. Browser found and fixed live numeric-input persistence; final review found Settings/CPU visibility/focus gaps, fixed with red/green tests. Full suite 373/373, typecheck/build green; browser evidence documented in task-7-report.md. Final re-review found no remaining code/scope defects and one accepted P2 browser-depth limitation. Stopped at Task 11.
