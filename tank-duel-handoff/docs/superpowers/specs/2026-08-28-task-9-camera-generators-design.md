# Task 9: Camera and Generators Design

**Date:** 2026-08-28
**Status:** Approved

## Scope

Task 9 adds the Rust and Selene worlds, the Canyon, Craters, Plates, and Spires terrain generators, deterministic terrain validation and fallback, and a phase-aware camera.

The task text contains a boundary conflict: its detailed requirements defer Hollow and Ring to Task 10, while its final sentence says “five worlds, six generators, 30 combinations.” This implementation follows the explicit feature boundaries and therefore finishes Task 9 with five worlds and five available generators (25 combinations). Hollow, wrap behavior, and Ring remain wholly in Task 10.

## Source of Truth

Production code will import all gameplay and generator parameters from `spec/*.json`. Existing numeric generator parameters currently embedded in `terrain.ts`, plus the reference parameters for the four new generators, will move into `spec/generators.json` rather than being copied into additional production modules.

Terrain-validation policy values—spawn sample width, flatness tolerance, test angle, retry count, and fallback seeds—will also live in spec. Shell power values, blast radii, tank geometry, world physics, and spawn positions continue to come from their existing spec files. `spec/test-vectors.json` remains immutable.

## Worlds and Generator Selection

`WorldId` expands to include Rust and Selene. Each world uses its configured generator by default. A valid generator query selection may override that default so every shipped world/generator combination can be exercised without changing simulation rules.

The generator result includes the accepted seed and whether deterministic fallback was required. Given the same world, generator, dimensions, and requested seed, generation and validation produce the same result.

## Terrain Generators

The existing seeded PRNG and one-dimensional heightfield representation remain the common foundation. Hills is retained, while Canyon, Craters, Plates, and Spires implement the algorithms and parameter values represented in `docs/03-worlds.html`, with every numeric value imported from `spec/generators.json`.

Generators stay pure: they receive dimensions, seed, and imported configuration and return terrain data. They do not read browser state or mutate the match.

## Validation and Fallback

A generated map is accepted only if both conditions hold:

1. Each spawn zone varies by no more than the spec-provided vertical tolerance across the spec-provided horizontal sample width.
2. From each tank, at least one spec-provided legal power value fired as HE at the spec-provided 45-degree validation angle lands within the imported HE blast radius of the opposing spawn.

The reachability check uses the real deterministic projectile simulation and the selected world's physics. It does not use a separate approximate range formula. Each side is tested independently because wind and asymmetric terrain can change the result.

If a candidate fails, the generator advances deterministically through at most the spec-provided number of attempts. If none pass, it generates the world/generator pair's known-good fallback seed and asserts that fallback passes. A failure of the known-good fallback is surfaced as a configuration error rather than silently accepting a blocked map.

## Camera

`render/camera.ts` is a pure view-policy module. In AIM it computes a view that frames both living tanks with spec-backed padding. In FLIGHT it follows the active projectile while retaining enough context for readable motion. Non-wrapping worlds clamp the view rectangle to world bounds, so the camera never reveals space outside the map.

The camera affects rendering and pointer coordinate conversion only. It never changes simulation positions, velocities, step counts, collision checks, or trajectory history. Resizing recomputes the viewport and camera transform from the current immutable simulation state; it cannot perturb an in-flight shot.

The renderer composes letterboxing with the camera transform:

- screen coordinates map through the letterboxed canvas into camera-local coordinates;
- camera-local coordinates map into world coordinates by adding the view origin;
- world rendering applies the inverse transform consistently to terrain, tanks, projectiles, effects, and aim input.

HUD remains screen-oriented and does not pan with the world camera.

## Verification

Automated coverage will include:

- deterministic output and characteristic shape checks for all five generators;
- all 25 world/generator combinations producing accepted terrain;
- a deliberately blocked candidate being rejected and regenerated;
- deterministic fallback after the configured retry limit;
- flat-spawn and bidirectional 45-degree HE validation;
- AIM framing, FLIGHT following, and non-wrap camera clamping;
- a mid-flight resize leaving the simulation trajectory unchanged;
- query resolution for Rust, Selene, and generator overrides;
- the full pre-existing test suite and strict production build.

Browser verification will exercise each new world, multiple generator combinations, an in-flight resize, pointer aiming after camera movement, and console cleanliness.

## Task Boundary

Stop after Task 9 is implemented and verified. Do not add Hollow, world wrapping, seam duplication, or the Ring generator; those belong to Task 10.
