# Task 2 Brief — Pure screen reducer and acceptance paths

Implement only Task 2 from the approved Task 11 plan. Read the approved design and current Task 1 interfaces first.

## Files

- Create `src/ui/flow.ts` and `src/ui/flow.test.ts`.

## Interfaces

- Export `ScreenId`, `AppFlowState`, `FlowAction`, `createFlow(config)`, and `reduceFlow(state, action)`.
- Consume `MatchConfig` and related helpers from `src/ui/config.ts`.

## Required behavior

- Initial screen is TITLE.
- Quick Start applies local mode and opens MAP; selecting a map tile reaches ROUND_INTRO. Tests count these as exactly two actions/clicks from TITLE.
- MODE is representable and exposes 1v1 Local plus a disabled CPU option for Task 12, but MODE is not a mandatory third step.
- CUSTOM is one setup screen. HOWTO supports Back and Play navigation.
- Random exists as a MAP tile option and not a separate menu action.
- ROUND_OVER Rematch preserves every setting except a newly derived seed; Change Loadout preserves settings and targets loadout; Menu returns TITLE.
- Invalid transitions return the same state. Reducer is exhaustive, pure, headless, and contains no DOM/browser APIs.
- Do not implement views, persistence wiring, match runtime, or Task 12.
- Follow TDD. Run focused tests and sim purity tests with `--configLoader runner` and D: temp/cache, then TypeScript.
- Write `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-2-report.md` with RED/GREEN evidence and concerns.
