# Task 1 fix round 1 scoped re-review

Re-review Important F1 from `task-1-review.md` against current files and the Fix Round 1 report.

Verify the new consistency check independently derives both `rangePerPowerPoint` near the reference
region and `driftPerWindUnit` from production ballistics/constants, does not mirror `CPU_RULES`, uses
a defensible tolerance, and would fail after a meaningful stale-gain physics change. Confirm no
production CPU tuning/spec/golden mutation and no new Critical/Important breakage.

Verdict F1 ADDRESSED or NOT ADDRESSED with exact evidence. F2/F3 remain deferred Minors and are out
of scope. Worker evidence: focused 65/65, full 442/442, TypeScript clean.

Write `task-1-fix-1-review.md` in this plan workspace.
