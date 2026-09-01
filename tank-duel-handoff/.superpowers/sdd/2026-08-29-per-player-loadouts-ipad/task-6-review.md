# Task 6 independent review — Blue/Pink gameplay presentation

## Verdict summary

- **Spec compliance: FAIL.** Combat identity and projectile ownership are implemented correctly, but Blue/Pink leaks into non-gameplay TITLE/HOWTO decoration, which the approved design and review package explicitly exclude.
- **Code quality: FAIL.** The implementation is deterministic and typechecks, but it introduces a second exported `PlayerIndex` contract and couples non-gameplay scenes to the gameplay identity mapper. The ownership test also weakens its type-level coverage with casts.

## Findings

### Critical

None.

### Important

1. **Gameplay identity is applied to non-gameplay TITLE and HOWTO decoration.** The approved design limits Blue/Pink to gameplay-owned presentation (`docs/superpowers/specs/2026-08-29-per-player-loadouts-ipad-design.md:63-76`), the Task 6 brief says title/HOWTO-adjacent functional decoration remains unchanged (`.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-brief.md:7-15`), and the review package explicitly calls out non-player title/HOWTO decoration (`.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-review-package.md:13-15`). Current title flags use `playerColor(side < 0 ? 0 : 1)` at `src/render/titleScene.ts:229-245`; current HOWTO historical trajectories use `[playerColor(0), playerColor(1), HE_SHELL.accent]` at `src/render/howtoScene.ts:161-188`. These surfaces have no gameplay owner—the HOWTO color is based on shot index—so this is an identity-boundary violation and a visual scope change outside gameplay.

2. **Task 6 redeclares the canonical `PlayerIndex` contract.** Task 1 established and current `src/sim/playerLoadouts.ts:4` exports `PlayerIndex`; Task 6 independently exports the same alias from `src/sim/ballistics.ts:8`. `Projectile.owner` and `LaunchOptions.owner` then depend on the second alias at `src/sim/ballistics.ts:15-21,38-45`, while render identity imports it from ballistics at `src/render/palette.ts:20-21,36-37`. The aliases are structurally equal today, so TypeScript passes, but loadout/UI ownership and projectile/render ownership no longer share one contract. Reuse the existing type or move it to one neutral shared module.

### Minor

1. **The ownership regression test bypasses the interfaces it is intended to protect.** `src/sim/projectileOwnership.test.ts:6-18` redeclares an `OwnedLaunch` shape, casts `launchProjectile` through `unknown`, and treats `Projectile.owner` as optional. Runtime propagation is checked, but this makes the test less direct than importing `LaunchOptions` and reading the required `Projectile.owner` field without casts.

2. **The identity test does not assert per-player mapping for every surface.** `src/render/playerIdentity.test.ts:77-94` aggregates both players into one recording context and only checks that both colors occur; it could pass with player colors swapped between owners. The HUD/effects assertions at `src/render/playerIdentity.test.ts:96-120` similarly aggregate both active-player draws. The production mapping is correct by inspection, but direct owner-to-color assertions would make the regression proof match the requirement.

3. **The worker report has no complete changed-file inventory.** The brief requires changed files in the checkpoint report (`.superpowers/sdd/2026-08-29-per-player-loadouts-ipad/task-6-brief.md:39-43`), but `task-6-report.md:1-60` gives surface prose and `task-6-report.md:92-98` gives self-review claims without an exhaustive list. This matters in the non-Git workspace because the actual touched surface includes variant/validation fixtures and `titleScene.ts`/`howtoScene.ts` in addition to the seven principal baselines.

## Explicit review-package coverage

| Review-package bullet | Verdict | Evidence |
|---|---|---|
| Every player-owned combat surface uses `playerColor(PlayerIndex)` from `PRESENTATION` | PASS | The sole mapper is `src/render/palette.ts:20-22`. Projectile, trail, tank body/cannon/health, and active marker use it at `src/render/entities.ts:25,57,68,88-91`; the active-player HUD power bar uses it at `src/render/hud.ts:110-116`; muzzle feedback uses it at `src/render/effects.ts:88-99`. |
| Menus/loadout, terrain, explosions, shell icons, generic accents, and non-player title/HOWTO decoration retain functional colors | FAIL | Functional surfaces remain intact: fire zones use `zone.accent` at `src/render/entities.ts:33-45`; explosion sparks/debris use `event.accent`/`#8A6C4A` at `src/render/effects.ts:51-76`; shell icons and orange selected borders remain at `src/render/hud.ts:120-138`. TITLE flags and HOWTO trajectories instead use `playerColor` at `src/render/titleScene.ts:239` and `src/render/howtoScene.ts:167,176`. |
| Identity remains non-color-only | PASS | Player labels/status remain in HUD text at `src/render/hud.ts:91-99`; active state retains a rectangular marker at `src/render/entities.ts:88-91`; tank silhouettes, health geometry, position/direction, and alpha cues remain. |
| Old competing player palette entries are fully removed | PASS | `PALETTE` has no `playerOne`/`playerTwo` fields at `src/render/palette.ts:7-18`; fresh search `rg -n 'PALETTE\\.player(One|Two)' src` returned no matches. |
| `Projectile.owner` / `LaunchOptions.owner` are typed and supplied by every caller | PASS | Required readonly fields are at `src/sim/ballistics.ts:15-21,38-46`; launch copies `options.owner` directly at `src/sim/ballistics.ts:59-69`. All current launch sites supply `owner`, including production fire/validation at `src/sim/world.ts:275-284`, `src/sim/terrainValidation.ts:108-117`, `src/sim/worldValidation.ts:23-31`, historical HOWTO at `src/render/howtoScene.ts:215-223`, and fixtures/tests at `src/sim/ballistics.test.ts:21-30,46-53,76-83,143-150`, `src/sim/exotic-projectiles.test.ts:7-15`, `src/sim/projectileOwnership.test.ts:65-69`, `src/sim/weapons.test.ts:19-27,74-82`, `src/sim/world-ranges.test.ts:10-18`, `src/sim/world.test.ts:263-271,311-319,354-362`, and `src/render/camera.test.ts:86-87`. |
| Fire, split, staged, airburst, bounce, roller, cloning, validation, and presentation preserve owner | PASS | Fire sources `tank.player` and emits it for muzzle feedback at `src/sim/world.ts:275-299`; apex children copy owner at `src/sim/weapons.ts:70-91`; airburst children spread the complete projectile at `src/sim/weapons.ts:106-113`; skipper and roller retain the same object at `src/sim/weapons.ts:155-190,204-238`; validation launches provide explicit owner metadata at `src/sim/terrainValidation.ts:108-117` and `src/sim/worldValidation.ts:23-31`; render consumes owner through `src/render/entities.ts:24-28` and `src/render/effects.ts:90-93`. |
| Owner never branches physics, damage, RNG, terrain, or deterministic outcomes | PASS | Production simulation owner reads are limited to launch assignment (`src/sim/ballistics.ts:68`), child copy (`src/sim/weapons.ts:76`), and muzzle presentation metadata (`src/sim/world.ts:298`). Physics is owner-free at `src/sim/ballistics.ts:86-113`; impact/terrain/damage is owner-free at `src/sim/world.ts:427-550`; no owner read exists in RNG or terrain helpers. The owner-0/owner-1 launch-vector check is at `src/sim/projectileOwnership.test.ts:59-83`, and the golden hash is unchanged. |
| Newly touched validation/presentation code remains strict and does not silently repair invalid ownership | PASS | `LaunchOptions.owner` is required and copied without defaulting, coercion, clamping, or fallback at `src/sim/ballistics.ts:38-46,59-69`. Validation callers use explicit owner `0`; `playerColor` indexes the typed presentation registry directly at `src/render/palette.ts:20-22`. No ownership repair path was found. |
| No CPU/ammunition/visual-overhaul scope creep, no UI imports into simulation, no duplicated spec colors, and no golden-file mutation | FAIL for the visual-boundary portion; PASS for the remainder | No CPU/ammunition behavior was added; no `../render/` or `../ui/` imports were found under `src/sim`; production Blue/Pink literals appear only in `spec/presentation.json`; and `spec/test-vectors.json` is unchanged. The TITLE/HOWTO `playerColor` changes are nevertheless visual scope creep under the gameplay-only rule (finding 1). |

## Checks

- Fresh focused run: `npm test -- --configLoader runner src/render/playerIdentity.test.ts src/render/effects.test.ts src/render/howtoScene.test.ts src/render/titleScene.test.ts src/render/rendererCamera.test.ts src/sim/ballistics.test.ts src/sim/projectileOwnership.test.ts src/sim/weapons.test.ts src/sim/world.test.ts src/sim/world-ranges.test.ts src/sim/world-validation.test.ts src/sim/purity.test.ts` — **12 files, 134 tests passed**.
- Fresh TypeScript check: `npx tsc --noEmit` — **exit 0**.
- Fresh golden check: `Get-FileHash -Algorithm SHA256 spec/test-vectors.json` — **`D7B49CB35C2EBBA18D2FE0BC1C3021737E18E4AD2A0D368D7D8C1E1DDF99DDF8`**.
- Fresh static checks: no `PALETTE.playerOne/playerTwo` references; every current `launchProjectile` call supplies `owner`; no simulation UI/render imports; no production Blue/Pink literals outside the spec registry; no owner branch in physics/damage/RNG/terrain paths.
- Worker evidence accepted from the review package/report but not rerun here: full suite **52 files / 421 tests**, strict TypeScript clean, and Vite build clean (**62 modules transformed**).

## Concerns

The automated gate is green but has no assertion that TITLE/HOWTO decoration stays on functional colors, so it misses the primary spec failure. Correct the two non-gameplay color leaks, consolidate `PlayerIndex`, strengthen direct owner-to-color assertions, and add a complete changed-file inventory before re-review.
