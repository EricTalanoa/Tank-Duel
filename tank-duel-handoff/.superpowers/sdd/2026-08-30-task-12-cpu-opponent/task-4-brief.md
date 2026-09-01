# Task 4 brief — CPU flow, tier controls, and deterministic deck

Implement Task 4 from the approved Task 12 plan with strict TDD.

## Authority and boundaries

- Read approved Task 12 design, current `sim/cpu.ts`, `sim/playerLoadouts.ts`, UI config/flow/view/
  loadout files, controller, and this brief.
- `CPU_TIERS` is the only tier registry. Remove UI's parallel cast-based parsing of `cpu.json`.
- CPU mode gets Player 2's existing `STANDARD_SHELL_IDS` complete deck and automates HE only.
  Never duplicate shell IDs, HE identity, budgets, slot counts, tier labels, or CPU values.
- Local mode must retain two independent editable panels and existing two-click Quick Start.
- CPU mode uses the existing mode/map/custom screens; add no third screen.
- Preserve iPad landscape/portrait gate, neutral loadout styling, icons, 44x44 targets, focus,
  storage/rematch/change-loadout lifecycle, and golden vectors.
- Do not implement Task 13 or visual-overhaul work.

## Required TDD behavior

Before production changes, add tests proving:

- CPU mode is enabled, loses the Task 12 note, and spec-backed Recruit/Gunner/Veteran controls are
  ordered, selectable, keyboard accessible, visibly selected, and persisted through map/custom/
  round-over/rematch/storage;
- Quick Start still reaches ROUND_INTRO in two actions and local mode remains default/unchanged;
- CPU loadout mounts one editable human panel plus neutral read-only CPU tier/deck summary with
  every named shell icon;
- Player 1 edits cannot mutate CPU deck; Deploy returns frozen `[humanDeck, cpuDeck]` stable order;
- CPU deck is complete, valid, deterministic, and independently allocated;
- controller replaces tuple entry 1 with CPU deck even if a stale/malicious UI callback supplies a
  different second deck;
- Change Loadout restores human selection; rematch reuses both values; stale callbacks cannot create
  duplicate runtimes;
- local mode still deploys both independently edited decks.

Record expected RED before production implementation.

## Implementation surface

- Modify `src/ui/config.ts/.test.ts`, `flow.ts/.test.ts`, `screenModels.ts/.test.ts`,
  `appView.ts/.test.ts`, `loadout.ts/.test.ts/.css`.
- Modify `src/app/controller.ts/.test.ts` and `src/main.ts`.
- Produce `cpuPlayerLoadoutIds(): readonly string[]` through existing standard-shell and complete-deck
  validation contracts.
- Make loadout options mode/tier aware. CPU mode renders one editor and one read-only summary; local
  mode renders the existing two editors. One shared Deploy action always returns `PlayerLoadouts`.
- Enable explicit flow actions for mode/tier without changing screen count.

## Verification/report

Run focused UI/controller/runtime tests, then fresh full suite and `npx tsc --noEmit`, with TEMP/TMP
on D:\codex-temp. Verify hashes unchanged except the previously authorized `cpu-trials.json`.

Write RED/GREEN evidence, click counts, mode/tier persistence, local/CPU DOM proof, deck tuple and
anti-spoofing proof, icons/accessibility, rematch/change-loadout behavior, changed files,
source-of-truth/golden audit, self-review, and concerns to `task-4-report.md`.

Do not initialize Git or dispatch subagents.
