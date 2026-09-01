# Task 11 Checkpoint 5 Report

## Status

Complete. The title and HOWTO canvas scenes are implemented within the Task 5 boundary with injected RAF/time/RNG/motion policy, idempotent disposal, deterministic model/update seams, bounded pools/work, and reduced-motion behavior.

## Changed files

- `src/render/titleScene.ts`
- `src/render/titleScene.test.ts`
- `src/render/howtoScene.ts`
- `src/render/howtoScene.test.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-5-report.md`

## RED evidence

All test commands used `TEMP`/`TMP` at `D:\codex-temp`, npm cache at `D:\codex-npm-cache`, and Vite's runner config loader.

- Title contract: failed because `src/render/titleScene.ts` did not exist.
- Deterministic state: failed because `updateTitleSceneModel` was missing.
- Bounded pools/work: failed because `titleScenePoolCounts` was missing.
- Reduced motion: failed because the snapshot had no activity model.
- Lifecycle: failed because `createTitleScene` was missing.
- Drawing: failed because the loop did not draw and `drawTitleScene` was missing.
- HOWTO contract: failed because `src/render/howtoScene.ts` did not exist.
- HOWTO sequence/lifecycle: failed because `updateHowtoSceneModel` and `createHowtoScene` were missing.

Each failure was observed before its production behavior was added.

## Implementation

- The title model reads all seven systems from `spec/screens.json` and renders one coordinated artillery-at-dusk scene: bounded embers, cloud bands, beams, flags, stars, muzzle glows, and periodic exchanged fire.
- Title state is seeded through the injected `Rng`; updates derive directly from elapsed time and never grow pools or use `Math.random`.
- Reduced motion shrinks atmospheric pools, stops cloud/beam/flag spatial motion, suppresses exchanged fire, and retains a static atmospheric scene.
- HOWTO shot powers come from the spec-backed screen model. HE elevation, physics, world data, and safety bounds come from existing spec-backed simulation modules.
- HOWTO trajectories are precomputed historical shots in short → long → hit order. No current-match prediction or preview API is exported.
- Both scene factories tolerate an unavailable 2D context, own one injected frame loop, and cancel it exactly once on repeated disposal.

## Verification

```powershell
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/sim/purity.test.ts
```

Result: 3 test files passed; 31 tests passed.

```powershell
npx tsc --noEmit
```

Result: exit 0.

## Concerns

- No blocker. Per the checkpoint boundary, Task 6 still needs to mount and dispose these scenes through the application controller.

## Fix Round 1

All three reviewer P2 findings are addressed.

### Changes

- Added a reusable canvas-context test double in `src/render/howtoScene.test.ts` and exercised drawing at the initial state, each shot transition, completed animated history, and reduced-motion complete history.
- Clarified `HOWTO_FRAME_WORK_BUDGET` as a **total update-plus-draw budget**. `HowtoFrameState.updateWork` now names update work explicitly, `drawHowtoScene` returns draw work, and tests assert their sum stays within the bound.
- Imported `spec/screens.json` directly in the HOWTO scene test, parsed the three result/power pairs independently, compared the scene model to that source, and retained comparison with `buildHowToScreenModel()`.
- Ran the required strict TypeScript and runner-loaded Vite production build to the specified D: output directory.

### RED evidence

```powershell
npm test -- --configLoader runner src/render/howtoScene.test.ts
```

Result: 1 test file failed; 2 tests failed because the pre-fix frame model had no explicit `updateWork`, making update-plus-draw assertions evaluate to `NaN` against the frame budget.

The direct `screens.json` assertion initially matched the existing correct scene values, so its ability to catch drift was verified with a temporary one-fine-step production mutation:

```powershell
npm test -- --configLoader runner src/render/howtoScene.test.ts
```

Result: 1 test file failed; 1 test failed. The source-backed assertion reported all three mutated scene powers differing from the directly parsed screen spec. The mutation was immediately restored.

### GREEN and final verification

After restoring the source-backed values and implementing explicit total-work accounting:

```powershell
npm test -- --configLoader runner src/render/howtoScene.test.ts
```

Result: 1 test file passed; 6 tests passed.

Final focused render and purity verification:

```powershell
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/sim/purity.test.ts
```

Result: 3 test files passed; 32 tests passed.

Required strict TypeScript check:

```powershell
npx tsc --noEmit
```

Result: exit 0.

Required runner-loaded production build:

```powershell
npx vite build --configLoader runner --outDir D:/codex-temp/tank-duel-task11-task5-dist --emptyOutDir
```

Result: exit 0; 45 modules transformed; build completed in 443 ms. Output was written to `D:/codex-temp/tank-duel-task11-task5-dist`.
