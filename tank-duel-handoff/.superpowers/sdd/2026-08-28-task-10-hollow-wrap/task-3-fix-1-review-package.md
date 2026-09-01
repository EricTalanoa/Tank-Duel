# Task 3 Fix Round 1 Review Package

Review only the fixes for these three findings, plus regressions directly introduced by them:

1. Wrapped terrain edits used signed 32-bit coercion, corrupting unbounded projectile x values beyond `2^31` and large negative values.
2. Collapse processing scanned a width-sized bitmap instead of only active ranges.
3. Collapse dirty output merged seam-adjacent edge ranges into a full-width range.

Files in scope:

- `src/sim/terrain.ts`
- `src/sim/terrain.test.ts`
- `src/sim/collapse.ts`
- `src/sim/collapse.test.ts`
- `.superpowers/sdd/2026-08-28-task-10-hollow-wrap/task-3-report.md`

Return one verdict per finding: `ADDRESSED` or `NOT ADDRESSED`, with exact file and line evidence. Report only new correctness or performance regressions caused by these fixes. Do not broaden review into later Task 10 world, camera, or renderer integration.
