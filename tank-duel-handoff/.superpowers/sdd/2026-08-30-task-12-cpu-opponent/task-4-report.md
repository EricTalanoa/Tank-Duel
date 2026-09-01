# Task 12 / Task 4 — CPU flow, tier controls, and deterministic deck

## Status

**DONE_WITH_CONCERNS.** Task 4 production and focused verification are complete; the one
complementary regression command could not return a Vitest completion result in this environment.

## Baseline

- `npx tsc --noEmit` exited 0 before Task 4 edits.
- `spec/test-vectors.json` SHA-256 was
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- The initial full `npm test -- --configLoader runner` launch emitted Vitest's `RUN` header
  but no completion payload in this runner capture. This is the same limitation recorded at
  Task 3 and is not treated as a passing baseline.

## Strict TDD evidence

### RED — before production changes

Added behavior tests in `config.test.ts`, `flow.test.ts`, `screenModels.test.ts`,
`appView.test.ts`, `loadout.test.ts`, and `controller.test.ts`, then ran:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/ui/config.test.ts src/ui/flow.test.ts src/ui/screenModels.test.ts src/ui/appView.test.ts src/ui/loadout.test.ts src/app/controller.test.ts
```

Result: exit 1; **52 tests total: 13 expected failures, 39 passes**.

The failures established the missing production behavior:

- no `CPU_TIER_OPTIONS` alias of strict `CPU_TIERS`;
- CPU mode still disabled and labelled `Task 12`;
- no `selectCpuTier` flow action or CPU mode/tier persistence through MAP/CUSTOM;
- no ordered, selected, keyboard-button tier controls in the DOM;
- CPU loadout still rendered two editable panels instead of a neutral icon-bearing summary;
- controller accepted the supplied Player 2 deck and had no CPU mode/tier loadout options;
- stale callbacks had no generation guard.

No production source file was changed before this RED run.

### GREEN

Implemented the minimal production changes after RED:

- `CPU_TIER_OPTIONS` is the strict `CPU_TIERS` identity; `ui/config.ts` no longer parses
  `cpu.json` itself.
- CPU mode is enabled with no Task 12 note. `selectMode` and `selectCpuTier` keep the existing
  MODE/MAP/CUSTOM screens, retain Quick Start's local two-action route, and preserve selected
  CPU mode/tier through round-over/rematch configuration.
- MODE, MAP, and CUSTOM render semantic buttons for `Recruit`, `Gunner`, and `Veteran` directly
  from the strict registry. They use `type="button"`, `aria-pressed`, selected styling, existing
  48px `menu-button` targets, and the existing visible-focus treatment.
- `cpuPlayerLoadoutIds()` derives the frozen CPU deck only from `STANDARD_SHELL_IDS` through
  `makePlayerLoadouts`. CPU loadout mode mounts one Player 1 editor plus a neutral, read-only
  CPU tier/deck summary. The summary contains all six named shell icons and has no shell-edit
  controls. Local mode still mounts two independent editors.
- The controller passes mode/tier to the loadout owner, replaces Player 2 with the canonical CPU
  deck even for a supplied malicious deck, deep-copies the tuple for runtime/rematch ownership,
  and invalidates stale loadout callbacks with a generation token.
- `main.ts` forwards mode/tier into the pre-existing mount boundary; orientation ownership and
  runtime scheduling were not changed.

Focused RED-to-GREEN checkpoints:

```text
config + flow:                 2 files, 14 tests passed
screen models + app view:      2 files, 13 tests passed
loadout + controller:          2 files, 25 tests passed
```

Required focused UI/controller/runtime command:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npm test -- --configLoader runner src/ui src/app/controller.test.ts src/app/matchRuntime.test.ts
```

Result: exit 0; **9 files, 90 tests passed**.

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
npx tsc --noEmit
```

Result: exit 0 with no diagnostics.

## Behavior evidence

- **Click count/local default:** `Quick Start` remains TITLE → MAP → ROUND_INTRO in exactly two
  actions, with `mode: 'local'`; local mode retains two independently editable panels and shared
  deploy.
- **Mode/tier persistence:** CPU selection routes MODE → MAP; tier actions are valid on MODE/MAP/
  CUSTOM only in CPU mode. The reducer proof carries a selected tier through MAP, CUSTOM,
  ROUND_OVER, and REMATCH. The existing storage schema serializes and validates both `mode` and
  `cpuTierId`; controller transitions save every accepted configuration change.
- **DOM/accessibility/icons:** the CPU tier DOM test proves ordered Recruit/Gunner/Veteran buttons,
  selected `aria-pressed` state, keyboard-native button semantics, and dispatch. The CPU summary
  test proves one editable region, one neutral summary, no summary edit cards, all standard deck
  icon sources, and one shared deploy.
- **Deck tuple/anti-spoofing:** the loadout model returns frozen `[humanDeck, cpuDeck]` in stable
  player order. The controller test supplies `['he', 'sand']` as malicious Player 2 input and
  proves runtime receives `STANDARD_SHELL_IDS` instead; its Player 2 tuple entry is frozen.
- **Change loadout/rematch/stale lifecycle:** Change Loadout restores the selected human deck plus
  canonical CPU deck. Existing rematch ownership tests remain covered in the focused run, CPU mode
  and tier are preserved by the flow rematch test, and the CPU controller test proves an old
  loadout callback cannot create another runtime after a fresh overlay is mounted.

## Source-of-truth and golden audit

- UI imports `CPU_TIERS` from `sim/cpu.ts`; no UI `cpu.json` cast/parsing remains.
- Tier labels use the parsed registry names. The CPU deck names/HE identity/slot order come only
  from `STANDARD_SHELL_IDS` plus `makePlayerLoadouts`; no CPU tier, budget, slot, or shell value
  is copied into this checkpoint.
- `spec/test-vectors.json` was not edited. Its SHA-256 after implementation is unchanged:
  `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.
- No spec/golden file was edited, no Git repository was initialized, and no subagents were used.

## Changed files

- `src/ui/config.ts`, `src/ui/config.test.ts`
- `src/ui/flow.ts`, `src/ui/flow.test.ts`
- `src/ui/screenModels.ts`, `src/ui/screenModels.test.ts`
- `src/ui/appView.ts`, `src/ui/appView.test.ts`
- `src/ui/loadout.ts`, `src/ui/loadout.test.ts`, `src/ui/loadout.css`
- `src/app/controller.ts`, `src/app/controller.test.ts`
- `src/main.ts`
- This report

## Self-review

The CPU route remains app/UI-owned; `sim/` receives no DOM/storage dependency. CPU tier identity
uses the existing strict parser. Canonicalization occurs at both the CPU loadout model and,
critically, the controller boundary, so a stale or malicious UI result cannot select Player 2's
deck. Runtime CPU scheduling and orientation handling remain in their existing owners. No Task 13
or visual-overhaul behavior was added.

## Concern

The complementary full-suite half could not be verified with a completion record. The exact command
was:

```powershell
$env:TEMP='D:\codex-temp'
$env:TMP='D:\codex-temp'
$testFiles = rg --files src -g '*.test.ts' | Where-Object { $_ -notlike 'src\ui\*' -and $_ -ne 'src\app\controller.test.ts' -and $_ -ne 'src\app\matchRuntime.test.ts' }
& npx vitest run --configLoader runner @testFiles
```

The harness returned only Vitest's `RUN` header with `exit undefined`, no pass/fail count, and no
diagnostic. The original all-suite command showed the same capture behavior. Therefore focused
UI/controller/runtime coverage and TypeScript are green, but complementary regression coverage is
**incomplete evidence**, so this checkpoint is not reported as `DONE`.
