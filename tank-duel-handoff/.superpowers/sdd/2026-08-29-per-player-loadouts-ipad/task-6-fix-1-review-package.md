# Task 6 fix round 1 scoped re-review

Re-review only the two Important findings in `task-6-review.md` against the current code and the
Fix Round 1 evidence appended to `task-6-report.md`:

1. Gameplay Blue/Pink leaked into TITLE flags and HOWTO historical trajectories. Verify both use
   their prior functional colors now and that new tests would fail if `playerColor` were restored
   there. Confirm gameplay-owned surfaces still use `playerColor`.
2. `PlayerIndex` was redeclared in `src/sim/ballistics.ts`. Verify there is now one canonical type
   from `src/sim/playerLoadouts.ts`, all relevant imports use it, and owner behavior remains intact.

Verdict each finding **ADDRESSED** or **NOT ADDRESSED**, cite exact file/line evidence, and flag only
new Critical/Important breakage introduced by this fix. The three Minor findings are explicitly
deferred to final review and are outside this scoped round.

Worker evidence: focused 65/65, full suite 423/423, `tsc --noEmit` clean.
