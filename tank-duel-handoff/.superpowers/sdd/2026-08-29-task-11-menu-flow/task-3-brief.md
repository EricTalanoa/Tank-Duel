# Task 3 Brief — Disposable match runtime

Implement only Task 3 from the approved plan.

## Files

- Create `src/app/matchRuntime.ts` and `src/app/matchRuntime.test.ts`.
- Modify `src/main.ts` to consume the runtime only as needed for extraction.
- Modify `src/input/controls.ts` only if existing disposal is insufficient.

## Interface and behavior

- Export `createMatchRuntime(options): MatchRuntime`.
- `MatchRuntime` exposes `state` and idempotent `dispose()`.
- Own exactly one clock, world, effects/audio/renderer, reduced-motion listener, controls binding, and RAF loop.
- Use injected RAF/time/listener/control factories in tests. Prove one loop starts; disposal prevents future scheduling/work; controls and listeners dispose exactly once; duplicate dispose is safe.
- Preserve current fixed-step simulation, flight scaling, event/audio dispatch, terrain repaint, and dev inspection behavior.
- Detect terminal round state once and invoke a completion callback with minimal app-layer recap data; do not add DOM or ROUND_OVER state to `sim/`.
- Do not implement views, app controller, storage wiring, or Task 12.
- TDD; run runtime, clock, controls, world, and purity tests with runner/D:, then TypeScript.
- Write `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-3-report.md` with evidence and concerns.
