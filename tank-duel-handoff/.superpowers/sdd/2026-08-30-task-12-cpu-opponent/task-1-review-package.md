# Task 1 independent review package

Review `task-1-brief.md`, the approved Task 12 design, Task 1 of the implementation plan,
`task-1-report.md`, and current `src/sim/cpu.ts` / `.test.ts`.

Return separate **spec compliance** and **code quality** PASS/FAIL verdicts. Rank findings as
Critical, Important, or Minor with exact file/line evidence.

Explicitly audit strict parser behavior, frozen registry/memory, exact formula signs/order,
whether tier jitter applies to every shot as required by `spec/cpu.json`, clamp/jitter ordering,
opening formula, observed-impact-only correction, direction handling, Recruit/Veteran wind skill,
seeded reproducibility, no true-solution helper, no retyped CPU values, simulation purity, test
independence/mutation strength, and golden immutability.

Worker evidence: focused 37/37, full suite 440/440, TypeScript clean, golden hash unchanged.
Do not edit production code. Write `task-1-review.md` in this plan workspace.
