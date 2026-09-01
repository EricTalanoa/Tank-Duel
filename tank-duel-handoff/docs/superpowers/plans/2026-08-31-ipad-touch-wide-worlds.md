# iPad Touch Controls and Wide Worlds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Focus the menu on Quick Start, ship every world at 1200 px or wider, and make a complete match playable using touch controls and direct aiming gestures.

**Architecture:** Keep simulation input centralized in `matchRuntime.ts`. Add a pure touch-aim mapper under `input/`, a DOM touch-control owner under `ui/`, and adapt both into the runtime's existing angle, power, shell, and fire callbacks. World widths remain spec-driven, with explicit validated mass overrides preserving shell reach.

**Tech Stack:** TypeScript, Canvas 2D, DOM Pointer Events, CSS, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-ipad-touch-wide-worlds-design.md`

## Global Constraints

- Every shipped world is at least 1200 field pixels wide.
- The 150 px spawn inset remains unchanged, yielding a minimum 900 px spawn gap.
- All 12 completed shells are enabled in Quick Start; Anvil remains unavailable.
- Touch targets are at least 44 by 44 CSS pixels and account for iPad safe-area insets.
- Dragging adjusts aim but never fires; Fire always requires an explicit tap.
- Keyboard controls remain functional.
- Gameplay remains landscape-only.
- Verification stays focused on directly affected behavior plus a production build.

---

### Task 1: Focus the title menu on Quick Start

**Files:**
- Modify: `src/ui/screenModels.ts`
- Modify: `src/ui/appView.test.ts`

**Interfaces:**
- Consumes: `buildTitleScreenModel(): TitleScreenModel`
- Produces: a title model and DOM containing no enabled or disabled Custom Game button

- [ ] **Step 1: Write the failing DOM test**

Add an assertion to the existing TITLE rendering test:

```ts
expect(root.all('button').map((button) => button.getAttribute('aria-label'))).toEqual([
  'Quick Start',
  'How to Play',
  'Settings',
]);
expect(root.all('button').some((button) => button.textContent.includes('Custom Game'))).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm it fails because Custom Game is present**

Run: `npm run test -- src/ui/appView.test.ts`

- [ ] **Step 3: Remove only the Custom Game title action**

Delete the `Custom Game` action from `buildTitleScreenModel()`. Leave `openCustom`, the CUSTOM reducer branch, and the CUSTOM renderer intact.

- [ ] **Step 4: Run the focused test**

Run: `npm run test -- src/ui/appView.test.ts`
Expected: PASS.

---

### Task 2: Expand all worlds and preserve projectile reach

**Files:**
- Modify: `spec/worlds.json`
- Modify: `src/sim/world-ranges.test.ts`
- Modify: `src/sim/world-validation.test.ts`
- Modify only if required by failing validation: world mass override data consumed by `src/sim/worlds.ts`

**Interfaces:**
- Consumes: `spawnGapForWorld(world): number`, `validateWorldShellRanges(world)`
- Produces: `SHIPPED_WORLDS` with `width >= 1200` and every flight shell range greater than its spawn gap

- [ ] **Step 1: Add the minimum-width and spawn-gap test**

```ts
it('ships only wide battlefields with distant spawns', () => {
  for (const world of SHIPPED_WORLDS) {
    expect(world.width).toBeGreaterThanOrEqual(1200);
    expect(spawnGapForWorld(world)).toBeGreaterThanOrEqual(900);
  }
});
```

- [ ] **Step 2: Run the world tests and confirm Terra, Vesper, and Ferrum fail**

Run: `npm run test -- src/sim/world-ranges.test.ts src/sim/world-validation.test.ts`

- [ ] **Step 3: Set the three narrow world widths**

In `spec/worlds.json`, set:

```json
{ "id": "terra", "width": 1200 }
{ "id": "vesper", "width": 1200 }
{ "id": "ferrum", "width": 1200 }
```

Do not alter Hollow, Rust, or Selene widths. Do not change gravity, air drag, wind, or flight time scale.

- [ ] **Step 4: Run range validation and record the required Vesper/Ferrum overrides**

Use `validateWorldShellRanges` as the calculator. Store the resulting explicit per-shell values through the existing `massOverrides` world-loading path; do not weaken the range assertion or regenerate golden ballistic vectors.

- [ ] **Step 5: Confirm every flight shell crosses its world gap**

```ts
for (const world of SHIPPED_WORLDS) {
  const gap = spawnGapForWorld(world);
  expect(validateWorldShellRanges(world).every(({ rangePx }) => rangePx > gap)).toBe(true);
}
```

Run: `npm run test -- src/sim/world-ranges.test.ts src/sim/world-validation.test.ts`
Expected: PASS.

---

### Task 3: Add pure direct-aim gesture mapping

**Files:**
- Create: `src/input/touchAim.ts`
- Create: `src/input/touchAim.test.ts`

**Interfaces:**
- Produces:

```ts
export interface TouchAimPoint { readonly x: number; readonly y: number }
export interface TouchAimResult { readonly angleDeg: number; readonly power: number }
export function mapTouchAim(
  origin: TouchAimPoint,
  pointer: TouchAimPoint,
  direction: 1 | -1,
  powerRange: Readonly<{ min: number; max: number }>,
  maxDragPx: number,
): TouchAimResult;
```

- [ ] **Step 1: Write focused mapping tests**

Cover right-facing 45 degrees, left-facing mirroring, clamped 0–90 degree elevation, minimum power at zero drag, and maximum power at/above `maxDragPx`.

```ts
expect(mapTouchAim({ x: 100, y: 200 }, { x: 200, y: 100 }, 1, { min: 10, max: 100 }, 200).angleDeg)
  .toBeCloseTo(45);
expect(mapTouchAim({ x: 100, y: 200 }, { x: -100, y: 0 }, -1, { min: 10, max: 100 }, 200))
  .toEqual({ angleDeg: 45, power: 100 });
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npm run test -- src/input/touchAim.test.ts`

- [ ] **Step 3: Implement the pure mapper**

Use `Math.atan2(Math.max(0, origin.y - pointer.y), Math.abs(pointer.x - origin.x))`, convert radians to degrees, clamp to 0–90, and linearly map Euclidean drag distance to the provided power range.

- [ ] **Step 4: Run the focused test**

Run: `npm run test -- src/input/touchAim.test.ts`
Expected: PASS.

---

### Task 4: Build the touch control surface

**Files:**
- Create: `src/ui/touchControls.ts`
- Create: `src/ui/touchControls.css`
- Create: `src/ui/touchControls.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces:

```ts
export interface TouchShellControl {
  readonly slot: number;
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export interface TouchControlState {
  readonly angleDeg: number;
  readonly power: number;
  readonly canAim: boolean;
  readonly canFire: boolean;
  readonly shells: readonly TouchShellControl[];
}

export interface TouchControlCallbacks {
  readonly onAngle: (value: number) => void;
  readonly onPower: (value: number) => void;
  readonly onShell: (slot: number) => void;
  readonly onFire: () => void;
}

export interface MountedTouchControls {
  render(state: TouchControlState): void;
  dispose(): void;
}

export function mountTouchControls(
  root: HTMLElement,
  callbacks: TouchControlCallbacks,
): MountedTouchControls;
```

- [ ] **Step 1: Write DOM behavior tests**

Test that angle/power sliders emit numeric values, step buttons emit adjacent values, shell buttons emit stable 1-based slots, disabled shells do nothing, Fire emits once per tap, and disposal removes the surface and listeners.

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `npm run test -- src/ui/touchControls.test.ts`

- [ ] **Step 3: Implement the DOM owner**

Render two range inputs, four step buttons, deck buttons, and one Fire button. Use delegated `click` and `input` listeners. Mask shell SVGs using the existing `--icon` pattern rather than `<img>`.

- [ ] **Step 4: Add iPad-safe styles**

Use fixed positioning above the canvas, `env(safe-area-inset-*)`, `touch-action: manipulation` on buttons, and `min-inline-size`/`min-block-size: 44px`. Put aim controls at bottom-left, deck at bottom-center, and Fire at bottom-right. Add a compact-height media query that hides secondary text without shrinking targets.

- [ ] **Step 5: Import the stylesheet from `src/main.ts` and run the test**

Run: `npm run test -- src/ui/touchControls.test.ts`
Expected: PASS.

---

### Task 5: Integrate touch controls and canvas dragging into the match runtime

**Files:**
- Modify: `src/input/controls.ts`
- Modify: `src/input/controls.test.ts`
- Modify: `src/app/matchRuntime.ts`
- Modify: `src/app/matchRuntime.test.ts`
- Modify: `src/app/controller.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Interfaces:**
- Extends `CreateMatchRuntimeOptions` with the root or factory needed to mount `MountedTouchControls`.
- Extends pointer controls with drag start/move/end/cancel callbacks and pointer capture.
- Consumes `mapTouchAim`, `mountTouchControls`, `renderer.toField`, and the active tank position.

- [ ] **Step 1: Add a runtime test for touch parity**

Through injected touch-control and pointer-control fakes, assert that:

```ts
touch.onAngle(55);       // state.aim.angleDeg becomes 55
touch.onPower(82);       // state.aim.power becomes 82
touch.onShell(2);        // arsenal selects slot 2
touch.onFire();          // one projectile launches
touch.onFire();          // no second projectile during FLIGHT
```

Also assert drag movement updates angle/power and drag end does not fire.

- [ ] **Step 2: Run the runtime and input tests and confirm the new dependencies are absent**

Run: `npm run test -- src/input/controls.test.ts src/app/matchRuntime.test.ts`

- [ ] **Step 3: Extend pointer controls for a captured drag**

On primary `pointerdown`, call `setPointerCapture(pointerId)`. Route matching `pointermove`, `pointerup`, and `pointercancel` events. Always release capture on end/cancel/dispose. Ignore non-primary buttons.

- [ ] **Step 4: Mount touch controls for MATCH only**

The runtime adapts absolute slider values into deltas:

```ts
onAngle: (value) => adjustAngle(state, value - state.aim.angleDeg),
onPower: (value) => adjustPower(state, value - state.aim.power),
onShell: (slot) => selectShell(state, slot),
onFire: fireOnce,
```

Build `TouchControlState` from the active arsenal on render frames. Mark controls inert during non-AIM phases, CPU turns, pause, and disposal.

- [ ] **Step 5: Connect direct aiming**

Only begin a drag when the field-space pointer is within a generous 44 CSS-pixel-equivalent radius of the active tank. Convert the current pointer with `renderer.toField`, call `mapTouchAim`, then apply deltas. Do not call `fire` on pointer release.

- [ ] **Step 6: Protect browser interaction**

Set `touch-action: none` on `#field` only while it is the gameplay surface. Keep menu DOM controls at `touch-action: manipulation`; preserve keyboard focus and visible focus styles.

- [ ] **Step 7: Run focused integration tests**

Run: `npm run test -- src/input/controls.test.ts src/app/matchRuntime.test.ts src/ui/touchControls.test.ts`
Expected: PASS.

---

### Task 6: Focused verification

**Files:**
- Verify all files changed above

**Interfaces:**
- Confirms the approved spec without expanding test scope

- [ ] **Step 1: Run directly affected tests**

```powershell
npm run test -- src/ui/appView.test.ts src/ui/loadout.test.ts src/ui/config.test.ts src/sim/world-ranges.test.ts src/sim/world-validation.test.ts src/input/touchAim.test.ts src/input/controls.test.ts src/ui/touchControls.test.ts src/app/matchRuntime.test.ts
```

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Perform one iPad landscape smoke check when a browser harness is available**

At 1194 by 834, confirm the canvas fills the viewport, every control is tappable without overlap, a full turn can be aimed and fired without a keyboard, and browser scrolling does not occur over the battlefield. If the browser harness is unavailable, report that limitation rather than installing new dependencies.

## Commit note

The current environment may not write `.git/index.lock`. If Git remains read-only, leave all implementation changes uncommitted and report that clearly instead of changing repository permissions.
