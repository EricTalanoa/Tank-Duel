# Task 3 Non-Git Review Package

- Requirements: `task-3-brief.md`, plus "### Task 3" in
  `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`.
- Evidence: `task-3-report.md`.
- Binding design: `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`.
- Baselines: `task-3-baseline/` holds the pre-task `controller.ts`, `controller.test.ts`,
  `matchRuntime.ts`, `matchRuntime.test.ts`, and `main.ts`. Use `diff -u` against the current
  files; this workspace is not a Git repository.
- Changed files claimed: `src/app/matchRuntime.ts`, `src/app/matchRuntime.test.ts`,
  `src/app/controller.ts`, `src/app/controller.test.ts`, `src/main.ts`.
- Review boundary: tuple plumbing from controller through runtime into `createWorld`, controller
  ownership and immutability, rematch / change-loadout restoration, runtime pause semantics, and
  test quality. The two-panel loadout UI is Task 4 and is explicitly **not** in scope.
- `src/main.ts` is permitted to contain exactly one temporary widening adapter converting the
  UI's still-shared single deck into two identical tuple entries. Task 4 deletes it. Its
  existence is sanctioned; its implementation is reviewable.
- `src/ui/loadout.ts` retains its single-deck contract by design this checkpoint. Do not flag it.
- `setPaused` has no production caller until Task 5's orientation gate. Direct unit coverage is
  the expected state.
