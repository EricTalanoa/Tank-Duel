# Task 11 Checkpoint 4 Report

## Status

Complete. Task 4 screen models, safe delegated DOM views, responsive menu structure, and config-aware stable loadout deployment are implemented within the approved boundary.

## Changed files

- `src/ui/screenModels.ts`
- `src/ui/screenModels.test.ts`
- `src/ui/appView.ts`
- `src/ui/appView.test.ts`
- `src/ui/menu.css`
- `src/ui/loadout.ts`
- `src/ui/loadout.test.ts`
- `.superpowers/sdd/2026-08-29-task-11-menu-flow/task-4-report.md`

## RED

All commands used `TEMP`/`TMP` at `D:\codex-temp`, npm cache at `D:\codex-npm-cache`, and Vite's runner config loader.

```powershell
npm test -- --configLoader runner src/ui/screenModels.test.ts
```

Failed because `./screenModels` did not exist.

```powershell
npm test -- --configLoader runner src/ui/appView.test.ts src/ui/loadout.test.ts
```

Failed because `./appView` did not exist and the existing loadout model returned disabled-by-config shells instead of the expected HE-first enabled subset.

## GREEN and verification

```powershell
npm test -- --configLoader runner src/ui/screenModels.test.ts src/ui/appView.test.ts src/ui/loadout.test.ts src/sim/purity.test.ts
```

Result: 4 test files passed; 35 tests passed.

```powershell
npx tsc --noEmit
```

Result: exit 0.

The injection guard scan found no `innerHTML`, `outerHTML`, or `insertAdjacentHTML` use in `src/ui/appView.ts` or `src/ui/loadout.ts`.

## Implementation notes

- Models cover TITLE, MODE, MAP, CUSTOM, ROUND_INTRO, HOWTO, and ROUND_OVER using spec-backed registries.
- Custom, intro, loadout, and recap shell names are always paired with their icon.
- HE is forced into loadout slot 1 and Custom presents it enabled, locked, unlimited, with both controls disabled.
- App view handlers are installed once on mount, use event delegation across rerenders, and are removed by idempotent disposal.
- DOM is constructed with element APIs and `textContent`; dynamic spec/config text is never interpolated as markup.
- Loadout cards and deployment are filtered by enabled-shell config and normalized into stable spec slot order.

## Concerns

- No blocker. Task 6 must wire `onAction`, `onConfigChange`, resolved random configuration, and the separate loadout/match lifecycle; this checkpoint intentionally does not own those transitions.
- `mountLoadout` now returns an HE-inclusive, spec-ordered deployment list. The current runtime path remains compatible because `createLoadout` treats HE as the locked free slot.

## Fix Round 1

Reviewer finding addressed: loadout `.loadout-card` and `.deploy` buttons now have explicit visible `:focus-visible` styling in `src/ui/loadout.css`, and a focused regression test protects that contract without adding focus styling to disabled controls.

### RED

All commands used `TEMP`/`TMP` at `D:\codex-temp`, npm cache at `D:\codex-npm-cache`, and Vite's runner config loader.

```powershell
npm test -- --configLoader runner src/ui/loadout.test.ts
```

Result: failed in `src/ui/loadout.test.ts` because `loadout.css` did not yet contain an explicit `.loadout-card:focus-visible:not(:disabled)` rule.

### GREEN and verification

```powershell
npm test -- --configLoader runner src/ui/loadout.test.ts src/ui/appView.test.ts
```

Result: 2 test files passed; 10 tests passed.

```powershell
npx tsc --noEmit
```

Result: exit 0.
