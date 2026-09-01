# Task 2 Non-Git Review Package

- Requirements: `task-2-brief.md`.
- Evidence: `task-2-report.md`.
- Binding design: `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`.
- Baselines: `task-2-baseline/` contains pre-task world, world tests, repair, standard-shells, and exotic-projectiles files.
- Current changed files: `src/sim/world.ts`, `src/sim/world.test.ts`, `src/sim/repair.test.ts`, `src/ui/loadout.test.ts`, `src/app/matchRuntime.ts`.
- `matchRuntime.ts` may contain only the temporary identical-two-deck adapter required after removing `CreateWorldOptions.loadoutIds`; checkpoint 3 replaces its public shared API.
- Review boundary: independent world arsenals, direct caller migration, non-aliasing, purity, and test quality. No controller/UI tuple implementation yet.
