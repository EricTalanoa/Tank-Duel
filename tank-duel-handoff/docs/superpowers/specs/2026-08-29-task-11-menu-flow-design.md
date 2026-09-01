# Task 11 Menu Flow Design

## Goal and boundary

Add the complete path between page load and local play: TITLE, MODE, MAP, CUSTOM, HOWTO, ROUND_INTRO, loadout, MATCH, and ROUND_OVER. Match simulation remains unchanged and pure. Task 12 CPU behavior and Task 13 validation expansion are not implemented here.

`spec/screens.json` owns screen membership and paths. Other `spec/*.json` files own worlds, generators, shells, icons, ammunition bounds, physics, and defaults. Prose supplies structure only where it does not conflict with spec.

## Application architecture

Introduce a UI/application layer outside `sim/`:

- `ui/flow.ts`: pure screen reducer and transition commands.
- `ui/config.ts`: typed match configuration assembled from spec-backed values.
- `ui/storage.ts`: guarded localStorage adapter with versioned decoding and default fallback.
- `ui/screens/*`: DOM views for title, mode, map, custom, how-to, round intro, and round over.
- `render/titleScene.ts` and `render/howtoScene.ts`: canvas-only animation modules that own no match state.
- `main.ts`: application composition root. It mounts the flow controller and creates/disposes a match runtime.

The simulation does not import the UI, DOM, storage, or browser APIs. Screen navigation is deterministic and testable without a browser; DOM mounts translate clicks into reducer actions.

## Screen flow

The initial screen is TITLE.

- Quick Start sets the path to quick/local and opens MAP. This counts as click one. Selecting any map tile, including Random, resolves the configuration and opens ROUND_INTRO. This counts as click two.
- MODE exists as the quick-start mode chooser structure required by `screens.json`, but local is the active/default mode and “1 v CPU” is visible, disabled, and labelled as arriving in Task 12. The Quick Start action applies local mode without requiring a third click.
- Custom Game opens CUSTOM directly. Its Start action opens ROUND_INTRO, keeping Custom Game a one-screen setup path.
- How to Play opens HOWTO and teaches bracketing with three real spec-backed trajectories: short, long, hit. It never shows a predictive trajectory for the current match.
- ROUND_INTRO displays the resolved configuration and shell icons, then opens the existing loadout. Deploying starts MATCH.
- ROUND_OVER has Rematch, Change Loadout, and Menu. Rematch keeps every setting and creates a new seed. Change Loadout keeps settings and returns to loadout. Menu disposes the match runtime and returns to TITLE.

The CPU option is intentionally non-startable until Task 12; no local match is mislabeled as CPU play.

## Configuration and persistence

`MatchConfig` contains path, mode, CPU tier placeholder, selected/random world, generator, seed, rounds, wind, turn timer, enabled shells, and per-shell ammo. Values are initialized from spec-backed registries.

Custom ammunition rules in Task 11 are limited to the screen contract already specified: HE is always enabled, locked, unlimited, and shown with its icon; other rows show spec-provided icons, enable toggles, and ammo controls. Bounds come from spec. Task 13 may extend validation but must not require replacing this model.

Persist the last valid configuration in localStorage under one versioned key. Decode unknown data defensively: reject wrong versions, unknown IDs, invalid shapes, disabled HE, or out-of-range values and fall back to defaults. Persistence stays outside `sim/`. URL world/generator/seed values may initialize a fresh configuration but do not silently overwrite later user choices unless explicitly present.

Random is represented as a map tile value. It is resolved to a concrete shipped world using the seeded RNG before ROUND_INTRO, while the original selection remains available for rematch semantics.

## Match runtime lifecycle

Extract the existing direct startup into a disposable match runtime:

- creates world, clock, effects, audio, renderer, reduced-motion listener, and controls;
- owns one animation-frame loop and stops scheduling after disposal;
- removes controls and media listeners on disposal;
- reports round completion and spent-shell recap to the app controller;
- never leaves multiple loops or input handlers alive after rematch/menu navigation.

Rematch derives a different seed, rebuilds terrain/world/runtime, and preserves all other settings. ROUND_OVER takes priority over title navigation while a completed match is being resolved.

## Visual design and motion

Follow `docs/05-flow.html` structure, not its literal styling. Reuse the current restrained artillery palette and icon system.

The title scene is canvas-only and implements all seven spec-listed elements: embers, drifting cloud bands, sweeping beams, waving flags, twinkling stars, pulsing muzzle glow, and periodic exchanged fire. It uses a deterministic local animation seed and bounded object pools. Reduced motion removes or slows decorative movement while leaving the title usable.

The HOWTO scene uses real precomputed/spec-backed shot samples and animates the sequence short → long → hit. It is explanatory history, not an aiming preview.

All controls are semantic buttons/inputs with visible focus, labels, disabled state, and keyboard operation. Every surface naming a shell pairs it with the `shell.icon` asset.

## Error handling

- Invalid persisted data falls back to defaults without blocking startup.
- Unknown URL IDs use existing world/generator resolvers.
- Random resolution always produces a shipped world and compatible generator.
- A failed canvas context leaves the DOM menu usable and suppresses only decoration.
- Repeated transition actions are idempotent; duplicate match starts are ignored while a runtime is active.

## Testing and acceptance mapping

Headless tests cover:

- Quick Start reaches ROUND_INTRO in exactly two reducer actions/clicks.
- Random appears among MAP tiles and nowhere as a separate menu command.
- Rematch preserves configuration deeply except for a changed seed.
- HE cannot be disabled and remains unlimited.
- Custom ammunition rows and ROUND_INTRO/deploy summary models pair every shell name with its spec icon.
- Valid settings survive storage encode/decode and reload; invalid storage falls back safely.
- Match runtime disposal prevents duplicate loops/listeners.
- Title animation includes all seven required systems with bounded work and honors reduced motion.

Browser verification covers TITLE animation, quick and custom paths, reload persistence, icon rendering, match completion/ROUND_OVER, rematch, loadout change, menu return, console health, and one reduced-motion pass.

Full `npm test` and strict TypeScript/Vite build must pass. Because C: is full, generated test/build temporary output may be redirected to D: without changing source or golden vectors.

## Stop condition

Stop at Task 11’s line: “The game has a front door.” Do not implement CPU aiming logic, Task 13 custom-game expansion, online play, or any backend.
