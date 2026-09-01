# Task 6: Feel Design

## Scope

Task 6 adds presentation feedback and animated terrain collapse: particles, screen
shake, direct-hit hitstop, muzzle flash, synthesized sound, and reduced-motion behavior.
It ends at Task 6's `Stop here` line. It does not add Task 7 weapons or loadouts.

## Source of Truth

Create `spec/effects.json` because Task 6 currently has no machine-readable effects
spec. It will contain every presentation tuning value. Code imports this file and does
not duplicate values from `TASKS.md`.

The config contains:

- direct-hit hitstop: 9 rendered frames;
- terrain-collapse cap: 2 vertical pixels per dirty column per simulation frame;
- reduced-motion particle multiplier: 0.25;
- frame budget: 16 ms;
- the reference performance shell ID: `mortar`, whose blast radius remains sourced
  from `spec/shells.json`;
- particle count/lifetime/speed/gravity, shake duration/amplitude/decay, muzzle-flash
  duration/radius, and synthesized audio envelope/frequency settings.

The additional aesthetic tuning is centralized in this new spec so later balancing
does not scatter unexplained numbers through rendering code.

## Event Boundary

Gameplay remains deterministic and DOM-free. `GameState` gains a short presentation
event queue. Simulation operations emit semantic events with field coordinates and
shell identity:

- `muzzleFlash` when a shot is successfully fired;
- `impact` for each resolved projectile impact;
- `directHit` when an impact point is inside either tank's hull box.

Events contain no Canvas, audio, or wall-clock state. The main loop drains them once
and forwards them to rendering and audio. Tests can therefore verify emission without
a browser.

A direct hit is geometrical: the impact point lies inside the half-open hull box built
from `spec/constants.json -> tank`. It is independent of owner and damage outcome.

## Visual Effects

`src/render/effects.ts` owns transient presentation state. It uses its own seeded
render RNG derived from the match seed, keeping screenshots repeatable without
consuming simulation RNG draws.

- Muzzle flash is a brief shell-colored bloom at the muzzle.
- Impact particles combine bright sparks and terrain-colored debris. Count scales
  with shell blast radius and is capped by the effects spec.
- Screen shake applies a decaying field-space translation. HUD remains stable because
  shake affects the world transform before terrain/entities, not the HUD overlay.
- Direct-hit hitstop freezes presentation-event aging and simulation advancement for
  the configured rendered-frame count. The browser frame loop continues drawing.

Trajectory animation is gameplay information and is never disabled.

## Reduced Motion

`matchMedia('(prefers-reduced-motion: reduce)')` is read outside `src/sim/`. A pure
`motionPolicy(reduced)` function returns the effective settings and is headlessly
tested.

Reduced motion:

- disables screen shake;
- disables hitstop;
- multiplies particle count by the configured 0.25;
- leaves projectile stepping and trajectory rendering enabled;
- retains muzzle flash and sound because neither moves the viewport nor stops time.

The media-query listener updates policy live if the preference changes during play.

## Terrain Collapse

`src/sim/collapse.ts` owns deterministic terrain settling. A collapse job contains a
set of dirty columns, never the full map. Each simulation frame, each queued column
moves unsupported solid pixels downward by no more than the configured 2 pixels.

Carves and fills enqueue their returned dirty range. Processing reports only columns
that changed so `terrainLayer` repaints those ranges. A column leaves the queue when a
pass makes no change. Collapse participates in SETTLE's movement/quiet decision and is
bounded by the existing settle hard exit.

The algorithm never scans columns outside the queued ranges. Tests instrument column
visits and assert this directly.

## Audio

`src/render/audio.ts` uses Web Audio oscillators and filtered noise, avoiding missing
binary assets and network dependencies. Audio starts only after the first keyboard
interaction so browser autoplay policy is respected.

It exposes `unlock()`, `playFire(shell)`, `playImpact(shell)`, and `playDirectHit()`.
If Web Audio is unavailable or suspended, calls are safe no-ops. Audio state never
enters simulation or replay data.

## Performance

Effects use pooled/preallocated particle objects, bounded counts, one Canvas state
save/restore per effect layer, and dirty-range terrain work. No particle allocates
during its per-frame update.

A benchmark test constructs the reference mortar blast using its radius from
`spec/shells.json`, runs full-particle update/draw work repeatedly after warmup, and
asserts the measured frame remains below the budget imported from `spec/effects.json`.
The browser smoke test also records representative frame durations to guard against a
headless benchmark that misses Canvas costs.

## Testing

Implementation follows red-green-refactor. Coverage includes:

- event emission and geometric direct-hit detection;
- exact normal and reduced-motion policies;
- trajectory stepping continuing under reduced motion;
- collapse changing only queued dirty columns and moving no column by more than the
  configured cap per frame;
- hitstop lasting exactly the configured rendered frames without consuming sim steps;
- particle count bounds and deterministic render RNG;
- audio calls remaining safe before unlock and when Web Audio is unavailable;
- the reference mortar blast staying below the configured frame budget;
- all Task 1-5 tests and the strict production build remaining green;
- browser verification of flash, particles, shake, hitstop, sound initialization,
  animated collapse, and reduced-motion behavior.

