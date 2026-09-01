# Task 5 report — landscape iPad orientation gate

## Scope

Implemented checkpoint 5 only from the approved per-player-loadouts/iPad plan and task brief. The orientation gate is confined to UI/application code. `src/sim/` and `spec/test-vectors.json` were not changed; no Git repository was initialized.

## TDD evidence

### RED

After adding behavioral tests only, this focused command was run with `TEMP` and `TMP` set to `D:\codex-temp`:

```powershell
npm test -- --configLoader runner src/ui/orientationGate.test.ts src/app/controller.test.ts src/app/matchRuntime.test.ts src/render/titleScene.test.ts src/render/howtoScene.test.ts
```

It failed as expected before production implementation:

- `src/ui/orientationGate.test.ts` could not import the missing `./orientationGate` module.
- `src/app/controller.test.ts` failed because `setPresentationBlocked` did not exist.
- `src/render/titleScene.test.ts` and `src/render/howtoScene.test.ts` failed because `setPaused` did not exist.
- Result: 4 failed files; 3 failed and 29 passing tests.

### GREEN

After the minimal implementation, the same focused command passed:

- 5 test files passed.
- 39 tests passed.

The final fresh full-suite run also passed:

```powershell
npm test -- --configLoader runner
```

- 50 test files passed.
- 416 tests passed.

## Verification

```powershell
npx tsc --noEmit
```

Completed with exit code 0 and no diagnostics.

```powershell
npx vite build --outDir D:\codex-task5-build-20260830-1804
```

Completed with exit code 0 using `TEMP` and `TMP` set to `D:\codex-temp`. Vite transformed 62 modules and wrote the fresh external build output to `D:\codex-task5-build-20260830-1804`.

## Lifecycle proof

- `isPresentationBlocked` covers the required viewport examples: 768×1024 and 800×600 are blocked; 1194×834 and 1200×800 are allowed.
- The gate reports its initial state, then only reports actual state changes. Resize and orientation-change listeners are both removed by idempotent disposal.
- While blocked, the app surface receives `inert` and `aria-hidden="true"`; a sibling full-screen `alertdialog` says `Rotate your iPad` and includes the landscape instruction. Previous inert and ARIA values, including absent attributes, are restored on unblock and disposal.
- Title and HOWTO scenes implement the shared `PausableDisposable` contract. Pausing cancels the pending frame once; resuming re-bases time and schedules one frame without rebuilding their models or animation state. Repeated pause/resume and disposal are inert.
- The controller stores presentation blocking, pauses active title/HOWTO/runtime owners, and pauses a runtime created while blocked. Loadout remains the same mounted owner and is blocked through the inert app surface rather than being recreated.
- `main.ts` creates one inert app surface containing the canvas, app view, and loadout UI; the gate is a sibling overlay and is disposed on `pagehide` with the controller.

## Source-of-truth and golden audit

- `src/ui/orientationGate.ts` imports and consumes `PRESENTATION.requiredOrientation` and `PRESENTATION.minimumLandscapeWidthPx`; it does not duplicate those values.
- No orientation or DOM behavior was introduced under `src/sim/`.
- `spec/test-vectors.json` SHA-256 after implementation: `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`.

## Changed files

- `src/ui/orientationGate.ts`
- `src/ui/orientationGate.test.ts`
- `src/ui/orientationGate.css`
- `src/app/controller.ts`
- `src/app/controller.test.ts`
- `src/render/titleScene.ts`
- `src/render/titleScene.test.ts`
- `src/render/howtoScene.ts`
- `src/render/howtoScene.test.ts`
- `src/main.ts`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-5-report.md`

## Self-review and concerns

- Confirmed the implementation does not include Task 6 player colors, CPU behavior, ammunition changes, or the visual overhaul.
- Confirmed CSS is viewport-covering, safe-area aware, and has no hover-only interaction selector.
- The Vite build prints its standard warning that an external `outDir` will not be emptied. The target was pre-checked as nonexistent and was freshly created by the build, so no existing output was affected.
