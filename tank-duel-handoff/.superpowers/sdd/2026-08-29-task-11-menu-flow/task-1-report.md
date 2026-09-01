# Task 11 Checkpoint 1 Report

## Changed files

- `src/ui/config.ts`
- `src/ui/config.test.ts`
- `src/ui/storage.ts`
- `src/ui/storage.test.ts`

## RED

Command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/config.test.ts src/ui/storage.test.ts
```

Output:

```text
FAIL  src/ui/config.test.ts
Error: Cannot find module './config'

FAIL  src/ui/storage.test.ts
Error: Cannot find module './config'

Test Files  2 failed (2)
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
npm test -- --configLoader runner src/ui/config.test.ts src/ui/storage.test.ts
```

Focused tests output:

```text
Test Files  2 passed (2)
Tests  11 passed (11)
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

Additional regression check:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner
```

```text
Test Files  40 passed (40)
Tests  319 passed (319)
```

## Self-review

- `src/ui/config.ts` keeps all logic headless and outside `sim/`, with no DOM or storage globals.
- Defaults and validation are built from shipped registries and parsed `spec/screens.json` groups instead of retyping menu values from prose.
- `resolveMatchConfig()` preserves explicit choices and resolves `random` through a seeded RNG while forcing generator compatibility through the existing world/generator resolver.
- `src/ui/storage.ts` persists only versioned, validated config data and reconstructs rich shell metadata on load, so bad payloads fall back instead of clamping.
- Focused tests cover the required invariants: shipped defaults, HE lock/unlimited rules, random resolution, versioning, round-trip persistence, and invalid payload fallback.

## Concerns

- The brief does not pin one canonical default enabled-shell roster beyond HE and spec-backed ammo bounds. I aligned defaults to the current shipped standard deck (`slot <= 6`) so Task 11 config matches the existing local-play loadout rather than the HTML prototype's broader sample state.

## Fix Round 1

### Files

- `spec/screens.json`
- `src/ui/config.ts`
- `src/ui/config.test.ts`
- `src/ui/storage.test.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-1-report.md`

### RED

Command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/ui/config.test.ts src/ui/storage.test.ts
```

Output:

```text
FAIL  src/ui/config.test.ts > match config > builds defaults from shipped registries and keeps HE locked on
AssertionError: expected undefined to deeply equal { min: 1, max: 9 }

FAIL  src/ui/config.test.ts > match config > rejects invalid shapes, missing or extra shell keys, malformed entries, and invalid ids
TypeError: Cannot read properties of undefined (reading 'max')

Test Files  1 failed | 1 passed (2)
Tests  2 failed | 15 passed (17)
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
npm test -- --configLoader runner src/ui/config.test.ts src/ui/storage.test.ts
```

Focused tests output:

```text
Test Files  2 passed (2)
Tests  17 passed (17)
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
