# Task 7 preliminary automated report — per-player loadouts/iPad

## Scope and status

This is the automated and evidence-only portion of Task 7. Production code was not edited,
no browser acceptance was run, and this is not a final review or a plan-completion report.

The brief, progress ledger (including the deferred Task 6 Minors), approved design specification,
implementation plan, and Task 1–6 reports were read before this check.

## Fresh automated gate

All commands ran from `C:\Users\erict\Desktop\Personal Projs\Tank Duel\tank-duel-handoff` with:

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'
```

### Full Vitest suite

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npm test -- --configLoader runner
```

Exit code: `0`

```text
Test Files  52 passed (52)
     Tests  424 passed (424)
Start at  21:22:45
Duration  18.88s (transform 15.79s, setup 0ms, import 35.08s, tests 21.75s, environment 73ms)
```

### Strict TypeScript check

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; npx tsc --noEmit
```

Exit code: `0`; no diagnostics were emitted.

### Fresh Vite production build

```powershell
$env:TEMP='D:\codex-temp'; $env:TMP='D:\codex-temp'; $task7BuildOut='D:\codex-tank-duel-task7-20260830-212300'; if (Test-Path -LiteralPath $task7BuildOut) { Write-Error "Fresh build target already exists: $task7BuildOut"; exit 1 }; npx vite build --outDir $task7BuildOut --emptyOutDir
```

Exit code: `0`. The command verified that the external output directory did not exist before
Vite created it.

```text
vite v8.2.2 building client environment for production...
✓ 62 modules transformed.
D:/codex-tank-duel-task7-20260830-212300/index.html                  0.65 kB │ gzip:  0.40 kB
D:/codex-tank-duel-task7-20260830-212300/assets/index-C-t4DRj6.css   6.41 kB │ gzip:  2.09 kB
D:/codex-tank-duel-task7-20260830-212300/assets/index-COHs_W_J.js   96.28 kB │ gzip: 33.09 kB
✓ built in 526ms
```

### Golden-vector immutability

```powershell
Get-FileHash -LiteralPath 'spec\test-vectors.json' -Algorithm SHA256
```

```text
D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

The observed value matches the established golden hash exactly.

## Static source audit against the brief

- `rg -n "\bloadoutIds\b|\binitialShellIds\b" src --glob '*.ts'` returned no production matches.
  The production flow instead carries `PlayerLoadouts` through `main.ts`, controller, runtime,
  and `createWorld`; world construction creates one arsenal from each tuple entry.
- `spec/presentation.json` remains the source for iPad orientation, minimum width, ordered player
  labels, and Blue/Pink colors. `src/render/presentation.ts` validates that registry and
  `playerColor` reads it directly.
- `src/ui/loadout.ts` owns two loadout models, builds each panel independently, returns a frozen
  two-entry deployment tuple, and renders one shared Deploy control. `src/ui/loadout.css` contains
  explicit 44px minimum width/height and visible `:focus-visible` treatments.
- `src/ui/orientationGate.ts` consumes the presentation rules, applies/restores `inert` and
  `aria-hidden`, exposes an `alertdialog` rotate surface, and the controller pauses existing or
  newly created title/HOWTO/runtime owners without replacing active loadout/menu owners.
- Player-owned combat rendering routes through `playerColor`: projectile, trails, tank body/health/
  active marker/aim, active HUD power, and muzzle feedback. Functional TITLE/HOWTO accents route
  through `functionalAccent`; `rg -n "#E8B33C|#4FC3D9" src --glob '*.ts' -g '!*.test.ts'` returned
  no production matches. `PALETTE.playerOne` and `PALETTE.playerTwo` have no production references.
- `Projectile.owner` and `LaunchOptions.owner` are required `PlayerIndex` fields. Launch, split,
  airburst, bounce, roller, validation, and rendering paths retain or consume the owner without
  branching simulation physics, damage, terrain, or RNG. No production `src/sim/` imports from
  `src/ui/` or `src/render/` were found.
- No Task 12 CPU deck/aim behavior, Task 13 ammunition behavior, or menu visual-overhaul code was
  identified in the audited inserted-plan paths.

## Reconstructed changed-file inventory for the inserted plan

Because this workspace is deliberately non-Git, this inventory is reconstructed from the preserved
task baselines, Task 1–6 reports/fix reports, the Task 6 review evidence, and final source audit.
It excludes generated Vite output, `node_modules`, temporary probe files that the reports state
were deleted, and preserved baseline/review-package copies (provenance rather than product changes).

### Specifications

- `spec/constants.json`
- `spec/presentation.json`
- `spec/screens.json`

### Runtime, simulation, and app flow

- `src/app/controller.ts`
- `src/app/controller.test.ts`
- `src/app/matchRuntime.ts`
- `src/app/matchRuntime.test.ts`
- `src/main.ts`
- `src/sim/ballistics.ts`
- `src/sim/ballistics.test.ts`
- `src/sim/constants.ts`
- `src/sim/constants.test.ts`
- `src/sim/exotic-projectiles.test.ts`
- `src/sim/playerLoadouts.ts`
- `src/sim/playerLoadouts.test.ts`
- `src/sim/presentation.ts`
- `src/sim/projectileOwnership.test.ts`
- `src/sim/repair.test.ts`
- `src/sim/terrainValidation.ts`
- `src/sim/weapons.ts`
- `src/sim/weapons.test.ts`
- `src/sim/world.ts`
- `src/sim/world.test.ts`
- `src/sim/world-ranges.test.ts`
- `src/sim/worldValidation.ts`

### Rendering and UI

- `src/render/camera.test.ts`
- `src/render/effects.ts`
- `src/render/entities.ts`
- `src/render/howtoScene.ts`
- `src/render/howtoScene.test.ts`
- `src/render/hud.ts`
- `src/render/palette.ts`
- `src/render/playerIdentity.test.ts`
- `src/render/presentation.ts`
- `src/render/presentation.test.ts`
- `src/render/titleScene.ts`
- `src/render/titleScene.test.ts`
- `src/ui/loadout.ts`
- `src/ui/loadout.test.ts`
- `src/ui/loadout.css`
- `src/ui/orientationGate.ts`
- `src/ui/orientationGate.test.ts`
- `src/ui/orientationGate.css`

### Plan evidence

- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/progress.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-1-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-fix-1-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-fix-2-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-2-fix-3-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-3-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-4-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-5-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-report.md`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-7-automated-report.md`

## Deferred Task 6 Minor triage

1. **Owner-test type coverage — remains Minor.** `src/sim/projectileOwnership.test.ts` still
   reconstructs an `OwnedLaunch` signature, casts `launchProjectile` through `unknown`, and reads
   `Projectile.owner` as optional. Runtime behavior is covered, but this weakens compile-time
   contract coverage. No change was made in this evidence-only task.
2. **Per-surface owner/color mapping — remains Minor.** `src/render/playerIdentity.test.ts` still
   aggregates both players' canvas records for several surfaces. It can prove both colors occur but
   does not pin every surface's owner-to-color mapping against a swap. No change was made.
3. **Task 6 inventory gap — documented here.** The Task 6 report itself remains unchanged, but this
   report supplies the requested whole-inserted-plan reconstructed inventory, including the Task 6
   variant/validation/render paths omitted from that checkpoint report.

## Limitations and stop boundary

- No iPad browser interaction, viewport emulation, console inspection, focus traversal, touch
  measurement, rotation/resume observation, or visual acceptance was performed.
- Therefore this report does not claim browser acceptance, final independent review, plan
  completion, or readiness to begin Task 12.
- The repository remains non-Git; no Git operation was performed. Production source is unchanged by
  this Task 7 automated pass.
