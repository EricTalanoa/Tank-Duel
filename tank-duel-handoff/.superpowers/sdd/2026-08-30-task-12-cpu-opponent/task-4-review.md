# Task 4 independent review — CPU flow, tier controls, and deterministic deck

## Verdicts

- **Spec compliance: PASS (under an authorized owner ruling on F1).** Every behavioral requirement
  of the Task 4 brief and plan is implemented and verified. One explicitly required TDD proof is
  absent — the brief's "Required TDD behavior" list demands that CPU mode/tier selection be proven
  "persisted through map/custom/round-over/rematch/**storage**", and storage has no test. Map,
  custom, round-over, and rematch are proven. This review initially graded that a FAIL by the Task 1
  precedent; the project owner has since ruled the storage proof out of scope (see "Owner ruling"
  below), so it is recorded as an explicit, accepted gap rather than a hidden substitution, and the
  verdict is PASS on that basis.
- **Code quality: PASS (with concerns).** The implementation is scoped to the planned files,
  canonicalizes the CPU deck at two independent boundaries, keeps `sim/` free of UI/DOM
  dependencies, and adds no screen. Three non-blocking concerns are recorded as F2–F4.

## Owner ruling (2026-08-31, post-review)

Menu-configuration persistence is retained as-is, and the F1 test is **waived**. Rationale from the
owner: an app restart returning to a clean state is acceptable, so the reload path does not warrant
a regression guard at this checkpoint.

Scope of the ruling, stated precisely so it is not over-read later: no match state is persisted
anywhere in this codebase and none ever was — `localStorage` is written from exactly one place
(`src/app/controller.ts:258`) and holds only the last menu setup (path, mode, cpuTierId, world,
generator, seed, rounds, wind, turn timer, enabled shells, per-shell config). The ruling therefore
waives a *test*, not a behavior: CPU mode and tier still persist across launches today, and that is
unchanged by this decision. Cost if wrong: a future edit to `toStoredMatchConfig` that drops or
hardcodes `mode`/`cpuTierId` will not be caught by any test, and will surface only as a player
returning to a local Gunner match after choosing a Veteran CPU match.

## Fresh checks

All commands run on 2026-08-31 with `TEMP`/`TMP` set to `D:\codex-temp`.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused UI/controller/runtime gate | PASS | `npx vitest run --configLoader runner src/ui src/app/controller.test.ts src/app/matchRuntime.test.ts` → 9 files, **90/90 passed**, exit 0. Matches the report. |
| Full regression suite | **PASS — the report's open concern does not reproduce** | `npx vitest run --configLoader runner` → 54 files, **471/471 passed**, exit 0, duration 53.6s. See "Resolution of the reported concern". |
| Strict TypeScript | PASS | `npx tsc --noEmit` exited 0 with no diagnostics. |
| Golden immutability | PASS | `spec/test-vectors.json` SHA-256 `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8` and `spec/cpu.json` SHA-256 `8117D182B8E332C20188F68BDCC96E9F07C6972AE59E9D2A3974CE8BB75E7C64`, both unchanged from Task 3. |
| Production scope | PASS | `find src spec index.html -newermt "2026-08-31 15:52"` returns exactly the 14 files in the report's inventory. No spec file, no unreported source file, no Git initialization. This review edited no production file. |

### Resolution of the reported concern

The checkpoint was filed `DONE_WITH_CONCERNS` solely because the complementary regression half
returned only Vitest's `RUN` header with `exit undefined`. That is a harness-capture artifact of
the `rg`-built `@testFiles` argument-file invocation, not a suite problem: invoking the runner
directly (`npx vitest run --configLoader runner`, no argument file) produced a complete payload of
54 files / 471 tests passing. Regression coverage for this checkpoint is therefore **verified**,
and the concern is closed. Task 3's identical note can be closed the same way.

## Package audit and exact evidence

| Review-package item | Verdict | Evidence |
| --- | --- | --- |
| Single authoritative tier registry | PASS | `ui/config.ts` no longer imports `spec/cpu.json`; `CPU_TIER_OPTIONS = CPU_TIERS` and `CPU_TIER_IDS` derives from it (`src/ui/config.ts:3`, `:64-68`). No cast-based parsing remains in `src/ui`. `screenModels.ts:2` and `loadout.ts:3` import `CPU_TIERS`/`cpuTierById` from `sim/cpu`. |
| Enabled CPU flow, no extra screen | PASS | `ScreenId` is unchanged at nine members (`src/ui/flow.ts:12-21`). The `cpu` option is `enabled: true` with the `Task 12` note removed (`:63-68`). `selectMode`/`selectCpuTier` return the *same* screen for MAP/CUSTOM; only MODE→MAP navigates (`:86-100`). |
| Two-click local Quick Start | PASS | `quickStart` still pins `mode: 'local'` (`src/ui/flow.ts:79-83`); TITLE→MAP→`selectMap`→ROUND_INTRO is two actions (`src/ui/flow.test.ts:30-40`, `:80-107`). `playFromHowTo` also still pins local (`flow.ts:111-115`). |
| Tier selection / persistence / rematch | PASS | `selectCpuTier` is rejected off MODE/MAP/CUSTOM, in local mode, and for an unknown id (`flow.ts:97-100`). `flow.test.ts:80-107` carries a selected tier through MAP, CUSTOM, ROUND_OVER, and rematch. |
| Tier persistence through storage | WAIVED (owner ruling) | Behavior works — `transition` saves on every accepted config change (`src/app/controller.ts:110-113`) and `toStoredMatchConfig` carries both fields (`src/ui/storage.ts:51-56`). No test proves it; the proof is waived. See F1. |
| Semantic, focusable, visibly-selected controls | PASS | Tier buttons are real `<button type="button">` with `data-cpu-tier`, `aria-pressed`, and `is-selected` (`src/ui/appView.ts:290-305`). They carry `menu-button map-tile`, giving `min-block-size: 3rem` (48px) and the shared `:focus-visible` outline (`src/ui/menu.css:48-56`, `:66-69`); `.map-tile.is-selected` supplies the accent border (`:58-60`). `appView.test.ts:69-90` asserts order `['Recruit','Gunner','Veteran']`, `type=button` on all three, `aria-pressed` `['false','false','true']`, and dispatch of `{type:'selectCpuTier', cpuTierId:'recruit'}`. |
| CPU-mode single human editor + neutral read-only summary | PASS | `mode === 'cpu'` renders `playerPanelModel(0,…)` plus `cpuPanelModel(…)` with `editable: false` (`src/ui/loadout.ts:109-113`), and `render()` routes non-editable panels to `renderCpuSummary` (`:162-166`). The summary emits `<li data-shell-id>` items with no `data-shell`, and the click handler only matches `[data-shell], [data-deploy]` (`:174-176`), so no toggle path exists. `loadout.test.ts:195-215` asserts exactly one `[data-player]`, one `[data-cpu-summary]`, zero `[data-shell]` inside the summary, and one shared `[data-deploy]`. |
| Icon-complete summary | PASS | Summary cards come from `loadoutCardModels(activeLoadout, STANDARD_SHELL_IDS)`, whose filter admits `{freeShell} ∪ STANDARD_SHELL_IDS` — the whole CPU deck (`loadout.ts:49-79`, `:224-236`). `loadout.test.ts:209-211` asserts the summary's `img` sources equal one per `STANDARD_SHELL_IDS` entry, in order. |
| Local two-editor regression | PASS | Local mode still builds two `playerPanelModel`s and both remain toggleable (`loadout.ts:109-113`, `:121-128`); the pre-existing two-deck deploy and independent-edit tests still pass in the focused run (`loadout.test.ts:60-72`, `:217+`). |
| Canonical, valid, frozen, deterministic CPU deck | PASS | `CPU_PLAYER_LOADOUT_IDS` is built once via `makePlayerLoadouts(STANDARD_SHELL_IDS, STANDARD_SHELL_IDS)[1]` (`loadout.ts:44-47`), which runs `validateDeck` (HE in slot one, no duplicates, every id a playable weapon) and freezes the array (`src/sim/playerLoadouts.ts:32-44`). No shell id, HE identity, budget, or slot count is retyped. |
| Player 1 cannot mutate the CPU deck | PASS | `toggle` early-returns for `mode === 'cpu' && player === 1` (`loadout.ts:121`), and `deployment()` ignores `loadouts[1]` entirely in CPU mode (`:129-137`). `loadout.test.ts:75-96` toggles player 1 and asserts the deck is identical to a `structuredClone` taken beforehand. |
| Controller anti-spoofing | PASS | `onDeploy` replaces tuple entry 1 with `cpuPlayerLoadoutIds()` whenever `state.config.mode === 'cpu'`, independent of what the UI supplied (`src/app/controller.ts:143-150`). `controller.test.ts:105-134` feeds a malicious `['he','sand']` as Player 2 and asserts the runtime receives `STANDARD_SHELL_IDS`, frozen. |
| Stable tuple order and copy ownership | PASS | Both branches funnel through `makePlayerLoadouts`, which copies and freezes each deck in `[P1, P2]` order (`playerLoadouts.ts:39-43`). |
| Change Loadout restoration | PASS | `selectedPlayerLoadoutIds` is re-supplied as `initialPlayerLoadoutIds` on remount (`controller.ts:151-153`); `controller.test.ts:126-130` asserts the human deck plus canonical CPU deck are restored after `changeLoadout`. |
| Stale callback / runtime guards | PASS | `loadoutGeneration` increments on both mount and `leaveScreen`, and `onDeploy` compares its captured generation (`controller.ts:71`, `:118-121`, `:137-145`). `controller.test.ts:131-134` re-fires the first overlay's callback and asserts the screen stays LOADOUT with still exactly one runtime. |
| Orientation preservation | PASS | `orientationGate.ts/.css/.test.ts` are untouched; `main.ts`'s only change is forwarding `mode`/`cpuTierId` into the pre-existing `mountLoadout` boundary (`src/main.ts:38-46`). |
| No Task 13 / visual-overhaul scope creep | PASS | The changed-file scan matches the inventory exactly; the sole CSS additions are the CPU summary panel and deck list (`src/ui/loadout.css:5`, `:17-19`). |
| Source-of-truth usage | PASS (one exception, F3) | Tier labels come from `tier.name` on the parsed registry (`screenModels.ts:297-305`); the CPU deck comes only from `STANDARD_SHELL_IDS` + `makePlayerLoadouts`. The one duplicated derivation is the default-tier rule — F3. |
| Golden immutability | PASS | Hashes above. |

## Ranked findings

### F1 — WAIVED by owner ruling (was: Important, blocking): CPU mode/tier persistence through storage is never proven, and the existing test is blind to it

> **Status: accepted gap, no action.** Retained in full because the analysis stays true and the
> failure mode stays live — see "Owner ruling" above. Do not silently re-open this as a defect.

`src/ui/storage.test.ts` contains exactly one round-trip test, and it builds its fixture from
`createDefaultConfig()` (`src/ui/storage.test.ts:37-58`), which sets `mode: 'local'` and
`cpuTierId: CREATE_DEFAULT_CPU_TIER_ID` (`src/ui/config.ts:112-117`) — and
`CREATE_DEFAULT_CPU_TIER_ID` resolves to `'gunner'`, the middle of three tiers
(`src/ui/config.ts:70-72`). The controller reload test is the same story: it drives
`openCustom`/`startCustom` and never leaves local mode (`src/app/controller.test.ts:36-75`).
Grepping `cpu` in `src/ui/storage.test.ts` returns nothing.

Failure scenario: suppose `toStoredMatchConfig` were changed to emit `mode: 'local'` and
`cpuTierId: 'gunner'` literally instead of `config.mode` / `config.cpuTierId`
(`src/ui/storage.ts:51-56`). Every test in the repository still passes — the storage round-trip
compares against a config whose values *are* those defaults, and the controller reload test never
sets anything else. In the app, a player who picks a Veteran CPU match, plays, and returns after a
reload silently gets a **local** match at **Gunner**. The mechanism is currently correct and the
controller does save on every accepted config change (`src/app/controller.ts:110-113`), so this is
a proof gap rather than a live defect — but the brief lists storage among the persistence surfaces
that had to be proven before production changes, and it is the one surface with no test.

Fix: add a storage round-trip over a config with `mode: 'cpu'` and a *non-default* tier
(`'recruit'` or `'veteran'`), or extend the existing controller reload test to dispatch
`selectMode: 'cpu'` + `selectCpuTier` before reloading the harness. One test closes this.

### F2 — Minor: RED-era `as unknown as` casts were left in place after GREEN, disabling the compile-time contract checks

Eight assertions still route around the type system even though every property they reach for is
now a declared part of the production contract:

- `src/ui/flow.test.ts:51`, `:88`, `:94` — `{ type: 'selectCpuTier', … } as unknown as FlowAction`, although `selectCpuTier` is a member of the `FlowAction` union (`src/ui/flow.ts:47`).
- `src/ui/config.test.ts:21-23` — `configModule as unknown as { CPU_TIER_OPTIONS: … }`, although `CPU_TIER_OPTIONS` is a normal named export (`src/ui/config.ts:64`).
- `src/ui/screenModels.test.ts:34` — `mode as unknown as { cpuTiers: … }`, although `cpuTiers` is declared on `ModeScreenModel` (`src/ui/screenModels.ts:57`).
- `src/ui/loadout.test.ts:83`, `:89`, `:90`, `:202` — `as Parameters<typeof …>[0]` and `players[n] as unknown as { editable: boolean }`, although `mode`, `cpuTierId`, and `editable` are all declared (`src/ui/loadout.ts:22`, `:32-33`).
- `src/app/controller.test.ts:112`, `:117` — the same pattern against `AppControllerLoadoutOptions.mode`/`.cpuTierId` (`src/app/controller.ts:33-34`).

Failure scenario: rename `ModeScreenModel.cpuTiers` to `tiers`, or drop `editable` from
`PlayerLoadoutPanelModel`, and `npx tsc --noEmit` stays green for these tests — the casts assert
the shape rather than check it, so the loss surfaces as a runtime `undefined` at test time (or, for
the `FlowAction` casts, as a thrown `assertNever`) instead of as the type error TDD is meant to
produce. These casts were correct during RED, when the members did not exist; they are stale now.
Deleting all eight is behavior-preserving.

### F3 — Minor: the default-CPU-tier rule is duplicated in `loadout.ts` as a magic index

`src/ui/loadout.ts:98` falls back to `CPU_TIERS[1]!.id`, hand-reproducing the rule that
`src/ui/config.ts:70-72` states as `CPU_TIER_IDS[Math.floor(CPU_TIER_IDS.length / 2)]` and exports
as `CREATE_DEFAULT_CPU_TIER_ID`. Failure scenario: add a fourth tier to `spec/cpu.json`, and
`CREATE_DEFAULT_CPU_TIER_ID` moves to index 2 while the loadout overlay silently keeps defaulting
to index 1 — the two defaults diverge with nothing to catch it. The brief's "`CPU_TIERS` is the
only tier registry / never duplicate tier values" rule is met for labels and ids but not for this
derived default. Import `CREATE_DEFAULT_CPU_TIER_ID` instead.

Related, lower still: the same line validates the CPU tier even in local mode, so a corrupt
persisted `cpuTierId` would throw while mounting a purely local loadout (`loadout.ts:98-99`).
`validateConfig` makes that unreachable today; computing `cpuTier` lazily inside the
`mode === 'cpu'` branch would remove the coupling.

### F4 — Minor: the new CPU-difficulty fieldset has no stylesheet rule

`cpuTierControls` emits `<fieldset class="cpu-tier-controls"><legend>CPU difficulty</legend>…`
(`src/ui/appView.ts:290-292`), but no rule for `.cpu-tier-controls`, `.cpu-tier-option`, `fieldset`,
or `legend` exists in `src/ui/menu.css`, `src/ui/loadout.css`, `src/ui/orientationGate.css`, or
`src/style.css` (verified by grep). The buttons inside inherit `menu-button map-tile` and are fine;
the container is not. Failure scenario: on MODE/MAP/CUSTOM the group renders with the UA default
`2px groove` fieldset border and default legend metrics against the dark `.app-screen` gradient —
the one piece of unstyled browser chrome in an otherwise fully themed menu. It is also rendered
unconditionally in local mode, where all three buttons are permanently disabled
(`screenModels.ts:299-302`), so local players see a dead, unstyled control group on every menu
screen. Note the checkpoint *did* add CSS for its other new region (the CPU loadout summary) and a
`loadout.test.ts` stylesheet assertion to match (`loadout.test.ts:156-157`); the menu-side region
got neither. Either style the fieldset or hide the group when `mode !== 'cpu'`.

## Notes (no action required)

- In a custom game that disables shells, the CPU still receives the complete six-shell standard
  deck (`loadout.ts:104-106`). That is exactly what the plan's global constraint demands ("CPU
  Player 2 receives the existing spec-backed standard six-shell deck"), and it is behaviorally
  inert because Task 3 automates HE only — recorded so it is not mistaken for a defect later.
- `ModeOptionModel.selected` is computed for the MODE screen but unused there, because `renderMode`
  routes mode options through `actionButton` (`appView.ts:125-136`). Correct as written — MODE
  options are navigation, not a toggle — but the field is dead on that one screen.
- `controller.ts` now imports `cpuPlayerLoadoutIds` from `ui/loadout` (`controller.ts:6`). The plan
  places that function there, and the module has no import-time DOM access, so this is
  plan-conformant; if the app/ui import direction is ever tightened, that canonical deck is the
  natural thing to lift into `sim/`.
- Test counts across the six changed test files went 47 → 52. The eight rewritten cases replace
  assertions that pinned the now-removed "CPU disabled / Task 12 note" behavior; no unrelated
  coverage was deleted. The one incidental loss is the `playFromHowTo` mode assertion from the
  retired "forces all startable task 11 paths back to local mode" test — the production guard at
  `flow.ts:111-115` is still in place but is now unasserted.

## Disposition

**Nothing blocks this checkpoint.** F1 is waived by the owner ruling above. F2–F4 are non-blocking
and carry to the Task 5 final review, following the Task 1 precedent for deferred Minors.

One scheduling note for whoever runs Task 5: **F4 is the one that will be seen.** Task 5 is the
browser acceptance checkpoint, and the unstyled `.cpu-tier-controls` fieldset sits on the MODE, MAP,
and CUSTOM screens that acceptance will walk through — including in local mode, where its three
buttons are permanently disabled. It is cheaper to fix before that pass than to triage during it.
