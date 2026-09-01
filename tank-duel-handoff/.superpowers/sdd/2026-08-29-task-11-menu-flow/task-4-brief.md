# Task 4 Brief — Screen models, DOM views, and icon invariants

Implement only Task 4 from the approved plan.

## Files

- Create `src/ui/screenModels.ts`, `src/ui/screenModels.test.ts`, `src/ui/appView.ts`, `src/ui/appView.test.ts`, `src/ui/menu.css`.
- Modify `src/ui/loadout.ts` and its tests only as required for config-aware enabled shells and stable deployment.

## Interfaces and requirements

- Export typed model builders for TITLE, MODE, MAP, CUSTOM, ROUND_INTRO, HOWTO, and ROUND_OVER.
- Export `mountAppView(root, callbacks)` returning `render(flowState)` and idempotent `dispose()`.
- Consume the Task 1 config and Task 2 flow interfaces; views dispatch callbacks/actions but do not own navigation.
- Every rendered surface that names a shell includes its `shell.icon` from spec: Custom rows, round-intro/deploy summary, loadout, and round-over recap.
- HE row is enabled, locked, unlimited, and its toggle/count controls are disabled.
- Random is a selectable MAP tile, never a menu command. CPU is visible and disabled/labelled for Task 12.
- Use semantic buttons/inputs, labels, disabled states, visible focus hooks, keyboard-operable DOM, and event delegation that does not duplicate handlers after rerender.
- Escape dynamic text/attributes or construct DOM safely; no user/spec text injection through raw unescaped interpolation.
- Adapt loadout to respect enabled-shell config while preserving HE slot 1 and stable shell-slot mapping.
- Do not implement controller, persistence wiring, match lifecycle, animations, CPU logic, or Task 13.
- TDD; run model/DOM/loadout tests with runner/D:, purity, and TypeScript. Write task-4-report.md.
