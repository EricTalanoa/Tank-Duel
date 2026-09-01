# Task 1 Non-Git Review Package

## Requirements and evidence

- Brief: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-brief.md`
- Implementer report: `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-report.md`
- Binding design: `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`

## Baseline snapshots

The pre-task versions of existing files are in `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-baseline/`:

- `constants.json` → current `spec/constants.json`
- `screens.json` → current `spec/screens.json`
- `constants.ts` → current `src/sim/constants.ts`
- `constants.test.ts` → current `src/sim/constants.test.ts`

## New files

- `spec/presentation.json`
- `src/render/presentation.ts`
- `src/render/presentation.test.ts`
- `src/sim/playerLoadouts.ts`
- `src/sim/playerLoadouts.test.ts`

## Review boundary

Review only checkpoint 1. No world/runtime/controller/two-panel/orientation-gate/color-consumer implementation belongs in this package.
