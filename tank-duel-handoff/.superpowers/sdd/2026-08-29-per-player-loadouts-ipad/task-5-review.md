# Task 5 independent review — landscape iPad orientation gate

## Verdicts

- **Spec compliance: PASS.** No Critical, Important, or Minor findings.
- **Code quality: PASS.** No Critical, Important, or Minor findings.

## Evidence and package-bullet audit

| Package requirement | Evidence | Result |
| --- | --- | --- |
| Spec-backed orientation/minimum-width policy and required boundaries | `src/ui/orientationGate.ts:1,14-17` imports `PRESENTATION` and evaluates portrait/square plus spec minimum; `src/ui/orientationGate.test.ts:9-16` covers 768x1024, 1194x834, 800x600, and 1200x800. | PASS |
| Initial/de-duplicated callbacks and resize/orientation cleanup | `src/ui/orientationGate.ts:37-60` calculates and emits only on state change, including initial state; `src/ui/orientationGate.ts:63-71` idempotently removes both listeners; `src/ui/orientationGate.test.ts:18-74` proves counts and cleanup. | PASS |
| Accessible overlay and exact inert/ARIA restoration | Prior `inert` and `aria-hidden` are captured/restored in `src/ui/orientationGate.ts:25-35`; blocked state applies both at `src/ui/orientationGate.ts:41-50`; the named/described modal alert dialog is built at `src/ui/orientationGate.ts:75-94`; tests cover present and absent prior state at `src/ui/orientationGate.test.ts:18-74`. | PASS |
| Tablet/landscape gate presentation | Viewport cover, safe-area padding, and absence of hover-only interaction are implemented in `src/ui/orientationGate.css:1-48` and asserted by `src/ui/orientationGate.test.ts:76-83`. | PASS |
| Title pause/resume idempotence, one frame, and state preservation | `src/render/titleScene.ts:93-128` preserves its model/elapsed timeline, cancels once, rebases time, and schedules one continuation; `src/render/titleScene.test.ts:149-186` verifies the pause/resume contract. | PASS |
| HOWTO pause/resume idempotence, one frame, and state preservation | `src/render/howtoScene.ts:48-83` follows the same retained-model/rebased-time lifecycle; `src/render/howtoScene.test.ts:181-215` verifies it. | PASS |
| Match pause/resume idempotence and no advancement/input while blocked | `src/app/matchRuntime.ts:138-165` gates controls; `src/app/matchRuntime.ts:171-242` cancels/rebases/schedules exactly one frame; `src/app/matchRuntime.test.ts:330-419` covers advancement, input, idempotence, and disposal. | PASS |
| Immediate pause for an owner created while blocked | Scene owners are paused immediately after creation in `src/app/controller.ts:125-130`; a new runtime is paused before being retained at `src/app/controller.ts:150-180`; covered by `src/app/controller.test.ts:104-121`. | PASS |
| Loadout/menu preservation through inertness, not recreation | The controller does not pause or replace the loadout owner at `src/app/controller.ts:131-145,196-201`; bootstrap places the loadout inside the inert app surface at `src/main.ts:17-24,38-45`; the non-recreation assertion is at `src/app/controller.test.ts:104-121`. | PASS |
| Gate bootstrap/disposal ownership and stale/duplicate callback safety | `src/main.ts:58-65` owns one gate and disposes it before the controller on `pagehide`; controller-side duplicate/stale safety is at `src/app/controller.ts:159-180,196-211`; gate event safety is at `src/ui/orientationGate.ts:54-71`. | PASS |
| No simulation UI/DOM imports; no Task 6/CPU/ammo/visual-overhaul scope creep | The Task 5 baseline comparison contains changes only to the seven permitted existing files; the only new production files are the permitted orientation-gate TS/CSS files. `src/sim/purity.test.ts` remains the simulation DOM/purity guard. No Task 6 player-identity, CPU, ammunition, or broad visual files appear in the review surface or baseline comparison. | PASS |
| Source of truth and golden immutability | `src/ui/orientationGate.ts:1,14-17` consumes `PRESENTATION.requiredOrientation` and `PRESENTATION.minimumLandscapeWidthPx`; scan found no duplicated `900` in Task 5 production code. `spec/test-vectors.json` SHA-256 is `D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`, matching the package baseline. | PASS |

## Checks run

```powershell
npm test -- --configLoader runner src/ui/orientationGate.test.ts src/app/controller.test.ts src/app/matchRuntime.test.ts src/render/titleScene.test.ts src/render/howtoScene.test.ts
# 5 files passed, 39 tests passed

npm test -- --configLoader runner
# 50 files passed, 416 tests passed

npx tsc --noEmit
# exit 0; no diagnostics
```

Additional read-only audit: SHA-256 of `spec/test-vectors.json`; source-of-truth/purity scans; and `git diff --no-index --stat` comparisons for each preserved Task 5 baseline file.

## Findings and concerns

No findings. No concerns.
