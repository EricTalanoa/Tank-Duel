# Task 6 fix round 1 scoped re-review

## Verdict

- **Important finding 1 — ADDRESSED.** TITLE flags and HOWTO historical trajectories use functional colors and no longer use `playerColor`.
- **Important finding 2 — ADDRESSED.** `PlayerIndex` has one canonical declaration in `src/sim/playerLoadouts.ts`, and relevant consumers import it.
- **New Critical findings: None.**
- **New Important findings: 1.** The fix hardcodes the restored functional colors independently in two production files, duplicating spec-owned values.

## Original Important finding 1 — ADDRESSED

- TITLE defines functional flag colors at `src/render/titleScene.ts:73-75` and draws them at `src/render/titleScene.ts:230-246`; there is no `playerColor` call in `titleScene.ts`.
- HOWTO defines functional historical trail colors at `src/render/howtoScene.ts:36-40` and selects them by historical shot index at `src/render/howtoScene.ts:168-178`; there is no `playerColor` call in `howtoScene.ts`.
- The new regression tests assert the boundary: `src/render/titleScene.test.ts:213-235` requires `#E8B33C` and `#4FC3D9`, while `src/render/howtoScene.test.ts:52-83` requires `['#E8B33C', '#4FC3D9', '#FF6B35']`. Restoring `playerColor` would produce `#4DA3FF`/`#FF5CA8` for the first two surfaces and fail these assertions.
- Gameplay-owned surfaces still use `playerColor`: projectile/trail/tank surfaces at `src/render/entities.ts:24-29,49-104`, HUD power at `src/render/hud.ts:110-116`, and muzzle feedback at `src/render/effects.ts:88-99`.

## Original Important finding 2 — ADDRESSED

- The only `PlayerIndex` declaration is `src/sim/playerLoadouts.ts:4`.
- `src/sim/ballistics.ts:6` imports the canonical type and uses it for `Projectile.owner` and `LaunchOptions.owner` at `src/sim/ballistics.ts:14-45`.
- `src/render/palette.ts:7` imports the same canonical type and maps it to `PRESENTATION` at `src/render/palette.ts:23-25`.
- Static search found no second declaration and no `playerColor` use in TITLE/HOWTO.
- Owner behavior remains intact: `fire` supplies `tank.player` at `src/sim/world.ts:275-284`; apex children copy owner at `src/sim/weapons.ts:70-91`; airburst cloning preserves it through spread at `src/sim/weapons.ts:106-113`; bounce/roller paths retain the same projectile object at `src/sim/weapons.ts:155-190,204-238`.

## New Important finding

1. **Functional spec colors are duplicated in production code.** The fix adds `TITLE_FLAG_COLORS = ['#E8B33C', '#4FC3D9']` at `src/render/titleScene.ts:74` and `HISTORICAL_TRAIL_COLORS = ['#E8B33C', '#4FC3D9', HE_SHELL.accent]` at `src/render/howtoScene.ts:37`. `#E8B33C` and `#4FC3D9` are also spec-owned values in `spec/worlds.json:83,173` and `spec/shells.json:363`. This is new duplication introduced by the fix and violates the Task 6 source-of-truth/no-duplicated-colors constraint. Centralize these functional colors behind the existing functional palette/spec access while keeping them separate from `playerColor`.

## Checks

- Fresh focused run: `npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts src/sim/ballistics.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts` — **7 files, 65 tests passed**.
- Fresh TypeScript check: `npx tsc --noEmit` — **exit 0**.
- Worker evidence accepted from the fix report but not rerun here: full suite **52 files / 423 tests passed**.
- Static checks: one `PlayerIndex` declaration; no `playerColor` in TITLE/HOWTO; gameplay consumers still use `playerColor`; no new Critical issue found.

## Scope note

The three Minor findings from `task-6-review.md` were explicitly deferred by the fix-round package and are not assessed here.
