# Task 8 Worlds Part One Design

## Scope

Task 8 ships Terra, Vesper, and Ferrum as selectable simulation profiles without adding camera behavior or new terrain generators. All three remain at or below the no-camera width limit. Rust, Selene, Hollow, camera behavior, wrapping, and the `spires` and `plates` generators remain deferred to later tasks.

`spec/worlds.json`, `spec/constants.json`, `spec/shells.json`, and `spec/test-vectors.json` remain authoritative. Production code does not duplicate gameplay numbers from documentation, and golden vectors are never regenerated.

## World Model

`src/sim/worlds.ts` exposes typed profiles loaded from `spec/worlds.json`. A runtime world profile includes the raw world fields plus the base-gravity and wind-coefficient values imported from `spec/constants.json`. This makes the selected world the complete ballistics environment without changing the meaning of the existing spec `gravity` multiplier.

`GameState` owns its selected world. `createWorld(seed, { worldId })` resolves Terra by default and derives field width, wind behavior, ballistics, and flight-time scale from that profile. The existing explicit width and generator options remain available only as test fixtures; normal game construction uses the world profile. Task 8 uses `hills` terrain for all three shipped profiles because their named generators are implemented in Task 9.

Wind modes follow spec data: `none` produces zero wind, `fixed` chooses one seeded value at world creation and retains it across handoffs, and `reroll` chooses a seeded value at creation and each handoff.

## Ballistics API

`stepProjectile` receives a world-owned physics environment containing base gravity, gravity multiplier, wind coefficient, air drag, and current wind. It no longer imports gravity or wind acceleration constants directly. The fixed substep count and launch coefficient remain shared constants because Task 8 does not move them.

World-specific shell mass overrides are applied when a projectile launches, without mutating the imported shell definition. Projectile state records its effective mass separately from the shell. Terra uses every shell's spec mass unchanged.

## Reachability Validation and Overrides

At startup, each shipped world validates every flight-capable playable shell against that world's actual spawn gap, derived from the same spawn positions used by `createWorld`. Validation simulates a maximum-power, 45-degree, no-wind shot over flat ground using the real fixed-step ballistics code.

If a shell cannot cross the gap, a deterministic bounded search finds the largest effective mass that does cross it. The resulting value is stored in the world runtime profile's mass-override table. Repair Kit is excluded because it has no flight. Validation throws if no positive effective mass can make a flight-capable shell cross the gap. The current spec-backed Ferrum and 150 px spawn inset do not require the stale prose-described Mortar override; the validator, rather than that prose, decides whether an override exists.

## Flight Time Scaling

The render-loop policy owns a fractional carry value for flight scaling. For every normal fixed simulation step requested by the clock, AIM, RESOLVE, SETTLE, HANDOFF, and ROUND_OVER advance once. FLIGHT adds integer simulation steps according to the selected world's `flightTimeScale`, retaining any fractional remainder for later frames.

Every simulation call still advances by the existing fixed `DT`; scaling changes only how many fixed steps run. Hitstop continues to return zero steps and does not consume scale carry.

## Tests and Acceptance

Tests cover:

- Terra, Vesper, and Ferrum power-75 and power-100 HE ranges against imported golden vectors;
- power-100 range exceeding each shipped map width;
- watched power-100 flight time, after applying imported scale, remaining between the Task 8 bounds;
- fixed timestep identity across scale values, with only step count changing;
- world width, gravity, drag, wind, and wind mode coming from imported profiles;
- fixed, rerolled, and absent wind behavior;
- every flight-capable playable shell crossing each shipped world's spawn gap, plus a harsher synthetic profile proving runtime overrides work when required;
- no hardcoded field dimensions in simulation or rendering modules outside world/spec configuration;
- all previous tests and the strict production build remaining green.

Browser verification switches among the three profiles through query parameters, confirms each field fits without camera movement, fires representative shots, and checks for a clean console.

## Out of Scope

No camera, wide worlds, wrap behavior, new terrain generators, menu flow, or hand-tuned override values are added in Task 8.
