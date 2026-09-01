# Task 6 report — Blue/Pink gameplay presentation

## Scope and source of truth

Implemented checkpoint 6 only. Player combat identity now resolves exclusively through `playerColor(player)`, which returns `PRESENTATION.players[player].color` (`#4DA3FF` / `#FF5CA8`). `PALETTE.playerOne` and `PALETTE.playerTwo` were removed; the source audit found zero remaining references.

## TDD evidence

### RED

1. Added `src/render/playerIdentity.test.ts` before production edits. The first focused run failed all three identity behaviours: `playerColor` was absent, current tank/projectile surfaces used the previous palette, and muzzle flashes used `event.accent`.
2. Completed the recording-canvas fixture so its projectile model matched the existing renderer, then added `src/sim/projectileOwnership.test.ts` before ownership production edits.
3. Re-ran the focused RED command:

```text
npm test -- --configLoader runner src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts
5 failed / 5 tests
```

The failures were expected behavioural failures: no render-layer mapping, old non-spec player colors, projectile/variant owners absent, and `fire` not recording the active player as owner. No production code had been changed before this clean RED run.

### GREEN

Added only the required mapping, ownership metadata, and render selection. Focused verification then passed:

```text
npm test -- --configLoader runner src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts src/sim/ballistics.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts src/sim/world-ranges.test.ts
6 files passed, 55 tests passed
```

## Migrated player-owned surfaces

- Tank hull/body and health fill: `drawTank` resolves the tank player's color.
- Aim indicator/cannon stroke and active-turn marker: `drawTank` resolves the active tank's color.
- Player-owned trails: `drawTrails` resolves the trail tank's color.
- Projectile/bullet: `drawFlightEntities` resolves `projectile.owner`.
- Active player's HUD power/aim indicator: `drawHud` resolves `state.activePlayer`.
- Muzzle flash feedback: `fire` records the projectile owner in the event; `createEffects` resolves that owner at draw time.
- Legacy presentation-only usages that depended on removed palette entries: How To shot colors and title flags now resolve through `playerColor`.

The recording-canvas tests prove both players' body, health fill, active marker, aim stroke, projectile, trail, muzzle feedback, and HUD indicator use their corresponding presentation color.

## Projectile ownership and physics

- `PlayerIndex` is the `0 | 1` owner type exported by `src/sim/ballistics.ts`.
- `Projectile.owner` and `LaunchOptions.owner` are readonly.
- `fire` passes the active tank's `player` as `owner`.
- Apex-generated Cluster and staged MIRV children copy owner explicitly.
- Altitude-generated Airburst bomblets retain owner through the existing complete projectile spread.
- Skipper bounce and Roller continuation retain ownership by continuing the same projectile object.
- The new ownership test exercises all of the above and proves launch vectors are identical for otherwise identical owner 0 and owner 1 launches.

`owner` is read only by render/presentation selection. Ballistics, terrain, damage, RNG, and determinism logic do not branch on it.

## Functional colors intentionally unchanged

- Shell icons remain neutral image assets; the recording-canvas test proves they are still drawn.
- Selected shell border remains functional orange `#FF8C42`.
- Explosion sparks continue to use `impact.accent`, with terrain debris `#8A6C4A`.
- How To target, title muzzle glow/exchange fire, terrain, menus/loadout, and generic accents retain their existing functional palettes.

## Source-of-truth and golden audit

```text
rg "PALETTE\\.player(One|Two)" src
# no matches
```

All player-color consumers route through `playerColor`; it is the only function that reads `PRESENTATION.players[player].color` for rendering. `spec/test-vectors.json` was not edited or regenerated. Its SHA-256 after the task is:

```text
D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8
```

`src/sim/world-ranges.test.ts` remained green as part of the focused and full suites, preserving the shipped golden ranges.

## Final verification

```text
npm test -- --configLoader runner
52 files passed, 421 tests passed

npx tsc --noEmit
exit 0

TEMP=D:\\codex-temp TMP=D:\\codex-temp npx vite build --outDir D:\\codex-tank-duel-task6-51647ad81c3c4a1fa88d66b2ecff2e92 --emptyOutDir
62 modules transformed; built in 231 ms
```

The final Vite output directory was newly generated on `D:` and was empty before Vite emitted its artifacts.

## Self-review

- Confirmed every actual `launchProjectile` caller/fixture now supplies an owner.
- Confirmed all spawn and continuation paths preserve owner.
- Confirmed no competing `PALETTE.playerOne/playerTwo` identity contract remains.
- Confirmed test vectors remain unchanged and physics golden ranges still pass.
- Confirmed changes stay within Task 6 presentation/ownership scope; no CPU, ammunition, terrain, RNG, or visual-overhaul work was added.

## Concerns

None. The fresh D: build output directory is intentionally retained as build evidence.

## Fix Round 1

### Scope

Addressed only the two Important review findings:

1. Restored TITLE flags and HOWTO historical trajectories to their prior functional colors. Neither surface is gameplay-owned and neither now calls `playerColor`.
2. Removed the duplicate `PlayerIndex` alias from `src/sim/ballistics.ts`. Projectile ownership and the render palette now import the canonical `PlayerIndex` from `src/sim/playerLoadouts.ts`.

The three ledgered Minor findings were not changed.

### RED evidence

Before changing production code, added recording-canvas boundary regressions to the existing TITLE and HOWTO scene tests and ran:

```text
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts
2 files failed; 2 new tests failed; 14 existing tests passed
```

Expected failures proved the current leak:

```text
HOWTO received: [ '#4DA3FF', '#FF5CA8', '#FF6B35' ]
expected:         [ '#E8B33C', '#4FC3D9', '#FF6B35' ]

TITLE fills included: '#4DA3FF', '#FF5CA8'
expected functional flags: '#E8B33C', '#4FC3D9'
```

The production root cause was direct use of `playerColor` indexed by title side/HOWTO shot index, even though neither element has a gameplay owner. Separately, `ballistics.ts` declared a second structural `PlayerIndex` alias and `palette.ts` imported it from there.

### GREEN evidence

Restored the unowned visual surfaces with contextual functional constants:

- `TITLE_FLAG_COLORS = ['#E8B33C', '#4FC3D9']`
- `HISTORICAL_TRAIL_COLORS = ['#E8B33C', '#4FC3D9', HE_SHELL.accent]`

`Projectile.owner` and `LaunchOptions.owner` now use the canonical type imported from `playerLoadouts`; `playerColor` imports that same canonical type directly.

Focused coverage passed:

```text
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts src/sim/ballistics.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts
7 files passed, 65 tests passed
```

Final verification passed:

```text
npm test -- --configLoader runner
52 files passed, 423 tests passed

npx tsc --noEmit
exit 0
```

Static follow-up confirmed `PlayerIndex` has one declaration at `src/sim/playerLoadouts.ts`; `ballistics.ts` and `palette.ts` import it from there. A search for `playerColor(` in `titleScene.ts` and `howtoScene.ts` returned no matches.

### Exact changed files

- `src/render/titleScene.ts`
- `src/render/titleScene.test.ts`
- `src/render/howtoScene.ts`
- `src/render/howtoScene.test.ts`
- `src/sim/ballistics.ts`
- `src/render/palette.ts`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-report.md`

## Fix Round 2

### Scope

Addressed the one new Important finding only: TITLE/HOWTO functional colors are no longer independently duplicated as production literals. The three deferred Minor findings remain untouched.

### RED evidence

Before production changes, updated the TITLE/HOWTO boundary tests to consume a public render-level `functionalAccent(WorldId)` contract and added a test that compares that contract against `worldById(world).palette.accent` from the validated world specification. The focused RED command was:

```text
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts
2 files failed; 3 tests failed; 14 tests passed
```

All three failures were the expected missing-contract failure:

```text
TypeError: functionalAccent is not a function
```

This proves the scenes cannot satisfy their visual-color expectations until a shared render accessor exists. Their expectations now derive from that public contract, so changing the spec-backed source will fail the scene tests if either scene returns to an independent duplicate.

### GREEN evidence

Added one render-layer accessor:

```text
functionalAccent(world: WorldId) -> worldById(world).palette.accent
```

TITLE selects `rust` and `hollow` functional accents by its decorative flag index. HOWTO selects the same two world accents for its first two historical trajectories and retains `HE_SHELL.accent` for the third. Neither scene calls `playerColor`, and no color literal was relocated into production code.

Required focused gate:

```text
npm test -- --configLoader runner src/render/titleScene.test.ts src/render/howtoScene.test.ts src/render/playerIdentity.test.ts src/sim/projectileOwnership.test.ts src/sim/ballistics.test.ts src/sim/weapons.test.ts src/sim/exotic-projectiles.test.ts
7 files passed, 66 tests passed
```

Final verification:

```text
npm test -- --configLoader runner
52 files passed, 424 tests passed

npx tsc --noEmit
exit 0
```

Static audit results:

```text
rg "#E8B33C|#4FC3D9" src/render --glob "!*.test.ts"
# no matches

rg "playerColor\\(" src/render/titleScene.ts src/render/howtoScene.ts
# no matches
```

### Exact changed files

- `src/render/palette.ts`
- `src/render/titleScene.ts`
- `src/render/titleScene.test.ts`
- `src/render/howtoScene.ts`
- `src/render/howtoScene.test.ts`
- `.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-report.md`
