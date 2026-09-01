# Task 11 Checkpoint 2 Report

## Changed files

- `src/ui/flow.ts`
- `src/ui/flow.test.ts`

## RED

Command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/flow.test.ts
```

Output:

```text
FAIL  src/ui/flow.test.ts
Error: Cannot find module './flow'

Test Files  1 failed (1)
Tests  no tests
```

## GREEN

Focused tests command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/flow.test.ts
```

Focused tests output:

```text
Test Files  1 passed (1)
Tests  6 passed (6)
```

Sim purity command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/sim/purity.test.ts
```

Sim purity output:

```text
Test Files  1 passed (1)
Tests  20 passed (20)
```

TypeScript command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npx tsc --noEmit
```

TypeScript output:

```text
exit 0
```

## Self-review

- `src/ui/flow.ts` is a pure reducer module with no DOM, browser, storage, or `Math.random` usage.
- Quick Start reaches `ROUND_INTRO` in exactly two reducer actions, while `MODE` remains representable for later view/controller work.
- The reducer exposes Random as a map tile, keeps CPU visible but disabled, and returns the exact same state object for invalid transitions.
- `ROUND_OVER` actions preserve config correctly: Rematch changes only the seed and returns to `MATCH`, Change Loadout keeps settings and targets `LOADOUT`, and Menu returns `TITLE`.

## Concerns

- The brief leaves `HOWTO -> Play` implicit. I routed it to the quick/local MAP step so it stays aligned with the approved design's "Quick Start applies local mode and opens MAP directly" rule rather than the older flow prototype's intermediate MODE button.

## Fix Round 1

### Files

- `src/ui/flow.ts`
- `src/ui/flow.test.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-2-report.md`

### RED

Command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/flow.test.ts
```

Output:

```text
FAIL  src/ui/flow.test.ts > app flow > forces all startable task 11 paths back to local mode until task 12
AssertionError: expected 'cpu' to be 'local'

FAIL  src/ui/flow.test.ts > app flow > moves from round intro to loadout to match to round over
Error: Unhandled flow action: {"type":"openLoadout"}

FAIL  src/ui/flow.test.ts > app flow > returns the same state for invalid transitions and invalid rematch seeds
Error: Unhandled flow action: {"type":"openLoadout"}

Test Files  1 failed (1)
Tests  3 failed | 5 passed (8)
```

### GREEN

Focused tests command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/flow.test.ts
```

Focused tests output:

```text
Test Files  1 passed (1)
Tests  8 passed (8)
```

Sim purity command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/sim/purity.test.ts
```

Sim purity output:

```text
Test Files  1 passed (1)
Tests  20 passed (20)
```

TypeScript command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npx tsc --noEmit
```

TypeScript output:

```text
exit 0
```

### Notes

- All Task 11 startable paths now localize `mode` to `local`, including the Custom path regression case where persisted `cpu` state previously leaked into `ROUND_INTRO`.
- The reducer now covers the approved app-layer transition chain `ROUND_INTRO -> LOADOUT -> MATCH -> ROUND_OVER` with a minimal recap payload that stays outside `sim/`.
- Invalid-transition coverage now includes wrong-screen `quickStart`, `openCustom`, `openHowTo`, `changeLoadout`, `openLoadout`, `deployLoadout`, `completeMatch`, and invalid rematch seeds, each returning the same state object.
