# Final whole-task review package

Review the complete inserted per-player-loadouts/iPad plan against:

- `docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md`
- `docs/superpowers/plans/2026-08-29-per-player-loadouts-ipad.md`
- `spec/*.json` as binding source of truth
- `progress.md`, task reports/reviews/fix reviews 1-6
- `task-7-automated-report.md` and `task-7-report.md`
- all production/test files in the complete inventory in the automated report

This is a non-Git workspace; use preserved task baselines and reports as provenance. Do not edit
production code.

Return separate **spec compliance**, **code quality**, and **acceptance evidence** PASS/FAIL
verdicts. Rank all findings Critical/Important/Minor with exact file/line or report-evidence
citations. Explicitly verify:

- independent full-budget two-player decks, frozen stable tuple, non-aliased world arsenals,
  rematch/change-loadout lifecycle, and active-player slot behavior;
- iPad landscape policy, accessible inert portrait gate, exact state preservation, immediate pause
  for new animated owners, listener/frame idempotence, and safe cleanup;
- Blue/Pink only on player-owned combat surfaces, non-color identity cues, canonical owner type,
  all projectile propagation paths, physics/determinism neutrality, and functional TITLE/HOWTO/
  terrain/explosion/shell/menu colors;
- strict spec readers, no duplicated spec values in production, no simulation DOM/render imports,
  immutable golden vectors, and no CPU/Task 13/visual-overhaul scope creep;
- automated/browser evidence sufficiency and console health.

Triage the two remaining deferred Minors:

1. `projectileOwnership.test.ts` uses a cast/redeclared optional-owner test shape.
2. `playerIdentity.test.ts` aggregates colors for some surfaces instead of pinning owner-to-color
   per surface.

Decide whether either must be fixed before this inserted task can stop; the Task 6 inventory gap is
superseded by Task 7's complete inventory.

Fresh gate: 52 files / 424 tests, TypeScript clean, Vite build clean, golden hash unchanged. Browser
evidence covers 1194x834 landscape, 834x1194 portrait, distinct arsenals, touch/focus measurements,
inert/ARIA behavior, rotation recovery, combat identity, and zero warning/error console entries.
