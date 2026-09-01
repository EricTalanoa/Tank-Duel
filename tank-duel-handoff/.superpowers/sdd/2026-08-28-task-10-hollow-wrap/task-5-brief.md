# Task 5 Brief — Unbounded camera and tiled rendering

Implement checkpoint 5 exactly as specified in `docs/superpowers/plans/2026-08-28-task-10-hollow-wrap.md` and the approved design. Tasks 1–4 are complete and independently reviewed.

## Constraints

- Read values from `spec/*.json`; do not retype gameplay numbers from docs.
- Do not modify `spec/test-vectors.json`.
- Projectile/trail x remains unbounded; canonical terrain/tanks/persistent entities are tiled for display.
- Hollow FLIGHT camera follows the unbounded projectile without horizontal clamping.
- Hollow AIM frames the opponent's nearest wrapped copy.
- Vertical camera bounds and every non-wrap camera behavior remain unchanged.
- Draw only the finite world copies intersecting the view.
- Terrain and canonical world entities are drawn per required tile offset. Unbounded projectiles/trails are drawn once in flight coordinates so a seam crossing remains one continuous local polyline.
- Keep input normalization at canonical interaction boundaries; do not normalize render coordinates preemptively.
- No Task 6 browser verification and no Task 11 work.
- No Git repository; do not commit.

## Required TDD and verification

Follow the Task 5 plan steps: camera tests, exact copy-selection tests, trail continuity test, focused render tests, strict build, and one full test run. Redirect TEMP/TMP/npm cache to `D:`. Write `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-5-report.md` with RED/GREEN evidence, changed files, verification, and concerns.
