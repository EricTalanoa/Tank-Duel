# Task 11 Checkpoint 3 Report

## Changed files

- `src/app/matchRuntime.ts`
- `src/app/matchRuntime.test.ts`
- `src/main.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-3-report.md`

`src/input/controls.ts` was not changed because its existing `Controls.dispose()` contract is sufficient; the runtime makes cleanup idempotent and invokes it exactly once.

## RED

Initial missing-runtime command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/app/matchRuntime.test.ts
```

Initial output:

```text
FAIL  src/app/matchRuntime.test.ts
Error: Cannot find module './matchRuntime'
Test Files  1 failed (1)
Tests  no tests
```

Disposal mutation RED used the same command after adding assertions that captured input and reduced-motion callbacks are inert after disposal:

```text
FAIL  match runtime lifecycle > stops all work and scheduling after idempotent disposal
AssertionError: expected { angleDeg: 56, power: 86 } to deeply equal { angleDeg: 46, power: 76 }
Test Files  1 failed (1)
Tests  1 failed | 3 passed (4)
```

## GREEN

Focused runtime test:

```text
Test Files  1 passed (1)
Tests  4 passed (4)
```

Required checkpoint suites command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/clock.test.ts src/input/controls.test.ts src/sim/world.test.ts src/sim/purity.test.ts
```

Output:

```text
Test Files  5 passed (5)
Tests  67 passed (67)
```

Strict TypeScript command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npx tsc --noEmit
```

Output:

```text
exit 0
```

## Implementation notes

- `createMatchRuntime(options)` owns one world, clock, flight scaler, effects engine, audio engine, renderer, reduced-motion listener, controls binding, and RAF loop.
- The frame body preserves fixed-step pumping, flight scaling/hitstop policy, presentation draining and audio dispatch, terrain repaint/reset, draw telemetry, effects advancement, and scheduling order from `main.ts`.
- `dispose()` is idempotent, cancels the pending frame, disposes controls/listener exactly once, removes the owned dev inspection handle, and guards queued callbacks from further work.
- Completion is reported once after terminal-frame presentation work. The recap records shell IDs only when `fire(state)` succeeds, grouped by player, and does not add app state or DOM behavior to `sim/`.
- `main.ts` now delegates match ownership to the runtime while retaining the current URL seed/world/generator and loadout startup behavior.

## Concerns

- None for checkpoint 3. Per direction, verification was limited to the required focused suites plus strict TypeScript; the full repository suite remains a later Task 11 checkpoint.

## Fix Round 1

### Changed files

- `src/app/matchRuntime.ts`
- `src/app/matchRuntime.test.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-3-report.md`

### Finding 1 — exact frame-pipeline ordering

The runtime dependency boundary now delegates to the existing `step` and `drainPresentationEvents` functions by default. Tests inject wrappers that call those real functions while recording their exact position; production behavior and ordering are unchanged.

RED command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/app/matchRuntime.test.ts
```

RED output:

```text
FAIL  match runtime lifecycle > preserves step, event/audio, terrain repaint, draw, motion, and scheduling order
AssertionError: expected [ 'effects.consume', …(6) ] to deeply equal [ 'sim.step', 'events.drain', …(7) ]
Test Files  1 failed (1)
Tests  1 failed | 3 passed (4)
```

GREEN output after routing those two calls through their injected defaults:

```text
Test Files  1 passed (1)
Tests  4 passed (4)
```

The strengthened test asserts these literal sequences:

```text
event frame: sim.step → events.drain → effects.consume → audio.fire → audio.impact → audio.directHit → renderer.terrainChanged → renderer.draw → raf.request
empty-event frame: sim.step → events.drain → effects.consume → renderer.draw → effects.advanceFrame → raf.request
```

### Finding 2 — completion/disposal race

The regression test makes `onComplete` immediately call `runtime.dispose()` twice, invokes the completed frame again to probe for work, and asserts no next RAF, one draw, and exactly one controls/media-listener cleanup. Because the guarded behavior already existed, RED was established with a temporary mutation removing only the post-completion `disposed` check; the guard was then restored unchanged for GREEN.

Mutation RED command: same focused runtime command above.

Mutation RED output:

```text
FAIL  match runtime lifecycle > does not reschedule when completion synchronously disposes the runtime
AssertionError: expected [ 'events.drain', …(5) ] to deeply equal [ 'events.drain', …(4) ]
Received trailing operation: "raf.request"
Test Files  1 failed (1)
Tests  1 failed | 4 passed (5)
```

GREEN output with the original guard restored:

```text
Test Files  1 passed (1)
Tests  5 passed (5)
```

### Required verification

Command:

```powershell
$taskTemp = 'D:\codex-temp'
$taskCache = 'D:\codex-npm-cache'
New-Item -ItemType Directory -Force -Path $taskTemp, $taskCache | Out-Null
$env:TEMP = $taskTemp
$env:TMP = $taskTemp
$env:npm_config_cache = $taskCache
npm test -- --configLoader runner src/app/matchRuntime.test.ts src/sim/clock.test.ts src/input/controls.test.ts src/sim/world.test.ts src/sim/purity.test.ts
```

Output:

```text
Test Files  5 passed (5)
Tests  68 passed (68)
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

### Concerns

- None. The only production change is the two-function dependency seam; its browser defaults are the same `step` and `drainPresentationEvents` implementations previously called directly.
