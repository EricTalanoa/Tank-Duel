# Task 11 Menu Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete, persistent front-door and post-round flow around the existing local match.

**Architecture:** A pure app-flow reducer and spec-backed configuration model drive DOM screen mounts outside `sim/`. `main.ts` becomes a composition root that creates and disposes one match runtime; canvas title/how-to scenes remain render-only.

**Tech Stack:** TypeScript 7, Vitest 4, Vite 8, DOM/CSS, Canvas 2D, localStorage.

**Spec:** `docs/superpowers/specs/2026-08-29-task-11-menu-flow-design.md`

## Global Constraints

- `spec/*.json` is the source of truth; production imports values instead of retyping documentation numbers.
- `spec/test-vectors.json` is immutable golden reference data.
- `sim/` remains pure: no DOM, Canvas, `window`, localStorage, or `Math.random`.
- Every surface naming a shell renders its `shell.icon` path.
- Quick Start reaches ROUND_INTRO in exactly two clicks: Quick Start, then a map tile.
- CPU is visible but disabled and labelled for Task 12.
- Custom Game is one setup screen. Random is a map tile, never a menu action.
- No Task 12 CPU logic or Task 13 expansion.
- The workspace has no Git repository; test/build checkpoints replace commits.
- C: has zero free space. Use `--configLoader runner`, redirect TEMP/TMP/npm cache and generated build output to D:.

---

### Task 1: Spec-backed configuration and persistence

**Files:**
- Create: `src/ui/config.ts`
- Create: `src/ui/config.test.ts`
- Create: `src/ui/storage.ts`
- Create: `src/ui/storage.test.ts`

**Interfaces:**
- Produces: `MatchConfig`, `createDefaultConfig()`, `validateConfig(value)`, `resolveMatchConfig(config, seedRng)`, `loadLastConfig(storage)`, `saveLastConfig(storage, config)`.
- Consumes: worlds, generators, shells, constants, seeded RNG, and `spec/screens.json`.

- [ ] Write failing tests proving defaults use shipped/spec values, HE is enabled/locked/unlimited, random resolves to a shipped compatible world, and malformed persisted data falls back.
- [ ] Run `npm test -- --configLoader runner src/ui/config.test.ts src/ui/storage.test.ts`; expect missing modules/APIs.
- [ ] Implement typed configuration, versioned serialization, and a structural validator. Use an injected `StorageLike` interface so tests remain headless.
- [ ] Add round-trip/reload tests and assert unknown IDs, wrong versions, disabled HE, and invalid ammo are rejected rather than clamped.
- [ ] Run the focused tests and `npx tsc --noEmit`; require green.
- [ ] Write `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-1-report.md` with RED/GREEN evidence.

### Task 2: Pure screen reducer and acceptance paths

**Files:**
- Create: `src/ui/flow.ts`
- Create: `src/ui/flow.test.ts`

**Interfaces:**
- Produces: `ScreenId`, `AppFlowState`, `FlowAction`, `createFlow(config)`, `reduceFlow(state, action)`.
- Consumes: `MatchConfig` from Task 1.

- [ ] Write failing tests for TITLE initial state; Quick Start then map tile reaching ROUND_INTRO in exactly two actions; CUSTOM in one setup screen; HOWTO back/play; Random present in map options; and CPU disabled.
- [ ] Write failing ROUND_OVER tests: Rematch changes only seed, Change Loadout preserves settings, Menu returns TITLE.
- [ ] Run the focused test; expect missing reducer.
- [ ] Implement an exhaustive pure reducer. Reject invalid transitions by returning the unchanged state and expose no DOM types.
- [ ] Run focused tests and the sim purity suite; require green.
- [ ] Record the checkpoint report.

### Task 3: Match runtime lifecycle extraction

**Files:**
- Create: `src/app/matchRuntime.ts`
- Create: `src/app/matchRuntime.test.ts`
- Modify: `src/main.ts`
- Modify: `src/input/controls.ts` only if disposal is not already complete.

**Interfaces:**
- Produces: `createMatchRuntime(options): MatchRuntime`; `MatchRuntime.dispose()`; `MatchRuntime.state`; completion callback with recap data.
- Consumes: resolved config/loadout, renderer, controls, clock, effects, audio, world creation.

- [ ] Write failing tests using injected RAF/listener/control factories to prove one loop starts, disposal cancels future scheduling, controls/listeners dispose once, and duplicate disposal is safe.
- [ ] Run focused test; expect missing runtime.
- [ ] Extract existing `startMatch` ownership from `main.ts` without changing simulation stepping.
- [ ] Detect terminal round state once and notify the app controller without starting ROUND_OVER inside `sim/`.
- [ ] Run runtime, clock, controls, world, and full sim tests; require green.
- [ ] Record the checkpoint report.

### Task 4: Screen models, DOM views, and icon invariants

**Files:**
- Create: `src/ui/screenModels.ts`
- Create: `src/ui/screenModels.test.ts`
- Create: `src/ui/appView.ts`
- Create: `src/ui/appView.test.ts`
- Create: `src/ui/menu.css`
- Modify: `src/ui/loadout.ts`

**Interfaces:**
- Produces: model builders for TITLE, MODE, MAP, CUSTOM, ROUND_INTRO, HOWTO, ROUND_OVER; `mountAppView(root, callbacks)` with `render(flowState)` and `dispose()`.
- Consumes: Tasks 1–2 config/flow and spec-backed weapon/world registries.

- [ ] Write failing model tests that every named shell row/summary/recap contains its icon, HE toggle is disabled and unlimited, Random is a MAP tile, and CPU is disabled.
- [ ] Write DOM tests for semantic buttons, screen labels, focusable controls, exact callback dispatch, and no duplicate handlers after rerender.
- [ ] Run focused tests; expect missing models/view.
- [ ] Implement escaped DOM rendering and event delegation. Keep styling structural and responsive; do not copy numeric gameplay values from prose.
- [ ] Adapt loadout to accept enabled-shell configuration and to return deployment without losing stable slot mapping.
- [ ] Run UI/loadout tests and strict TypeScript check; require green.
- [ ] Record the checkpoint report.

### Task 5: Title and how-to canvas scenes

**Files:**
- Create: `src/render/titleScene.ts`
- Create: `src/render/titleScene.test.ts`
- Create: `src/render/howtoScene.ts`
- Create: `src/render/howtoScene.test.ts`

**Interfaces:**
- Produces: `createTitleScene(canvas, options): DisposableScene`; `createHowtoScene(canvas, options): DisposableScene`.
- Consumes: injected RAF/time, seeded RNG, motion policy, constants/test-vector-backed demonstration values.

- [ ] Write failing tests asserting all seven title systems are present, object counts stay bounded over a long run, disposal stops scheduling, and reduced motion reduces decoration without hiding menus.
- [ ] Write failing HOWTO tests for three historical trajectories ordered short → long → hit and no current-match prediction API.
- [ ] Run focused tests; expect missing modules.
- [ ] Implement canvas scenes with bounded pools and no assets. Import all numeric animation/gameplay values from spec/config modules or derive dimensions from canvas.
- [ ] Add a deterministic frame-work budget test rather than a timing-flaky wall-clock assertion.
- [ ] Run render tests and build; require green.
- [ ] Record the checkpoint report.

### Task 6: Application controller integration and persistence

**Files:**
- Create: `src/app/controller.ts`
- Create: `src/app/controller.test.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css` or existing global stylesheet as applicable.

**Interfaces:**
- Produces: `createAppController(dependencies)`; owns flow, view, storage, scenes, loadout, and at most one match runtime.
- Consumes: Tasks 1–5 APIs.

- [ ] Write failing integration tests for reload persistence, quick/custom navigation, ROUND_INTRO → loadout → MATCH, completion → ROUND_OVER, Rematch, Change Loadout, and Menu cleanup.
- [ ] Assert Rematch deep-equals previous resolved settings except seed, saves the new config, and creates exactly one replacement runtime.
- [ ] Run focused tests; expect missing controller.
- [ ] Implement dependency-injected controller and reduce `main.ts` to DOM lookup plus controller construction.
- [ ] Preserve URL seed/world/generator initialization for explicitly supplied parameters without overriding later saved choices unexpectedly.
- [ ] Run app/UI/runtime tests, purity scan, and strict TypeScript check; require green.
- [ ] Record the checkpoint report.

### Task 7: Task 11 verification and stop

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Produces: Task 11 feature-complete front door and local rematch flow.

- [ ] Run `npm test -- --configLoader runner`; require every test green and record totals.
- [ ] Run `npx tsc --noEmit` and `npx vite build --configLoader runner --outDir D:/codex-temp/tank-duel-task11-dist --emptyOutDir`; require exit 0.
- [ ] Browser-test TITLE animation, exact two-click Quick Start, Random map tile, Custom HE lock/icons, reload persistence, ROUND_INTRO/loadout, local MATCH, ROUND_OVER actions, and reduced motion. Check console warnings/errors.
- [ ] Run a final independent whole-task review against `TASKS.md`, `spec/screens.json`, the approved design, source-of-truth rules, and the Task 11 boundary.
- [ ] If browser/review fixes change code, repeat full tests and build from fresh commands.
- [ ] Stop at Task 11: “The game has a front door.” Leave CPU behavior and Task 13 untouched.
