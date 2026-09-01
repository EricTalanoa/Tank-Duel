# Task 7 brief — integrated iPad acceptance and stop

Verify the complete inserted per-player-loadouts/iPad task and stop before original Task 12.

## Automated gate

With TEMP/TMP on `D:\codex-temp`, run the full Vitest suite, `npx tsc --noEmit`, and a Vite
production build to a fresh D: output directory. Verify `spec/test-vectors.json` remains unchanged.

## Browser acceptance

At an iPad landscape viewport, verify two equal neutral loadout panels, independent selection and
budgets, HE locked in both, minimum 44x44 targets, visible focus, one shared Deploy action, and
distinct decks reaching the two in-match arsenals. Check console errors/warnings.

Rotate/emulate portrait: only the rotate surface is interactive and content beneath is inert.
Return to landscape and verify the same configuration/decks/match terrain/health/turn/ammunition
resume without duplicated frames/listeners.

Verify gameplay Player 1 Blue and Player 2 Pink on tank, health, active/aim, projectile, and trail;
labels/shape/luminance remain non-color cues. Terrain, shell icons, explosions, title/HOWTO, menus,
and loadout remain on functional/neutral colors.

## Review and report

Run a final independent whole-task review against spec JSON, approved design/plan, source-of-truth
rules, golden immutability, per-player non-aliasing, orientation lifecycle/accessibility, and the
boundary excluding original Tasks 12/13 and visual overhaul. Triage the three deferred Task 6 Minor
findings recorded in `progress.md`.

If source changes for any acceptance/review fix, use TDD and repeat the complete automated gate.
Write `task-7-report.md` with automated, browser, review, changed-file, limitation, console, and
golden evidence. Mark the inserted plan complete and stop before Task 12.
